use crate::models::{Highlight, TranscriptSegment};
use anyhow::{Context, Result};
use serde::Deserialize;
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

/// Formats time given in floating-point seconds into an `[HH:MM:SS]` string.
///
/// # Examples
/// ```
/// use dabar_core::llm::format_timestamp;
/// assert_eq!(format_timestamp(75.0), "[00:01:15]");
/// assert_eq!(format_timestamp(3665.0), "[01:01:05]");
/// ```
pub fn format_timestamp(seconds: f32) -> String {
    let total_secs = seconds.max(0.0) as u32;
    let hours = total_secs / 3600;
    let minutes = (total_secs % 3600) / 60;
    let secs = total_secs % 60;
    format!("[{:02}:{:02}:{:02}]", hours, minutes, secs)
}

/// Converts timestamped transcript segments into a single formatted prompt string
/// where each line begins with an inline `[HH:MM:SS]` timestamp marker.
pub fn format_segments_to_prompt(segments: &[TranscriptSegment]) -> String {
    segments
        .iter()
        .map(|seg| {
            let timestamp_str = format_timestamp(seg.start);
            format!("{} {}", timestamp_str, seg.text.trim())
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Parses timestamp values flexibly, accepting numeric floats (e.g. `45.5`)
/// or formatted timestamp strings (e.g. `"00:01:15"`, `"01:15"`).
pub fn parse_timestamp_value(val: &serde_json::Value) -> Option<f32> {
    if let Some(num) = val.as_f64() {
        return Some(num as f32);
    }
    if let Some(s) = val.as_str() {
        let trimmed = s.trim();
        if let Ok(num) = trimmed.parse::<f32>() {
            return Some(num);
        }
        let parts: Vec<&str> = trimmed.split(':').collect();
        return match parts.len() {
            3 => {
                let h: f32 = parts[0].trim().parse().ok()?;
                let m: f32 = parts[1].trim().parse().ok()?;
                let sec: f32 = parts[2].trim().parse().ok()?;
                Some(h * 3600.0 + m * 60.0 + sec)
            }
            2 => {
                let m: f32 = parts[0].trim().parse().ok()?;
                let sec: f32 = parts[1].trim().parse().ok()?;
                Some(m * 60.0 + sec)
            }
            1 => parts[0].trim().parse().ok(),
            _ => None,
        };
    }
    None
}

/// Parses raw JSON response from the LLM, validates timestamp rules,
/// enforces clip duration constraints (30.0s to 90.0s), discards invalid items with warnings,
/// and transforms valid candidates into `Highlight` domain structs.
pub fn parse_and_validate_highlights(json_value: &serde_json::Value) -> Vec<Highlight> {
    let clips_array = match json_value.get("clips").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => match json_value.get("highlights").and_then(|v| v.as_array()) {
            Some(arr) => arr,
            None => {
                tracing::warn!("LLM JSON response missing 'clips' or 'highlights' array");
                return Vec::new();
            }
        },
    };

    let mut valid_highlights = Vec::new();

    for (index, item) in clips_array.iter().enumerate() {
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Sermon Highlight")
            .trim()
            .to_string();

        let start_raw = item.get("start_timestamp").or_else(|| item.get("start_time"));
        let end_raw = item.get("end_timestamp").or_else(|| item.get("end_time"));

        let start_time = match start_raw.and_then(parse_timestamp_value) {
            Some(t) => t,
            None => {
                tracing::warn!("Discarding clip #{index} ('{title}'): missing or unparseable start_timestamp");
                continue;
            }
        };

        let end_time = match end_raw.and_then(parse_timestamp_value) {
            Some(t) => t,
            None => {
                tracing::warn!("Discarding clip #{index} ('{title}'): missing or unparseable end_timestamp");
                continue;
            }
        };

        let reason = item
            .get("reason")
            .and_then(|v| v.as_str())
            .unwrap_or("High-impact preaching moment with strong audience engagement potential.")
            .trim()
            .to_string();

        let suggested_hook_text = item
            .get("suggested_hook_text")
            .or_else(|| item.get("hook_text"))
            .and_then(|v| v.as_str())
            .unwrap_or(&title)
            .trim()
            .to_string();

        let score = item
            .get("score")
            .and_then(|v| v.as_f64())
            .map(|f| f as f32)
            .unwrap_or(8.5);

        // Rule 1: start_timestamp < end_timestamp
        if start_time >= end_time {
            tracing::warn!(
                "Discarding clip #{index} ('{title}'): start_timestamp ({start_time:.1}s) >= end_timestamp ({end_time:.1}s)"
            );
            continue;
        }

        // Rule 2: Each clip MUST be between 30 and 90 seconds in duration
        let duration = end_time - start_time;
        if duration < 30.0 || duration > 90.0 {
            tracing::warn!(
                "Discarding clip #{index} ('{title}'): duration ({duration:.1}s) is outside required 30-90s range"
            );
            continue;
        }

        valid_highlights.push(Highlight {
            id: Uuid::new_v4(),
            title,
            start_time,
            end_time,
            score,
            reason,
            suggested_hook_text,
        });
    }

    valid_highlights
}

/// Detects sermon highlights from timestamped transcript segments using Groq LLM.
///
/// # Features
/// - Formats Whisper transcript segments with `[HH:MM:SS]` inline timestamps.
/// - Prompts LLM using structured JSON output (`response_format: { type: "json_object" }`).
/// - Retries once on transient failure (up to 2 total attempts).
/// - Gracefully falls back to an empty list (`Ok(Vec::new())`) if all attempts fail (prevents pipeline crashes).
/// - Filters out clips outside the 30-90 second range or with invalid timestamps.
pub async fn detect_sermon_highlights(
    api_key: &str,
    segments: &[TranscriptSegment],
) -> Result<Vec<Highlight>> {
    if segments.is_empty() {
        tracing::warn!("detect_sermon_highlights called with empty transcript segments");
        return Ok(Vec::new());
    }

    let formatted_transcript = format_segments_to_prompt(segments);
    let user_prompt = format!(
        "Analyze the following timestamped sermon transcript and extract high-impact clip moments:\n\n{}",
        formatted_transcript
    );

    let system_prompt = r#"You are an experienced pastoral editor and ministry media director.
Your task is to analyze timestamped sermon transcripts and extract the most spiritually impactful, meaningful teaching moments for church members and seekers.

Guidelines for selected moments:
1. Target Duration: Each clip MUST be between 30 and 90 seconds in duration (start_timestamp to end_timestamp).
2. Theological Clarity & Depth: Prioritize moments of clear biblical exposition, Gospel truths, conviction, and practical spiritual application.
3. Emotional Weight & Testimony: Identify genuine moments of personal vulnerability, answered prayers, encouragement in trials, or passionate declarations of God's faithfulness.
4. Coherence: Ensure the clip captures a complete spiritual thought, illustration, or call to action with a natural beginning and resolution. Avoid clipping mid-sentence or chopping context.
5. Tone: Focus on genuine ministry impact and heart resonance — NOT clickbait, viral trends, or artificial drama.

Return JSON output with a "clips" array containing clip objects:
{
  "clips": [
    {
      "title": "Clear Pastoral Title (3-7 words)",
      "start_timestamp": 45.0,
      "end_timestamp": 90.0,
      "reason": "Spiritual insight and reason why this moment brings encouragement or clarity to listeners",
      "suggested_hook_text": "Key takeaway or core truth summary"
    }
  ]
}"#;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .context("building reqwest client")?;

    let payload = json!({
        "model": MOMENT_MODEL,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_prompt }
        ]
    });

    let mut last_error: Option<anyhow::Error> = None;

    // Execute LLM request with retry mechanism (1 initial + 1 retry = 2 attempts max)
    for attempt in 1..=2 {
        tracing::info!("Executing LLM sermon highlight detection (attempt {attempt}/2)...");

        let result = async {
            let response = client
                .post(GROQ_CHAT_URL)
                .bearer_auth(api_key)
                .json(&payload)
                .send()
                .await
                .context("sending Groq LLM request")?
                .error_for_status()
                .context("Groq LLM returned non-success status code")?
                .json::<ChatResponse>()
                .await
                .context("parsing Groq LLM response JSON structure")?;

            let content = response
                .choices
                .first()
                .map(|choice| choice.message.content.as_str())
                .context("Groq LLM response contained no choice messages")?;

            let parsed_json: serde_json::Value =
                serde_json::from_str(content).context("parsing LLM message content as JSON")?;

            Ok::<serde_json::Value, anyhow::Error>(parsed_json)
        }
        .await;

        match result {
            Ok(json_value) => {
                let highlights = parse_and_validate_highlights(&json_value);
                tracing::info!(
                    "Successfully detected {} valid sermon highlight clip(s)",
                    highlights.len()
                );
                return Ok(highlights);
            }
            Err(err) => {
                tracing::warn!("LLM highlight detection attempt {attempt} failed: {err:?}");
                last_error = Some(err);
                if attempt < 2 {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            }
        }
    }

    // Graceful Fallback: Log error, return empty vector to prevent pipeline crash
    if let Some(err) = last_error {
        tracing::error!(
            "LLM sermon highlight detection failed after 2 attempts. Falling back to empty clip list. Error: {err:?}"
        );
    }

    Ok(Vec::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_timestamp() {
        assert_eq!(format_timestamp(0.0), "[00:00:00]");
        assert_eq!(format_timestamp(75.4), "[00:01:15]");
        assert_eq!(format_timestamp(3665.0), "[01:01:05]");
    }

    #[test]
    fn test_format_segments_to_prompt() {
        let segments = vec![
            TranscriptSegment {
                start: 10.0,
                end: 25.0,
                text: " Faith is stepping out when you can't see the full staircase. ".to_string(),
            },
            TranscriptSegment {
                start: 75.0,
                end: 90.0,
                text: "Your current trial is preparing you for a greater purpose.".to_string(),
            },
        ];

        let prompt = format_segments_to_prompt(&segments);
        assert!(prompt.contains("[00:00:10] Faith is stepping out"));
        assert!(prompt.contains("[00:01:15] Your current trial"));
    }

    #[test]
    fn test_parse_timestamp_value() {
        assert_eq!(parse_timestamp_value(&json!(45.5)), Some(45.5));
        assert_eq!(parse_timestamp_value(&json!("45.5")), Some(45.5));
        assert_eq!(parse_timestamp_value(&json!("01:15")), Some(75.0));
        assert_eq!(parse_timestamp_value(&json!("01:01:05")), Some(3665.0));
        assert_eq!(parse_timestamp_value(&json!("invalid")), None);
    }

    #[test]
    fn test_parse_and_validate_highlights_filtering() {
        let raw_json = json!({
            "clips": [
                {
                    "title": "Valid Sermon Highlight",
                    "start_timestamp": 10.0,
                    "end_timestamp": 55.0, // 45s duration (valid: 30-90s)
                    "reason": "Clear illustration with strong message",
                    "suggested_hook_text": "Don't give up in your storm!"
                },
                {
                    "title": "Too Short Clip",
                    "start_timestamp": 0.0,
                    "end_timestamp": 15.0, // 15s duration (<30s, invalid)
                    "reason": "Too brief",
                    "suggested_hook_text": "Short"
                },
                {
                    "title": "Too Long Clip",
                    "start_timestamp": 0.0,
                    "end_timestamp": 120.0, // 120s duration (>90s, invalid)
                    "reason": "Exceeds max duration",
                    "suggested_hook_text": "Long"
                },
                {
                    "title": "Inverted Timestamp Clip",
                    "start_timestamp": 100.0,
                    "end_timestamp": 50.0, // start >= end (invalid)
                    "reason": "Bad timestamps",
                    "suggested_hook_text": "Inverted"
                }
            ]
        });

        let highlights = parse_and_validate_highlights(&raw_json);
        assert_eq!(highlights.len(), 1);
        assert_eq!(highlights[0].title, "Valid Sermon Highlight");
        assert_eq!(highlights[0].start_time, 10.0);
        assert_eq!(highlights[0].end_time, 55.0);
        assert_eq!(highlights[0].reason, "Clear illustration with strong message");
        assert_eq!(highlights[0].suggested_hook_text, "Don't give up in your storm!");
    }
}
