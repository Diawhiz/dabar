use crate::models::{Highlight, TranscriptSegment};
use anyhow::{Context, Result};

use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const MOMENT_MODEL: &str = "llama-3.3-70b-versatile";

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct HighlightCandidate {
    title: String,
    start_time: f32,
    end_time: f32,
    score: f32,
}

pub async fn detect_key_moments(
    api_key: &str,
    segments: &[TranscriptSegment],
) -> Result<Vec<Highlight>> {
    let blocks = group_segments(segments);
    let prompt = format!(
        "Find high-impact sermon clip moments. Return only JSON: {{\"highlights\":[{{\"title\":\"...\",\"start_time\":0.0,\"end_time\":45.0,\"score\":9.0}}]}}.\n\nTranscript blocks:\n{}",
        blocks
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .context("building reqwest client")?;

    let response = client
        .post(GROQ_CHAT_URL)
        .bearer_auth(api_key)
        .json(&json!({
            "model": MOMENT_MODEL,
            "response_format": { "type": "json_object" },
            "messages": [
                {
                    "role": "system",
                    "content": "You identify concise, emotionally strong sermon clips suitable for vertical short-form video."
                },
                { "role": "user", "content": prompt }
            ]
        }))
        .send()
        .await
        .context("sending Groq LLM request")?
        .error_for_status()
        .context("Groq LLM request failed")?
        .json::<ChatResponse>()
        .await
        .context("parsing Groq LLM response")?;

    let content = response
        .choices
        .first()
        .map(|choice| choice.message.content.as_str())
        .context("Groq LLM response did not include choices")?;
    let parsed: serde_json::Value =
        serde_json::from_str(content).context("parsing highlight JSON")?;
    let candidates: Vec<HighlightCandidate> =
        serde_json::from_value(parsed["highlights"].clone()).context("reading highlights")?;

    Ok(candidates
        .into_iter()
        .map(|candidate| Highlight {
            id: Uuid::new_v4(),
            title: candidate.title,
            start_time: candidate.start_time,
            end_time: candidate.end_time,
            score: candidate.score,
        })
        .collect())
}

fn group_segments(segments: &[TranscriptSegment]) -> String {
    let mut blocks = Vec::new();
    let mut current = String::new();
    let mut block_start = 0.0;
    let mut block_end = 0.0;

    for segment in segments {
        if current.is_empty() {
            block_start = segment.start;
        }

        block_end = segment.end;
        current.push_str(segment.text.trim());
        current.push(' ');

        if block_end - block_start >= 35.0 {
            blocks.push(format!(
                "[{block_start:.1}-{block_end:.1}] {}",
                current.trim()
            ));
            current.clear();
        }
    }

    if !current.is_empty() {
        blocks.push(format!(
            "[{block_start:.1}-{block_end:.1}] {}",
            current.trim()
        ));
    }

    blocks.join("\n")
}
