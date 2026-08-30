use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::process::Command;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct DownloadedAudio {
    pub path: PathBuf,
    pub title: Option<String>,
}

/// Returns true if the given URL is a Google Drive file share link.
///
/// Accepts both `drive.google.com/file/d/<ID>/...` and `drive.google.com/open?id=<ID>` formats.
pub fn is_gdrive_url(url: &str) -> bool {
    let s = url.trim();
    s.contains("drive.google.com/file/d/")
        || s.contains("drive.google.com/open?id=")
        || (s.contains("drive.google.com/") && s.contains("/view"))
}

/// Extract the Google Drive file ID from a share link.
///
/// Handles:
/// - `https://drive.google.com/file/d/<ID>/view?usp=sharing`
/// - `https://drive.google.com/open?id=<ID>`
pub fn extract_gdrive_id(url: &str) -> Option<String> {
    let trimmed = url.trim();

    // Format: /file/d/<ID>/
    if let Some(pos) = trimmed.find("/file/d/") {
        let after = &trimmed[pos + 8..];
        let id: String = after
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        if id.len() > 10 {
            return Some(id);
        }
    }

    // Format: ?id=<ID> or &id=<ID>
    if let Some(pos) = trimmed.find("id=") {
        let after = &trimmed[pos + 3..];
        let id: String = after
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        if id.len() > 10 {
            return Some(id);
        }
    }

    None
}

/// Download audio from a Google Drive share link using yt-dlp.
///
/// yt-dlp supports Google Drive natively. The link must have public
/// ("Anyone with the link") share permission enabled.
/// Returns the downloaded file path and the filename as title.
pub async fn download_gdrive_audio(
    gdrive_url: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    tokio::fs::create_dir_all(output_dir)
        .await
        .with_context(|| format!("creating audio output directory {}", output_dir.display()))?;

    let file_id = extract_gdrive_id(gdrive_url).with_context(|| {
        format!("could not extract Google Drive file ID from '{gdrive_url}' — expected a valid drive.google.com share link")
    })?;

    let dest_template = output_dir.join(&file_id);

    let mut cmd = get_binary_command("yt-dlp");
    cmd.arg("-f")
        .arg("ba[abr<=128]/ba/bestaudio/b")
        .arg("-N")
        .arg("4")
        .arg("--print")
        .arg("after_video:title")
        .arg("--no-check-certificates")
        .arg("--no-playlist")
        .arg("--no-cache-dir")
        .arg("-o")
        .arg(format!("{}.%(ext)s", dest_template.display()))
        .arg(gdrive_url);

    let output = cmd
        .output()
        .await
        .context("failed to spawn yt-dlp for Google Drive download — is yt-dlp installed?")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let msg = stderr.trim();

        if msg.contains("Permission denied") || msg.contains("Access denied") || msg.contains("403") {
            anyhow::bail!(
                "Google Drive download failed: the file is private or restricted. \
                 Set the share link to 'Anyone with the link can view' and try again."
            );
        }
        if msg.contains("No such file") || msg.contains("404") {
            anyhow::bail!(
                "Google Drive download failed: the file could not be found. \
                 Please check the link is correct and the file still exists."
            );
        }
        anyhow::bail!("yt-dlp failed to download from Google Drive: {msg}");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let title = stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string);

    let found_path = find_downloaded_file(output_dir, &file_id).await?;

    Ok(DownloadedAudio {
        path: found_path,
        title,
    })
}

