use crate::ffmpeg;
use crate::models::{Chapter, TranscriptSegment};
use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;

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

const CHUNK_TRIGGER_BYTES: u64 = 24 * 1024 * 1024; // 24 MB
const CHUNK_TRIGGER_DURATION_SECS: f32 = 1200.0; // 20 minutes
const CHUNK_DURATION_SECS: f32 = 900.0; // 15 minutes
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

pub async fn transcribe_audio(
    backend: &TranscriptionBackend,
    raw_audio_path: &Path,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
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
            let segments = transcribe_audio_local(model_path, raw_audio_path, custom_vocab, progress_callback).await?;
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
    progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
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

// ── Local Whisper.cpp Implementation ────────────────────────────────────────

pub async fn transcribe_audio_local(
    model_path: &Path,
    raw_audio_path: &Path,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
) -> Result<Vec<TranscriptSegment>> {
    // Resolve effective model path — prefer tiny for speed
    let effective_model_path: PathBuf = if model_path.exists() {
        model_path.to_path_buf()
    } else {
        let mut candidates = Vec::new();
        // Always prefer tiny over base for speed
        if let Some(parent) = model_path.parent() {
            candidates.push(parent.join("ggml-tiny.bin"));
            candidates.push(parent.join("ggml-base.bin"));
        }
        for env_var in &["APPDATA", "LOCALAPPDATA"] {
            if let Ok(val) = std::env::var(env_var) {
                let base_p = PathBuf::from(&val);
                for dir_name in &["dabar", "com.preshdevops.dabar", "com.dabar.app"] {
                    candidates.push(base_p.join(dir_name).join("whisper-models").join("ggml-tiny.bin"));
                    candidates.push(base_p.join(dir_name).join("whisper-models").join("ggml-base.bin"));
                }
            }
        }
        candidates
            .into_iter()
            .find(|p| p.exists())
            .unwrap_or_else(|| model_path.to_path_buf())
    };

    if !effective_model_path.exists() {
        anyhow::bail!(
            "Offline Whisper model not found at {}. Please run setup in Onboarding or Settings to download the offline speech model.",
            model_path.display()
        );
    }

    tracing::info!(
        "Using Whisper model: {} ({:.1} MB)",
        effective_model_path.display(),
        effective_model_path.metadata().map(|m| m.len() as f64 / 1_048_576.0).unwrap_or(0.0)
    );

    let temp_dir = std::env::temp_dir().join(format!("dabar_local_whisper_{}", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .with_context(|| format!("creating temp directory {}", temp_dir.display()))?;

    if let Some(ref cb) = progress_callback {
        cb(0.05);
    }

    // Convert to 16kHz mono WAV
    let wav_path = temp_dir.join("input_16k.wav");
    tracing::info!("Converting audio to 16kHz mono WAV for local Whisper: {}", raw_audio_path.display());
    ffmpeg::convert_audio_to_wav_16k(raw_audio_path, &wav_path).await?;

    if let Some(ref cb) = progress_callback {
        cb(0.10);
    }

    // Get audio duration to decide chunking strategy
    let duration = ffmpeg::get_media_duration(&wav_path).await.unwrap_or(0.0);
    tracing::info!("Audio duration: {duration:.1}s ({:.1} minutes)", duration / 60.0);

    // ── Chunked parallel transcription for audio > 3 minutes ─────────────────
    const LOCAL_CHUNK_SECS: f32 = 300.0;     // 5 minutes per chunk
    const LOCAL_OVERLAP_SECS: f32 = 3.0;     // 3s overlap for stitching
    const MIN_CHUNK_DURATION: f32 = 180.0;   // Only chunk if > 3 minutes

    let segments = if duration > MIN_CHUNK_DURATION {
        transcribe_local_chunked(
            &effective_model_path,
            &wav_path,
            &temp_dir,
            duration,
            LOCAL_CHUNK_SECS,
            LOCAL_OVERLAP_SECS,
            custom_vocab,
            progress_callback.as_ref(),
        ).await?
    } else {
        // Short audio — single pass
        run_single_whisper_pass(
            &effective_model_path,
            &wav_path,
            &temp_dir.join("full"),
            custom_vocab,
            0.0,
        ).await?
    };

    if let Some(ref cb) = progress_callback {
        cb(1.0);
    }

    let _ = tokio::fs::remove_dir_all(&temp_dir).await;

    if segments.is_empty() {
        anyhow::bail!("Whisper transcription produced no text. The audio may be silent or unsupported.");
    }

    Ok(segments)
}

/// Split audio into chunks and run whisper-cli on them in parallel.
async fn transcribe_local_chunked(
    model_path: &Path,
    wav_path: &Path,
    temp_dir: &Path,
    total_duration: f32,
    chunk_secs: f32,
    overlap_secs: f32,
    custom_vocab: Option<&str>,
    progress_callback: Option<&Box<dyn Fn(f32) + Send + Sync>>,
) -> Result<Vec<TranscriptSegment>> {
    // Build chunk list
    let mut chunks: Vec<(f32, f32)> = Vec::new();
    let mut start = 0.0_f32;
    while start < total_duration {
        let end = (start + chunk_secs).min(total_duration);
        chunks.push((start, end));
        start = end - overlap_secs;
        if total_duration - start < 10.0 { break; } // don't create tiny trailing chunks
    }

    let num_chunks = chunks.len();
    tracing::info!(
        "Splitting {:.0}s audio into {} chunks of ~{:.0}s each for parallel processing",
        total_duration, num_chunks, chunk_secs
    );

    // Extract audio chunks via ffmpeg (very fast, < 1s each)
    let mut chunk_paths = Vec::new();
    for (i, (start, end)) in chunks.iter().enumerate() {
        let chunk_wav = temp_dir.join(format!("chunk_{i:03}.wav"));
        let duration = end - start;
        ffmpeg::extract_audio_chunk_wav(wav_path, &chunk_wav, *start, duration).await?;
        chunk_paths.push((i, *start, chunk_wav));
    }

    if let Some(cb) = progress_callback {
        cb(0.15);
    }

    // Use 1 whisper process with all CPU threads to avoid duplicate model instances in RAM
    let total_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let max_parallel = 1;
    let threads_per_process = total_cores.clamp(2, 8);

    tracing::info!(
        "Running whisper-cli with {} threads (single-process mode for low RAM footprint)",
        threads_per_process
    );

    // Process chunks with bounded concurrency
    let model_path = model_path.to_path_buf();
    let custom_vocab_owned = custom_vocab.map(|s| s.to_string());

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(max_parallel));
    let completed = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

    let mut handles = Vec::new();
    for (i, offset, chunk_wav) in chunk_paths {
        let model = model_path.clone();
        let vocab = custom_vocab_owned.clone();
        let chunk_temp = temp_dir.join(format!("out_{i:03}"));
        let sem = semaphore.clone();
        let done = completed.clone();
        let n_chunks = num_chunks;

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();

            tracing::info!("Processing chunk {}/{} (offset {:.0}s)", i + 1, n_chunks, offset);

            let result = run_single_whisper_pass_with_threads(
                &model,
                &chunk_wav,
                &chunk_temp,
                vocab.as_deref(),
                offset,
                threads_per_process,
            ).await;

            let finished = done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            tracing::info!("Chunk {}/{} done ({}/{})", i + 1, n_chunks, finished, n_chunks);

            (offset, result)
        });
        handles.push(handle);
    }

    // Collect results
    let mut chunk_results = Vec::new();
    for handle in handles {
        let (offset, result) = handle.await.context("joining chunk transcription task")?;
        match result {
            Ok(segments) => {
                chunk_results.push((offset, segments));
                if let Some(cb) = progress_callback {
                    let progress = 0.15 + 0.80 * (chunk_results.len() as f32 / num_chunks as f32);
                    cb(progress);
                }
            }
            Err(e) => {
                tracing::warn!("Chunk at offset {offset:.0}s failed: {e}. Skipping.");
                // Don't fail entire transcription for one bad chunk
            }
        }
    }

    if chunk_results.is_empty() {
        anyhow::bail!("All audio chunks failed transcription.");
    }

    Ok(stitch_transcript_chunks(chunk_results))
}

