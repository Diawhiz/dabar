CREATE TABLE IF NOT EXISTS sermons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    youtube_url TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    sermon_id TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    score REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_highlights_sermon_id ON highlights(sermon_id);

CREATE TABLE IF NOT EXISTS transcript_segments (
    id TEXT PRIMARY KEY,
    sermon_id TEXT NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    text TEXT NOT NULL,
    ordinal INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_sermon_id
    ON transcript_segments(sermon_id, ordinal);

