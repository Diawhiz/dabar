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
        .arg("-crf")
        .arg("22")
        .arg("-maxrate")
        .arg("6000k")
        .arg("-bufsize")
        .arg("12000k")
        .arg("-preset")
        .arg("veryfast")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("128k")
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

/// Extract an audio-only clip segment as MP3 (e.g. for radio, podcasts, WhatsApp voice shares).
pub async fn extract_audio_clip(
    input_source: &str,
    output_path: &Path,
    start_time: f32,
    end_time: f32,
) -> Result<()> {
    if start_time < 0.0 || end_time <= start_time {
        anyhow::bail!(
            "invalid audio clip bounds: start_time ({start_time:.2}) must be >= 0 and < end_time ({end_time:.2})"
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
        .arg("-vn")
        .arg("-c:a")
        .arg("libmp3lame")
        .arg("-b:a")
        .arg("128k")
        .arg(output_path)
        .output()
        .await
        .context("executing ffmpeg audio clip extraction")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffmpeg audio clip extraction failed: {}", stderr.trim());
    }

    Ok(())
}

pub async fn preprocess_audio_for_whisper(
    input_path: &Path,
    output_path: &Path,
) -> Result<()> {
    let output = get_binary_command("ffmpeg")
        .arg("-y")
        .arg("-threads")
        .arg("0")
        .arg("-i")
        .arg(input_path)
        .arg("-vn")
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg("16000")
        .arg("-c:a")
        .arg("libmp3lame")
        .arg("-b:a")
        .arg("32k")
        .arg("-compression_level")
        .arg("0")
        .arg(output_path)
        .output()
        .await
        .context("executing ffmpeg audio preprocessing for Whisper")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffmpeg audio preprocessing failed: {}", stderr.trim());
    }

    Ok(())
}

pub async fn extract_audio_chunk(
    input_path: &Path,
    output_path: &Path,
    start_time: f32,
    duration: f32,
) -> Result<()> {
    let output = get_binary_command("ffmpeg")
        .arg("-y")
        .arg("-threads")
        .arg("0")
        .arg("-ss")
        .arg(format!("{start_time:.3}"))
        .arg("-i")
        .arg(input_path)
        .arg("-t")
        .arg(format!("{duration:.3}"))
        .arg("-vn")
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg("16000")
        .arg("-c:a")
        .arg("libmp3lame")
        .arg("-b:a")
        .arg("32k")
        .arg("-compression_level")
        .arg("0")
        .arg(output_path)
        .output()
        .await
        .context("executing ffmpeg audio chunk extraction")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffmpeg audio chunk extraction failed: {}", stderr.trim());
    }

    Ok(())
}

pub async fn get_media_duration(input_path: &Path) -> Result<f32> {
    let output = get_binary_command("ffmpeg")
        .arg("-i")
        .arg(input_path)
        .output()
        .await
        .context("executing ffmpeg to detect duration")?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    if let Some(dur) = parse_ffmpeg_duration(&stderr) {
        return Ok(dur);
    }

    anyhow::bail!(
        "could not determine audio duration from ffmpeg output for {}",
        input_path.display()
    )
}

pub fn parse_ffmpeg_duration(stderr: &str) -> Option<f32> {
    let pos = stderr.find("Duration: ")?;
    let after = &stderr[pos + 10..];
    let duration_str: String = after
        .chars()
        .take_while(|c| *c != ',' && *c != '\n' && *c != '\r')
        .collect();
    let parts: Vec<&str> = duration_str.trim().split(':').collect();
    if parts.len() == 3 {
        let hours: f32 = parts[0].trim().parse().ok()?;
        let mins: f32 = parts[1].trim().parse().ok()?;
        let secs: f32 = parts[2].trim().parse().ok()?;
        Some(hours * 3600.0 + mins * 60.0 + secs)
    } else {
        None
    }
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

    // Walk up ancestor directories (cwd, cwd/.., cwd/../.., ...) to find
    // bin/<exe> at the workspace root regardless of which subdirectory
    // cargo run was invoked from (e.g. apps/server/ -> dabar/bin/).
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir: Option<&Path> = Some(cwd.as_path());
        while let Some(ancestor) = dir {
            let bin_dir = ancestor.join("bin");
            let candidate = bin_dir.join(&exe_name);
            if candidate.exists() {
                return Command::new(candidate);
            }
            // Check subfolders inside bin/ (e.g. bin/ffmpeg-master.../bin/ffmpeg.exe)
            if let Ok(mut entries) = std::fs::read_dir(&bin_dir) {
                while let Some(Ok(entry)) = entries.next() {
                    let path = entry.path();
                    if path.is_dir() {
                        let sub1 = path.join(&exe_name);
                        if sub1.exists() {
                            return Command::new(sub1);
                        }
                        let sub2 = path.join("bin").join(&exe_name);
                        if sub2.exists() {
                            return Command::new(sub2);
                        }
                    }
                }
            }
            dir = ancestor.parent();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ffmpeg_duration_standard() {
        let sample = "Input #0, mp3, from 'test.mp3':\n  Duration: 01:23:45.67, start: 0.000000, bitrate: 128 kb/s";
        let dur = parse_ffmpeg_duration(sample).expect("should parse duration");
        assert!((dur - 5025.67).abs() < 0.001);
    }

    #[test]
    fn test_parse_ffmpeg_duration_short() {
        let sample = "Duration: 00:02:15.50, start: 0.000000";
        let dur = parse_ffmpeg_duration(sample).expect("should parse duration");
        assert!((dur - 135.50).abs() < 0.001);
    }

    #[test]
    fn test_parse_ffmpeg_duration_invalid() {
        let sample = "No duration line present here";
        assert!(parse_ffmpeg_duration(sample).is_none());
    }
}