/// Run a single whisper-cli invocation. `time_offset` shifts all timestamps.
async fn run_single_whisper_pass(
    model_path: &Path,
    wav_path: &Path,
    output_dir: &Path,
    custom_vocab: Option<&str>,
    time_offset: f32,
) -> Result<Vec<TranscriptSegment>> {
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().clamp(4, 16))
        .unwrap_or(4);
    run_single_whisper_pass_with_threads(model_path, wav_path, output_dir, custom_vocab, time_offset, threads).await
}

/// Run a single whisper-cli invocation with explicit thread count.
async fn run_single_whisper_pass_with_threads(
    model_path: &Path,
    wav_path: &Path,
    output_dir: &Path,
    custom_vocab: Option<&str>,
    time_offset: f32,
    num_threads: usize,
) -> Result<Vec<TranscriptSegment>> {
    tokio::fs::create_dir_all(output_dir).await?;

    let output_prefix = output_dir.join("transcription");
    let json_output_path = output_dir.join("transcription.json");

    let (whisper_bin_dir, mut cmd) = get_binary_command("whisper-cli");
    if let Some(ref bin_dir) = whisper_bin_dir {
        cmd.current_dir(bin_dir);
    }
    cmd.arg("-m")
        .arg(model_path)
        .arg("-f")
        .arg(wav_path)
        .arg("-oj")
        .arg("-of")
        .arg(&output_prefix)
        .arg("-l")
        .arg("en")
        .arg("-t")
        .arg(num_threads.to_string())
        // ── Speed-first flags ───────────────────────────────────
        .arg("-bs").arg("1")        // greedy decoding — fastest possible
        .arg("-bo").arg("1")        // single candidate
        .arg("--no-prints");        // suppress verbose logs

    if let Some(vocab) = custom_vocab {
        let clean = vocab.trim();
        if !clean.is_empty() {
            cmd.arg("--prompt").arg(clean);
        }
    }

    let output = cmd.output().await;

    let mut segments = match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);

            // 1. JSON output file
            if json_output_path.exists() {
                if let Ok(json_str) = tokio::fs::read_to_string(&json_output_path).await {
                    if let Ok(segs) = parse_whisper_cpp_json(&json_str) {
                        return Ok(offset_segments(segs, time_offset));
                    }
                }
            }

            // 2. Any .json file in output dir
            if let Ok(mut entries) = tokio::fs::read_dir(output_dir).await {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let p = entry.path();
                    if p.extension().and_then(|e| e.to_str()) == Some("json") {
                        if let Ok(json_str) = tokio::fs::read_to_string(&p).await {
                            if let Ok(segs) = parse_whisper_cpp_json(&json_str) {
                                return Ok(offset_segments(segs, time_offset));
                            }
                        }
                    }
                }
            }

            // 3. Text output from stdout/stderr
            if let Ok(segs) = parse_whisper_cpp_text_output(&stdout) {
                segs
            } else if let Ok(segs) = parse_whisper_cpp_text_output(&stderr) {
                segs
            } else if !out.status.success() {
                let err_msg = if !stderr.trim().is_empty() {
                    stderr.trim().to_string()
                } else if !stdout.trim().is_empty() {
                    stdout.trim().to_string()
                } else {
                    format!("whisper-cli exited with status code {:?}", out.status.code())
                };
                anyhow::bail!("local whisper-cli error: {}", err_msg);
            } else {
                anyhow::bail!("whisper-cli produced no recognizable transcription output");
            }
        }
        Err(e) => {
            anyhow::bail!(
                "Could not execute whisper-cli binary ({}). Please install offline tools in Settings.",
                e
            );
        }
    };

    // Apply time offset for chunked processing
    if time_offset > 0.1 {
        for seg in &mut segments {
            seg.start += time_offset;
            seg.end += time_offset;
        }
    }

    Ok(segments)
}

