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
    pub transcript_segments: Vec<TranscriptSegment>,
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
            transcript_segments: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub id: Uuid,
    pub title: String,
    pub start_time: f32,
    pub end_time: f32,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}
