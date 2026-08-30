use crate::models::{Chapter, Highlight, TranscriptSegment};
use crate::structuring::detect_scripture_references;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

const GROQ_CHAT_URL: &str = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

pub const DEFAULT_MOMENT_MODEL: &str = "llama-3.3-70b-versatile";
pub const FALLBACK_MOMENT_MODEL: &str = "llama-3.1-8b-instant";
const GROQ_FALLBACK_MODEL: &str = "gemma2-9b-it";
const OPENROUTER_MODEL_1: &str = "meta-llama/llama-3.2-3b-instruct:free";
const OPENROUTER_MODEL_2: &str = "google/gemma-2-9b-it:free";

const CLIP_MIN_SECS: f32 = 30.0;
const CLIP_MAX_SECS: f32 = 180.0;
const MAX_PROMPT_WORDS: usize = 2_500;

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
        .map(|seg| format!("{} {}", format_timestamp(seg.start), seg.text.trim()))
        .collect::<Vec<_>>()
        .join("\n")
}

fn condense_transcript(segments: &[TranscriptSegment]) -> String {
    let full = format_segments_to_prompt(segments);
    let word_count: usize = full.split_whitespace().count();
    if word_count <= MAX_PROMPT_WORDS {
        return full;
    }
    tracing::info!("Transcript ~{word_count} words — condensing to ~{MAX_PROMPT_WORDS} for LLM");
    let scores: Vec<f32> = segments.iter().map(segment_importance_score).collect();
    let avg_words: f32 = word_count as f32 / segments.len() as f32;
    let target_segs = (MAX_PROMPT_WORDS as f32 / avg_words.max(1.0)) as usize;
    let step = (segments.len() / target_segs.max(1)).max(1);
    let mut selected: Vec<usize> = vec![0];
    let mut i = step;
    while i < segments.len().saturating_sub(1) {
        let end = (i + step).min(segments.len());
        let best = (i..end)
            .max_by(|&a, &b| scores[a].partial_cmp(&scores[b]).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(i);
        selected.push(best);
        i += step;
    }
    if segments.len() > 1 { selected.push(segments.len() - 1); }
    selected.sort_unstable();
    selected.dedup();
    let mut lines = Vec::new();
    let mut prev: Option<usize> = None;
    for idx in &selected {
        if let Some(p) = prev {
            if *idx > p + 1 {
                let gap = segments[*idx].start - segments[p].end;
                lines.push(format!("  ... [{:.0}s omitted] ...", gap));
            }
        }
        lines.push(format!("{} {}", format_timestamp(segments[*idx].start), segments[*idx].text.trim()));
        prev = Some(*idx);
    }
    lines.join("\n")
}

pub fn parse_timestamp_value(val: &serde_json::Value) -> Option<f32> {
    if let Some(n) = val.as_f64() { return Some(n as f32); }
    if let Some(s) = val.as_str() {
        let t = s.trim().trim_matches('[').trim_matches(']');
        let p: Vec<&str> = t.split(':').collect();
        if p.len() == 3 {
            let h: f32 = p[0].parse().ok()?;
            let m: f32 = p[1].parse().ok()?;
            let s: f32 = p[2].parse().ok()?;
            return Some(h * 3600.0 + m * 60.0 + s);
        } else if p.len() == 2 {
            let m: f32 = p[0].parse().ok()?;
            let s: f32 = p[1].parse().ok()?;
            return Some(m * 60.0 + s);
        } else if let Ok(v) = t.parse::<f32>() { return Some(v); }
    }
    None
}

pub fn validate_chapters(mut chapters: Vec<Chapter>) -> Vec<Chapter> {
    if chapters.is_empty() { return Vec::new(); }
    chapters.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap_or(std::cmp::Ordering::Equal));
    let mut validated = Vec::new();
    for ch in chapters {
        if ch.end_time <= ch.start_time { continue; }
        if let Some(prev) = validated.last_mut() {
            let p: &mut Chapter = prev;
            if ch.start_time < p.end_time { p.end_time = ch.start_time; }
        }
        validated.push(ch);
    }
    validated
}

pub fn parse_and_validate_chapters(json_value: &serde_json::Value) -> Vec<Chapter> {
    let arr = match json_value.get("chapters").and_then(|v| v.as_array()) {
        Some(a) => a, None => return Vec::new(),
    };
    let mut result = Vec::new();
    for item in arr {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Sermon Section").trim().to_string();
        let summary = item.get("summary").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let start = item.get("start_time").or_else(|| item.get("start_timestamp")).and_then(parse_timestamp_value);
        let end = item.get("end_time").or_else(|| item.get("end_timestamp")).and_then(parse_timestamp_value);
        if let (Some(s), Some(e)) = (start, end) {
            if e > s { result.push(Chapter { id: Uuid::new_v4(), title, summary, start_time: s, end_time: e }); }
        }
    }
    validate_chapters(result)
}