/// Shift all segment timestamps by a fixed offset.
fn offset_segments(mut segments: Vec<TranscriptSegment>, offset: f32) -> Vec<TranscriptSegment> {
    if offset > 0.1 {
        for seg in &mut segments {
            seg.start += offset;
            seg.end += offset;
        }
    }
    segments
}

pub fn parse_whisper_cpp_json(json_str: &str) -> Result<Vec<TranscriptSegment>> {
    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .context("parsing whisper-cli JSON output")?;

    let mut segments = Vec::new();

    // Format 1: "transcription": [ { "offsets": { "from": 0, "to": 4500 }, "text": "..." }, ... ]
    if let Some(arr) = parsed.get("transcription").and_then(|v| v.as_array()) {
        for item in arr {
            let text = item.get("text").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            if text.is_empty() {
                continue;
            }

            let mut start_sec = 0.0;
            let mut end_sec = 0.0;

            if let Some(offsets) = item.get("offsets") {
                let from_ms = offsets.get("from").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let to_ms = offsets.get("to").and_then(|v| v.as_f64()).unwrap_or(0.0);
                start_sec = (from_ms / 1000.0) as f32;
                end_sec = (to_ms / 1000.0) as f32;
            } else if let Some(timestamps) = item.get("timestamps") {
                if let Some(from_str) = timestamps.get("from").and_then(|v| v.as_str()) {
                    start_sec = parse_whisper_timestamp_str(from_str).unwrap_or(0.0);
                }
                if let Some(to_str) = timestamps.get("to").and_then(|v| v.as_str()) {
                    end_sec = parse_whisper_timestamp_str(to_str).unwrap_or(0.0);
                }
            }

            if end_sec <= start_sec {
                end_sec = start_sec + 3.0;
            }

            segments.push(TranscriptSegment {
                start: start_sec,
                end: end_sec,
                text,
            });
        }
    }

    // Format 2: "segments": [ { "start": 0.0, "end": 4.5, "text": "..." } ]
    if segments.is_empty() {
        if let Some(arr) = parsed.get("segments").and_then(|v| v.as_array()) {
            for item in arr {
                let text = item.get("text").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                if text.is_empty() {
                    continue;
                }
                let start = item.get("start").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                let end = item.get("end").and_then(|v| v.as_f64()).unwrap_or((start + 3.0) as f64) as f32;
                segments.push(TranscriptSegment { start, end, text });
            }
        }
    }

    if segments.is_empty() {
        anyhow::bail!("whisper-cli JSON output contained no transcription segments");
    }

    Ok(segments)
}

