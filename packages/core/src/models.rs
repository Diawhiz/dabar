use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SermonStatus {
    Queued,
    Downloading,
    Transcribing,
    Detecting,
    Processing,
    Ready,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sermon {
    pub id: Uuid,
    pub title: String,
    pub youtube_url: String,
    pub status: SermonStatus,
    pub created_at: DateTime<Utc>,
    pub error_message: Option<String>,
    pub highlights: Vec<Highlight>,
    #[serde(default)]
    pub chapters: Vec<Chapter>,
    pub transcript_segments: Vec<TranscriptSegment>,
    #[serde(default)]
    pub audio_path: Option<String>,
    #[serde(default)]
    pub highlight_status: Option<String>,
    #[serde(default)]
    pub highlight_error: Option<String>,
    #[serde(default)]
    pub total_candidates: Option<u32>,
    #[serde(default)]
    pub passed_candidates: Option<u32>,
}

impl Sermon {
    pub fn queued(youtube_url: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            title: "Queued Sermon".to_string(),
            youtube_url,
            status: SermonStatus::Queued,
            created_at: Utc::now(),
            error_message: None,
            highlights: Vec::new(),
            chapters: Vec::new(),
            transcript_segments: Vec::new(),
            audio_path: None,
            highlight_status: None,
            highlight_error: None,
            total_candidates: None,
            passed_candidates: None,
        }
    }
}

/// A topic-based sermon chapter with headline, summary, and timestamp span.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: Uuid,
    pub title: String,
    pub summary: String,
    pub start_time: f32,
    pub end_time: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub id: Uuid,
    pub title: String,
    pub start_time: f32,
    pub end_time: f32,
    pub score: f32,
    pub reason: String,
    pub suggested_hook_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}

/// A structured section of a sermon marked by natural speech transitions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub title: String,
    pub start_time: f32,
    pub end_time: f32,
    pub paragraphs: Vec<Paragraph>,
}

/// A structured paragraph grouping adjacent transcript segments with natural pauses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paragraph {
    pub start_time: f32,
    pub end_time: f32,
    pub text: String,
    pub segments: Vec<TranscriptSegment>,
    pub scripture_refs: Vec<ScriptureRef>,
}

/// A detected Scripture reference within a sermon paragraph.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptureRef {
    pub book: String,
    pub reference: String,
    pub timestamp: f32,
}

/// Fully structured sermon transcript ready for the illumination reader & document export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredTranscript {
    pub sections: Vec<Section>,
    pub scripture_references: Vec<ScriptureRef>,
}
