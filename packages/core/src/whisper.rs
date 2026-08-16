use crate::ffmpeg;
use crate::models::{Chapter, TranscriptSegment};
use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

const GROQ_TRANSCRIPTIONS_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL: &str = "whisper-large-v3-turbo";

const ASSEMBLYAI_UPLOAD_URL: &str = "https://api.assemblyai.com/v2/upload";
const ASSEMBLYAI_TRANSCRIPT_URL: &str = "https://api.assemblyai.com/v2/transcript";

/// Selects the transcription engine.
///
/// - `AssemblyAI`: cloud API — automated speech-to-text and topic-based Auto-Chapters.
/// - `Groq`: cloud API — fast speech-to-text via Groq Whisper.
/// - `Local`: offline whisper.cpp via the `model_path` GGML model file.
#[derive(Debug, Clone)]
pub enum TranscriptionBackend {
    AssemblyAI { api_key: String },
    Groq { api_key: String },
    Local { model_path: PathBuf },
}

/// The unified output of the transcription stage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptSegment>,
    pub chapters: Vec<Chapter>,
}

// Groq has a hard 25 MB payload limit.
// We trigger chunking fallback if compressed audio exceeds 24 MB.
const GROQ_MAX_FILE_BYTES: u64 = 25 * 1024 * 1024; // 25 MB
const CHUNK_TRIGGER_BYTES: u64 = 24 * 1024 * 1024; // 24 MB

// 30 minutes chunk duration with 5 seconds overlap
const CHUNK_DURATION_SECS: f32 = 1800.0;
const CHUNK_OVERLAP_SECS: f32 = 5.0;

#[derive(Debug, Deserialize)]
struct GroqTranscription {
    segments: Option<Vec<GroqSegment>>,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GroqSegment {
    start: f32,
    end: f32,
    text: String,
}

// ── AssemblyAI Schema ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct AssemblyAIUploadResponse {
    upload_url: String,
}

