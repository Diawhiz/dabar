use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::process::Command;

#[derive(Debug, Clone)]
pub struct DownloadedAudio {
    pub path: PathBuf,
    pub title: Option<String>,
}

pub async fn download_youtube_audio(
    youtube_url: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    tokio::fs::create_dir_all(output_dir)
        .await
        .with_context(|| format!("creating audio output directory {}", output_dir.display()))?;

    let output_template = output_dir.join("%(id)s.%(ext)s");
    let output = Command::new("yt-dlp")
        .arg("--extract-audio")
        .arg("--audio-format")
        .arg("m4a")
        .arg("--print")
        .arg("after_move:filepath")
        .arg("--print")
        .arg("title")
        .arg("--extractor-args")
        .arg("youtube:player_client=android_vr,tv")
        .arg("--output")
        .arg(&output_template)
        .arg(youtube_url)
        .output()
        .await
        .context("running yt-dlp")?;

    if !output.status.success() {
        anyhow::bail!(
            "yt-dlp failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        );
    }

    let lines: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect();

    let path = lines
        .iter()
        .find(|line| Path::new(line.as_str()).exists())
        .map(PathBuf::from)
        .context("yt-dlp did not report a downloaded audio path")?;

    let title = lines
        .into_iter()
        .find(|line| line != path.to_string_lossy().as_ref());
    Ok(DownloadedAudio { path, title })
}
