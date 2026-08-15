use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Status of all external tools the app depends on.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepsStatus {
    pub ffmpeg: BinaryStatus,
    pub yt_dlp: BinaryStatus,
    pub whisper_model: ModelStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryStatus {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStatus {
    pub base_available: bool,
    pub tiny_available: bool,
    pub base_path: Option<String>,
    pub tiny_path: Option<String>,
}

/// Check all external dependency statuses without downloading anything.
pub async fn check_all(app_data_dir: &std::path::Path) -> DepsStatus {
    let ffmpeg = check_binary("ffmpeg", app_data_dir).await;
    let yt_dlp = check_binary("yt-dlp", app_data_dir).await;
    let whisper_model = check_whisper_models(app_data_dir);

    DepsStatus { ffmpeg, yt_dlp, whisper_model }
}

async fn check_binary(name: &str, app_data_dir: &std::path::Path) -> BinaryStatus {
    // 1. Check environment variable override
    let env_key = name.to_uppercase().replace('-', "_") + "_PATH";
    if let Ok(custom) = std::env::var(&env_key) {
        let p = std::path::Path::new(&custom);
        if p.exists() {
            let version = get_version(p.to_str().unwrap_or(name)).await;
            return BinaryStatus {
                found: true,
                path: Some(custom),
                version,
            };
        }
    }

    // 2. Check app data bin directory
    let bin_name = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };

    let app_bin = app_data_dir.join("bin").join(&bin_name);
    if app_bin.exists() {
        let version = get_version(app_bin.to_str().unwrap_or(name)).await;
        return BinaryStatus {
            found: true,
            path: Some(app_bin.to_string_lossy().to_string()),
            version,
        };
    }

    // 3. Check system PATH
    let version_arg = if name == "ffmpeg" { "-version" } else { "--version" };
    match tokio::process::Command::new(name)
        .arg(version_arg)
        .output()
        .await
    {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .map(|l| l.trim().to_string());
            BinaryStatus {
                found: true,
                path: Some(name.to_string()),
                version,
            }
        }
        _ => BinaryStatus {
            found: false,
            path: None,
            version: None,
        },
    }
}

async fn get_version(path: &str) -> Option<String> {
    let arg = if path.contains("ffmpeg") { "-version" } else { "--version" };
    tokio::process::Command::new(path)
        .arg(arg)
        .output()
        .await
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string()
        })
}

fn check_whisper_models(app_data_dir: &std::path::Path) -> ModelStatus {
    let models_dir = app_data_dir.join("whisper-models");
    let base_path = models_dir.join("ggml-base.bin");
    let tiny_path = models_dir.join("ggml-tiny.bin");

    ModelStatus {
        base_available: base_path.exists(),
        tiny_available: tiny_path.exists(),
        base_path: if base_path.exists() {
            Some(base_path.to_string_lossy().to_string())
        } else {
            None
        },
        tiny_path: if tiny_path.exists() {
            Some(tiny_path.to_string_lossy().to_string())
        } else {
            None
        },
    }
}

/// Detect available system RAM in GB.
pub fn available_ram_gb() -> u64 {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    sys.total_memory() / (1024 * 1024 * 1024)
}

/// Returns true if this looks like a low-end machine (≤4 GB RAM).
pub fn is_low_end() -> bool {
    available_ram_gb() <= 4
}

/// Returns the recommended FFmpeg preset based on available RAM.
/// Low-end machines use ultrafast to avoid slowdowns; capable machines use veryfast.
pub fn recommended_ffmpeg_preset() -> &'static str {
    if is_low_end() { "ultrafast" } else { "veryfast" }
}

/// Download yt-dlp binary to app data dir if not already present.
/// Returns the path to the downloaded binary.
pub async fn download_yt_dlp(app_data_dir: &std::path::Path) -> Result<PathBuf> {
    let bin_dir = app_data_dir.join("bin");
    tokio::fs::create_dir_all(&bin_dir).await?;

    let bin_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    let dest = bin_dir.join(bin_name);

    if dest.exists() {
        tracing::info!("yt-dlp already present at {}", dest.display());
        return Ok(dest);
    }

    let url = if cfg!(windows) {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
    };

    tracing::info!("Downloading yt-dlp from {url} to {}", dest.display());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;
    let bytes = client.get(url).send().await?.bytes().await?;
    tokio::fs::write(&dest, &bytes).await?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = tokio::fs::metadata(&dest).await?.permissions();
        perms.set_mode(0o755);
        tokio::fs::set_permissions(&dest, perms).await?;
    }

    tracing::info!("yt-dlp downloaded successfully: {} MB", bytes.len() / (1024 * 1024));
    Ok(dest)
}
