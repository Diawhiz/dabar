use anyhow::{Context, Result};
use std::path::Path;
use tokio::process::Command;

pub async fn render_vertical_clip(
    input_path: &Path,
    output_path: &Path,
    start_time: f32,
    end_time: f32,
) -> Result<()> {
    if end_time <= start_time {
        anyhow::bail!("clip end_time must be greater than start_time");
    }

    let duration = end_time - start_time;
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-ss")
        .arg(format!("{start_time:.3}"))
        .arg("-i")
        .arg(input_path)
        .arg("-t")
        .arg(format!("{duration:.3}"))
        .arg("-vf")
        .arg("scale=1080:-2,crop=1080:1920")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-c:a")
        .arg("aac")
        .arg(output_path)
        .output()
        .await
        .context("running ffmpeg")?;

    if !output.status.success() {
        anyhow::bail!(
            "ffmpeg failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }

    Ok(())
}
