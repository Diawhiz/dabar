use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::process::Command;

#[derive(Debug, Clone)]
pub struct DownloadedAudio {
    pub path: PathBuf,
    pub title: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct CobaltResponse {
    status: String,
    url: Option<String>,
    filename: Option<String>,
    picker: Option<Vec<CobaltPickerItem>>,
}

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct CobaltPickerItem {
    url: String,
}

fn get_cobalt_endpoints() -> Vec<String> {
    if let Ok(custom) = std::env::var("COBALT_API_URL") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return vec![trimmed.to_string()];
        }
    }

    vec![
        "https://api.cobalt.tools/".to_string(),
        "https://cobalt.api.scie.dev/".to_string(),
        "https://cobalt.pub/".to_string(),
        "https://cobalt-api.kwi.li/".to_string(),
    ]
}

pub async fn download_youtube_audio(
    youtube_url: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    tokio::fs::create_dir_all(output_dir)
        .await
        .with_context(|| format!("creating audio output directory {}", output_dir.display()))?;

    // Cobalt API is the sole audio downloader
    download_via_cobalt(youtube_url, output_dir).await
}

async fn download_via_cobalt(
    youtube_url: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    let endpoints = get_cobalt_endpoints();

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .context("building reqwest client for Cobalt API")?;

    let mut last_err = anyhow::anyhow!("No Cobalt API endpoints available");

    for endpoint in endpoints {
        let req_body = serde_json::json!({
            "url": youtube_url,
            "downloadMode": "audio",
            "audioFormat": "m4a"
        });

        let res = client
            .post(&endpoint)
            .header("accept", "application/json")
            .header("content-type", "application/json")
            .json(&req_body)
            .send()
            .await;

        let response = match res {
            Ok(r) => r,
            Err(e) => {
                last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} request error: {e}");
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} HTTP {status}: {body}");
            continue;
        }

        let parsed: CobaltResponse = match response.json().await {
            Ok(p) => p,
            Err(e) => {
                last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} JSON parse error: {e}");
                continue;
            }
        };

        let stream_url = match parsed.url.or_else(|| parsed.picker.and_then(|p| p.first().map(|i| i.url.clone()))) {
            Some(u) => u,
            None => {
                last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} response did not contain download URL");
                continue;
            }
        };

        let filename = parsed.filename.unwrap_or_else(|| "sermon.m4a".to_string());
        let dest_path = output_dir.join(&filename);

        let bytes = client
            .get(&stream_url)
            .send()
            .await
            .context("fetching audio stream from Cobalt CDN")?
            .error_for_status()
            .context("Cobalt CDN audio download failed")?
            .bytes()
            .await
            .context("reading audio bytes from Cobalt stream")?;

        tokio::fs::write(&dest_path, bytes)
            .await
            .context("writing audio bytes to disk")?;

        return Ok(DownloadedAudio {
            path: dest_path,
            title: Some("Sermon Audio".to_string()),
        });
    }

    Err(last_err)
}

pub async fn resolve_stream_url(youtube_url: &str) -> Result<String> {
    let endpoints = get_cobalt_endpoints();

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .context("building reqwest client for Cobalt API")?;

    let mut last_err = anyhow::anyhow!("No Cobalt API endpoints available");

    for endpoint in endpoints {
        let req_body = serde_json::json!({
            "url": youtube_url,
            "downloadMode": "audio",
            "audioFormat": "m4a"
        });

        let res = client
            .post(&endpoint)
            .header("accept", "application/json")
            .header("content-type", "application/json")
            .json(&req_body)
            .send()
            .await;

        let response = match res {
            Ok(r) => r,
            Err(e) => {
                last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} request error: {e}");
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} HTTP {status}: {body}");
            continue;
        }

        let parsed: CobaltResponse = match response.json().await {
            Ok(p) => p,
            Err(e) => {
                last_err = anyhow::anyhow!("Cobalt endpoint {endpoint} JSON parse error: {e}");
                continue;
            }
        };

        let stream_url = match parsed.url.or_else(|| parsed.picker.and_then(|p| p.first().map(|i| i.url.clone()))) {
            Some(u) => u,
            None => {
                last_err = anyhow::anyhow!("Cobalt response did not contain download URL");
                continue;
            }
        };

        return Ok(stream_url);
    }

    Err(last_err)
}

#[allow(dead_code)]
fn apply_cookies_arg(cmd: &mut Command) {
    if let Some(writable_path) = get_writable_cookies_path() {
        cmd.arg("--cookies").arg(writable_path);
    }
}

#[allow(dead_code)]
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

#[allow(dead_code)]
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
    let mut target_path = PathBuf::from(name);

    if name == "yt-dlp" {
        if let Ok(custom_path) = std::env::var("YT_DLP_PATH") {
            let trimmed = custom_path.trim();
            if !trimmed.is_empty() {
                let p = Path::new(trimmed);
                if p.is_absolute() && p.exists() {
                    target_path = p.to_path_buf();
                } else if let Ok(cwd) = std::env::current_dir() {
                    let rel_candidate = cwd.join(p);
                    if rel_candidate.exists() {
                        target_path = rel_candidate;
                    } else {
                        target_path = PathBuf::from(trimmed);
                    }
                } else {
                    target_path = PathBuf::from(trimmed);
                }
            }
        }
    }

    if target_path == Path::new(name) {
        let exe_name = if cfg!(windows) && !name.ends_with(".exe") {
            format!("{name}.exe")
        } else {
            name.to_string()
        };

        if let Ok(cwd) = std::env::current_dir() {
            let candidate = cwd.join("bin").join(&exe_name);
            if candidate.exists() {
                target_path = candidate;
            }
        }

        if target_path == Path::new(name) {
            if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
                let candidate = PathBuf::from(&home).join(".local/bin").join(&exe_name);
                if candidate.exists() {
                    target_path = candidate;
                }
            }
        }
    }

    create_cmd_with_path(&target_path)
}

fn create_cmd_with_path(target_path: &Path) -> Command {
    let mut cmd = Command::new(target_path);
    let current_path = std::env::var("PATH").unwrap_or_default();
    let separator = if cfg!(windows) { ";" } else { ":" };

    if let Ok(cwd) = std::env::current_dir() {
        let node_bin = cwd.join("bin").join("node").join("bin");
        let local_bin = cwd.join("bin");
        let home_bin = std::env::var("HOME")
            .map(|h| PathBuf::from(h).join(".local/bin"))
            .unwrap_or_else(|_| PathBuf::from("/home/render/.local/bin"));

        let updated_path = format!(
            "{}{separator}{}{separator}{}{separator}{current_path}",
            node_bin.display(),
            local_bin.display(),
            home_bin.display()
        );
        cmd.env("PATH", updated_path);
    }

    cmd
}