pub fn parse_and_validate_highlights_detailed(json_value: &serde_json::Value) -> (Vec<Highlight>, Vec<DiscardedCandidate>, usize) {
    let arr = match json_value.get("clips").and_then(|v| v.as_array())
        .or_else(|| json_value.get("highlights").and_then(|v| v.as_array())) {
        Some(a) => a, None => return (Vec::new(), Vec::new(), 0),
    };
    let total = arr.len();
    let mut valid = Vec::new();
    let mut disc = Vec::new();
    for item in arr {
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Sermon Highlight").trim().to_string();
        let start = match item.get("start_timestamp").or_else(|| item.get("start_time")).and_then(parse_timestamp_value) {
            Some(t) => t,
            None => { disc.push(DiscardedCandidate { title, start_time: None, end_time: None, duration: None, reason: "Missing start".to_string() }); continue; }
        };
        let end = match item.get("end_timestamp").or_else(|| item.get("end_time")).and_then(parse_timestamp_value) {
            Some(t) => t,
            None => { disc.push(DiscardedCandidate { title, start_time: Some(start), end_time: None, duration: None, reason: "Missing end".to_string() }); continue; }
        };
        let reason = item.get("reason").and_then(|v| v.as_str()).unwrap_or("High-impact moment.").trim().to_string();
        let hook = item.get("suggested_hook_text").or_else(|| item.get("hook_text")).and_then(|v| v.as_str()).unwrap_or(&title).trim().to_string();
        let score = item.get("score").and_then(|v| v.as_f64()).map(|f| (f as f32).clamp(0.0, 1.0)).unwrap_or(0.90);
        if end <= start { disc.push(DiscardedCandidate { title, start_time: Some(start), end_time: Some(end), duration: Some(end - start), reason: "end <= start".to_string() }); continue; }
        let dur = end - start;
        if dur < CLIP_MIN_SECS { disc.push(DiscardedCandidate { title, start_time: Some(start), end_time: Some(end), duration: Some(dur), reason: format!("{dur:.0}s < min {CLIP_MIN_SECS}s") }); continue; }
        let final_end = if dur > CLIP_MAX_SECS { start + CLIP_MAX_SECS } else { end };
        valid.push(Highlight { id: Uuid::new_v4(), title, start_time: start, end_time: final_end, score, reason, suggested_hook_text: hook });
    }
    (valid, disc, total)
}

pub fn parse_and_validate_highlights(json_value: &serde_json::Value) -> Vec<Highlight> {
    parse_and_validate_highlights_detailed(json_value).0
}

pub async fn analyze_sermon(api_key: Option<&str>, segments: &[TranscriptSegment]) -> Result<SermonAnalysisResult> {
    if segments.is_empty() {
        return Ok(SermonAnalysisResult {
            chapters: Vec::new(),
            highlights_report: HighlightDetectionReport { highlights: Vec::new(), total_proposed: 0, total_passed: 0, discarded: Vec::new(), status: HighlightDetectionStatus::NoCandidatesProposed, error_message: None },
        });
    }
    let key = match api_key.filter(|k| !k.trim().is_empty()) {
        Some(k) => k,
        None => { tracing::info!("No API key — offline heuristics."); return Ok(analyze_sermon_offline_heuristics(segments)); }
    };
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(90)).build().context("building client")?;
    let condensed = condense_transcript(segments);
    let total_dur = segments.last().map(|s| s.end).unwrap_or(0.0);
    let sys = format!(r#"You are a pastoral editor. Analyze the timestamped sermon transcript and return JSON:
{{"chapters":[{{"title":"3-7 word title","summary":"section overview","start_timestamp":0.0,"end_timestamp":300.0}}],"clips":[{{"title":"3-7 word title","start_timestamp":45.0,"end_timestamp":165.0,"reason":"why this impacts listeners","suggested_hook_text":"key quote"}}]}}
Rules: 3-8 chapters spanning the full {total_dur:.0}s sermon. 3-6 clips each 60-180s long. Use exact timestamps from the transcript."#);
    let usr = format!("Analyze this sermon transcript:\n\n{condensed}");

    for model in [DEFAULT_MOMENT_MODEL, FALLBACK_MOMENT_MODEL, GROQ_FALLBACK_MODEL] {
        match try_chat_completion(&client, GROQ_CHAT_URL, key, model, &sys, &usr).await {
            Ok(Some(r)) => { tracing::info!("LLM succeeded: Groq/{model}"); return Ok(r); }
            Ok(None) => tracing::warn!("Groq/{model}: no usable JSON"),
            Err(e) => tracing::warn!("Groq/{model}: {e}"),
        }
    }

    let or_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    for model in [OPENROUTER_MODEL_1, OPENROUTER_MODEL_2] {
        match try_chat_completion(&client, OPENROUTER_CHAT_URL, &or_key, model, &sys, &usr).await {
            Ok(Some(r)) => { tracing::info!("LLM succeeded: OpenRouter/{model}"); return Ok(r); }
            Ok(None) => tracing::warn!("OpenRouter/{model}: no usable JSON"),
            Err(e) => tracing::warn!("OpenRouter/{model}: {e}"),
        }
    }

    tracing::info!("All cloud LLMs unavailable — using upgraded offline heuristics.");
    Ok(analyze_sermon_offline_heuristics(segments))
}

