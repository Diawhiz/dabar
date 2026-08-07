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
    let mut cmd = get_binary_command("yt-dlp");
    apply_cookies_arg(&mut cmd);
    cmd.arg("--extract-audio")
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
        .arg(youtube_url);

    let output = cmd.output().await.context("running yt-dlp")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format_yt_dlp_error("download_youtube_audio", &stderr));
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
    let mut cmd = get_binary_command("yt-dlp");
    apply_cookies_arg(&mut cmd);
    cmd.arg("-g")
        .arg("--extractor-args")
        .arg("youtube:player_client=android_vr,tv")
        .arg(youtube_url);

    let output = cmd
        .output()
        .await
        .context("running yt-dlp -g to resolve media stream URL")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format_yt_dlp_error("resolve_stream_url", &stderr));
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

fn get_writable_cookies_path() -> Option<PathBuf> {
    if let Ok(cookies_path) = std::env::var("YT_DLP_COOKIES_PATH") {
        let trimmed = cookies_path.trim();
        if !trimmed.is_empty() {
            let src = Path::new(trimmed);
            if src.exists() {
                let dest = std::env::temp_dir().join("dabar_cookies_writable.txt");
                if let Err(e) = std::fs::copy(src, &dest) {
                    eprintln!("Warning: failed to copy cookies file to writable location: {:?}", e);
                    return Some(PathBuf::from(trimmed));
                }
                return Some(dest);
            }
        }
    }
    None
}

fn apply_cookies_arg(cmd: &mut Command) {
    if let Some(writable_path) = get_writable_cookies_path() {
        cmd.arg("--cookies").arg(writable_path);
    }
}

fn format_yt_dlp_error(action: &str, stderr: &str) -> anyhow::Error {
    let trimmed = stderr.trim();
    if trimmed.contains("Sign in to confirm you're not a bot")
        || trimmed.contains("confirm you're not a bot")
    {
        anyhow::anyhow!(
            "YouTube bot-detection error during {action}: 'Sign in to confirm you're not a bot'. Export cookies.txt from a logged-in YouTube browser session, upload to server/Render Secret Files, and set YT_DLP_COOKIES_PATH environment variable."
        )
    } else {
        anyhow::anyhow!("yt-dlp failed during {action}: {trimmed}")
    }
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

