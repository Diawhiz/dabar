use crate::models::{Chapter, Highlight, TranscriptSegment};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const DEFAULT_MOMENT_MODEL: &str = "openai/gpt-oss-120b";
pub const FALLBACK_MOMENT_MODEL: &str = "openai/gpt-oss-20b";
const LEGACY_FALLBACK_MODEL_1: &str = "llama-3.3-70b-versatile";
const LEGACY_FALLBACK_MODEL_2: &str = "llama-3.1-8b-instant";

/// Selects the LLM backend for highlight/chapter detection.
#[derive(Debug, Clone)]
pub enum LlmBackend {
    /// Groq cloud API (fast, requires API key)
    Groq { api_key: String },
    /// Local Ollama REST API (offline, requires Ollama running at the given URL)
    Ollama { base_url: String, model: String },
}

impl Default for LlmBackend {
    fn default() -> Self {
        LlmBackend::Groq { api_key: String::new() }
    }
}

pub async fn check_ollama(base_url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();
    
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    client.get(&url).send().await.is_ok()
}

async fn execute_analysis_with_backend(
    client: &reqwest::Client,
    backend: &LlmBackend,
    prompt_text: &str,
) -> Result<serde_json::Value> {
    match backend {
        LlmBackend::Groq { api_key } => {
            execute_llm_analysis_request(client, api_key, prompt_text).await
        }
        LlmBackend::Ollama { base_url, model } => {
            let system_prompt = r#"You are an experienced pastoral editor, theologian, and media director.
Analyze the timestamped sermon transcript and produce structured output containing BOTH topic chapters and high-impact pastoral video clips.

Return JSON in this exact structure:
{
  "chapters": [
    {
      "title": "Topic Chapter Title (3-7 words)",
      "summary": "1-2 sentence overview of this teaching section",
      "start_timestamp": 0.0,
      "end_timestamp": 320.0
    }
  ],
  "clips": [
    {
      "title": "Compelling Pastoral Title (3-7 words)",
      "start_timestamp": 45.0,
      "end_timestamp": 90.0,
      "reason": "Spiritual insight and conviction why this moment impacts listeners",
      "suggested_hook_text": "Key core truth or scripture quote"
    }
  ]
}

Guidelines:
1. Chapters: 3 to 8 logical teaching topic chapters spanning the transcript chronologically.
2. Clips: 2 to 6 high-impact clips, each strictly between 30 and 90 seconds in duration.
3. Prioritize clear Gospel truths, scriptural insight, personal testimony, and practical life application."#;

            let user_prompt = format!(
                "Analyze the following timestamped sermon transcript:\n\n{}",
                prompt_text
            );
            
            let payload = json!({
                "model": model,
                "format": "json",
                "stream": false,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": &user_prompt }
                ]
            });
            
            let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
            let response = client.post(&url).json(&payload).send().await.context("Ollama request failed")?;
            let text = response.text().await.context("Failed to read Ollama response")?;
            
            let parsed: serde_json::Value = serde_json::from_str(&text).context("Parsing Ollama JSON response")?;
            let content = parsed.get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .context("Ollama response missing message.content")?;
            
            serde_json::from_str(content).context("Parsing LLM generated JSON")
        }
    }
}