/// Extract a YouTube video ID from various URL formats or a raw 11-char ID.
pub fn extract_youtube_id(url_or_id: &str) -> Option<String> {
    let trimmed = url_or_id.trim();
    if trimmed.is_empty() {
        return None;
    }
    // If it's already a raw 11-char ID
    if trimmed.len() == 11 && trimmed.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
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

/// Download audio from a YouTube URL using yt-dlp (audio-only, mp3 format).
///
/// Shells out to yt-dlp in a logged-out/no-cookie context. The downloaded
/// file is saved to `output_dir` with a unique filename derived from the
/// video ID. Returns the local file path and video title on success.
/// Strip the `&t=` / `?t=` timestamp fragment from a YouTube URL so yt-dlp
/// does not treat it as a separate stream selector or get confused during retries.
fn strip_youtube_timestamp(url: &str) -> String {
    // Remove &t=... or ?t=... query parameters (case-insensitive)
    let url = if let Some(pos) = url.find("&t=") {
        &url[..pos]
    } else if let Some(pos) = url.find("?t=") {
        &url[..pos]
    } else {
        url
    };
    url.to_string()
}

pub async fn download_youtube_audio(
    youtube_url: &str,
    output_dir: &Path,
) -> Result<DownloadedAudio> {
    let youtube_url = strip_youtube_timestamp(youtube_url);
    tokio::fs::create_dir_all(output_dir)
        .await
        .with_context(|| format!("creating audio output directory {}", output_dir.display()))?;

    let video_id = extract_youtube_id(&youtube_url)
        .with_context(|| format!("could not extract YouTube video ID from '{youtube_url}' — expected a valid youtube.com or youtu.be URL"))?;

    // Use a deterministic filename template
    let dest_template = output_dir.join(&video_id);

    // High-performance single-pass yt-dlp download:
    // 1. '-f "ba[abr<=128]/ba/bestaudio/b"' selects small, high-efficiency native audio stream (e.g. 50-70kbps opus/m4a).
    // 2. '-N 4' (concurrent fragments) downloads 4 streams in parallel, bypassing YouTube's single-connection rate-limiting throttle.
    // 3. '--print after_video:title' captures the title in the same single invocation (eliminates extra 4-8s latency).
    // 4. Skips yt-dlp FFmpeg re-encoding step since Whisper preprocessor directly downsamples to 16kHz mono.
    let mut cmd = get_binary_command("yt-dlp");
    cmd.arg("-f")
        .arg("ba[abr<=128]/ba/bestaudio/b")
        .arg("-N")
        .arg("4")
        .arg("--buffer-size")
        .arg("64K")
        .arg("--print")
        .arg("after_video:title")
        .arg("-o")
        .arg(format!("{}.%(ext)s", dest_template.display()));

    apply_yt_dlp_common_args(&mut cmd);
    cmd.arg(&youtube_url);

    let output = tokio::time::timeout(
        Duration::from_secs(900), // 15-minute hard cap on any single download
        cmd.output(),
    )
    .await
    .context("yt-dlp download timed out after 15 minutes")?
    .context("failed to spawn yt-dlp process — is yt-dlp installed and on PATH?")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format_yt_dlp_error("audio download", &stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let title = stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string);

    let found_path = find_downloaded_file(output_dir, &video_id).await?;

    Ok(DownloadedAudio {
        path: found_path,
        title,
    })
}

/// Resolve a direct stream URL for a YouTube video using yt-dlp.
///
/// Returns a best-audio URL suitable for piping directly into ffmpeg. Used
/// by the clip-download endpoints to extract vertical clips without a full
/// file download step.
pub async fn resolve_stream_url(youtube_url: &str) -> Result<String> {
    let _video_id = extract_youtube_id(youtube_url)
        .with_context(|| format!("could not extract YouTube video ID from '{youtube_url}'"))?;

    let mut cmd = get_binary_command("yt-dlp");
    cmd.arg("--get-url")
        .arg("-f")
        .arg("bestvideo+bestaudio/best");

    apply_yt_dlp_common_args(&mut cmd);
    cmd.arg(youtube_url);

    let output = cmd
        .output()
        .await
        .context("failed to spawn yt-dlp process for stream URL resolution")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format_yt_dlp_error("stream URL resolution", &stderr));
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if url.is_empty() {
        anyhow::bail!("yt-dlp returned an empty stream URL for '{youtube_url}'");
    }

    Ok(url)
}