async fn try_chat_completion(client: &reqwest::Client, url: &str, api_key: &str, model: &str, system_prompt: &str, user_prompt: &str) -> Result<Option<SermonAnalysisResult>> {
    let body = json!({"model": model, "messages": [{"role":"system","content":system_prompt},{"role":"user","content":user_prompt}], "temperature": 0.3, "response_format": {"type":"json_object"}});
    let mut req = client.post(url).json(&body);
    if !api_key.trim().is_empty() { req = req.bearer_auth(api_key); }
    if url.contains("openrouter") { req = req.header("HTTP-Referer", "https://dabar.app").header("X-Title", "Dabar"); }
    let resp = req.send().await.with_context(|| format!("request to {url}"))?;
    let status = resp.status();
    if status.as_u16() == 429 { let b = resp.text().await.unwrap_or_default(); anyhow::bail!("rate limited: {}", &b[..b.len().min(200)]); }
    if !status.is_success() { let b = resp.text().await.unwrap_or_default(); anyhow::bail!("HTTP {status}: {}", &b[..b.len().min(200)]); }
    let cr = resp.json::<ChatResponse>().await.context("parsing response")?;
    let content = match cr.choices.first() { Some(c) => &c.message.content, None => return Ok(None) };
    let json_val = match serde_json::from_str::<serde_json::Value>(content) { Ok(v) => v, Err(_) => return Ok(None) };
    let chapters = parse_and_validate_chapters(&json_val);
    let (highlights, discarded, total_proposed) = parse_and_validate_highlights_detailed(&json_val);
    let total_passed = highlights.len();
    if chapters.is_empty() && highlights.is_empty() { return Ok(None); }
    Ok(Some(SermonAnalysisResult {
        chapters,
        highlights_report: HighlightDetectionReport {
            highlights, total_proposed, total_passed, discarded,
            status: if total_passed > 0 { HighlightDetectionStatus::Success } else { HighlightDetectionStatus::AllCandidatesFiltered },
            error_message: None,
        },
    }))
}

pub fn segment_importance_score(seg: &TranscriptSegment) -> f32 {
    let text = seg.text.to_lowercase();
    let mut score: f32 = 0.0;
    let refs = detect_scripture_references(&seg.text, seg.start);
    score += refs.len() as f32 * 0.35;
    score += seg.text.matches('?').count() as f32 * 0.12;
    score += seg.text.matches('!').count() as f32 * 0.08;
    for p in ["you must","you need to","you have to","don't give up","stand up","rise up","hold on","listen to me","receive this"] { if text.contains(p) { score += 0.15; } }
    for p in ["the truth is","what god is saying","here's the key","i want you to understand","let me tell you something","this is important","the spirit of god","holy spirit"] { if text.contains(p) { score += 0.18; } }
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.len() >= 4 {
        let mut counts = std::collections::HashMap::new();
        for w in &words { *counts.entry(w).or_insert(0usize) += 1; }
        let reps: usize = counts.values().filter(|&&c| c >= 2).sum();
        score += (reps as f32 * 0.04).min(0.20);
    }
    for p in ["i remember","there was a time","let me share","one day","god told me"] { if text.contains(p) { score += 0.10; } }
    for p in ["jesus christ","the blood of jesus","salvation","born again","eternal life","the cross","resurrection","he is risen","god so loved","grace of god"] { if text.contains(p) { score += 0.12; } }
    if text.contains("let us pray") || text.contains("father god") || text.contains("in jesus name") { score += 0.08; }
    let dur = (seg.end - seg.start).max(0.0);
    if dur < 10.0 { score *= 0.3; }
    score.min(1.0)
}