pub fn parse_whisper_cpp_text_output(text_out: &str) -> Result<Vec<TranscriptSegment>> {
    let mut segments = Vec::new();

    // Parse lines like: [00:00:00.000 --> 00:00:05.000]   Good morning church...
    for line in text_out.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.contains("-->") {
            if let Some(close_bracket) = trimmed.find(']') {
                let time_part = &trimmed[1..close_bracket];
                let text_part = trimmed[close_bracket + 1..].trim().to_string();

                let parts: Vec<&str> = time_part.split("-->").collect();
                if parts.len() == 2 && !text_part.is_empty() {
                    let start = parse_whisper_timestamp_str(parts[0].trim()).unwrap_or(0.0);
                    let end = parse_whisper_timestamp_str(parts[1].trim()).unwrap_or(start + 3.0);
                    segments.push(TranscriptSegment {
                        start,
                        end,
                        text: text_part,
                    });
                }
            }
        }
    }

    if segments.is_empty() {
        anyhow::bail!("could not parse segments from whisper-cli output");
    }

    Ok(segments)
}

fn parse_whisper_timestamp_str(ts: &str) -> Option<f32> {
    let clean = ts.trim().replace(',', ".");
    let parts: Vec<&str> = clean.split(':').collect();
    if parts.len() == 3 {
        let hrs: f32 = parts[0].parse().ok()?;
        let mins: f32 = parts[1].parse().ok()?;
        let secs: f32 = parts[2].parse().ok()?;
        Some(hrs * 3600.0 + mins * 60.0 + secs)
    } else if parts.len() == 2 {
        let mins: f32 = parts[0].parse().ok()?;
        let secs: f32 = parts[1].parse().ok()?;
        Some(mins * 60.0 + secs)
    } else {
        clean.parse().ok()
    }
}