#[derive(Debug, Serialize)]
struct AssemblyAITranscriptRequest {
    audio_url: String,
    auto_chapters: bool,
    punctuate: bool,
    format_text: bool,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AssemblyAITranscriptCreated {
    id: String,
    status: String,
    error: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AssemblyAIPollResponse {
    id: String,
    status: String,
    error: Option<String>,
    text: Option<String>,
    words: Option<Vec<AssemblyAIWord>>,
    chapters: Option<Vec<AssemblyAIChapter>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssemblyAIWord {
    pub text: String,
    pub start: u64, // ms
    pub end: u64,   // ms
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssemblyAIChapter {
    pub gist: Option<String>,
    pub headline: Option<String>,
    pub summary: Option<String>,
    pub start: u64, // ms
    pub end: u64,   // ms
}

/// Transcribes an audio file using the specified backend.
///
/// - Preprocesses audio to the correct format for the chosen backend.
/// - Splits large files into chunks automatically if using Groq.
/// - Performs async upload and auto-chaptering if using AssemblyAI.
/// - Calls `progress_callback` with a float 0.0–1.0 to report transcription progress.
pub async fn transcribe_audio(
    backend: &TranscriptionBackend,
    raw_audio_path: &Path,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<TranscriptionResult> {
    match backend {
        TranscriptionBackend::AssemblyAI { api_key } => {
            transcribe_audio_assemblyai(api_key, raw_audio_path, progress_callback).await
        }
        TranscriptionBackend::Groq { api_key } => {
            let segments = transcribe_audio_groq(api_key, raw_audio_path, progress_callback).await?;
            Ok(TranscriptionResult {
                segments,
                chapters: Vec::new(),
            })
        }
        TranscriptionBackend::Local { model_path } => {
            let segments = transcribe_audio_local(model_path, raw_audio_path, progress_callback).await?;
            Ok(TranscriptionResult {
                segments,
                chapters: Vec::new(),
            })
        }
    }
}

// ── AssemblyAI Implementation ───────────────────────────────────────────────

/// Transcribes and extracts Auto-Chapters using AssemblyAI.
async fn upload_with_retry(
    client: &reqwest::Client,
    api_key: &str,
    audio_bytes: Vec<u8>,
) -> Result<reqwest::Response> {
    let max_attempts = 3;
    let mut last_err = None;

    for attempt in 1..=max_attempts {
        tracing::info!("AssemblyAI upload attempt {attempt}/{max_attempts}...");
        match client
            .post(ASSEMBLYAI_UPLOAD_URL)
            .header("Authorization", api_key)
            .header("Content-Type", "application/octet-stream")
            .body(audio_bytes.clone())
            .send()
            .await
        {
            Ok(resp) => return Ok(resp),
            Err(e) => {
                tracing::warn!("AssemblyAI upload attempt {attempt} failed: {e}. {}",
                    if attempt < max_attempts { "Retrying..." } else { "Giving up." });
                last_err = Some(e);
                if attempt < max_attempts {
                    tokio::time::sleep(std::time::Duration::from_secs(3 * attempt)).await;
                }
            }
        }
    }

    Err(last_err.unwrap()).context("uploading audio to AssemblyAI (all attempts exhausted)")
}

async fn transcribe_audio_assemblyai(
    api_key: &str,
    raw_audio_path: &Path,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<TranscriptionResult> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        anyhow::bail!("AssemblyAI API key is missing. Please configure it in Settings.");
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .context("building reqwest client")?;

    if let Some(ref cb) = progress_callback {
        cb(0.05);
    }

    // Compress to mono 16kHz 32kbps before upload — raw YouTube-sourced audio (up to 128kbps)
    // can be 4-6x larger and risks the upload exceeding the client timeout on slower connections.
    let temp_dir = std::env::temp_dir().join(format!("dabar_assemblyai_{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .with_context(|| format!("creating temp directory {}", temp_dir.display()))?;
    let preprocessed_path = temp_dir.join("preprocessed_mono16k.mp3");
    ffmpeg::preprocess_audio_for_whisper(raw_audio_path, &preprocessed_path).await?;

    // Step 1: Upload audio file
    tracing::info!("Uploading sermon audio to AssemblyAI: {}", preprocessed_path.display());
    let audio_bytes = tokio::fs::read(&preprocessed_path)
        .await
        .with_context(|| format!("reading preprocessed audio file {}", preprocessed_path.display()))?;
    tracing::info!("Preprocessed audio size for AssemblyAI upload: {:.2} MB", audio_bytes.len() as f64 / 1_048_576.0);

    let upload_resp = upload_with_retry(&client, api_key, audio_bytes).await?;
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    if !upload_resp.status().is_success() {
        let status = upload_resp.status();
        let body = upload_resp.text().await.unwrap_or_default();
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            anyhow::bail!("AssemblyAI Authentication failed (HTTP {status}): Check your AssemblyAI API key in Settings.");
        }
        anyhow::bail!("AssemblyAI audio upload failed (HTTP {status}): {body}");
    }

    let upload_data: AssemblyAIUploadResponse = upload_resp
        .json()
        .await
        .context("parsing AssemblyAI upload response")?;

    if let Some(ref cb) = progress_callback {
        cb(0.20);
    }

    // Step 2: Submit transcription with Auto-Chapters
    tracing::info!("Submitting transcription request with Auto-Chapters to AssemblyAI...");
    let request_body = AssemblyAITranscriptRequest {
        audio_url: upload_data.upload_url,
        auto_chapters: true,
        punctuate: true,
        format_text: true,
    };

    let submit_resp = client
        .post(ASSEMBLYAI_TRANSCRIPT_URL)
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .context("submitting transcript request to AssemblyAI")?;

    if !submit_resp.status().is_success() {
        let status = submit_resp.status();
        let body = submit_resp.text().await.unwrap_or_default();
        anyhow::bail!("AssemblyAI transcript creation failed (HTTP {status}): {body}");
    }

    let created_data: AssemblyAITranscriptCreated = submit_resp
        .json()
        .await
        .context("parsing AssemblyAI transcript creation response")?;

    let transcript_id = created_data.id;
    let poll_url = format!("{ASSEMBLYAI_TRANSCRIPT_URL}/{transcript_id}");
    tracing::info!("AssemblyAI transcription job started: ID {transcript_id}");

    // Step 3: Polling loop
    let mut progress_pct: f32 = 0.25;
    let mut attempts = 0;
    let max_attempts = 300; // ~15 minutes max polling

    let poll_result: AssemblyAIPollResponse = loop {
        attempts += 1;
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;

        let poll_resp = client
            .get(&poll_url)
            .header("Authorization", api_key)
            .send()
            .await;

        let poll_resp = match poll_resp {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("AssemblyAI poll network warning: {e}. Retrying...");
                continue;
            }
        };

        if !poll_resp.status().is_success() {
            let status = poll_resp.status();
            tracing::warn!("AssemblyAI poll returned HTTP {status}. Retrying...");
            continue;
        }

        let poll_data: AssemblyAIPollResponse = match poll_resp.json().await {
            Ok(d) => d,
            Err(e) => {
                tracing::warn!("AssemblyAI poll JSON parsing warning: {e}. Retrying...");
                continue;
            }
        };

        match poll_data.status.as_str() {
            "completed" => {
                if let Some(ref cb) = progress_callback {
                    cb(1.0);
                }
                break poll_data;
            }
            "error" => {
                let err_msg = poll_data
                    .error
                    .unwrap_or_else(|| "Unknown AssemblyAI transcription error".to_string());
                anyhow::bail!("AssemblyAI transcription error: {err_msg}");
            }
            _ => {
                // Status is "queued" or "processing"
                progress_pct = (progress_pct + 0.02).min(0.95);
                if let Some(ref cb) = progress_callback {
                    cb(progress_pct);
                }
            }
        }

        if attempts >= max_attempts {
            anyhow::bail!("AssemblyAI transcription timed out after 15 minutes.");
        }
    };

    // Step 4: Map AssemblyAI response to TranscriptSegments and Chapters
    let segments = if let Some(words) = poll_result.words {
        words_to_segments(&words)
    } else if let Some(text) = poll_result.text {
        vec![TranscriptSegment {
            start: 0.0,
            end: 0.0,
            text,
        }]
    } else {
        Vec::new()
    };

    let chapters = if let Some(raw_chapters) = poll_result.chapters {
        raw_chapters
            .into_iter()
            .map(|c| {
                let title = c
                    .headline
                    .filter(|h| !h.trim().is_empty())
                    .or(c.gist)
                    .unwrap_or_else(|| "Key Topic".to_string());
                let summary = c.summary.unwrap_or_default();
                Chapter {
                    id: Uuid::new_v4(),
                    title,
                    summary,
                    start_time: (c.start as f32) / 1000.0,
                    end_time: (c.end as f32) / 1000.0,
                }
            })
            .collect()
    } else {
        Vec::new()
    };

    tracing::info!(
        "AssemblyAI transcription completed successfully: {} segments, {} chapters",
        segments.len(),
        chapters.len()
    );

    Ok(TranscriptionResult { segments, chapters })
}

/// Converts timestamped words into natural paragraph/sentence segments.
pub fn words_to_segments(words: &[AssemblyAIWord]) -> Vec<TranscriptSegment> {
    if words.is_empty() {
        return Vec::new();
    }
    let mut segments = Vec::new();
    let mut current_words: Vec<String> = Vec::new();
    let mut seg_start = (words[0].start as f32) / 1000.0;
    let mut seg_end = (words[0].end as f32) / 1000.0;

    for w in words {
        let text = w.text.trim().to_string();
        if text.is_empty() {
            continue;
        }
        if current_words.is_empty() {
            seg_start = (w.start as f32) / 1000.0;
        }
        seg_end = (w.end as f32) / 1000.0;
        current_words.push(text.clone());

        let ends_sentence = text.ends_with('.') || text.ends_with('?') || text.ends_with('!');
        let duration = seg_end - seg_start;
        let word_count = current_words.len();

        if ends_sentence || word_count >= 20 || (word_count >= 10 && duration >= 5.0) {
            segments.push(TranscriptSegment {
                start: seg_start,
                end: seg_end,
                text: current_words.join(" "),
            });
            current_words.clear();
        }
    }

    if !current_words.is_empty() {
        segments.push(TranscriptSegment {
            start: seg_start,
            end: seg_end,
            text: current_words.join(" "),
        });
    }

    segments
}

// ── Groq Whisper Implementation ─────────────────────────────────────────────

async fn transcribe_audio_groq(
    api_key: &str,
    raw_audio_path: &Path,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    let temp_dir = std::env::temp_dir().join(format!("dabar_whisper_{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .with_context(|| format!("creating temp directory {}", temp_dir.display()))?;

    if let Some(ref cb) = progress_callback {
        cb(0.05);
    }

    let result = transcribe_audio_internal(api_key, raw_audio_path, &temp_dir, progress_callback).await;
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;
    result
}

/// Offline transcription using a local whisper.cpp GGML model.
async fn transcribe_audio_local(
    model_path: &std::path::PathBuf,
    _raw_audio_path: &Path,
    _progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    if !model_path.exists() {
        anyhow::bail!(
            "Offline Whisper model not found at {}. Please download a model in Settings.",
            model_path.display()
        );
    }
    anyhow::bail!(
        "Offline transcription is not yet enabled in this build. Please configure an AssemblyAI API key in Settings."
    )
}

async fn transcribe_audio_internal(
    api_key: &str,
    raw_audio_path: &Path,
    temp_dir: &Path,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    let preprocessed_path = temp_dir.join("preprocessed_mono16k.mp3");

    tracing::info!(
        "Preprocessing audio for Whisper (mono, 16kHz, 32kbps MP3): {}",
        raw_audio_path.display()
    );

    ffmpeg::preprocess_audio_for_whisper(raw_audio_path, &preprocessed_path).await?;

    if let Some(ref cb) = progress_callback {
        cb(0.35);
    }

    let metadata = tokio::fs::metadata(&preprocessed_path)
        .await
        .with_context(|| format!("reading metadata for {}", preprocessed_path.display()))?;

    let file_size = metadata.len();
    let size_mb = (file_size as f64) / (1024.0 * 1024.0);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .context("building reqwest client")?;

    if file_size <= CHUNK_TRIGGER_BYTES {
        tracing::info!(
            "Preprocessed audio fits in single request ({size_mb:.2} MB <= 24.00 MB limit margin)"
        );
        let res = transcribe_single_audio_file(&client, api_key, &preprocessed_path, 0.0).await;
        if let Some(ref cb) = progress_callback {
            cb(1.0);
        }
        res
    } else {
        tracing::warn!(
            "Preprocessed audio ({size_mb:.2} MB) exceeds safe margin (24.00 MB). Initiating chunked transcription fallback..."
        );
        let res = transcribe_chunked_audio(&client, api_key, &preprocessed_path, temp_dir).await;
        if let Some(ref cb) = progress_callback {
            cb(1.0);
        }
        res
    }
}

async fn transcribe_single_audio_file(
    client: &reqwest::Client,
    api_key: &str,
    audio_path: &Path,
    time_offset: f32,
) -> Result<Vec<TranscriptSegment>> {
    let bytes = tokio::fs::read(audio_path)
        .await
        .with_context(|| format!("reading audio file {}", audio_path.display()))?;

    let file_size = bytes.len() as u64;
    let size_mb = (file_size as f64) / (1024.0 * 1024.0);
    let filename = audio_path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("audio.mp3")
        .to_string();

    tracing::info!(
        "Sending audio to Groq Whisper: {:.2} MB (file: '{}', offset: {:.2}s, max allowed: 25.00 MB)",
        size_mb,
        filename,
        time_offset
    );

    if file_size > GROQ_MAX_FILE_BYTES {
        anyhow::bail!(
            "Audio file ({:.2} MB) exceeds Groq Whisper 25 MB payload limit",
            size_mb
        );
    }

    let mut attempts = 0;
    let transcription: GroqTranscription = loop {
        attempts += 1;
        let file_part = Part::bytes(bytes.clone()).file_name(filename.clone());
        let form = Form::new()
            .text("model", WHISPER_MODEL)
            .text("response_format", "verbose_json")
            .part("file", file_part);

        let response = client
            .post(GROQ_TRANSCRIPTIONS_URL)
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                match resp.json::<GroqTranscription>().await {
                    Ok(data) => break data,
                    Err(err) => {
                        anyhow::bail!("parsing Groq Whisper response JSON: {}", err);
                    }
                }
            }
            Ok(resp)
                if (resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
                    || resp.status().is_server_error())
                    && attempts < 4 =>
            {
                let status = resp.status();
                let wait_secs = attempts * 3;
                tracing::warn!(
                    "Groq Whisper returned HTTP {} for '{}'. Retrying in {}s (attempt {}/4)...",
                    status,
                    filename,
                    wait_secs,
                    attempts
                );
                tokio::time::sleep(std::time::Duration::from_secs(wait_secs)).await;
            }
            Ok(resp) => {
                let status = resp.status();
                let error_body = resp.text().await.unwrap_or_default();
                anyhow::bail!(
                    "Groq Whisper transcription failed (HTTP {}): {}",
                    status,
                    error_body
                );
            }
            Err(err) if attempts < 4 => {
                let wait_secs = attempts * 3;
                tracing::warn!(
                    "Network error sending Groq Whisper request for '{}': {}. Retrying in {}s (attempt {}/4)...",
                    filename,
                    err,
                    wait_secs,
                    attempts
                );
                tokio::time::sleep(std::time::Duration::from_secs(wait_secs)).await;
            }
            Err(err) => {
                anyhow::bail!("sending Groq Whisper transcription request: {}", err);
            }
        }
    };

    if let Some(segments) = transcription.segments {
        return Ok(segments
            .into_iter()
            .map(|seg| TranscriptSegment {
                start: seg.start + time_offset,
                end: seg.end + time_offset,
                text: seg.text,
            })
            .collect());
    }

    Ok(transcription
        .text
        .map(|text| {
            vec![TranscriptSegment {
                start: time_offset,
                end: time_offset,
                text,
            }]
        })
        .unwrap_or_default())
}

async fn transcribe_chunked_audio(
    client: &reqwest::Client,
    api_key: &str,
    audio_path: &Path,
    chunk_dir: &Path,
) -> Result<Vec<TranscriptSegment>> {
    let total_duration = ffmpeg::get_media_duration(audio_path).await?;
    tracing::info!(
        "Splitting audio of total duration {:.2}s into ~{:.0}s chunks with {:.0}s overlap",
        total_duration,
        CHUNK_DURATION_SECS,
        CHUNK_OVERLAP_SECS
    );

    let mut chunk_specs: Vec<(usize, f32, std::path::PathBuf)> = Vec::new();
    let mut current_start: f32 = 0.0;
    let mut chunk_index: usize = 0;

    while current_start < total_duration {
        let duration_to_extract = (total_duration - current_start).min(CHUNK_DURATION_SECS);
        let chunk_file = chunk_dir.join(format!("chunk_{chunk_index:03}.mp3"));

        tracing::info!(
            "Extracting chunk #{chunk_index} (start: {current_start:.2}s, duration: {duration_to_extract:.2}s)..."
        );

        ffmpeg::extract_audio_chunk(
            audio_path,
            &chunk_file,
            current_start,
            duration_to_extract,
        )
        .await
        .with_context(|| format!("extracting audio chunk #{chunk_index}"))?;

        chunk_specs.push((chunk_index, current_start, chunk_file));

        let advance = CHUNK_DURATION_SECS - CHUNK_OVERLAP_SECS;
        current_start += advance;
        chunk_index += 1;
    }

    let mut join_set = tokio::task::JoinSet::new();
    for (idx, start_time, file_path) in chunk_specs {
        let client_clone = client.clone();
        let api_key_clone = api_key.to_string();
        join_set.spawn(async move {
            let res = transcribe_single_audio_file(&client_clone, &api_key_clone, &file_path, 0.0).await;
            (idx, start_time, res)
        });
    }

    let mut chunk_results: Vec<(f32, Vec<TranscriptSegment>)> = Vec::new();
    while let Some(res) = join_set.join_next().await {
        let (_idx, start_time, result) = res.context("joining chunk transcription task")?;
        let segments = result?;
        chunk_results.push((start_time, segments));
    }

    chunk_results.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    Ok(stitch_transcript_chunks(chunk_results))
}

pub fn stitch_transcript_chunks(
    chunk_results: Vec<(f32, Vec<TranscriptSegment>)>,
) -> Vec<TranscriptSegment> {
    let mut stitched: Vec<TranscriptSegment> = Vec::new();
    let mut last_end: f32 = 0.0;

    for (chunk_start, segments) in chunk_results {
        for mut seg in segments {
            let abs_start = seg.start + chunk_start;
            let abs_end = seg.end + chunk_start;
            seg.start = abs_start;
            seg.end = abs_end;

            if !stitched.is_empty() {
                if abs_end <= last_end + 0.3 {
                    continue;
                }
                if abs_start < last_end {
                    seg.start = last_end;
                }
            }

            if seg.end > seg.start {
                last_end = seg.end;
                stitched.push(seg);
            }
        }
    }

    stitched
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_words_to_segments() {
        let words = vec![
            AssemblyAIWord {
                text: "Grace".into(),
                start: 0,
                end: 500,
            },
            AssemblyAIWord {
                text: "and".into(),
                start: 550,
                end: 800,
            },
            AssemblyAIWord {
                text: "peace.".into(),
                start: 850,
                end: 1200,
            },
            AssemblyAIWord {
                text: "Welcome".into(),
                start: 1500,
                end: 2000,
            },
        ];

        let segs = words_to_segments(&words);
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0].text, "Grace and peace.");
        assert_eq!(segs[0].start, 0.0);
        assert_eq!(segs[0].end, 1.2);
        assert_eq!(segs[1].text, "Welcome");
    }

    #[test]
    fn test_stitch_single_chunk() {
        let chunk0 = vec![
            TranscriptSegment {
                start: 0.0,
                end: 5.0,
                text: "Hello world".into(),
            },
            TranscriptSegment {
                start: 5.0,
                end: 10.0,
                text: "Welcome to Dabar".into(),
            },
        ];

        let stitched = stitch_transcript_chunks(vec![(0.0, chunk0)]);
        assert_eq!(stitched.len(), 2);
        assert_eq!(stitched[0].start, 0.0);
        assert_eq!(stitched[1].end, 10.0);
    }
}
