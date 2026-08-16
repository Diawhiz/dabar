use crate::ffmpeg;
use crate::models::{Chapter, TranscriptSegment};
use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const GROQ_TRANSCRIPTIONS_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL: &str = "whisper-large-v3-turbo";

/// Selects the transcription engine.
///
/// - `Groq`: cloud API — fast speech-to-text via Groq Whisper Large v3 Turbo.
/// - `Local`: offline whisper.cpp via the `model_path` GGML model file.
#[derive(Debug, Clone)]
pub enum TranscriptionBackend {
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
// We trigger chunking fallback if compressed audio exceeds 24 MB or duration exceeds 20 minutes (1200s).
const GROQ_MAX_FILE_BYTES: u64 = 25 * 1024 * 1024; // 25 MB
const CHUNK_TRIGGER_BYTES: u64 = 24 * 1024 * 1024; // 24 MB
const CHUNK_TRIGGER_DURATION_SECS: f32 = 1200.0; // 20 minutes

// 15 minutes chunk duration with 5 seconds overlap
const CHUNK_DURATION_SECS: f32 = 900.0;
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

/// Builds domain-tailored prompt to steer Whisper toward Nigerian-accented English,
/// Christian preaching vocabulary, and custom church terminology.
pub fn build_whisper_prompt(custom_vocab: Option<&str>) -> String {
    let mut prompt = "Sermon transcript in Nigerian English, Christian preaching, Bible exposition, scripture readings, Yoruba interjections (Hallelujah, Amen, Pastor, Apostle, Jesus Christ, Holy Spirit, Jehovah, Lord God, Bible).".to_string();
    if let Some(vocab) = custom_vocab {
        let clean = vocab.trim();
        if !clean.is_empty() {
            prompt.push_str(" Church Vocabulary: ");
            prompt.push_str(clean);
        }
    }
    prompt
}

/// Transcribes an audio file using the specified backend.
///
/// - Preprocesses audio to high-clarity mono 16kHz 64kbps MP3.
/// - Splits large files into chunks automatically if using Groq.
/// - Injects domain-specific initial prompt and custom vocabulary for maximum accuracy.
/// - Calls `progress_callback` with a float 0.0–1.0 to report transcription progress.
pub async fn transcribe_audio(
    backend: &TranscriptionBackend,
    raw_audio_path: &Path,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<TranscriptionResult> {
    match backend {
        TranscriptionBackend::Groq { api_key } => {
            let segments = transcribe_audio_groq(api_key, raw_audio_path, custom_vocab, progress_callback).await?;
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

// ── Groq Whisper Implementation ─────────────────────────────────────────────

async fn transcribe_audio_groq(
    api_key: &str,
    raw_audio_path: &Path,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    let temp_dir = std::env::temp_dir().join(format!("dabar_whisper_{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .with_context(|| format!("creating temp directory {}", temp_dir.display()))?;

    if let Some(ref cb) = progress_callback {
        cb(0.05);
    }

    let result = transcribe_audio_internal(api_key, raw_audio_path, &temp_dir, custom_vocab, progress_callback).await;
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
        "Offline transcription is not yet enabled in this build. Please configure your Groq API key in Settings."
    )
}

async fn transcribe_audio_internal(
    api_key: &str,
    raw_audio_path: &Path,
    temp_dir: &Path,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    let preprocessed_path = temp_dir.join("preprocessed_mono16k.mp3");

    tracing::info!(
        "Preprocessing audio for Whisper (mono, 16kHz, 64kbps MP3): {}",
        raw_audio_path.display()
    );

    ffmpeg::preprocess_audio_for_whisper(raw_audio_path, &preprocessed_path).await?;

    if let Some(ref cb) = progress_callback {
        cb(0.15);
    }

    let metadata = tokio::fs::metadata(&preprocessed_path)
        .await
        .with_context(|| format!("reading metadata for {}", preprocessed_path.display()))?;

    let file_size = metadata.len();
    let size_mb = (file_size as f64) / (1024.0 * 1024.0);
    let duration = ffmpeg::get_media_duration(&preprocessed_path).await.unwrap_or(0.0);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .context("building reqwest client")?;

    let needs_chunking = file_size > CHUNK_TRIGGER_BYTES || duration >= CHUNK_TRIGGER_DURATION_SECS;

    if !needs_chunking {
        tracing::info!(
            "Preprocessed audio fits in single request ({size_mb:.2} MB, duration: {duration:.1}s)"
        );
        let res = transcribe_single_audio_file(&client, api_key, &preprocessed_path, 0.0, custom_vocab).await;
        if let Some(ref cb) = progress_callback {
            cb(1.0);
        }
        res
    } else {
        tracing::info!(
            "Preprocessed audio ({size_mb:.2} MB, duration: {duration:.1}s) triggers chunked transcription. Initiating parallel chunked flow..."
        );
        transcribe_chunked_audio(
            &client,
            api_key,
            &preprocessed_path,
            temp_dir,
            duration,
            custom_vocab,
            progress_callback,
        )
        .await
    }
}

async fn transcribe_single_audio_file(
    client: &reqwest::Client,
    api_key: &str,
    audio_path: &Path,
    time_offset: f32,
    custom_vocab: Option<&str>,
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

    let prompt = build_whisper_prompt(custom_vocab);

    let mut attempts = 0;
    let transcription: GroqTranscription = loop {
        attempts += 1;
        let file_part = Part::bytes(bytes.clone()).file_name(filename.clone());
        let form = Form::new()
            .text("model", WHISPER_MODEL)
            .text("language", "en")
            .text("temperature", "0.0")
            .text("prompt", prompt.clone())
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
    total_duration: f32,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    let duration = if total_duration > 0.0 {
        total_duration
    } else {
        ffmpeg::get_media_duration(audio_path).await?
    };

    tracing::info!(
        "Splitting audio of total duration {:.2}s into ~{:.0}s chunks with {:.0}s overlap",
        duration,
        CHUNK_DURATION_SECS,
        CHUNK_OVERLAP_SECS
    );

    let mut current_start: f32 = 0.0;
    let mut chunk_index: usize = 0;
    let mut join_set = tokio::task::JoinSet::new();
    let mut total_chunks = 0;
    let vocab_owned = custom_vocab.map(|s| s.to_string());

    // Overlap audio chunk extraction with immediate network dispatch
    while current_start < duration {
        let duration_to_extract = (duration - current_start).min(CHUNK_DURATION_SECS);
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

        let client_clone = client.clone();
        let api_key_clone = api_key.to_string();
        let file_path = chunk_file;
        let start_time = current_start;
        let idx = chunk_index;
        let vocab_clone = vocab_owned.clone();

        join_set.spawn(async move {
            let res = transcribe_single_audio_file(
                &client_clone,
                &api_key_clone,
                &file_path,
                0.0,
                vocab_clone.as_deref(),
            )
            .await;
            (idx, start_time, res)
        });

        let advance = CHUNK_DURATION_SECS - CHUNK_OVERLAP_SECS;
        current_start += advance;
        chunk_index += 1;
        total_chunks += 1;
    }

    if let Some(ref cb) = progress_callback {
        cb(0.25);
    }

    let mut chunk_results: Vec<(f32, Vec<TranscriptSegment>)> = Vec::new();
    let mut completed_chunks = 0;

    while let Some(res) = join_set.join_next().await {
        let (_idx, start_time, result) = res.context("joining chunk transcription task")?;
        let segments = result?;
        chunk_results.push((start_time, segments));
        completed_chunks += 1;

        if let Some(ref cb) = progress_callback {
            if total_chunks > 0 {
                let pct = 0.25 + 0.65 * (completed_chunks as f32 / total_chunks as f32);
                cb(pct.min(0.92));
            }
        }
    }

    if let Some(ref cb) = progress_callback {
        cb(0.95);
    }

    chunk_results.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let stitched = stitch_transcript_chunks(chunk_results);

    if let Some(ref cb) = progress_callback {
        cb(1.0);
    }

    Ok(stitched)
}

pub fn stitch_transcript_chunks(
    mut chunk_results: Vec<(f32, Vec<TranscriptSegment>)>,
) -> Vec<TranscriptSegment> {
    chunk_results.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let mut stitched: Vec<TranscriptSegment> = Vec::new();
    let mut last_end: f32 = 0.0;

    for (chunk_start, segments) in chunk_results {
        for mut seg in segments {
            let abs_start = seg.start + chunk_start;
            let abs_end = seg.end + chunk_start;
            seg.start = abs_start;
            seg.end = abs_end;

            if !stitched.is_empty() {
                // If segment completely falls inside previously covered time span, skip duplicate
                if abs_end <= last_end + 0.3 {
                    continue;
                }
                // If segment crosses the boundary, clamp start to last_end to prevent overlap
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
    fn test_build_whisper_prompt() {
        let prompt = build_whisper_prompt(Some("Olorun, Oluwa, Pastor Emmanuel"));
        assert!(prompt.contains("Nigerian English"));
        assert!(prompt.contains("Pastor Emmanuel"));
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

    #[test]
    fn test_stitch_multiple_overlapping_chunks() {
        let chunk0 = vec![
            TranscriptSegment {
                start: 0.0,
                end: 5.0,
                text: "In the beginning".into(),
            },
            TranscriptSegment {
                start: 5.0,
                end: 10.0,
                text: "God created the heavens".into(),
            },
        ];

        // Chunk 1 starts at 8.0s (2.0s overlap with Chunk 0's 8.0-10.0 range)
        let chunk1 = vec![
            // Duplicate segment from overlap (abs: 8.0 -> 9.8s <= 10.0s + 0.3s)
            TranscriptSegment {
                start: 0.0,
                end: 1.8,
                text: "created the heavens".into(),
            },
            // Overlap boundary segment (abs: 9.8 -> 14.0s) -> clamped to start at 10.0s
            TranscriptSegment {
                start: 1.8,
                end: 6.0,
                text: "and the earth.".into(),
            },
            // Subsequent normal segment (abs: 14.0 -> 20.0s)
            TranscriptSegment {
                start: 6.0,
                end: 12.0,
                text: "Now the earth was formless and empty.".into(),
            },
        ];

        let stitched = stitch_transcript_chunks(vec![(0.0, chunk0), (8.0, chunk1)]);
        assert_eq!(stitched.len(), 4);
        assert_eq!(stitched[0].text, "In the beginning");
        assert_eq!(stitched[0].start, 0.0);
        assert_eq!(stitched[0].end, 5.0);

        assert_eq!(stitched[1].text, "God created the heavens");
        assert_eq!(stitched[1].start, 5.0);
        assert_eq!(stitched[1].end, 10.0);

        // Clamped start
        assert_eq!(stitched[2].text, "and the earth.");
        assert_eq!(stitched[2].start, 10.0);
        assert_eq!(stitched[2].end, 14.0);

        assert_eq!(stitched[3].text, "Now the earth was formless and empty.");
        assert_eq!(stitched[3].start, 14.0);
        assert_eq!(stitched[3].end, 20.0);
    }

    #[test]
    fn test_stitch_out_of_order_chunks() {
        let chunk0 = vec![TranscriptSegment {
            start: 0.0,
            end: 5.0,
            text: "Part 1".into(),
        }];
        let chunk1 = vec![TranscriptSegment {
            start: 0.0,
            end: 5.0,
            text: "Part 2".into(),
        }];

        // Passed out of chronological order
        let stitched = stitch_transcript_chunks(vec![(10.0, chunk1), (0.0, chunk0)]);
        assert_eq!(stitched.len(), 2);
        assert_eq!(stitched[0].text, "Part 1");
        assert_eq!(stitched[0].start, 0.0);
        assert_eq!(stitched[1].text, "Part 2");
        assert_eq!(stitched[1].start, 10.0);
    }
}