pub async fn detect_sermon_analysis_report_with_backend(
    backend: &LlmBackend,
    segments: &[TranscriptSegment],
) -> Result<SermonAnalysisResult> {
    if segments.is_empty() {
        return Ok(SermonAnalysisResult {
            chapters: Vec::new(),
            highlights_report: HighlightDetectionReport {
                highlights: Vec::new(),
                total_proposed: 0,
                total_passed: 0,
                discarded: Vec::new(),
                status: HighlightDetectionStatus::NoCandidatesProposed,
                error_message: Some("Transcript contains no segments to analyze.".to_string()),
            },
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .context("building reqwest client")?;

    let mut all_chapters: Vec<Chapter> = Vec::new();
    let mut all_highlights: Vec<Highlight> = Vec::new();
    let mut all_discarded: Vec<DiscardedCandidate> = Vec::new();
    let mut total_proposed: usize = 0;

    // If transcript is large, process in sequential semantic windows to guarantee requests stay under TPM limits
    if segments.len() <= WINDOW_SEGMENTS_SIZE {
        let prompt_text = format_segments_to_prompt(segments);
        let json_val = execute_analysis_with_backend(&client, backend, &prompt_text).await?;

        let chapters = parse_chapters_from_json(&json_val);
        let (highlights, discarded, proposed) = parse_and_validate_highlights_detailed(&json_val);

        all_chapters.extend(chapters);
        all_highlights.extend(highlights);
        all_discarded.extend(discarded);
        total_proposed += proposed;
    } else {
        tracing::info!(
            "Large transcript ({} segments) detected. Processing in windowed chunks to avoid TPM limits...",
            segments.len()
        );

        let mut start_idx = 0;
        while start_idx < segments.len() {
            let end_idx = (start_idx + WINDOW_SEGMENTS_SIZE).min(segments.len());
            let window_slice = &segments[start_idx..end_idx];
            let prompt_text = format_segments_to_prompt(window_slice);

            tracing::info!(
                "Analyzing window segments {}..{} of {}...",
                start_idx,
                end_idx,
                segments.len()
            );

            if let Ok(json_val) = execute_analysis_with_backend(&client, backend, &prompt_text).await {
                let chapters = parse_chapters_from_json(&json_val);
                let (highlights, discarded, proposed) = parse_and_validate_highlights_detailed(&json_val);

                all_chapters.extend(chapters);
                all_highlights.extend(highlights);
                all_discarded.extend(discarded);
                total_proposed += proposed;
            }

            if end_idx >= segments.len() {
                break;
            }
            start_idx += WINDOW_SEGMENTS_SIZE - WINDOW_OVERLAP_SIZE;
            if matches!(backend, LlmBackend::Groq { .. }) {
                tokio::time::sleep(std::time::Duration::from_millis(800)).await;
            }
        }
    }

    // Deduplicate and sort highlights
    all_highlights.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
    let mut deduplicated_highlights: Vec<Highlight> = Vec::new();
    let mut last_end = 0.0;
    for hl in all_highlights {
        if deduplicated_highlights.is_empty() || hl.start_time >= last_end - 5.0 {
            last_end = hl.end_time;
            deduplicated_highlights.push(hl);
        }
    }

    let validated_chapters = validate_chapters(all_chapters);
    let total_passed = deduplicated_highlights.len();
    let status = if total_passed > 0 || !validated_chapters.is_empty() {
        HighlightDetectionStatus::Success
    } else if total_proposed == 0 {
        HighlightDetectionStatus::NoCandidatesProposed
    } else {
        HighlightDetectionStatus::AllCandidatesFiltered
    };

    Ok(SermonAnalysisResult {
        chapters: validated_chapters,
        highlights_report: HighlightDetectionReport {
            total_proposed,
            total_passed,
            discarded: all_discarded,
            status,
            error_message: None,
            highlights: deduplicated_highlights,
        },
    })
}

const WINDOW_SEGMENTS_SIZE: usize = 90;
const WINDOW_OVERLAP_SIZE: usize = 12;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SermonAnalysisResult {
    pub chapters: Vec<Chapter>,
    pub highlights_report: HighlightDetectionReport,
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

/// Parses topic chapters from LLM response.
pub fn parse_chapters_from_json(json_value: &serde_json::Value) -> Vec<Chapter> {
    let chapters_array = match json_value.get("chapters").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Vec::new(),
    };

    let mut result = Vec::new();
    for item in chapters_array {
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Sermon Chapter")
            .trim()
            .to_string();

        let summary = item
            .get("summary")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .trim()
            .to_string();

        let start_time = item
            .get("start_time")
            .or_else(|| item.get("start_timestamp"))
            .and_then(parse_timestamp_value);

        let end_time = item
            .get("end_time")
            .or_else(|| item.get("end_timestamp"))
            .and_then(parse_timestamp_value);

        if let (Some(start), Some(end)) = (start_time, end_time) {
            if end > start {
                result.push(Chapter {
                    id: Uuid::new_v4(),
                    title,
                    summary,
                    start_time: start,
                    end_time: end,
                });
            }
        }
    }

    validate_chapters(result)
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
            .unwrap_or("High-impact preaching moment with strong spiritual encouragement.")
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

        // Rule 2: Duration check with flexible tolerance (25s to 120s)
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

async fn execute_llm_analysis_request(
    client: &reqwest::Client,
    api_key: &str,
    formatted_transcript: &str,
) -> Result<serde_json::Value> {
    let system_prompt = r#"You are an experienced pastoral editor, theologian, and media director.
Analyze the timestamped sermon transcript and produce structured output containing BOTH topic chapters and high-impact pastoral video clips.

Return JSON in this exact structure:
{
  "chapters": [
    {
      "title": "Topic Chapter Title (3-7 words)",
      "summary": "1-2 sentence overview of this teaching section",
      "start_timestamp": 0.0,
      "end_timestamp": 320.0
    }
  ],
  "clips": [
    {
      "title": "Compelling Pastoral Title (3-7 words)",
      "start_timestamp": 45.0,
      "end_timestamp": 90.0,
      "reason": "Spiritual insight and conviction why this moment impacts listeners",
      "suggested_hook_text": "Key core truth or scripture quote"
    }
  ]
}

Guidelines:
1. Chapters: 3 to 8 logical teaching topic chapters spanning the transcript chronologically.
2. Clips: 2 to 6 high-impact clips, each strictly between 30 and 90 seconds in duration.
3. Prioritize clear Gospel truths, scriptural insight, personal testimony, and practical life application."#;

    let user_prompt = format!(
        "Analyze the following timestamped sermon transcript:\n\n{}",
        formatted_transcript
    );

    let configured_model = std::env::var("GROQ_MODEL").unwrap_or_else(|_| DEFAULT_MOMENT_MODEL.to_string());
    let models_to_try = [
        configured_model.as_str(),
        FALLBACK_MOMENT_MODEL,
        LEGACY_FALLBACK_MODEL_1,
        LEGACY_FALLBACK_MODEL_2,
    ];

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
                "Executing LLM analysis (model: {model}, attempt {attempt}/2)..."
            );

            let response = client
                .post(GROQ_CHAT_URL)
                .bearer_auth(api_key)
                .json(&payload)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    let chat_resp = resp
                        .json::<ChatResponse>()
                        .await
                        .context("parsing Groq LLM response JSON")?;

                    let content = chat_resp
                        .choices
                        .first()
                        .map(|c| c.message.content.as_str())
                        .context("Groq LLM response contained no choice messages")?;

                    let parsed_json: serde_json::Value =
                        serde_json::from_str(content).context("parsing LLM message content as JSON")?;

                    return Ok(parsed_json);
                }
                Ok(resp) => {
                    let status = resp.status();
                    let err_body = resp.text().await.unwrap_or_default();
                    tracing::warn!("Groq LLM error with model {model} (HTTP {status}): {err_body}");
                    last_error = Some(anyhow::anyhow!("Groq LLM returned {status}: {err_body}"));
                    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                        tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                    } else {
                        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
                    }
                }
                Err(err) => {
                    tracing::warn!("Groq LLM network error with model {model}: {err}");
                    last_error = Some(err.into());
                    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
                }
            }
        }
    }

    let err_msg = last_error
        .map(|e| e.to_string())
        .unwrap_or_else(|| "All Groq LLM models failed".to_string());
    anyhow::bail!("{err_msg}")
}

