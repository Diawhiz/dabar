use crate::models::{Chapter, Highlight, TranscriptSegment};
use crate::structuring::detect_scripture_references;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
pub const DEFAULT_MOMENT_MODEL: &str = "llama-3.3-70b-versatile";
pub const FALLBACK_MOMENT_MODEL: &str = "llama-3.1-8b-instant";
const LEGACY_FALLBACK_MODEL_1: &str = "gemma2-9b-it";
const LEGACY_FALLBACK_MODEL_2: &str = "mixtral-8x7b-32768";

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

pub fn format_timestamp(seconds: f32) -> String {
    let total_secs = seconds.max(0.0) as u32;
    let hours = total_secs / 3600;
    let minutes = (total_secs % 3600) / 60;
    let secs = total_secs % 60;
    format!("[{:02}:{:02}:{:02}]", hours, minutes, secs)
}

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

pub fn parse_timestamp_value(val: &serde_json::Value) -> Option<f32> {
    if let Some(num) = val.as_f64() {
        return Some(num as f32);
    }
    if let Some(s) = val.as_str() {
        let trimmed = s.trim().trim_matches('[').trim_matches(']');
        let parts: Vec<&str> = trimmed.split(':').collect();
        if parts.len() == 3 {
            let hours: f32 = parts[0].parse().ok()?;
            let mins: f32 = parts[1].parse().ok()?;
            let secs: f32 = parts[2].parse().ok()?;
            return Some(hours * 3600.0 + mins * 60.0 + secs);
        } else if parts.len() == 2 {
            let mins: f32 = parts[0].parse().ok()?;
            let secs: f32 = parts[1].parse().ok()?;
            return Some(mins * 60.0 + secs);
        } else if let Ok(direct_sec) = trimmed.parse::<f32>() {
            return Some(direct_sec);
        }
    }
    None
}

pub fn validate_chapters(mut chapters: Vec<Chapter>) -> Vec<Chapter> {
    if chapters.is_empty() {
        return Vec::new();
    }

    chapters.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));

    let mut validated = Vec::new();
    for ch in chapters {
        if ch.end_time <= ch.start_time {
            continue;
        }
        if let Some(prev) = validated.last_mut() {
            let p: &mut Chapter = prev;
            if ch.start_time < p.end_time {
                p.end_time = ch.start_time;
            }
        }
        validated.push(ch);
    }
    validated
}