async fn transcribe_audio_internal(
    api_key: &str,
    raw_audio_path: &Path,
    temp_dir: &Path,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
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
        "Sending audio to Groq Whisper: {:.2} MB (file: '{}', offset: {:.2}s)",
        size_mb,
        filename,
        time_offset
    );

    let prompt = build_whisper_prompt(custom_vocab);

    // Retry loop with exponential backoff (handles connection resets, rate limits, 5xx errors)
    let max_retries = 4;
    let mut last_err = anyhow::anyhow!("unknown transcription error");

    for attempt in 1..=max_retries {
        let part = Part::bytes(bytes.clone())
            .file_name(filename.clone())
            .mime_str("audio/mpeg")
            .context("creating multipart part")?;

        let form = Form::new()
            .text("model", WHISPER_MODEL)
            .text("response_format", "verbose_json")
            .text("prompt", prompt.clone())
            .part("file", part);

        match client
            .post(GROQ_TRANSCRIPTIONS_URL)
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await
        {
            Ok(res) => {
                let status = res.status();
                if status.is_success() {
                    let parsed: GroqTranscription = res
                        .json()
                        .await
                        .context("parsing Groq verbose_json response")?;

                    let mut segments = Vec::new();
                    if let Some(groq_segments) = parsed.segments {
                        for seg in groq_segments {
                            let start = seg.start + time_offset;
                            let end = seg.end + time_offset;
                            let text = seg.text.trim().to_string();
                            if !text.is_empty() {
                                segments.push(TranscriptSegment { start, end, text });
                            }
                        }
                    } else if let Some(full_text) = parsed.text {
                        let clean = full_text.trim().to_string();
                        if !clean.is_empty() {
                            let duration = ffmpeg::get_media_duration(audio_path).await.unwrap_or(30.0);
                            segments.push(TranscriptSegment {
                                start: time_offset,
                                end: time_offset + duration,
                                text: clean,
                            });
                        }
                    }
                    return Ok(segments);
                }

                let body = res.text().await.unwrap_or_default();
                let is_retryable = status.as_u16() == 429 || status.is_server_error();
                if is_retryable && attempt < max_retries {
                    let backoff = std::time::Duration::from_secs(2u64.pow(attempt));
                    tracing::warn!(
                        "Groq API returned HTTP {status} (attempt {attempt}/{max_retries}). Retrying in {backoff:?}... Details: {body}"
                    );
                    tokio::time::sleep(backoff).await;
                    last_err = anyhow::anyhow!("Groq API error ({status}): {body}");
                    continue;
                } else {
                    anyhow::bail!("Groq API error ({status}): {body}");
                }
            }
            Err(e) => {
                let backoff = std::time::Duration::from_secs(2u64.pow(attempt));
                tracing::warn!(
                    "Groq request network error on attempt {attempt}/{max_retries}: {e}. Retrying in {backoff:?}..."
                );
                last_err = anyhow::anyhow!("sending transcription request to Groq API: {e}");
                if attempt < max_retries {
                    tokio::time::sleep(backoff).await;
                }
            }
        }
    }

    Err(last_err)
}

async fn transcribe_chunked_audio(
    client: &reqwest::Client,
    api_key: &str,
    preprocessed_path: &Path,
    temp_dir: &Path,
    total_duration: f32,
    custom_vocab: Option<&str>,
    progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
) -> Result<Vec<TranscriptSegment>> {
    let mut chunk_plan = Vec::new();
    let mut current_start = 0.0;

    while current_start < total_duration {
        let chunk_dur = CHUNK_DURATION_SECS.min(total_duration - current_start);
        chunk_plan.push((current_start, chunk_dur));
        current_start += CHUNK_DURATION_SECS - CHUNK_OVERLAP_SECS;
    }

    let total_chunks = chunk_plan.len();
    tracing::info!(
        "Audio duration: {total_duration:.1}s. Splitting into {total_chunks} overlapping chunks."
    );

    // Limit concurrent requests to 2 to prevent TCP connection resets and rate limits
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(2));
    let mut handles = Vec::new();

    for (idx, (start, dur)) in chunk_plan.into_iter().enumerate() {
        let chunk_path = temp_dir.join(format!("chunk_{idx:03}.mp3"));
        ffmpeg::extract_audio_chunk(preprocessed_path, &chunk_path, start, dur).await?;

        let client_clone = client.clone();
        let key_clone = api_key.to_string();
        let vocab_clone = custom_vocab.map(str::to_string);
        let sem = semaphore.clone();

        let handle = tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let res = transcribe_single_audio_file(
                &client_clone,
                &key_clone,
                &chunk_path,
                start,
                vocab_clone.as_deref(),
            )
            .await;
            (start, res)
        });

        handles.push(handle);
    }

    let mut chunk_results = Vec::new();
    for handle in handles {
        let (start, res) = handle.await.context("joining chunk transcription thread")?;
        let segments = res.with_context(|| format!("transcribing chunk at offset {start:.1}s"))?;
        chunk_results.push((start, segments));
    }

    if let Some(ref cb) = progress_callback {
        cb(1.0);
    }

    Ok(stitch_transcript_chunks(chunk_results))
}

