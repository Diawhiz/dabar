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
    let output = get_binary_command("yt-dlp")
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

pub async fn resolve_stream_url(youtube_url: &str) -> Result<String> {
    let output = get_binary_command("yt-dlp")
        .arg("-g")
        .arg("--extractor-args")
        .arg("youtube:player_client=android_vr,tv")
        .arg(youtube_url)
        .output()
        .await
        .context("running yt-dlp -g to resolve media stream URL")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("yt-dlp stream resolution failed: {}", stderr.trim());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let resolved_url = stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .context("yt-dlp -g returned empty stdout")?
        .to_string();

    Ok(resolved_url)
}

pub async fn check_yt_dlp_installed() -> Result<String> {
    let output = get_binary_command("yt-dlp")
        .arg("--version")
        .output()
        .await
        .context("executing yt-dlp --version")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("yt-dlp execution failed: {}", stderr.trim());
    }

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        anyhow::bail!("yt-dlp returned empty version output");
    }

    Ok(version)
}

fn get_binary_command(name: &str) -> Command {
    if name == "yt-dlp" {
        if let Ok(custom_path) = std::env::var("YT_DLP_PATH") {
            let trimmed = custom_path.trim();
            if !trimmed.is_empty() {
                let p = Path::new(trimmed);
                if p.is_absolute() && p.exists() {
                    return Command::new(p);
                }
                if let Ok(cwd) = std::env::current_dir() {
                    let rel_candidate = cwd.join(p);
                    if rel_candidate.exists() {
                        return Command::new(rel_candidate);
                    }
                }
                return Command::new(trimmed);
            }
        }
    }

    let exe_name = if cfg!(windows) && !name.ends_with(".exe") {
        format!("{name}.exe")
    } else {
        name.to_string()
    };

    if let Ok(cwd) = std::env::current_dir() {
        let candidate = cwd.join("bin").join(&exe_name);
        if candidate.exists() {
            return Command::new(candidate);
        }
    }

    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let candidate = PathBuf::from(&home).join(".local/bin").join(&exe_name);
        if candidate.exists() {
            return Command::new(candidate);
        }
    }

    Command::new(name)
}

