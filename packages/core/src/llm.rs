use crate::models::{Chapter, Highlight, TranscriptSegment};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const DEFAULT_MOMENT_MODEL: &str = "llama-3.3-70b-versatile";
pub const FALLBACK_MOMENT_MODEL: &str = "llama-3.1-8b-instant";

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HighlightDetectionStatus {
    Success,
    NoCandidatesProposed,
    AllCandidatesFiltered,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscardedCandidate {
    pub title: String,
    pub start_time: Option<f32>,
    pub end_time: Option<f32>,
    pub duration: Option<f32>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightDetectionReport {
    pub highlights: Vec<Highlight>,
    pub total_proposed: usize,
    pub total_passed: usize,
    pub discarded: Vec<DiscardedCandidate>,
    pub status: HighlightDetectionStatus,
    pub error_message: Option<String>,
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

/// Parses raw JSON response from the LLM, validates timestamps and duration constraints,
/// records any discarded moments with detailed reasons, and produces validated `Highlight` structs.
pub fn parse_and_validate_highlights_detailed(
    json_value: &serde_json::Value,
) -> (Vec<Highlight>, Vec<DiscardedCandidate>, usize) {
    let clips_array = match json_value.get("clips").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => match json_value.get("highlights").and_then(|v| v.as_array()) {
            Some(arr) => arr,
            None => {
                tracing::warn!("LLM JSON response missing 'clips' or 'highlights' array");
                return (Vec::new(), Vec::new(), 0);
            }
        },
    };

    let total_proposed = clips_array.len();
    let mut valid_highlights = Vec::new();
    let mut discarded = Vec::new();

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
                let reason = format!("Missing or unparseable start_timestamp: {start_raw:?}");
                tracing::warn!("Discarding clip #{index} ('{title}'): {reason}");
                discarded.push(DiscardedCandidate {
                    title,
                    start_time: None,
                    end_time: None,
                    duration: None,
                    reason,
                });
                continue;
            }
        };

        let end_time = match end_raw.and_then(parse_timestamp_value) {
            Some(t) => t,
            None => {
                let reason = format!("Missing or unparseable end_timestamp: {end_raw:?}");
                tracing::warn!("Discarding clip #{index} ('{title}'): {reason}");
                discarded.push(DiscardedCandidate {
                    title,
                    start_time: Some(start_time),
                    end_time: None,
                    duration: None,
                    reason,
                });
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
            let reason_msg = format!(
                "Start timestamp ({start_time:.1}s) >= End timestamp ({end_time:.1}s)"
            );
            tracing::warn!("Discarding clip #{index} ('{title}'): {reason_msg}");
            discarded.push(DiscardedCandidate {
                title,
                start_time: Some(start_time),
                end_time: Some(end_time),
                duration: Some(end_time - start_time),
                reason: reason_msg,
            });
            continue;
        }

        // Rule 2: Duration check with flexible tolerance
        // Target: 30-90s. Accept moments from 25.0s to 120.0s (clamping to max 90.0s if 91-120s).
        let raw_duration = end_time - start_time;
        if raw_duration < 25.0 {
            let reason_msg = format!(
                "Duration ({raw_duration:.1}s) is too short (< 25s threshold)"
            );
            tracing::warn!("Discarding clip #{index} ('{title}'): {reason_msg}");
            discarded.push(DiscardedCandidate {
                title,
                start_time: Some(start_time),
                end_time: Some(end_time),
                duration: Some(raw_duration),
                reason: reason_msg,
            });
            continue;
        }

        if raw_duration > 120.0 {
            let reason_msg = format!(
                "Duration ({raw_duration:.1}s) exceeds maximum clip length (> 120s)"
            );
            tracing::warn!("Discarding clip #{index} ('{title}'): {reason_msg}");
            discarded.push(DiscardedCandidate {
                title,
                start_time: Some(start_time),
                end_time: Some(end_time),
                duration: Some(raw_duration),
                reason: reason_msg,
            });
            continue;
        }

        // If clip is slightly over 90s, clamp end_time to start_time + 90.0 to stay within vertical reel limits
        let final_end_time = if raw_duration > 90.0 {
            start_time + 90.0
        } else {
            end_time
        };

        valid_highlights.push(Highlight {
            id: Uuid::new_v4(),
            title,
            start_time,
            end_time: final_end_time,
            score,
            reason,
            suggested_hook_text,
        });
    }

    (valid_highlights, discarded, total_proposed)
}