pub fn stitch_transcript_chunks(
    mut chunk_results: Vec<(f32, Vec<TranscriptSegment>)>,
) -> Vec<TranscriptSegment> {
    chunk_results.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let mut stitched: Vec<TranscriptSegment> = Vec::new();

    for (_offset, segments) in chunk_results {
        for seg in segments {
            if let Some(last) = stitched.last() {
                if seg.start <= last.end + 0.3 {
                    if seg.end <= last.end + 0.3 {
                        continue;
                    }
                    stitched.push(TranscriptSegment {
                        start: last.end,
                        end: seg.end,
                        text: seg.text,
                    });
                    continue;
                }
            }
            stitched.push(seg);
        }
    }

    stitched
}

/// Returns `(Option<bin_parent_dir>, Command)`. The `bin_parent_dir` should be set as the
/// working directory so Windows can locate sibling DLLs (whisper.dll, ggml.dll, etc.).
fn get_binary_command(name: &str) -> (Option<PathBuf>, Command) {
    let env_key = format!("{}_PATH", name.to_uppercase().replace('-', "_"));
    if let Ok(custom_path) = std::env::var(&env_key) {
        if !custom_path.trim().is_empty() {
            let p = PathBuf::from(custom_path.trim());
            if p.exists() {
                let parent = p.parent().map(|d| d.to_path_buf());
                return (parent, Command::new(p));
            }
        }
    }

    let exe_names: Vec<String> = if cfg!(windows) {
        if name == "whisper-cli" {
            vec!["whisper-cli.exe".to_string(), "main.exe".to_string()]
        } else if !name.ends_with(".exe") {
            vec![format!("{name}.exe")]
        } else {
            vec![name.to_string()]
        }
    } else {
        if name == "whisper-cli" {
            vec!["whisper-cli".to_string(), "main".to_string()]
        } else {
            vec![name.to_string()]
        }
    };

    // 1. Check AppData / LocalAppData / UserProfile .dabar/bin
    let mut check_dirs = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        let base_p = PathBuf::from(&appdata);
        check_dirs.push(base_p.join("dabar").join("bin"));
        check_dirs.push(base_p.join("com.preshdevops.dabar").join("bin"));
        check_dirs.push(base_p.join("com.dabar.app").join("bin"));
    }
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        let base_p = PathBuf::from(&localappdata);
        check_dirs.push(base_p.join("dabar").join("bin"));
        check_dirs.push(base_p.join("com.preshdevops.dabar").join("bin"));
        check_dirs.push(base_p.join("com.dabar.app").join("bin"));
    }
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let home_p = PathBuf::from(&home);
        check_dirs.push(home_p.join(".dabar").join("bin"));
        check_dirs.push(home_p.join(".local").join("bin"));
    }

    for dir in &check_dirs {
        for exe in &exe_names {
            let candidate = dir.join(exe);
            if candidate.exists() {
                return (Some(dir.clone()), Command::new(candidate));
            }
        }
    }

    // 2. Walk up ancestor directories (cwd, cwd/.., cwd/../.., ...) to find bin/<exe>
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir: Option<&Path> = Some(cwd.as_path());
        while let Some(ancestor) = dir {
            let bin_dir = ancestor.join("bin");
            for exe in &exe_names {
                let candidate = bin_dir.join(exe);
                if candidate.exists() {
                    return (Some(bin_dir.clone()), Command::new(candidate));
                }
            }
            if let Ok(mut entries) = std::fs::read_dir(&bin_dir) {
                while let Some(Ok(entry)) = entries.next() {
                    let path = entry.path();
                    if path.is_dir() {
                        for exe in &exe_names {
                            let sub1 = path.join(exe);
                            if sub1.exists() {
                                return (Some(path.clone()), Command::new(sub1));
                            }
                            let sub2 = path.join("bin").join(exe);
                            if sub2.exists() {
                                return (Some(path.join("bin")), Command::new(sub2));
                            }
                        }
                    }
                }
            }
            dir = ancestor.parent();
        }
    }

    (None, Command::new(name))
}