pub async fn check_yt_dlp_installed() -> Result<String> {
    let output = get_binary_command("yt-dlp")
        .arg("--version")
        .output()
        .await
        .context("executing yt-dlp --version")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("yt-dlp returned non-zero exit code: {}", stderr.trim());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async fn find_downloaded_file(dir: &Path, base_name: &str) -> Result<PathBuf> {
    let mut entries = tokio::fs::read_dir(dir)
        .await
        .with_context(|| format!("reading audio directory {}", dir.display()))?;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.is_file() {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                if stem == base_name {
                    return Ok(path);
                }
            }
        }
    }

    anyhow::bail!(
        "downloaded audio file not found in {} for base name '{base_name}'",
        dir.display()
    )
}

fn format_yt_dlp_error(action: &str, stderr: &str) -> anyhow::Error {
    let trimmed = stderr.trim();

    if trimmed.contains("Sign in to confirm you’re not a bot")
        || trimmed.contains("Sign in to confirm you're not a bot")
        || trimmed.contains("bot confirmation")
    {
        return anyhow::anyhow!(
            "YouTube requires bot verification for this video. \
             Place a 'cookies.txt' file in your workspace or set the YT_DLP_COOKIES_PATH \
             environment variable."
        );
    }

    if trimmed.contains("Private video") {
        return anyhow::anyhow!(
            "Sermon download failed: this YouTube video is private."
        );
    }

    if trimmed.contains("Video unavailable") {
        return anyhow::anyhow!(
            "Sermon download failed: this YouTube video is unavailable or deleted."
        );
    }

    if trimmed.contains("members-only") || trimmed.contains("Join this channel") {
        return anyhow::anyhow!(
            "Sermon download failed: this is a members-only video. \
             Export cookies from an account with membership and provide them via the YT_DLP_COOKIES_PATH \
             environment variable."
        );
    }

    if trimmed.contains("age-restricted")
        || trimmed.contains("age verification")
    {
        return anyhow::anyhow!(
            "Sermon download failed: the YouTube video is age-restricted. \
             Provide cookies from a logged-in session via YT_DLP_COOKIES_PATH."
        );
    }

    anyhow::anyhow!("yt-dlp failed during {action}: {trimmed}")
}

/// Applies common yt-dlp flags for robust YouTube extraction:
/// - Passes cookies if YT_DLP_COOKIES_PATH, YT_DLP_COOKIES_FROM_BROWSER, or a local cookies.txt exists.
/// - Enables JS runtime if Node.js is present.
fn apply_yt_dlp_common_args(cmd: &mut Command) {
    cmd.arg("--no-playlist")
        .arg("--no-check-certificates")
        .arg("--no-cache-dir")
        // Hard network timeout so yt-dlp never hangs indefinitely waiting for a CDN response
        .arg("--socket-timeout").arg("30")
        // Retry on transient failures, but cap low so errors surface quickly
        .arg("--retries").arg("3")
        .arg("--fragment-retries").arg("3")
        .arg("--retry-sleep").arg("3");

    // Optional cookies support
    if let Ok(cookies_path) = std::env::var("YT_DLP_COOKIES_PATH") {
        let p = Path::new(&cookies_path);
        if p.exists() {
            cmd.arg("--cookies").arg(p);
        }
    } else {
        // Auto-detect cookies.txt in workspace root or cwd
        if let Ok(cwd) = std::env::current_dir() {
            let direct = cwd.join("cookies.txt");
            let parent = cwd.parent().map(|p| p.join("cookies.txt"));
            if direct.exists() {
                cmd.arg("--cookies").arg(direct);
            } else if let Some(parent_p) = parent {
                if parent_p.exists() {
                    cmd.arg("--cookies").arg(parent_p);
                }
            }
        }
    }

    if let Ok(browser) = std::env::var("YT_DLP_COOKIES_FROM_BROWSER") {
        if !browser.trim().is_empty() {
            cmd.arg("--cookies-from-browser").arg(browser.trim());
        }
    }

    if which_node_exists() {
        cmd.arg("--js-runtimes").arg("node");
    }
}


