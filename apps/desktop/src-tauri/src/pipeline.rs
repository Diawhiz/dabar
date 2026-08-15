use crate::db::Db;
use anyhow::Result;
use dabar_core::{Sermon, SermonStatus};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Progress event emitted to the frontend during pipeline execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineEvent {
    pub sermon_id: String,
    pub stage: String,
    pub progress: u8,   // 0-100 within current stage
    pub detail: String,
    pub is_error: bool,
    pub is_complete: bool,
}

/// Source input for the pipeline — YouTube URL, Google Drive share link, or local file path.
#[derive(Debug, Clone)]
pub enum PipelineSource {
    YouTube(String),
    GoogleDrive(String),
    LocalFile(PathBuf),
}

impl PipelineSource {
    pub fn from_str(source: &str) -> Self {
        let trimmed = source.trim();
        if trimmed.contains("youtube.com/") || trimmed.contains("youtu.be/") {
            PipelineSource::YouTube(trimmed.to_string())
        } else if dabar_core::downloader::is_gdrive_url(trimmed) {
            PipelineSource::GoogleDrive(trimmed.to_string())
        } else {
            PipelineSource::LocalFile(PathBuf::from(trimmed))
        }
    }

    /// The URL or path string to store in the database.
    pub fn as_stored_str(&self) -> String {
        match self {
            PipelineSource::YouTube(url) => url.clone(),
            PipelineSource::GoogleDrive(url) => url.clone(),
            PipelineSource::LocalFile(path) => path.to_string_lossy().to_string(),
        }
    }
}

/// Emit a progress event to the frontend.
fn emit(app: &AppHandle, sermon_id: Uuid, stage: &str, progress: u8, detail: &str) {
    let _ = app.emit(
        "pipeline-progress",
        PipelineEvent {
            sermon_id: sermon_id.to_string(),
            stage: stage.to_string(),
            progress,
            detail: detail.to_string(),
            is_error: false,
            is_complete: false,
        },
    );
}

fn emit_complete(app: &AppHandle, sermon_id: Uuid) {
    let _ = app.emit(
        "pipeline-progress",
        PipelineEvent {
            sermon_id: sermon_id.to_string(),
            stage: "ready".to_string(),
            progress: 100,
            detail: "Your sermon has been processed. Clips are ready to review.".to_string(),
            is_error: false,
            is_complete: true,
        },
    );
}

fn emit_error(app: &AppHandle, sermon_id: Uuid, error: &str) {
    let _ = app.emit(
        "pipeline-progress",
        PipelineEvent {
            sermon_id: sermon_id.to_string(),
            stage: "failed".to_string(),
            progress: 0,
            detail: error.to_string(),
            is_error: true,
            is_complete: false,
        },
    );
}

