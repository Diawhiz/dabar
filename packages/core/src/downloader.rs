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
struct PipedStreamResponse {
    title: Option<String>,
    #[serde(rename = "audioStreams")]
    audio_streams: Option<Vec<PipedAudioStream>>,
}

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct PipedAudioStream {
    url: String,
    format: Option<String>,
    quality: Option<String>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct InvidiousResponse {
    title: Option<String>,
    #[serde(rename = "adaptiveFormats")]
    adaptive_formats: Option<Vec<InvidiousFormat>>,
}

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct InvidiousFormat {
    url: String,
    #[serde(rename = "type")]
    format_type: Option<String>,
}

pub fn extract_youtube_id(url_or_id: &str) -> Option<String> {
    let trimmed = url_or_id.trim();
    if trimmed.is_empty() {
        return None;
    }
    // If it's already a raw 11-char ID
    if trimmed.len() == 11 && !trimmed.contains('/') && !trimmed.contains('?') && !trimmed.contains('=') {
        return Some(trimmed.to_string());
    }

    if let Some(pos) = trimmed.find("v=") {
        let after = &trimmed[pos + 2..];
        let id: String = after.chars().take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    if let Some(pos) = trimmed.find("youtu.be/") {
        let after = &trimmed[pos + 9..];
        let id: String = after.chars().take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    if let Some(pos) = trimmed.find("/embed/") {
        let after = &trimmed[pos + 7..];
        let id: String = after.chars().take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    if let Some(pos) = trimmed.find("/shorts/") {
        let after = &trimmed[pos + 8..];
        let id: String = after.chars().take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
        if id.len() == 11 {
            return Some(id);
        }
    }

    None
}

fn get_piped_endpoints() -> Vec<String> {
    if let Ok(custom) = std::env::var("PIPED_API_URL") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return vec![trimmed.to_string()];
        }
    }

    vec![
        "https://api.piped.video".to_string(),
        "https://pipedapi.kavin.rocks".to_string(),
        "https://pipedapi.tokhmi.xyz".to_string(),
        "https://pipedapi.moomoo.me".to_string(),
    ]
}

fn get_invidious_endpoints() -> Vec<String> {
    vec![
        "https://inv.tux.pizza".to_string(),
        "https://invidious.nerdvpn.de".to_string(),
        "https://vid.puffyan.us".to_string(),
        "https://invidious.drgns.space".to_string(),
    ]
}

pub async fn download_youtube_audio(
    youtube_url: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    tokio::fs::create_dir_all(output_dir)
        .await
        .with_context(|| format!("creating audio output directory {}", output_dir.display()))?;

    let video_id = extract_youtube_id(youtube_url)
        .with_context(|| format!("could not extract YouTube video ID from {youtube_url}"))?;

    // Tier 1: Piped API
    match download_via_piped(&video_id, output_dir).await {
        Ok(audio) => return Ok(audio),
        Err(err) => eprintln!("Piped API failed: {err:#}. Falling back to Invidious API..."),
    }

    // Tier 2: Invidious API
    download_via_invidious(&video_id, output_dir).await
}

async fn download_via_piped(
    video_id: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    let endpoints = get_piped_endpoints();

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .context("building reqwest client for Piped API")?;

    let mut last_err = anyhow::anyhow!("No Piped API endpoints available");

    for endpoint in &endpoints {
        let stream_req_url = format!("{endpoint}/streams/{video_id}");
        let res = client.get(&stream_req_url).send().await;

        let response = match res {
            Ok(r) => r,
            Err(e) => {
                last_err = anyhow::anyhow!("Piped API endpoint {endpoint} request error: {e}");
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            last_err = anyhow::anyhow!("Piped API endpoint {endpoint} returned status {status}");
            continue;
        }

        let parsed: PipedStreamResponse = match response.json().await {
            Ok(p) => p,
            Err(e) => {
                last_err = anyhow::anyhow!("Piped API endpoint {endpoint} JSON parse error: {e}");
                continue;
            }
        };

        let streams = match parsed.audio_streams {
            Some(s) if !s.is_empty() => s,
            _ => {
                last_err = anyhow::anyhow!("Piped API endpoint {endpoint} returned no audio streams");
                continue;
            }
        };

        let selected_stream = streams
            .iter()
            .find(|s| {
                s.mime_type
                    .as_deref()
                    .map(|m| m.contains("audio/mp4") || m.contains("audio/m4a"))
                    .unwrap_or(false)
                    || s.format.as_deref().map(|f| f == "M4A").unwrap_or(false)
            })
            .unwrap_or(&streams[0]);

        let dest_path = output_dir.join(format!("{video_id}.m4a"));

        let bytes = client
            .get(&selected_stream.url)
            .send()
            .await
            .context("downloading audio stream from Piped CDN")?
            .error_for_status()
            .context("Piped CDN audio download failed")?
            .bytes()
            .await
            .context("reading audio bytes from Piped stream")?;

        tokio::fs::write(&dest_path, bytes)
            .await
            .context("writing audio file to disk")?;

        return Ok(DownloadedAudio {
            path: dest_path,
            title: parsed.title,
        });
    }

    Err(last_err)
}

async fn download_via_invidious(
    video_id: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    let endpoints = get_invidious_endpoints();

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .context("building reqwest client for Invidious API")?;

    let mut last_err = anyhow::anyhow!("No Invidious API endpoints available");

    for endpoint in &endpoints {
        let req_url = format!("{endpoint}/api/v1/videos/{video_id}");
        let res = client.get(&req_url).send().await;

        let response = match res {
            Ok(r) => r,
            Err(e) => {
                last_err = anyhow::anyhow!("Invidious endpoint {endpoint} request error: {e}");
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            last_err = anyhow::anyhow!("Invidious endpoint {endpoint} returned status {status}");
            continue;
        }

        let parsed: InvidiousResponse = match response.json().await {
            Ok(p) => p,
            Err(e) => {
                last_err = anyhow::anyhow!("Invidious endpoint {endpoint} JSON parse error: {e}");
                continue;
            }
        };

        let formats = match parsed.adaptive_formats {
            Some(f) if !f.is_empty() => f,
            _ => {
                last_err = anyhow::anyhow!("Invidious endpoint {endpoint} returned no audio formats");
                continue;
            }
        };

        let selected = formats
            .iter()
            .find(|f| f.format_type.as_deref().map(|t| t.starts_with("audio/")).unwrap_or(false))
            .unwrap_or(&formats[0]);

        let dest_path = output_dir.join(format!("{video_id}.m4a"));

        let bytes = client
            .get(&selected.url)
            .send()
            .await
            .context("downloading audio stream from Invidious CDN")?
            .error_for_status()
            .context("Invidious CDN audio download failed")?
            .bytes()
            .await
            .context("reading audio bytes from Invidious stream")?;

        tokio::fs::write(&dest_path, bytes)
            .await
            .context("writing audio file to disk")?;

        return Ok(DownloadedAudio {
            path: dest_path,
            title: parsed.title,
        });
    }

    Err(last_err)
}

pub async fn resolve_stream_url(youtube_url: &str) -> Result<String> {
    let video_id = extract_youtube_id(youtube_url)
        .with_context(|| format!("could not extract YouTube video ID from {youtube_url}"))?;

    let endpoints = get_piped_endpoints();

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .context("building reqwest client for Piped API")?;

    let mut last_err = anyhow::anyhow!("No Piped API endpoints available");

    for endpoint in &endpoints {
        let stream_req_url = format!("{endpoint}/streams/{video_id}");
        let res = client.get(&stream_req_url).send().await;

        let response = match res {
            Ok(r) => r,
            Err(e) => {
                last_err = anyhow::anyhow!("Piped API endpoint {endpoint} request error: {e}");
                continue;
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            last_err = anyhow::anyhow!("Piped API endpoint {endpoint} returned status {status}");
            continue;
        }

        let parsed: PipedStreamResponse = match response.json().await {
            Ok(p) => p,
            Err(e) => {
                last_err = anyhow::anyhow!("Piped API endpoint {endpoint} JSON parse error: {e}");
                continue;
            }
        };

        let streams = match parsed.audio_streams {
            Some(s) if !s.is_empty() => s,
            _ => {
                last_err = anyhow::anyhow!("Piped API endpoint {endpoint} returned no audio streams");
                continue;
            }
        };

        let selected_stream = streams
            .iter()
            .find(|s| {
                s.mime_type
                    .as_deref()
                    .map(|m| m.contains("audio/mp4") || m.contains("audio/m4a"))
                    .unwrap_or(false)
                    || s.format.as_deref().map(|f| f == "M4A").unwrap_or(false)
            })
            .unwrap_or(&streams[0]);

        return Ok(selected_stream.url.clone());
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
