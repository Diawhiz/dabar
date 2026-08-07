use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use tokio::process::Command;

pub async fn extract_vertical_clip(
    input_source: &str,
    output_path: &Path,
    start_time: f32,
    end_time: f32,
) -> Result<()> {
    if start_time < 0.0 || end_time <= start_time {
        anyhow::bail!(
            "invalid clip duration bounds: start_time ({start_time:.2}) must be >= 0 and < end_time ({end_time:.2})"
        );
    }

    let duration = end_time - start_time;
    let output = get_binary_command("ffmpeg")
        .arg("-y")
        .arg("-ss")
        .arg(format!("{start_time:.3}"))
        .arg("-i")
        .arg(input_source)
        .arg("-t")
        .arg(format!("{duration:.3}"))
        .arg("-vf")
        .arg("split[original][blurred];[blurred]scale=1080:1920,gblur=sigma=20[bg];[original]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-c:a")
        .arg("aac")
        .arg(output_path)
        .output()
        .await
        .context("executing ffmpeg process")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffmpeg extraction failed: {}", stderr.trim());
    }

    Ok(())
}

pub async fn check_ffmpeg_installed() -> Result<String> {
    let output = get_binary_command("ffmpeg")
        .arg("-version")
        .output()
        .await
        .context("executing ffmpeg -version")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffmpeg execution failed: {}", stderr.trim());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let version_line = stdout
        .lines()
        .next()
        .map(str::trim)
        .unwrap_or("ffmpeg")
        .to_string();

    Ok(version_line)
}

fn get_binary_command(name: &str) -> Command {
    if name == "ffmpeg" {
        if let Ok(custom_path) = std::env::var("FFMPEG_PATH") {
            if !custom_path.trim().is_empty() {
                return Command::new(custom_path.trim());
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