/// Backwards-compatible parser returning only valid highlights.
pub fn parse_and_validate_highlights(json_value: &serde_json::Value) -> Vec<Highlight> {
    let (valid, _, _) = parse_and_validate_highlights_detailed(json_value);
    valid
}

/// Detects sermon highlights and returns a comprehensive `HighlightDetectionReport`
/// with proposed vs validated counts and any rejection diagnostics.
pub async fn detect_sermon_highlights_report(
    api_key: &str,
    segments: &[TranscriptSegment],
) -> Result<HighlightDetectionReport> {
    if segments.is_empty() {
        tracing::warn!("detect_sermon_highlights called with empty transcript segments");
        return Ok(HighlightDetectionReport {
            highlights: Vec::new(),
            total_proposed: 0,
            total_passed: 0,
            discarded: Vec::new(),
            status: HighlightDetectionStatus::NoCandidatesProposed,
            error_message: Some("Transcript contains no segments to analyze.".to_string()),
        });
    }

    let formatted_transcript = format_segments_to_prompt(segments);
    let estimated_tokens = (formatted_transcript.len() / 4).max(1);
    tracing::info!(
        "Highlight detection: analyzing sermon transcript with {} segments, {} characters (~{} estimated tokens)",
        segments.len(),
        formatted_transcript.len(),
        estimated_tokens
    );

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

    let configured_model = std::env::var("GROQ_MODEL").unwrap_or_else(|_| DEFAULT_MOMENT_MODEL.to_string());
    let models_to_try = [configured_model.as_str(), FALLBACK_MOMENT_MODEL];

    let mut last_error: Option<anyhow::Error> = None;

    for model in models_to_try {
        let payload = json!({
            "model": model,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": &user_prompt }
            ]
        });

        for attempt in 1..=2 {
            tracing::info!(
                "Executing LLM highlight detection (model: {model}, attempt {attempt}/2)..."
            );

            let res = async {
                let response = client
                    .post(GROQ_CHAT_URL)
                    .bearer_auth(api_key)
                    .json(&payload)
                    .send()
                    .await
                    .context("sending Groq LLM request")?;

                let status = response.status();
                if !status.is_success() {
                    let err_body = response.text().await.unwrap_or_default();
                    anyhow::bail!("Groq LLM returned error status {status}: {err_body}");
                }

                let chat_resp = response
                    .json::<ChatResponse>()
                    .await
                    .context("parsing Groq LLM response JSON")?;

                let content = chat_resp
                    .choices
                    .first()
                    .map(|choice| choice.message.content.as_str())
                    .context("Groq LLM response contained no choice messages")?;

                let parsed_json: serde_json::Value =
                    serde_json::from_str(content).context("parsing LLM message content as JSON")?;

                Ok::<serde_json::Value, anyhow::Error>(parsed_json)
            }
            .await;

            match res {
                Ok(json_val) => {
                    let (valid_highlights, discarded, total_proposed) =
                        parse_and_validate_highlights_detailed(&json_val);

                    tracing::info!(
                        "Highlight detection succeeded: {total_proposed} proposed, {} passed validation, {} discarded",
                        valid_highlights.len(),
                        discarded.len()
                    );

                    let status = if !valid_highlights.is_empty() {
                        HighlightDetectionStatus::Success
                    } else if total_proposed == 0 {
                        HighlightDetectionStatus::NoCandidatesProposed
                    } else {
                        HighlightDetectionStatus::AllCandidatesFiltered
                    };

                    return Ok(HighlightDetectionReport {
                        total_proposed,
                        total_passed: valid_highlights.len(),
                        discarded,
                        status,
                        error_message: None,
                        highlights: valid_highlights,
                    });
                }
                Err(err) => {
                    tracing::warn!(
                        "LLM highlight detection failed with model {model} (attempt {attempt}): {err}"
                    );
                    last_error = Some(err);
                    if attempt < 2 {
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    }
                }
            }
        }
    }

    let final_err_msg = last_error
        .map(|e| e.to_string())
        .unwrap_or_else(|| "Unknown Groq LLM API failure".to_string());

    tracing::error!("LLM highlight detection failed on all attempts: {final_err_msg}");

    // Return the failure explicitly
    anyhow::bail!("{final_err_msg}")
}