fn which_node_exists() -> bool {
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("bin/node/bin/node.exe").exists()
            || cwd.join("bin/node.exe").exists()
            || cwd.parent().map(|p| p.join("bin/node.exe").exists()).unwrap_or(false)
        {
            return true;
        }
    }
    std::process::Command::new("node")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Binary resolution — resolves yt-dlp executable path by searching:
// 1. YT_DLP_PATH env var
// 2. Ancestor directories' bin/ folders (walks up from cwd)
// 3. ~/.local/bin
// 4. System PATH (fallback)
// ---------------------------------------------------------------------------

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

        // Walk up ancestor directories (cwd, cwd/.., cwd/../.., ...) to find
        // bin/<exe> at the workspace root regardless of which subdirectory
        // cargo run was invoked from (e.g. apps/server/ -> dabar/bin/).
        if let Ok(cwd) = std::env::current_dir() {
            let mut dir: Option<&Path> = Some(cwd.as_path());
            while let Some(ancestor) = dir {
                let candidate = ancestor.join("bin").join(&exe_name);
                if candidate.exists() {
                    target_path = candidate;
                    break;
                }
                dir = ancestor.parent();
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
        let parent_bin = cwd.parent().map(|p| p.join("bin")).unwrap_or_else(|| cwd.clone());
        let home_bin = std::env::var("HOME")
            .map(|h| PathBuf::from(h).join(".local/bin"))
            .unwrap_or_else(|_| PathBuf::from("/home/render/.local/bin"));

        let updated_path = format!(
            "{}{separator}{}{separator}{}{separator}{}{separator}{current_path}",
            node_bin.display(),
            local_bin.display(),
            parent_bin.display(),
            home_bin.display()
        );
        cmd.env("PATH", updated_path);
    }

    cmd
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_youtube_id() {
        assert_eq!(extract_youtube_id("dQw4w9WgXcQ"), Some("dQw4w9WgXcQ".to_string()));
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string())
        );
        assert_eq!(
            extract_youtube_id("https://youtu.be/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string())
        );
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/embed/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string())
        );
        assert_eq!(
            extract_youtube_id("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
            Some("dQw4w9WgXcQ".to_string())
        );
        assert_eq!(extract_youtube_id("invalid url"), None);
        assert_eq!(extract_youtube_id(""), None);
    }

    #[test]
    fn test_format_yt_dlp_error() {
        let err_private = format_yt_dlp_error("test", "ERROR: Private video");
        assert!(err_private.to_string().contains("private or unavailable"));

        let err_geo = format_yt_dlp_error("test", "ERROR: Video not available in your country due to geo restriction");
        assert!(err_geo.to_string().contains("geo-restricted"));

        let err_invalid = format_yt_dlp_error("test", "ERROR: 'not_a_url' is not a valid URL");
        assert!(err_invalid.to_string().contains("not a valid YouTube link"));

        let err_bot = format_yt_dlp_error("test", "ERROR: Sign in to confirm you're not a bot");
        assert!(err_bot.to_string().contains("bot-detection"));
    }

    #[test]
    fn test_is_gdrive_url() {
        assert!(is_gdrive_url("https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view?usp=sharing"));
        assert!(is_gdrive_url("https://drive.google.com/open?id=1a2b3c4d5e6f7g8h9i0j"));
        assert!(!is_gdrive_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
        assert!(!is_gdrive_url("/path/to/local/file.mp4"));
    }

    #[test]
    fn test_extract_gdrive_id() {
        assert_eq!(
            extract_gdrive_id("https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view?usp=sharing"),
            Some("1a2b3c4d5e6f7g8h9i0j".to_string())
        );
        assert_eq!(
            extract_gdrive_id("https://drive.google.com/open?id=1a2b3c4d5e6f7g8h9i0j"),
            Some("1a2b3c4d5e6f7g8h9i0j".to_string())
        );
        assert_eq!(extract_gdrive_id("https://youtube.com"), None);
    }
}

