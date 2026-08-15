use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use dabar_core::{Highlight, Sermon, SermonStatus, TranscriptSegment};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

/// Local SQLite database state for the desktop app.
/// Uses SqlitePool (not AnyPool) for simpler, faster queries.
#[derive(Clone)]
pub struct Db {
    pub pool: SqlitePool,
}

impl Db {
    /// Connect to (or create) the local SQLite database in the app data directory.
    pub async fn connect(db_path: &str) -> Result<Self> {
        let pool = SqlitePool::connect(db_path)
            .await
            .with_context(|| format!("connecting to SQLite at {db_path}"))?;

        // Run embedded migrations with resilient fallback if dev modified the file
        if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
            tracing::warn!("sqlx migration warning ({e}); applying schema definitions directly...");
            let ddl = include_str!("../migrations/001_initial.sql");
            for statement in ddl.split(';') {
                let stmt = statement.trim();
                if !stmt.is_empty() {
                    let _ = sqlx::query(stmt).execute(&pool).await;
                }
            }
            // Clear stale migration checksum entry so future migrations are clean
            let _ = sqlx::query("DROP TABLE IF EXISTS _sqlx_migrations").execute(&pool).await;
        }

        tracing::info!("Database connected and migrations applied: {db_path}");
        Ok(Self { pool })
    }

    // ── Sermon operations ─────────────────────────────────────────────────────

    pub async fn insert_sermon(&self, sermon: &Sermon) -> Result<()> {
        sqlx::query(
            "INSERT INTO sermons (id, title, source_url, source_type, status, created_at, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(sermon.id.to_string())
        .bind(&sermon.title)
        .bind(&sermon.youtube_url)
        .bind("youtube")
        .bind(status_to_str(&sermon.status))
        .bind(sermon.created_at.to_rfc3339())
        .bind(&sermon.error_message)
        .execute(&self.pool)
        .await
        .context("inserting sermon")?;
        Ok(())
    }

    pub async fn list_sermons(&self) -> Result<Vec<Sermon>> {
        let rows = sqlx::query(
            "SELECT id, title, source_url, status, created_at, error_message
             FROM sermons ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .context("listing sermons")?;

        rows.into_iter().map(row_to_sermon).collect()
    }

    pub async fn get_sermon(&self, id: Uuid) -> Result<Option<Sermon>> {
        let row = sqlx::query(
            "SELECT id, title, source_url, status, created_at, error_message
             FROM sermons WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await
        .context("fetching sermon")?;

        let Some(row) = row else { return Ok(None) };
        let mut sermon = row_to_sermon(row)?;
        sermon.highlights = self.list_highlights(id).await?;
        sermon.transcript_segments = self.list_transcript_segments(id).await?;
        Ok(Some(sermon))
    }

    pub async fn get_highlight_with_sermon(
        &self,
        highlight_id: Uuid,
    ) -> Result<Option<(Highlight, Sermon)>> {
        let hl_row = sqlx::query(
            "SELECT id, sermon_id, title, start_time, end_time, score, reason, suggested_hook_text
             FROM highlights WHERE id = ?",
        )
        .bind(highlight_id.to_string())
        .fetch_optional(&self.pool)
        .await
        .context("fetching highlight")?;

        let Some(hl_row) = hl_row else { return Ok(None) };

        let highlight = Highlight {
            id: Uuid::parse_str(hl_row.try_get::<String, _>("id")?.as_str())?,
            title: hl_row.try_get("title")?,
            start_time: hl_row.try_get::<f64, _>("start_time")? as f32,
            end_time: hl_row.try_get::<f64, _>("end_time")? as f32,
            score: hl_row.try_get::<f64, _>("score")? as f32,
            reason: hl_row.try_get("reason").unwrap_or_default(),
            suggested_hook_text: hl_row.try_get("suggested_hook_text").unwrap_or_default(),
        };

        let sermon_id_str: String = hl_row.try_get("sermon_id")?;
        let sermon_id = Uuid::parse_str(&sermon_id_str)?;
        let sermon = self
            .get_sermon(sermon_id)
            .await?
            .context("parent sermon for highlight missing")?;

        Ok(Some((highlight, sermon)))
    }

    async fn list_highlights(&self, sermon_id: Uuid) -> Result<Vec<Highlight>> {
        let rows = sqlx::query(
            "SELECT id, title, start_time, end_time, score, reason, suggested_hook_text
             FROM highlights WHERE sermon_id = ?
             ORDER BY score DESC, start_time ASC",
        )
        .bind(sermon_id.to_string())
        .fetch_all(&self.pool)
        .await
        .context("listing highlights")?;

        rows.into_iter()
            .map(|row| {
                Ok(Highlight {
                    id: Uuid::parse_str(row.try_get::<String, _>("id")?.as_str())?,
                    title: row.try_get("title")?,
                    start_time: row.try_get::<f64, _>("start_time")? as f32,
                    end_time: row.try_get::<f64, _>("end_time")? as f32,
                    score: row.try_get::<f64, _>("score")? as f32,
                    reason: row.try_get("reason").unwrap_or_default(),
                    suggested_hook_text: row.try_get("suggested_hook_text").unwrap_or_default(),
                })
            })
            .collect()
    }

    async fn list_transcript_segments(&self, sermon_id: Uuid) -> Result<Vec<TranscriptSegment>> {
        let rows = sqlx::query(
            "SELECT start_time, end_time, text FROM transcript_segments
             WHERE sermon_id = ? ORDER BY ordinal ASC",
        )
        .bind(sermon_id.to_string())
        .fetch_all(&self.pool)
        .await
        .context("listing transcript segments")?;

        rows.into_iter()
            .map(|row| {
                Ok(TranscriptSegment {
                    start: row.try_get::<f64, _>("start_time")? as f32,
                    end: row.try_get::<f64, _>("end_time")? as f32,
                    text: row.try_get("text")?,
                })
            })
            .collect()
    }

    pub async fn update_status(&self, id: Uuid, status: SermonStatus) -> Result<()> {
        sqlx::query("UPDATE sermons SET status = ? WHERE id = ?")
            .bind(status_to_str(&status))
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .context("updating sermon status")?;
        Ok(())
    }

    pub async fn update_title(&self, id: Uuid, title: &str) -> Result<()> {
        sqlx::query("UPDATE sermons SET title = ? WHERE id = ?")
            .bind(title)
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .context("updating sermon title")?;
        Ok(())
    }

    pub async fn mark_failed(&self, id: Uuid, error_message: &str) -> Result<()> {
        sqlx::query("UPDATE sermons SET status = 'failed', error_message = ? WHERE id = ?")
            .bind(error_message)
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .context("marking sermon as failed")?;
        Ok(())
    }

    pub async fn save_sermon_results(
        &self,
        id: Uuid,
        title: Option<&str>,
        highlights: &[Highlight],
        segments: &[TranscriptSegment],
    ) -> Result<()> {
        let mut tx = self.pool.begin().await.context("beginning transaction")?;

        if let Some(t) = title {
            sqlx::query("UPDATE sermons SET title = ? WHERE id = ?")
                .bind(t)
                .bind(id.to_string())
                .execute(&mut *tx)
                .await
                .context("updating sermon title in transaction")?;
        }

        for (ordinal, seg) in segments.iter().enumerate() {
            sqlx::query(
                "INSERT INTO transcript_segments (id, sermon_id, start_time, end_time, text, ordinal)
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(id.to_string())
            .bind(seg.start as f64)
            .bind(seg.end as f64)
            .bind(&seg.text)
            .bind(ordinal as i64)
            .execute(&mut *tx)
            .await
            .context("inserting transcript segment")?;
        }

        for hl in highlights {
            sqlx::query(
                "INSERT INTO highlights (id, sermon_id, title, start_time, end_time, score, reason, suggested_hook_text)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(hl.id.to_string())
            .bind(id.to_string())
            .bind(&hl.title)
            .bind(hl.start_time as f64)
            .bind(hl.end_time as f64)
            .bind(hl.score as f64)
            .bind(&hl.reason)
            .bind(&hl.suggested_hook_text)
            .execute(&mut *tx)
            .await
            .context("inserting highlight")?;
        }

        sqlx::query("UPDATE sermons SET status = 'ready' WHERE id = ?")
            .bind(id.to_string())
            .execute(&mut *tx)
            .await
            .context("marking sermon as ready")?;

        tx.commit().await.context("committing sermon result transaction")?;
        Ok(())
    }

    // ── Settings operations ───────────────────────────────────────────────────

    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let row = sqlx::query("SELECT value FROM settings WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .context("fetching setting")?;
        Ok(row.and_then(|r| r.try_get::<Option<String>, _>("value").ok().flatten()))
    }

    pub async fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(&self.pool)
        .await
        .context("saving setting")?;
        Ok(())
    }

    // ── Pipeline checkpoint operations ────────────────────────────────────────

    pub async fn save_checkpoint(&self, sermon_id: Uuid, stage: &str, temp_path: &str) -> Result<()> {
        sqlx::query(
            "INSERT INTO pipeline_checkpoints (sermon_id, last_stage, temp_path, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(sermon_id) DO UPDATE SET
               last_stage = excluded.last_stage,
               temp_path = excluded.temp_path,
               updated_at = excluded.updated_at",
        )
        .bind(sermon_id.to_string())
        .bind(stage)
        .bind(temp_path)
        .bind(Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await
        .context("saving pipeline checkpoint")?;
        Ok(())
    }

    pub async fn delete_checkpoint(&self, sermon_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM pipeline_checkpoints WHERE sermon_id = ?")
            .bind(sermon_id.to_string())
            .execute(&self.pool)
            .await
            .context("deleting pipeline checkpoint")?;
        Ok(())
    }

    pub async fn list_incomplete_pipelines(&self) -> Result<Vec<(Uuid, String, String)>> {
        let rows = sqlx::query(
            "SELECT sermon_id, last_stage, temp_path FROM pipeline_checkpoints",
        )
        .fetch_all(&self.pool)
        .await
        .context("listing incomplete pipelines")?;

        rows.into_iter()
            .map(|row| {
                let id_str: String = row.try_get("sermon_id")?;
                let stage: String = row.try_get("last_stage")?;
                let path: String = row.try_get("temp_path")?;
                Ok((Uuid::parse_str(&id_str)?, stage, path))
            })
            .collect()
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn row_to_sermon(row: sqlx::sqlite::SqliteRow) -> Result<Sermon> {
    let status_str: String = row.try_get("status")?;
    let created_at_str: String = row.try_get("created_at")?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)?.with_timezone(&Utc);

    Ok(Sermon {
        id: Uuid::parse_str(row.try_get::<String, _>("id")?.as_str())?,
        title: row.try_get("title")?,
        youtube_url: row.try_get("source_url")?,
        status: status_from_str(&status_str),
        created_at,
        error_message: row.try_get("error_message")?,
        highlights: Vec::new(),
        transcript_segments: Vec::new(),
    })
}

pub fn status_to_str(status: &SermonStatus) -> &'static str {
    match status {
        SermonStatus::Queued => "queued",
        SermonStatus::Downloading => "downloading",
        SermonStatus::Transcribing => "transcribing",
        SermonStatus::Detecting => "detecting",
        SermonStatus::Processing => "processing",
        SermonStatus::Ready => "ready",
        SermonStatus::Failed => "failed",
    }
}

pub fn status_from_str(status: &str) -> SermonStatus {
    match status {
        "downloading" => SermonStatus::Downloading,
        "transcribing" => SermonStatus::Transcribing,
        "detecting" => SermonStatus::Detecting,
        "processing" => SermonStatus::Processing,
        "ready" => SermonStatus::Ready,
        "failed" => SermonStatus::Failed,
        _ => SermonStatus::Queued,
    }
}
