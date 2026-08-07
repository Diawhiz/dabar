use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use dabar_core::Sermon;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(health))
        .route("/health/", get(health))
        .route("/health", get(health))
        .route("/api/sermons/", get(list_sermons).post(create_sermon))
        .route("/api/sermons/{id}/", get(get_sermon))
        .route("/api/sermons/{id}/transcript/", get(get_transcript))
        .route("/api/sermons/{id}/transcribe/", post(queue_transcription))
        .route("/api/clips/{id}/download/", get(download_clip_by_id))
        .route("/api/clips/download/", get(download_clip_by_query))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
struct CreateSermonRequest {
    youtube_url: String,
}

#[derive(Debug, Deserialize)]
struct DownloadClipQuery {
    url: String,
    start: f32,
    end: f32,
}

#[derive(Debug, Serialize)]
struct ApiError {
    detail: String,
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "engine": "dabar-rust-axum"
    }))
}

async fn list_sermons(State(state): State<AppState>) -> impl IntoResponse {
    match state.list_sermons().await {
        Ok(sermons) => Json(sermons).into_response(),
        Err(error) => server_error(error),
    }
}

async fn create_sermon(
    State(state): State<AppState>,
    Json(payload): Json<CreateSermonRequest>,
) -> impl IntoResponse {
    let url = payload.youtube_url.trim().to_string();
    if url.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError {
                detail: "youtube_url is required.".to_string(),
            }),
        )
            .into_response();
    }

    let sermon = match state.insert_sermon(Sermon::queued(url.clone())).await {
        Ok(sermon) => sermon,
        Err(error) => return server_error(error),
    };

    // Clone owned variables before moving into the async move tokio::spawn task:
    // 1. `state_clone`: AppState wraps `AnyPool` (cheap pointer copy), needed for DB calls inside the spawned task.
    // 2. `sermon_id`: Uuid is Copy, identifies the sermon across pipeline stage DB writes.
    // 3. `youtube_url`: Owned String, required by yt-dlp to download sermon audio.
    let state_clone = state.clone();
    let sermon_id = sermon.id;
    let youtube_url = sermon.youtube_url.clone();

    tokio::spawn(async move {
        if let Err(err) = run_pipeline(state_clone.clone(), sermon_id, youtube_url).await {
            tracing::error!("Sermon pipeline failed for sermon {sermon_id}: {err:?}");
            if let Err(db_err) = state_clone.mark_failed(sermon_id, &err.to_string()).await {
                tracing::error!("Failed to record sermon failure in DB for {sermon_id}: {db_err:?}");
            }
        }
    });

    (StatusCode::CREATED, Json(sermon)).into_response()
}

async fn run_pipeline(
    state: AppState,
    sermon_id: Uuid,
    youtube_url: String,
) -> anyhow::Result<()> {
    let api_key = std::env::var("GROQ_API_KEY")
        .map_err(|_| anyhow::anyhow!("GROQ_API_KEY environment variable is not set"))?;

    // Stage 1: Downloading
    state.update_status(sermon_id, dabar_core::SermonStatus::Downloading).await?;
    let temp_dir = std::env::temp_dir().join(format!("dabar_{sermon_id}"));
    let downloaded = dabar_core::downloader::download_youtube_audio(&youtube_url, &temp_dir).await?;

    if let Some(title) = &downloaded.title {
        let _ = state.update_title(sermon_id, title).await;
    }

    // Stage 2: Transcribing
    state.update_status(sermon_id, dabar_core::SermonStatus::Transcribing).await?;
    let segments = dabar_core::whisper::transcribe_audio(&api_key, &downloaded.path).await?;

    // Clean up temporary audio file asynchronously
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    if segments.is_empty() {
        anyhow::bail!("Whisper transcription produced no text segments");
    }

    // Stage 3: Highlight Detection
    state.update_status(sermon_id, dabar_core::SermonStatus::Detecting).await?;
    let highlights = dabar_core::llm::detect_key_moments(&api_key, &segments).await?;

    // Stage 4: Commit Ready State & Save Results
    state
        .save_sermon_results(
            sermon_id,
            downloaded.title.as_deref(),
            &highlights,
            &segments,
        )
        .await?;

    tracing::info!("Sermon {sermon_id} pipeline completed successfully!");
    Ok(())
}

async fn get_sermon(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match state.get_sermon(id).await {
        Ok(Some(sermon)) => Json(sermon).into_response(),
        Ok(None) => not_found("Sermon not found."),
        Err(error) => server_error(error),
    }
}

async fn get_transcript(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match state.get_sermon(id).await {
        Ok(Some(sermon)) => Json(sermon.transcript_segments).into_response(),
        Ok(None) => not_found("Sermon not found."),
        Err(error) => server_error(error),
    }
}

async fn queue_transcription(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match state.get_sermon(id).await {
        Ok(Some(sermon)) => Json(sermon).into_response(),
        Ok(None) => not_found("Sermon not found."),
        Err(error) => server_error(error),
    }
}

async fn download_clip_by_id(Path(_id): Path<Uuid>) -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ApiError {
            detail: "Clip rendering will be enabled in the processing phase.".to_string(),
        }),
    )
}

async fn download_clip_by_query(Query(query): Query<DownloadClipQuery>) -> Response {
    let filename = format!("dabar-clip-{:.0}s.mp4", query.start.max(0.0));
    let detail = format!(
        "Clip rendering is queued for {} from {:.2}s to {:.2}s.",
        query.url, query.start, query.end
    );
    let mut response = (StatusCode::NOT_IMPLEMENTED, Json(ApiError { detail })).into_response();
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")).unwrap_or_else(
            |_| HeaderValue::from_static("attachment; filename=\"dabar-clip.mp4\""),
        ),
    );
    response
}

fn not_found(detail: &str) -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ApiError {
            detail: detail.to_string(),
        }),
    )
        .into_response()
}

fn server_error(error: anyhow::Error) -> Response {
    tracing::error!("{error:?}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ApiError {
            detail: "Dabar could not complete that request.".to_string(),
        }),
    )
        .into_response()
}

#[allow(dead_code)]
fn empty_mp4_response() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .body(Body::empty())
        .expect("empty response is valid")
}
