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

async fn list_sermons(State(state): State<AppState>) -> Json<Vec<Sermon>> {
    Json(state.list_sermons())
}

async fn create_sermon(
    State(state): State<AppState>,
    Json(payload): Json<CreateSermonRequest>,
) -> impl IntoResponse {
    if payload.youtube_url.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError {
                detail: "youtube_url is required.".to_string(),
            }),
        )
            .into_response();
    }

    let sermon = state.insert_sermon(Sermon::queued(payload.youtube_url));
    (StatusCode::CREATED, Json(sermon)).into_response()
}

async fn get_sermon(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match state.get_sermon(id) {
        Some(sermon) => Json(sermon).into_response(),
        None => not_found("Sermon not found."),
    }
}

async fn get_transcript(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match state.get_sermon(id) {
        Some(sermon) => Json(sermon.transcript_segments).into_response(),
        None => not_found("Sermon not found."),
    }
}

async fn queue_transcription(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match state.get_sermon(id) {
        Some(sermon) => Json(sermon).into_response(),
        None => not_found("Sermon not found."),
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

#[allow(dead_code)]
fn empty_mp4_response() -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/mp4")
        .body(Body::empty())
        .expect("empty response is valid")
}