/// Detects sermon chapters and highlight moments with windowed chunking for zero TPM limits.
pub async fn detect_sermon_analysis_report(
    api_key: &str,
    segments: &[TranscriptSegment],
) -> Result<SermonAnalysisResult> {
    if segments.is_empty() {
        return Ok(SermonAnalysisResult {
            chapters: Vec::new(),
            highlights_report: HighlightDetectionReport {
                highlights: Vec::new(),
                total_proposed: 0,
                total_passed: 0,
                discarded: Vec::new(),
                status: HighlightDetectionStatus::NoCandidatesProposed,
                error_message: Some("Transcript contains no segments to analyze.".to_string()),
            },
        });
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .context("building reqwest client")?;

    let mut all_chapters: Vec<Chapter> = Vec::new();
    let mut all_highlights: Vec<Highlight> = Vec::new();
    let mut all_discarded: Vec<DiscardedCandidate> = Vec::new();
    let mut total_proposed: usize = 0;

    // If transcript is large, process in sequential semantic windows to guarantee requests stay under TPM limits
    if segments.len() <= WINDOW_SEGMENTS_SIZE {
        let prompt_text = format_segments_to_prompt(segments);
        let json_val = execute_llm_analysis_request(&client, api_key, &prompt_text).await?;

        let chapters = parse_chapters_from_json(&json_val);
        let (highlights, discarded, proposed) = parse_and_validate_highlights_detailed(&json_val);

        all_chapters.extend(chapters);
        all_highlights.extend(highlights);
        all_discarded.extend(discarded);
        total_proposed += proposed;
    } else {
        tracing::info!(
            "Large transcript ({} segments) detected. Processing in windowed chunks to avoid Groq TPM limits...",
            segments.len()
        );

        let mut start_idx = 0;
        while start_idx < segments.len() {
            let end_idx = (start_idx + WINDOW_SEGMENTS_SIZE).min(segments.len());
            let window_slice = &segments[start_idx..end_idx];
            let prompt_text = format_segments_to_prompt(window_slice);

            tracing::info!(
                "Analyzing window segments {}..{} of {}...",
                start_idx,
                end_idx,
                segments.len()
            );

            if let Ok(json_val) = execute_llm_analysis_request(&client, api_key, &prompt_text).await {
                let chapters = parse_chapters_from_json(&json_val);
                let (highlights, discarded, proposed) = parse_and_validate_highlights_detailed(&json_val);

                all_chapters.extend(chapters);
                all_highlights.extend(highlights);
                all_discarded.extend(discarded);
                total_proposed += proposed;
            }

            if end_idx >= segments.len() {
                break;
            }
            start_idx += WINDOW_SEGMENTS_SIZE - WINDOW_OVERLAP_SIZE;
            tokio::time::sleep(std::time::Duration::from_millis(800)).await;
        }
    }

    // Deduplicate and sort highlights
    all_highlights.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
    let mut deduplicated_highlights: Vec<Highlight> = Vec::new();
    let mut last_end = 0.0;
    for hl in all_highlights {
        if deduplicated_highlights.is_empty() || hl.start_time >= last_end - 5.0 {
            last_end = hl.end_time;
            deduplicated_highlights.push(hl);
        }
    }

    let validated_chapters = validate_chapters(all_chapters);
    let total_passed = deduplicated_highlights.len();
    let status = if total_passed > 0 || !validated_chapters.is_empty() {
        HighlightDetectionStatus::Success
    } else if total_proposed == 0 {
        HighlightDetectionStatus::NoCandidatesProposed
    } else {
        HighlightDetectionStatus::AllCandidatesFiltered
    };

    Ok(SermonAnalysisResult {
        chapters: validated_chapters,
        highlights_report: HighlightDetectionReport {
            total_proposed,
            total_passed,
            discarded: all_discarded,
            status,
            error_message: None,
            highlights: deduplicated_highlights,
        },
    })
}

/// Detects sermon highlights and returns a comprehensive `HighlightDetectionReport`.
pub async fn detect_sermon_highlights_report(
    api_key: &str,
    segments: &[TranscriptSegment],
) -> Result<HighlightDetectionReport> {
    let result = detect_sermon_analysis_report(api_key, segments).await?;
    Ok(result.highlights_report)
}

/// Detects sermon highlights and returns a `Vec<Highlight>`.
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

