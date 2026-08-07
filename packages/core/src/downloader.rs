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
    cmd.arg("--user-agent")
        .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .arg("--extractor-args")
        .arg("youtube:player_client=mweb,web,ios")
        .arg("--js-runtimes")
        .arg("node")
        .arg("--remote-components")
        .arg("ejs:github")
        .arg("--extract-audio")
        .arg("--audio-format")
        .arg("m4a")
        .arg("--print")
        .arg("after_move:filepath")
        .arg("--print")
        .arg("title")
        .arg("--output")
        .arg(&output_template)
        .arg(youtube_url);

    let mut output = cmd.output().await.context("running yt-dlp")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("cookies are no longer valid") || stderr.contains("rotated in the browser") {
            eprintln!("Warning: YouTube cookies invalid/rotated. Retrying download without cookies...");
            let mut retry_cmd = get_binary_command("yt-dlp");
            retry_cmd
                .arg("--user-agent")
                .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .arg("--extractor-args")
                .arg("youtube:player_client=mweb,web,ios")
                .arg("--js-runtimes")
                .arg("node")
                .arg("--remote-components")
                .arg("ejs:github")
                .arg("--extract-audio")
                .arg("--audio-format")
                .arg("m4a")
                .arg("--print")
                .arg("after_move:filepath")
                .arg("--print")
                .arg("title")
                .arg("--output")
                .arg(&output_template)
                .arg(youtube_url);
            output = retry_cmd.output().await.context("running yt-dlp retry without cookies")?;
        }
    }

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
    cmd.arg("--user-agent")
        .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .arg("--extractor-args")
        .arg("youtube:player_client=mweb,web,ios")
        .arg("--js-runtimes")
        .arg("node")
        .arg("--remote-components")
        .arg("ejs:github")
        .arg("-g")
        .arg(youtube_url);

    let mut output = cmd
        .output()
        .await
        .context("running yt-dlp -g to resolve media stream URL")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("cookies are no longer valid") || stderr.contains("rotated in the browser") {
            let mut retry_cmd = get_binary_command("yt-dlp");
            retry_cmd
                .arg("--user-agent")
                .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                .arg("--extractor-args")
                .arg("youtube:player_client=mweb,web,ios")
                .arg("--js-runtimes")
                .arg("node")
                .arg("--remote-components")
                .arg("ejs:github")
                .arg("-g")
                .arg(youtube_url);
            output = retry_cmd.output().await.context("running yt-dlp -g retry without cookies")?;
        }
    }

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