/// The main sermon processing pipeline.
///
/// Runs entirely in a background Tokio task (called via `tokio::spawn`).
/// Emits granular progress events to the frontend via Tauri's event system.
/// Writes pipeline checkpoints to SQLite after each major stage for crash recovery.
pub async fn run_pipeline(
    app: AppHandle,
    db: Db,
    sermon_id: Uuid,
    source: PipelineSource,
    api_key: String,
    transcription_backend: dabar_core::whisper::TranscriptionBackend,
    _output_dir: PathBuf,
) -> Result<()> {
    let temp_dir = std::env::temp_dir().join(format!("dabar_{sermon_id}"));
    tokio::fs::create_dir_all(&temp_dir).await?;

    // ── Stage 1: Download / Locate audio ─────────────────────────────────────

    db.update_status(sermon_id, SermonStatus::Downloading).await?;
    emit(&app, sermon_id, "downloading", 5, "Locating sermon audio…");

    let audio_path: PathBuf = match &source {
        PipelineSource::YouTube(url) => {
            emit(&app, sermon_id, "downloading", 10, "Downloading audio from YouTube…");
            let downloaded = dabar_core::downloader::download_youtube_audio(url, &temp_dir).await?;
            if let Some(title) = &downloaded.title {
                let _ = db.update_title(sermon_id, title).await;
            }
            db.save_checkpoint(sermon_id, "downloading", &downloaded.path.to_string_lossy()).await?;
            emit(&app, sermon_id, "downloading", 100, "Audio downloaded successfully.");
            downloaded.path
        }
        PipelineSource::GoogleDrive(url) => {
            emit(&app, sermon_id, "downloading", 10, "Downloading audio from Google Drive…");
            let downloaded = dabar_core::downloader::download_gdrive_audio(url, &temp_dir).await?;
            if let Some(title) = &downloaded.title {
                let _ = db.update_title(sermon_id, title).await;
            }
            db.save_checkpoint(sermon_id, "downloading", &downloaded.path.to_string_lossy()).await?;
            emit(&app, sermon_id, "downloading", 100, "Audio downloaded from Google Drive.");
            downloaded.path
        }
        PipelineSource::LocalFile(path) => {
            // Validate the file exists and is readable
            if !path.exists() {
                anyhow::bail!("Local file not found: {}", path.display());
            }
            // Derive title from filename
            let title = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Sermon");
            let _ = db.update_title(sermon_id, title).await;
            db.save_checkpoint(sermon_id, "downloading", &path.to_string_lossy()).await?;
            emit(&app, sermon_id, "downloading", 100, "Local file located.");
            path.clone()
        }
    };

    // ── Stage 2: Transcription ────────────────────────────────────────────────

    db.update_status(sermon_id, SermonStatus::Transcribing).await?;
    emit(&app, sermon_id, "transcribing", 5, "Preparing audio for transcription…");

    let segments = dabar_core::whisper::transcribe_audio(
        &transcription_backend,
        &audio_path,
        Some(Box::new({
            let app_clone = app.clone();
            move |progress_pct: f32| {
                let pct = (progress_pct * 100.0) as u8;
                emit(&app_clone, sermon_id, "transcribing", pct.min(95), "Transcribing sermon…");
            }
        })),
    )
    .await?;

    // Clean up temp download after successful transcription
    if matches!(source, PipelineSource::YouTube(_) | PipelineSource::GoogleDrive(_)) {
        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
    }

    if segments.is_empty() {
        anyhow::bail!("Transcription produced no text. The audio may be silent or unsupported.");
    }

    emit(&app, sermon_id, "transcribing", 100, "Transcription complete.");

    // ── Stage 3: Highlight detection (only in online mode with API key) ───────

    let highlights = if !api_key.is_empty()
        && matches!(transcription_backend, dabar_core::whisper::TranscriptionBackend::Groq { .. })
    {
        db.update_status(sermon_id, SermonStatus::Detecting).await?;
        emit(&app, sermon_id, "detecting", 10, "Analysing sermon for key moments…");

        let hl = dabar_core::llm::detect_sermon_highlights(&api_key, &segments).await?;
        emit(&app, sermon_id, "detecting", 100, "Key moments identified.");
        hl
    } else {
        // Offline mode: skip highlight detection, transcript-only
        tracing::info!("Offline mode or no API key — skipping highlight detection for {sermon_id}");
        Vec::new()
    };

    // ── Stage 4: Save results ─────────────────────────────────────────────────

    let stored_title = match &source {
        PipelineSource::YouTube(_) | PipelineSource::GoogleDrive(_) => None,
        PipelineSource::LocalFile(p) => p.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string()),
    };

    db.save_sermon_results(
        sermon_id,
        stored_title.as_deref(),
        &highlights,
        &segments,
    )
    .await?;

    db.delete_checkpoint(sermon_id).await?;

    tracing::info!("Pipeline completed successfully for sermon {sermon_id}");
    emit_complete(&app, sermon_id);
    Ok(())
}

/// Handles a failed pipeline run: marks the sermon as failed in the DB,
/// emits an error event to the frontend, and logs the error.
pub async fn handle_pipeline_failure(
    app: &AppHandle,
    db: &Db,
    sermon_id: Uuid,
    err: anyhow::Error,
) {
    let msg = err.to_string();
    tracing::error!("Pipeline failed for sermon {sermon_id}: {err:?}");
    if let Err(db_err) = db.mark_failed(sermon_id, &msg).await {
        tracing::error!("Failed to record pipeline failure in DB: {db_err:?}");
    }
    emit_error(app, sermon_id, &msg);
}

/// Render a vertical video clip to disk (replaces HTTP streaming download).
/// Returns the path of the output file.
pub async fn render_clip_to_disk(
    sermon: &Sermon,
    highlight_id: Uuid,
    output_dir: &Path,
) -> Result<PathBuf> {
    let highlight = sermon
        .highlights
        .iter()
        .find(|h| h.id == highlight_id)
        .ok_or_else(|| anyhow::anyhow!("Highlight {highlight_id} not found in sermon"))?;

    tokio::fs::create_dir_all(output_dir).await?;

    let safe_title: String = highlight
        .title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(60)
        .collect();
    let output_path = output_dir.join(format!("dabar_{safe_title}.mp4"));

    // For local files, use the source path directly; for YouTube, resolve stream URL.
    let input_source: String = if sermon.youtube_url.starts_with('/') || {
        let p = std::path::Path::new(&sermon.youtube_url);
        p.exists()
    } {
        sermon.youtube_url.clone()
    } else {
        dabar_core::downloader::resolve_stream_url(&sermon.youtube_url).await?
    };

    dabar_core::ffmpeg::extract_vertical_clip(
        &input_source,
        &output_path,
        highlight.start_time,
        highlight.end_time,
    )
    .await?;

    Ok(output_path)
}