/// Detects sermon highlights and returns a `Vec<Highlight>`.
/// Propagates errors on API/network failure instead of silently dropping them.
pub async fn detect_sermon_highlights(
    api_key: &str,
    segments: &[TranscriptSegment],
) -> Result<Vec<Highlight>> {
    let report = detect_sermon_highlights_report(api_key, segments).await?;
    Ok(report.highlights)
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
                    "end_timestamp": 55.0, // 45s duration (valid: 25-120s)
                    "reason": "Clear illustration with strong message",
                    "suggested_hook_text": "Don't give up in your storm!"
                },
                {
                    "title": "Too Short Clip",
                    "start_timestamp": 0.0,
                    "end_timestamp": 15.0, // 15s duration (<25s, invalid)
                    "reason": "Too brief",
                    "suggested_hook_text": "Short"
                },
                {
                    "title": "Too Long Clip",
                    "start_timestamp": 0.0,
                    "end_timestamp": 150.0, // 150s duration (>120s, invalid)
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

        let (highlights, discarded, total) = parse_and_validate_highlights_detailed(&raw_json);
        assert_eq!(total, 4);
        assert_eq!(highlights.len(), 1);
        assert_eq!(discarded.len(), 3);
        assert_eq!(highlights[0].title, "Valid Sermon Highlight");
        assert_eq!(highlights[0].start_time, 10.0);
        assert_eq!(highlights[0].end_time, 55.0);
        assert_eq!(highlights[0].reason, "Clear illustration with strong message");
        assert_eq!(highlights[0].suggested_hook_text, "Don't give up in your storm!");
    }

    #[test]
    fn test_validate_chapters() {
        let chapters = vec![
            Chapter {
                id: Uuid::new_v4(),
                title: "Chapter 2".into(),
                summary: "Summary 2".into(),
                start_time: 120.0,
                end_time: 240.0,
            },
            Chapter {
                id: Uuid::new_v4(),
                title: "Chapter 1".into(),
                summary: "Summary 1".into(),
                start_time: 0.0,
                end_time: 120.0,
            },
            Chapter {
                id: Uuid::new_v4(),
                title: "Invalid Chapter".into(),
                summary: "Bad timestamps".into(),
                start_time: 300.0,
                end_time: 250.0,
            },
        ];

        let validated = validate_chapters(chapters);
        assert_eq!(validated.len(), 2);
        assert_eq!(validated[0].title, "Chapter 1");
        assert_eq!(validated[1].title, "Chapter 2");
    }
}

/// Validates and normalizes chapter boundaries (ensuring start < end and chronological ordering).
pub fn validate_chapters(chapters: Vec<Chapter>) -> Vec<Chapter> {
    let mut valid: Vec<Chapter> = chapters
        .into_iter()
        .filter(|c| c.end_time > c.start_time)
        .map(|mut c| {
            if c.title.trim().is_empty() {
                c.title = "Chapter".to_string();
            }
            c
        })
        .collect();

    valid.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
    valid
}

