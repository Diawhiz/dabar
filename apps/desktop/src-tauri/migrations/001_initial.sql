-- Dabar Desktop — SQLite Schema
-- Consolidated initial migration for the local desktop database.

CREATE TABLE IF NOT EXISTS sermons (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL DEFAULT 'Untitled Sermon',
    source_url        TEXT NOT NULL DEFAULT '',   -- YouTube URL or local file path
    source_type       TEXT NOT NULL DEFAULT 'youtube',  -- 'youtube' | 'local'
    status            TEXT NOT NULL DEFAULT 'queued',
    created_at        TEXT NOT NULL,
    error_message     TEXT,
    audio_path        TEXT,
    highlight_status  TEXT,
    highlight_error   TEXT,
    total_candidates  INTEGER,
    passed_candidates INTEGER
);

CREATE TABLE IF NOT EXISTS highlights (
    id                  TEXT PRIMARY KEY,
    sermon_id           TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    start_time          REAL NOT NULL,
    end_time            REAL NOT NULL,
    score               REAL NOT NULL,
    reason              TEXT NOT NULL DEFAULT '',
    suggested_hook_text TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_highlights_sermon_id ON highlights(sermon_id);

CREATE TABLE IF NOT EXISTS transcript_segments (
    id          TEXT PRIMARY KEY,
    sermon_id   TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    start_time  REAL NOT NULL,
    end_time    REAL NOT NULL,
    text        TEXT NOT NULL,
    ordinal     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_sermon_id
    ON transcript_segments(sermon_id, ordinal);

-- Key-value store for user preferences and settings
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Tracks in-progress pipeline stages for crash recovery
CREATE TABLE IF NOT EXISTS pipeline_checkpoints (
    sermon_id   TEXT PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
    last_stage  TEXT NOT NULL,      -- 'downloading' | 'transcribing' | 'detecting'
    temp_path   TEXT NOT NULL,      -- path to the downloaded audio temp file
    updated_at  TEXT NOT NULL
);
