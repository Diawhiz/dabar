use crate::ffmpeg;
use crate::models::TranscriptSegment;
use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use std::path::{Path, PathBuf};

const GROQ_TRANSCRIPTIONS_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL: &str = "whisper-large-v3-turbo";

/// Selects the transcription engine.
///
/// - `Groq`: cloud API — fast, highest accuracy, requires internet and a Groq API key.
/// - `Local`: offline whisper.cpp via the `model_path` GGML model file.
///   Requires the `offline-whisper` cargo feature to be enabled.
#[derive(Debug, Clone)]
pub enum TranscriptionBackend {
    Groq { api_key: String },
    Local { model_path: PathBuf },
}

// Groq has a hard 25 MB payload limit.
// We trigger chunking fallback if compressed audio exceeds 24 MB (leaving safety margin for multipart headers).
const GROQ_MAX_FILE_BYTES: u64 = 25 * 1024 * 1024; // 25 MB
const CHUNK_TRIGGER_BYTES: u64 = 24 * 1024 * 1024; // 24 MB

// 30 minutes chunk duration with 5 seconds overlap (at 32kbps mono, 30 mins is ~7.2 MB, well under 25MB)
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

/// Transcribes an audio file using the specified backend.
///
/// - Preprocesses audio to the correct format for the chosen backend.
/// - Splits large files into chunks automatically.
/// - Calls `progress_callback` with a float 0.0–1.0 to report transcription progress.
pub async fn transcribe_audio(
    backend: &TranscriptionBackend,
    raw_audio_path: &Path,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    match backend {
        TranscriptionBackend::Groq { api_key } => {
            transcribe_audio_groq(api_key, raw_audio_path, progress_callback).await
        }
        TranscriptionBackend::Local { model_path } => {
            transcribe_audio_local(model_path, raw_audio_path, progress_callback).await
        }
    }
}

async fn transcribe_audio_groq(
    api_key: &str,
    raw_audio_path: &Path,
    progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    let temp_dir = std::env::temp_dir().join(format!("dabar_whisper_{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .with_context(|| format!("creating temp directory {}", temp_dir.display()))?;

    // Report initial progress
    if let Some(ref cb) = progress_callback { cb(0.05); }

    let result = transcribe_audio_internal(api_key, raw_audio_path, &temp_dir, progress_callback).await;

    // Clean up temporary audio files and chunks
    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    result
}

/// Offline transcription using a local whisper.cpp GGML model.
/// This is a placeholder; full whisper-rs integration is added in the offline-whisper feature.
async fn transcribe_audio_local(
    model_path: &std::path::PathBuf,
    _raw_audio_path: &Path,
    _progress_callback: Option<Box<dyn Fn(f32) + Send>>,
) -> Result<Vec<TranscriptSegment>> {
    if !model_path.exists() {
        anyhow::bail!(
            "Offline Whisper model not found at {}. \
             Please download a model in Settings → Transcription → Offline mode.",
            model_path.display()
        );
    }
    // TODO(offline-whisper): invoke whisper-rs here once the feature is enabled.
    // For now, return a clear error directing the user to enable cloud mode.
    anyhow::bail!(
        "Offline transcription is not yet enabled in this build. \
         Please switch to Cloud (Groq) mode in Settings to transcribe this sermon."
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

/// Transcribes a single audio file and returns segments with absolute timestamps offset by `time_offset`.
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

    // Debug log for monitoring margin against Groq's 25 MB limit
    tracing::info!(
        "Sending audio to Groq Whisper: {:.2} MB (file: '{}', offset: {:.2}s, max allowed: 25.00 MB)",
        size_mb,
        filename,
        time_offset
    );

    if file_size > GROQ_MAX_FILE_BYTES {
        tracing::error!(
            "Audio file '{}' ({:.2} MB) exceeds Groq Whisper 25 MB limit",
            filename,
            size_mb
        );
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
            Err(err) => return Err(err).context("sending Groq Whisper transcription request"),
        }
    };

    if let Some(segments) = transcription.segments {
        return Ok(segments
            .into_iter()
            .map(|segment| TranscriptSegment {
                start: segment.start + time_offset,
                end: segment.end + time_offset,
                text: segment.text,
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

/// Splits long audio into ~10-minute overlapping chunks, transcribes each concurrently in parallel,
/// and stitches segments while trimming duplicate overlapping text.
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

    tracing::info!(
        "Extracted {} chunks. Launching parallel transcription requests to Groq Whisper...",
        chunk_specs.len()
    );

    let mut join_set = tokio::task::JoinSet::new();
    for (idx, start_time, file_path) in chunk_specs {
        let client_clone = client.clone();
        let api_key_clone = api_key.to_string();
        join_set.spawn(async move {
            let res = transcribe_single_audio_file(&client_clone, &api_key_clone, &file_path, 0.0).await;
            (idx, start_time, res)
        });
    }

    let mut completed_chunks: Vec<(usize, f32, Vec<TranscriptSegment>)> = Vec::new();
    while let Some(res) = join_set.join_next().await {
        let (idx, start_time, transcript_res) = res.context("chunk transcription task panicked")?;
        let segments = transcript_res.with_context(|| format!("transcribing audio chunk #{idx}"))?;
        completed_chunks.push((idx, start_time, segments));
    }

    // Sort by chunk index to guarantee chronological order before stitching
    completed_chunks.sort_by_key(|(idx, _, _)| *idx);

    let chunk_results: Vec<(f32, Vec<TranscriptSegment>)> = completed_chunks
        .into_iter()
        .map(|(_, start_time, segs)| (start_time, segs))
        .collect();

    let stitched = stitch_transcript_chunks(chunk_results);
    tracing::info!(
        "Successfully parallel-transcribed and stitched {} chunks into {} total segments",
        chunk_index,
        stitched.len()
    );

    Ok(stitched)
}

/// Stitches chunked transcript segments together and trims duplicate words in the overlap zone.
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
                // If segment ends within the already transcribed region, skip it as duplicate overlap
                if abs_end <= last_end + 0.3 {
                    continue;
                }
                // If segment starts before the last recorded end, adjust start boundary
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
    fn test_stitch_overlapping_chunks_trims_overlap() {
        let chunk0 = vec![
            TranscriptSegment {
                start: 0.0,
                end: 5.0,
                text: "Part 1 start".into(),
            },
            TranscriptSegment {
                start: 5.0,
                end: 10.0,
                text: "Part 1 end".into(),
            },
        ];

        // Chunk 1 starts at 8.0s (2.0s overlap)
        // Local [0.0 - 1.8] -> Absolute [8.0 - 9.8] (overlap duplicate)
        // Local [2.2 - 6.0] -> Absolute [10.2 - 14.0] (new content)
        let chunk1 = vec![
            TranscriptSegment {
                start: 0.0,
                end: 1.8,
                text: "Part 1 end duplicate".into(),
            },
            TranscriptSegment {
                start: 2.2,
                end: 6.0,
                text: "Part 2 new content".into(),
            },
        ];

        let stitched = stitch_transcript_chunks(vec![(0.0, chunk0), (8.0, chunk1)]);
        assert_eq!(stitched.len(), 3);
        assert_eq!(stitched[0].text, "Part 1 start");
        assert_eq!(stitched[1].text, "Part 1 end");
        assert_eq!(stitched[2].text, "Part 2 new content");
        assert!((stitched[2].start - 10.2).abs() < 0.001);
        assert!((stitched[2].end - 14.0).abs() < 0.001);
    }
}
