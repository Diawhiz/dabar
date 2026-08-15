# Dabar Architecture & Pipeline Design

Dabar is a sermon audio processing and illumination app with a **Rust / Tauri v2 desktop core** and a **React frontend**.

```
┌────────────────────────────────────────────────────────┐
│                   React Desktop UI                     │
│  (Chapters Studio · Manuscript Reader · Instant Search)│
└───────────────────────────┬────────────────────────────┘
                            │ Tauri IPC (Commands + Events)
┌───────────────────────────▼────────────────────────────┐
│                  Dabar Tauri Core                      │
│   (Local SQLite · HTML5 Asset Stream · Audio Storage)  │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│ Primary Pipeline      │       │ Fallback Pipeline     │
│ AssemblyAI            │       │ Groq Whisper +        │
│ Speech-to-Text +      │       │ Chunked LLM Chaptering│
│ Auto-Chapters         │       │ (or Offline GGML)     │
└───────────────────────┘       └───────────────────────┘
```

---

## 1. Primary Pipeline: AssemblyAI Auto-Chapters

Instead of brittle single-shot LLM prompts attempting to extract 30–90s clips from hour-long sermons, Dabar leverages **AssemblyAI Auto-Chapters** for combined high-accuracy transcription and topic-based sermon chapter segmentation.

### Step-by-Step Execution:
1. **Audio Ingestion**:
   - Downloads source audio from YouTube or Google Drive (via `yt-dlp`), or ingests local MP3/WAV/M4A files.
   - Copies audio to persistent local storage: `%APPDATA%\com.dabar.app\audio\{sermon_id}.mp3`.
   - Emits live download progress to the frontend.

2. **Upload to AssemblyAI**:
   - `POST https://api.assemblyai.com/v2/upload` with raw audio stream/bytes.
   - Returns a secure `upload_url`.

3. **Transcription & Auto-Chaptering Job**:
   - `POST https://api.assemblyai.com/v2/transcript` with configuration:
     ```json
     {
       "audio_url": "<upload_url>",
       "auto_chapters": true,
       "punctuate": true,
       "format_text": true
     }
     ```
   - Returns a unique transcript ID and queues the job.

4. **Resilient Polling & Parsing**:
   - Polls `GET https://api.assemblyai.com/v2/transcript/{id}` every 3 seconds.
   - Granular progress reporting (25% -> 95%) emitted over Tauri IPC.
   - When status reaches `"completed"`, parses:
     - `words` -> transformed into sentence-level `TranscriptSegment`s (`start`, `end`, `text`).
     - `chapters` -> transformed into `Chapter` structs (`id`, `title`, `summary`, `start_time`, `end_time`).

5. **Persistence**:
   - Saves sermon metadata, chapter list, and transcript segments in local SQLite database inside an atomic transaction.
   - Emits completion event.

---

## 2. Data Model

### Chapter (`packages/core/src/models.rs`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: Uuid,
    pub title: String,
    pub summary: String,
    pub start_time: f32, // in seconds
    pub end_time: f32,   // in seconds
}
```

### SQLite Schema (`chapters` table)
```sql
CREATE TABLE IF NOT EXISTS chapters (
    id          TEXT PRIMARY KEY,
    sermon_id   TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    summary     TEXT NOT NULL DEFAULT '',
    start_time  REAL NOT NULL,
    end_time    REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapters_sermon_id ON chapters(sermon_id, start_time);
```

---

## 3. Real Audio Playback & Synchronization

- **Asset Protocol**: Local audio files are streamed directly to the frontend webview via Tauri's custom asset protocol (`convertFileSrc(audio_path)`).
- **Synchronized Seeking**:
  - Clicking any Chapter card seeks the audio player to `chapter.start_time` and plays.
  - Clicking any manuscript timestamp seeks audio to that second.
  - URL timestamp parameters (`/transcript/:id?t=120`) jump directly to that chapter or timestamp.

---

## 4. Client-Side Instant Search

Dabar performs instant full-text search without external search indexes:
- **Search Scope**: Chapter titles, chapter summaries, and manuscript text segments.
- **Visual Feedback**:
  - Matches in chapters are displayed in quick-jump cards.
  - Matches in manuscript filter segments and display exact occurrence counts.

---

## 5. Fallback Roadmap: Groq Whisper & Offline Whisper

When an AssemblyAI API key is not configured:
1. **Groq Whisper**: Audio is preprocessed to 16kHz mono MP3, split into <=24MB chunks with 5-second overlap if needed, and transcribed.
2. **Chunked Chaptering (Future Fallback)**: Multi-pass map-reduce LLM chaptering to prevent token rate limits (TPM).
3. **Offline Mode**: GGML whisper.cpp models for zero-cloud environments.