fn detect_chapter_boundaries(segments: &[TranscriptSegment], target: usize) -> Vec<usize> {
    if segments.len() < 4 || target <= 1 { return Vec::new(); }
    let win = (segments.len() / (target * 2)).max(3);
    let word_set = |segs: &[TranscriptSegment]| -> std::collections::HashSet<String> {
        segs.iter().flat_map(|s| s.text.split_whitespace().map(|w| w.to_lowercase())).filter(|w| w.len() > 4).collect()
    };
    let mut scores: Vec<(usize, f32)> = Vec::new();
    let mut i = win;
    while i + win < segments.len() {
        let a = word_set(&segments[i.saturating_sub(win)..i]);
        let b = word_set(&segments[i..(i + win).min(segments.len())]);
        if !a.is_empty() && !b.is_empty() {
            let inter = a.intersection(&b).count() as f32;
            let uni = a.union(&b).count() as f32;
            scores.push((i, 1.0 - if uni > 0.0 { inter / uni } else { 0.0 }));
        }
        i += win;
    }
    scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let mut boundaries: Vec<usize> = scores.iter().take(target - 1).map(|(idx, _)| *idx).collect();
    boundaries.sort_unstable();
    boundaries
}

fn derive_chapter_title(segments: &[TranscriptSegment], fallback: &str) -> String {
    for seg in segments.iter().take(10) {
        if let Some(r) = detect_scripture_references(&seg.text, seg.start).into_iter().next() {
            return format!("Teaching from {}", r.reference);
        }
    }
    let best = segments.iter().max_by(|a, b| segment_importance_score(a).partial_cmp(&segment_importance_score(b)).unwrap_or(std::cmp::Ordering::Equal));
    if let Some(seg) = best {
        let words: Vec<&str> = seg.text.split_whitespace().take(8).collect();
        if words.len() >= 4 {
            let mut phrase = words.join(" ");
            if phrase.len() > 50 { phrase.truncate(50); if let Some(p) = phrase.rfind(' ') { phrase.truncate(p); } }
            phrase = phrase.trim_end_matches(|c: char| !c.is_alphanumeric()).to_string();
            if !phrase.is_empty() { return phrase; }
        }
    }
    fallback.to_string()
}

fn derive_clip_title(segs: &[&TranscriptSegment]) -> String {
    for seg in segs.iter().take(5) {
        if let Some(r) = detect_scripture_references(&seg.text, seg.start).into_iter().next() {
            return format!("Teaching: {}", r.reference);
        }
    }
    let best = segs.iter().max_by(|a, b| segment_importance_score(a).partial_cmp(&segment_importance_score(b)).unwrap_or(std::cmp::Ordering::Equal));
    if let Some(seg) = best {
        let words: Vec<&str> = seg.text.split_whitespace().take(7).collect();
        if words.len() >= 3 {
            let mut p = words.join(" ");
            p = p.trim_end_matches(|c: char| !c.is_alphanumeric()).to_string();
            if !p.is_empty() { return p; }
        }
    }
    "Key Preaching Moment".to_string()
}