pub fn parse_and_validate_chapters(json_value: &serde_json::Value) -> Vec<Chapter> {
    let chapters_array = match json_value.get("chapters").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return Vec::new(),
    };

    let mut result = Vec::new();
    for item in chapters_array {
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Sermon Section")
            .trim()
            .to_string();

        let summary = item
            .get("summary")
            .and_then(|v| v.as_str())
            .unwrap_or("")
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

pub fn parse_and_validate_highlights_detailed(
    json_value: &serde_json::Value,
) -> (Vec<Highlight>, Vec<DiscardedCandidate>, usize) {
    let clips_array = match json_value.get("clips").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => match json_value.get("highlights").and_then(|v| v.as_array()) {
            Some(arr) => arr,
            None => {
                return (Vec::new(), Vec::new(), 0);
            }
        },
    };

    let total_proposed = clips_array.len();
    let mut valid_highlights = Vec::new();
    let mut discarded = Vec::new();

    for (_index, item) in clips_array.iter().enumerate() {
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
                discarded.push(DiscardedCandidate {
                    title,
                    start_time: None,
                    end_time: None,
                    duration: None,
                    reason: "Missing start timestamp".to_string(),
                });
                continue;
            }
        };

        let end_time = match end_raw.and_then(parse_timestamp_value) {
            Some(t) => t,
            None => {
                discarded.push(DiscardedCandidate {
                    title,
                    start_time: Some(start_time),
                    end_time: None,
                    duration: None,
                    reason: "Missing end timestamp".to_string(),
                });
                continue;
            }
        };

        let reason = item
            .get("reason")
            .and_then(|v| v.as_str())
            .unwrap_or("High-impact preaching moment.")
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
            .map(|f| (f as f32).clamp(0.0, 1.0))
            .unwrap_or(0.90);

        if end_time <= start_time {
            discarded.push(DiscardedCandidate {
                title,
                start_time: Some(start_time),
                end_time: Some(end_time),
                duration: Some(end_time - start_time),
                reason: "End time <= start time".to_string(),
            });
            continue;
        }

        let raw_duration = end_time - start_time;
        if raw_duration < 15.0 {
            discarded.push(DiscardedCandidate {
                title,
                start_time: Some(start_time),
                end_time: Some(end_time),
                duration: Some(raw_duration),
                reason: "Duration < 15s".to_string(),
            });
            continue;
        }

        let final_end_time = if raw_duration > 120.0 {
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

pub fn parse_and_validate_highlights(json_value: &serde_json::Value) -> Vec<Highlight> {
    let (valid, _, _) = parse_and_validate_highlights_detailed(json_value);
    valid
}

/// Offline heuristic analysis for zero-key preaching moment and topic chapter extraction.
pub fn analyze_sermon_offline_heuristics(segments: &[TranscriptSegment]) -> SermonAnalysisResult {
    if segments.is_empty() {
        return SermonAnalysisResult {
            chapters: Vec::new(),
            highlights_report: HighlightDetectionReport {
                highlights: Vec::new(),
                total_proposed: 0,
                total_passed: 0,
                discarded: Vec::new(),
                status: HighlightDetectionStatus::NoCandidatesProposed,
                error_message: None,
            },
        };
    }

    let total_duration = segments.last().map(|s| s.end).unwrap_or(0.0);
    let mut highlights = Vec::new();
    let mut scripture_refs = Vec::new();

    // 1. Scan transcript for scripture references and preaching hooks
    for (i, seg) in segments.iter().enumerate() {
        let refs = detect_scripture_references(&seg.text, seg.start);
        for r in refs {
            scripture_refs.push((r, i));
        }
    }

    // High-impact preaching hook triggers
    let hook_patterns = [
        ("The Power of God's Word", "the word of god"),
        ("Walking in Faith", "walk by faith"),
        ("God's Divine Promise", "god has promised"),
        ("A Call to Prayer", "let us pray"),
        ("Key Life Application", "let me tell you"),
        ("Understanding the Scripture", "look at what the bible says"),
        ("Living with Purpose", "i want you to understand"),
        ("God's Grace and Mercy", "by the grace of god"),
        ("Overcoming in Victory", "you are more than a conqueror"),
        ("Standing on Truth", "stand firm"),
    ];

    for (title_template, trigger) in hook_patterns {
        if let Some((idx, seg)) = segments.iter().enumerate().find(|(_, s)| s.text.to_lowercase().contains(trigger)) {
            let start = seg.start;
            let target_end = (start + 45.0).min(total_duration);
            let end = segments
                .iter()
                .skip(idx)
                .find(|s| s.end >= target_end)
                .map(|s| s.end)
                .unwrap_or(target_end);

            if end > start + 15.0 && !highlights.iter().any(|h: &Highlight| (h.start_time - start).abs() < 30.0) {
                highlights.push(Highlight {
                    id: Uuid::new_v4(),
                    title: title_template.to_string(),
                    start_time: start,
                    end_time: (start + 60.0).min(end),
                    score: 0.92,
                    reason: format!("High-impact preaching section on {}", trigger),
                    suggested_hook_text: seg.text.chars().take(80).collect(),
                });
            }
        }
    }

    // Add moments from Scripture citations if needed
    for (scrip_ref, seg_idx) in scripture_refs.iter().take(3) {
        let seg = &segments[*seg_idx];
        let start = seg.start;
        let end = (start + 50.0).min(total_duration);

        if !highlights.iter().any(|h: &Highlight| (h.start_time - start).abs() < 25.0) {
            highlights.push(Highlight {
                id: Uuid::new_v4(),
                title: format!("Scripture Reading · {}", scrip_ref.reference),
                start_time: start,
                end_time: end,
                score: 0.95,
                reason: format!("Scripture reading and pastoral exposition of {}", scrip_ref.reference),
                suggested_hook_text: scrip_ref.reference.clone(),
            });
        }
    }

    // Fallback: If no moments found, create balanced highlights across the sermon
    if highlights.is_empty() && total_duration > 60.0 {
        let slice_count = if total_duration > 1200.0 { 3 } else { 2 };
        let interval = total_duration / (slice_count as f32 + 1.0);

        for i in 1..=slice_count {
            let target_t = interval * (i as f32);
            let start = segments.iter().find(|s| s.start >= target_t).map(|s| s.start).unwrap_or(target_t);
            let end = (start + 50.0).min(total_duration);

            highlights.push(Highlight {
                id: Uuid::new_v4(),
                title: format!("Key Sermon Moment · Part {}", i),
                start_time: start,
                end_time: end,
                score: 0.88,
                reason: "Featured pastoral teaching section.".to_string(),
                suggested_hook_text: "Faith and spiritual encouragement.".to_string(),
            });
        }
    }

    // 2. Generate Chapters chronologically
    let mut chapters = Vec::new();
    let chapter_interval = 360.0; // 6 minutes per chapter
    let num_chapters = ((total_duration / chapter_interval).ceil() as usize).max(1);

    for i in 0..num_chapters {
        let ch_start = (i as f32) * chapter_interval;
        let ch_end = ((i + 1) as f32 * chapter_interval).min(total_duration);

        if ch_end > ch_start {
            let title = match i {
                0 => "Introduction & Opening Scripture".to_string(),
                1 => "Message Exposition & Core Teaching".to_string(),
                2 => "Biblical Application & Principles".to_string(),
                3 => "Personal Testimony & Exhortation".to_string(),
                _ if i == num_chapters - 1 => "Closing Prayer & Benediction".to_string(),
                _ => format!("Teaching Section · Part {}", i + 1),
            };

            chapters.push(Chapter {
                id: Uuid::new_v4(),
                title,
                summary: format!("Sermon teaching from {} to {}.", format_timestamp(ch_start), format_timestamp(ch_end)),
                start_time: ch_start,
                end_time: ch_end,
            });
        }
    }

    let total_passed = highlights.len();
    SermonAnalysisResult {
        chapters,
        highlights_report: HighlightDetectionReport {
            highlights,
            total_proposed: total_passed,
            total_passed,
            discarded: Vec::new(),
            status: HighlightDetectionStatus::Success,
            error_message: None,
        },
    }
}

pub async fn analyze_sermon(
    api_key: Option<&str>,
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
                error_message: None,
            },
        });
    }

    // If no API key is provided, execute offline heuristic analysis directly
    let key = match api_key.filter(|k| !k.trim().is_empty()) {
        Some(k) => k,
        None => {
            tracing::info!("No API key provided — executing instant zero-key offline heuristic analysis.");
            return Ok(analyze_sermon_offline_heuristics(segments));
        }
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .context("building reqwest client")?;

    let formatted_transcript = format_segments_to_prompt(segments);

    let system_prompt = r#"You are an experienced pastoral editor and media director.
Analyze the timestamped sermon transcript and produce structured output containing BOTH topic chapters and high-impact video clips.

Return JSON in this exact structure:
{
  "chapters": [
    {
      "title": "Topic Chapter Title (3-7 words)",
      "summary": "Overview of this teaching section",
      "start_timestamp": 0.0,
      "end_timestamp": 320.0
    }
  ],
  "clips": [
    {
      "title": "Compelling Title (3-7 words)",
      "start_timestamp": 45.0,
      "end_timestamp": 90.0,
      "reason": "Spiritual insight and conviction why this moment impacts listeners",
      "suggested_hook_text": "Key core truth or scripture quote"
    }
  ]
}

Guidelines:
1. Chapters: 3 to 8 logical topic chapters spanning the transcript chronologically.
2. Clips: 2 to 6 high-impact clips, each strictly between 30 and 90 seconds in duration."#;

    let user_prompt = format!(
        "Analyze the following timestamped sermon transcript:\n\n{}",
        formatted_transcript
    );

    let models_to_try = [
        DEFAULT_MOMENT_MODEL,
        FALLBACK_MOMENT_MODEL,
        LEGACY_FALLBACK_MODEL_1,
        LEGACY_FALLBACK_MODEL_2,
    ];

    for model in models_to_try {
        let request_body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": &user_prompt }
            ],
            "temperature": 0.3,
            "response_format": { "type": "json_object" }
        });

        match client
            .post(GROQ_CHAT_URL)
            .bearer_auth(key)
            .json(&request_body)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(chat_resp) = resp.json::<ChatResponse>().await {
                    if let Some(first_choice) = chat_resp.choices.first() {
                        if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(&first_choice.message.content) {
                            let chapters = parse_and_validate_chapters(&parsed_json);
                            let (highlights, discarded, total_proposed) = parse_and_validate_highlights_detailed(&parsed_json);
                            let total_passed = highlights.len();

                            return Ok(SermonAnalysisResult {
                                chapters,
                                highlights_report: HighlightDetectionReport {
                                    highlights,
                                    total_proposed,
                                    total_passed,
                                    discarded,
                                    status: if total_passed > 0 { HighlightDetectionStatus::Success } else { HighlightDetectionStatus::AllCandidatesFiltered },
                                    error_message: None,
                                },
                            });
                        }
                    }
                }
            }
            _ => continue,
        }
    }

    // Fallback to offline heuristic extractor if cloud fails
    tracing::info!("Cloud LLM unavailable — falling back to offline heuristic analysis.");
    Ok(analyze_sermon_offline_heuristics(segments))
}
