use crate::models::TranscriptSegment;
use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use std::path::Path;

const GROQ_TRANSCRIPTIONS_URL: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL: &str = "whisper-large-v3-turbo";

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

pub async fn transcribe_audio(api_key: &str, audio_path: &Path) -> Result<Vec<TranscriptSegment>> {
    let bytes = tokio::fs::read(audio_path)
        .await
        .with_context(|| format!("reading audio file {}", audio_path.display()))?;
    let filename = audio_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio.m4a")
        .to_string();

    let file_part = Part::bytes(bytes).file_name(filename);
    let form = Form::new()
        .text("model", WHISPER_MODEL)
        .text("response_format", "verbose_json")
        .part("file", file_part);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .context("building reqwest client")?;

    let transcription = client
        .post(GROQ_TRANSCRIPTIONS_URL)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .context("sending Groq Whisper transcription request")?
        .error_for_status()
        .context("Groq Whisper transcription failed")?
        .json::<GroqTranscription>()
        .await
        .context("parsing Groq Whisper response")?;

    if let Some(segments) = transcription.segments {
        return Ok(segments
            .into_iter()
            .map(|segment| TranscriptSegment {
                start: segment.start,
                end: segment.end,
                text: segment.text,
            })
            .collect());
    }

    Ok(transcription
        .text
        .map(|text| {
            vec![TranscriptSegment {
                start: 0.0,
                end: 0.0,
                text,
            }]
        })
        .unwrap_or_default())
}