pub fn analyze_sermon_offline_heuristics(segments: &[TranscriptSegment]) -> SermonAnalysisResult {
    if segments.is_empty() {
        return SermonAnalysisResult {
            chapters: Vec::new(),
            highlights_report: HighlightDetectionReport { highlights: Vec::new(), total_proposed: 0, total_passed: 0, discarded: Vec::new(), status: HighlightDetectionStatus::NoCandidatesProposed, error_message: None },
        };
    }
    let total_dur = segments.last().map(|s| s.end).unwrap_or(0.0);
    let scores: Vec<f32> = segments.iter().map(segment_importance_score).collect();

    // Build candidates: sum scores over 45s windows
    let mut candidates: Vec<(usize, f32)> = (0..segments.len()).filter_map(|i| {
        let ws: f32 = segments[i..].iter().zip(scores[i..].iter())
            .take_while(|(s, _)| s.start - segments[i].start < 45.0)
            .map(|(_, sc)| sc).sum();
        if ws > 0.1 { Some((i, ws)) } else { None }
    }).collect();
    candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let target_clips = if total_dur > 3600.0 { 6 } else if total_dur > 1200.0 { 5 } else { 3 };
    let gap = 120.0_f32;
    let mut highlights: Vec<Highlight> = Vec::new();
    let mut last_end = -gap;
    let mut used: Vec<f32> = Vec::new();
    let clip_dur = if total_dur > 3600.0 { 150.0_f32 } else { 120.0_f32 };

    for (seg_idx, _) in &candidates {
        if highlights.len() >= target_clips { break; }
        let start = segments[*seg_idx].start;
        if start < last_end + gap || used.iter().any(|&s| (s - start).abs() < gap) { continue; }
        let end_target = start + clip_dur;
        let end = segments[*seg_idx..].iter().find(|s| s.end >= end_target)
            .map(|s| s.end.min(start + CLIP_MAX_SECS))
            .unwrap_or_else(|| (start + clip_dur).min(total_dur));
        if end <= start + CLIP_MIN_SECS { continue; }
        let clip_segs: Vec<&TranscriptSegment> = segments[*seg_idx..].iter().take_while(|s| s.start <= end).collect();
        let title = derive_clip_title(&clip_segs);
        let hook = segments[*seg_idx..].iter().zip(scores[*seg_idx..].iter())
            .take_while(|(s, _)| s.start <= end)
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(s, _)| s.text.chars().take(120).collect::<String>())
            .unwrap_or_else(|| title.clone());
        highlights.push(Highlight { id: Uuid::new_v4(), title, start_time: start, end_time: end, score: (0.85 + highlights.len() as f32 * 0.02).min(0.95), reason: "Multi-signal heuristic peak.".to_string(), suggested_hook_text: hook });
        last_end = end;
        used.push(start);
    }

    if highlights.is_empty() && total_dur > 60.0 {
        let count = 3_usize.min((total_dur / 300.0) as usize + 1);
        let interval = total_dur / (count as f32 + 1.0);
        for i in 1..=count {
            let s = interval * i as f32;
            let e = (s + clip_dur).min(total_dur);
            if e > s + CLIP_MIN_SECS {
                highlights.push(Highlight { id: Uuid::new_v4(), title: format!("Key Moment · Part {i}"), start_time: s, end_time: e, score: 0.80, reason: "Evenly-spaced fallback.".to_string(), suggested_hook_text: "Key sermon moment.".to_string() });
            }
        }
    }

    let target_chs = if total_dur > 3600.0 { 8 } else if total_dur > 1800.0 { 6 } else if total_dur > 600.0 { 4 } else { 3 };
    let boundaries = detect_chapter_boundaries(segments, target_chs);
    let mut ranges: Vec<(usize, usize)> = Vec::new();
    let mut prev = 0;
    for &b in &boundaries { if b > prev { ranges.push((prev, b)); prev = b; } }
    ranges.push((prev, segments.len()));
    let names = ["Introduction & Opening","Scripture & Context","Core Teaching","Illustration & Application","Altar Call & Exhortation","Testimony & Encouragement","Prayer & Intercession","Closing & Benediction"];
    let mut chapters: Vec<Chapter> = ranges.iter().enumerate().filter_map(|(i, (si, ei))| {
        let ch = &segments[*si..*ei];
        if ch.is_empty() { return None; }
        let cs = ch.first().unwrap().start;
        let ce = ch.last().unwrap().end;
        if ce <= cs { return None; }
        let fb = names.get(i).copied().unwrap_or("Teaching Section");
        Some(Chapter { id: Uuid::new_v4(), title: derive_chapter_title(ch, fb), summary: format!("From {} to {}.", format_timestamp(cs), format_timestamp(ce)), start_time: cs, end_time: ce })
    }).collect();

    if chapters.is_empty() {
        let interval = 360.0_f32;
        let n = ((total_dur / interval).ceil() as usize).max(1);
        for i in 0..n {
            let cs = i as f32 * interval;
            let ce = ((i+1) as f32 * interval).min(total_dur);
            if ce > cs { chapters.push(Chapter { id: Uuid::new_v4(), title: names.get(i).copied().unwrap_or("Teaching Section").to_string(), summary: format!("From {} to {}.", format_timestamp(cs), format_timestamp(ce)), start_time: cs, end_time: ce }); }
        }
    }

    let tp = highlights.len();
    SermonAnalysisResult { chapters, highlights_report: HighlightDetectionReport { highlights, total_proposed: tp, total_passed: tp, discarded: Vec::new(), status: HighlightDetectionStatus::Success, error_message: None } }
}
