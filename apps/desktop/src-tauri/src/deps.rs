use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Status of all external tools the app depends on.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepsStatus {
    pub ffmpeg: BinaryStatus,
    pub yt_dlp: BinaryStatus,
    pub whisper_cli: BinaryStatus,
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
    let whisper_cli = check_binary("whisper-cli", app_data_dir).await;
    let whisper_model = check_whisper_models(app_data_dir);

    DepsStatus {
        ffmpeg,
        yt_dlp,
        whisper_cli,
        whisper_model,
    }
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

    // Also check alternative alias (e.g. main.exe for whisper-cli)
    if name == "whisper-cli" {
        let main_bin_name = if cfg!(windows) { "main.exe" } else { "main" };
        let main_app_bin = app_data_dir.join("bin").join(main_bin_name);
        if main_app_bin.exists() {
            let version = get_version(main_app_bin.to_str().unwrap_or(name)).await;
            return BinaryStatus {
                found: true,
                path: Some(main_app_bin.to_string_lossy().to_string()),
                version,
            };
        }
    }

    // 3. Check system PATH
    let version_arg = if name == "ffmpeg" {
        "-version"
    } else if name == "whisper-cli" {
        "-h"
    } else {
        "--version"
    };

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
    let arg = if path.contains("ffmpeg") {
        "-version"
    } else if path.contains("whisper") {
        "-h"
    } else {
        "--version"
    };

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

pub fn available_ram_gb() -> u64 {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    sys.total_memory() / (1024 * 1024 * 1024)
}

pub fn is_low_end() -> bool {
    available_ram_gb() <= 4
}

pub fn recommended_ffmpeg_preset() -> &'static str {
    if is_low_end() { "ultrafast" } else { "veryfast" }
}

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

pub async fn download_ffmpeg(
    app_data_dir: &std::path::Path,
    progress_cb: impl Fn(u64, u64) + Send + 'static,
) -> Result<PathBuf> {
    let bin_dir = app_data_dir.join("bin");
    tokio::fs::create_dir_all(&bin_dir).await?;

    let bin_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    let dest = bin_dir.join(bin_name);

    if dest.exists() {
        tracing::info!("ffmpeg already present at {}", dest.display());
        return Ok(dest);
    }

    let url = if cfg!(windows) {
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
    } else if cfg!(target_os = "macos") {
        "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
    } else {
        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
    };

    tracing::info!("Downloading FFmpeg from {url}");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()?;

    let mut response = client.get(url).send().await?;
    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut bytes: Vec<u8> = Vec::with_capacity(if total > 0 { total as usize } else { 30 * 1024 * 1024 });

    while let Some(chunk) = response.chunk().await? {
        downloaded += chunk.len() as u64;
        bytes.extend_from_slice(&chunk);
        progress_cb(downloaded, total);
    }

    let temp_archive = bin_dir.join("ffmpeg_download.zip");
    tokio::fs::write(&temp_archive, &bytes).await?;

    let extract_temp_dir = bin_dir.join("ffmpeg_extract_temp");
    let _ = tokio::fs::remove_dir_all(&extract_temp_dir).await;
    tokio::fs::create_dir_all(&extract_temp_dir).await?;

    #[cfg(windows)]
    {
        let tar_res = tokio::process::Command::new("tar")
            .arg("-xf")
            .arg(&temp_archive)
            .arg("-C")
            .arg(&extract_temp_dir)
            .output()
            .await;

        if tar_res.is_err() || !tar_res.unwrap().status.success() {
            let _ = tokio::process::Command::new("powershell")
                .arg("-NoProfile")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Force -Path '{}' -DestinationPath '{}'",
                    temp_archive.display(),
                    extract_temp_dir.display()
                ))
                .output()
                .await;
        }

        if let Ok(entries) = find_files_recursive(&extract_temp_dir, &["ffmpeg.exe", "ffprobe.exe"]).await {
            for (name, path) in entries {
                let target = bin_dir.join(&name);
                let _ = tokio::fs::copy(&path, &target).await;
            }
        }
    }

    #[cfg(unix)]
    {
        let _ = tokio::process::Command::new("unzip")
            .arg("-o")
            .arg(&temp_archive)
            .arg("-d")
            .arg(&extract_temp_dir)
            .output()
            .await;

        if let Ok(entries) = find_files_recursive(&extract_temp_dir, &["ffmpeg", "ffprobe"]).await {
            for (name, path) in entries {
                let target = bin_dir.join(&name);
                let _ = tokio::fs::copy(&path, &target).await;
                use std::os::unix::fs::PermissionsExt;
                if let Ok(mut perms) = tokio::fs::metadata(&target).await.map(|m| m.permissions()) {
                    perms.set_mode(0o755);
                    let _ = tokio::fs::set_permissions(&target, perms).await;
                }
            }
        }
    }

    let _ = tokio::fs::remove_file(&temp_archive).await;
    let _ = tokio::fs::remove_dir_all(&extract_temp_dir).await;

    if dest.exists() {
        tracing::info!("FFmpeg successfully installed to {}", dest.display());
        Ok(dest)
    } else {
        anyhow::bail!("FFmpeg archive was downloaded but binary could not be extracted to {}", dest.display())
    }
}

/// Downloads and extracts the whisper-cli binary for local on-device transcription.
pub async fn download_whisper_cli(
    app_data_dir: &std::path::Path,
    progress_cb: impl Fn(u64, u64) + Send + 'static,
) -> Result<PathBuf> {
    let bin_dir = app_data_dir.join("bin");
    tokio::fs::create_dir_all(&bin_dir).await?;

    let bin_name = if cfg!(windows) { "whisper-cli.exe" } else { "whisper-cli" };
    let dest = bin_dir.join(bin_name);

    if dest.exists() {
        tracing::info!("whisper-cli already present at {}", dest.display());
        return Ok(dest);
    }

    let url = if cfg!(windows) {
        "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-x64.zip"
    } else if cfg!(target_os = "macos") {
        "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-arm64.zip"
    } else {
        "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-x64.zip"
    };

    tracing::info!("Downloading whisper.cpp runner from {url}");

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) DABAAR/0.2.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()?;


    // Priority order:
    //   1. openblas build (GCC-linked, ucrtbase only — runs on any Win 10+ without VC++ Redist)
    //   2. vanilla bin build (MSVC-linked, requires VC++ Redist which may be missing)
    //   3. pinned v1.7.4 release as last resort
    let urls = if cfg!(windows) {
        vec![
            "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-openblas-bin-x64.zip",
            "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-openblas-bin-x64.zip",
            "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-blas-bin-x64.zip",
            "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-x64.zip",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-arm64.zip",
            "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-bin-arm64.zip",
        ]
    } else {
        vec![
            "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-bin-x64.zip",
            "https://github.com/ggerganov/whisper.cpp/releases/download/v1.7.4/whisper-bin-x64.zip",
        ]
    };


    let mut resp_opt = None;
    for u in &urls {
        tracing::info!("Attempting to download whisper.cpp runner from {u}");
        if let Ok(resp) = client.get(*u).send().await {
            if resp.status().is_success() {
                resp_opt = Some(resp);
                break;
            }
        }
    }

    let mut response = match resp_opt {
        Some(r) => r,
        None => anyhow::bail!("Failed to download whisper.cpp runner from GitHub releases. Please check your internet connection."),
    };

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut bytes: Vec<u8> = Vec::with_capacity(if total > 0 { total as usize } else { 15 * 1024 * 1024 });

    while let Some(chunk) = response.chunk().await? {
        downloaded += chunk.len() as u64;
        bytes.extend_from_slice(&chunk);
        progress_cb(downloaded, total);
    }

    let temp_archive = bin_dir.join("whisper_download.zip");
    tokio::fs::write(&temp_archive, &bytes).await?;

    let extract_temp_dir = bin_dir.join("whisper_extract_temp");
    let _ = tokio::fs::remove_dir_all(&extract_temp_dir).await;
    tokio::fs::create_dir_all(&extract_temp_dir).await?;

    #[cfg(windows)]
    {
        let tar_res = tokio::process::Command::new("tar")
            .arg("-xf")
            .arg(&temp_archive)
            .arg("-C")
            .arg(&extract_temp_dir)
            .output()
            .await;

        if tar_res.is_err() || !tar_res.unwrap().status.success() {
            let _ = tokio::process::Command::new("powershell")
                .arg("-NoProfile")
                .arg("-Command")
                .arg(format!(
                    "Expand-Archive -Force -Path '{}' -DestinationPath '{}'",
                    temp_archive.display(),
                    extract_temp_dir.display()
                ))
                .output()
                .await;
        }


        // Copy ALL .exe and .dll files from the extracted archive so that all
        // sibling DLLs (ggml.dll, ggml-cpu.dll, whisper.dll, libwinpthread-1.dll,
        // libopenblas.dll, etc.) land in the same bin/ folder as whisper-cli.exe.
        let mut stack = vec![extract_temp_dir.clone()];
        while let Some(dir) = stack.pop() {
            if let Ok(mut rd) = tokio::fs::read_dir(&dir).await {
                while let Ok(Some(entry)) = rd.next_entry().await {
                    let path = entry.path();
                    if path.is_dir() {
                        stack.push(path);
                        continue;
                    }
                    let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                    let is_exe = fname.ends_with(".exe");
                    let is_dll = fname.ends_with(".dll");
                    if !is_exe && !is_dll { continue; }
                    // Rename main.exe -> whisper-cli.exe for compatibility
                    let target_name = if fname == "main.exe" {
                        "whisper-cli.exe".to_string()
                    } else {
                        fname.clone()
                    };
                    let target = bin_dir.join(&target_name);
                    let _ = tokio::fs::copy(&path, &target).await;
                    tracing::info!("Extracted {target_name} to bin dir");
                }
            }
        }
    } // end #[cfg(windows)]

    #[cfg(unix)]
    {
        let _ = tokio::process::Command::new("unzip")
            .arg("-o")
            .arg(&temp_archive)
            .arg("-d")
            .arg(&extract_temp_dir)
            .output()
            .await;

        if let Ok(entries) = find_files_recursive(&extract_temp_dir, &["whisper-cli", "main"]).await {
            for (name, path) in entries {
                let target_name = if name == "main" { "whisper-cli" } else { &name };
                let target = bin_dir.join(target_name);
                let _ = tokio::fs::copy(&path, &target).await;
                use std::os::unix::fs::PermissionsExt;
                if let Ok(mut perms) = tokio::fs::metadata(&target).await.map(|m| m.permissions()) {
                    perms.set_mode(0o755);
                    let _ = tokio::fs::set_permissions(&target, perms).await;
                }
            }
        }
    }

    let _ = tokio::fs::remove_file(&temp_archive).await;
    let _ = tokio::fs::remove_dir_all(&extract_temp_dir).await;

    if dest.exists() {
        tracing::info!("whisper-cli successfully installed to {}", dest.display());
        Ok(dest)
    } else {
        anyhow::bail!("whisper-cli binary could not be extracted to {}", dest.display())
    }
}

async fn find_files_recursive(dir: &std::path::Path, target_names: &[&str]) -> Result<Vec<(String, PathBuf)>> {
    let mut results = Vec::new();
    let mut stack = vec![dir.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        if let Ok(mut entries) = tokio::fs::read_dir(&current_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                } else if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    let file_name_lower = file_name.to_lowercase();
                    for &target in target_names {
                        if file_name_lower == target.to_lowercase() {
                            results.push((target.to_string(), path.clone()));
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

/// Download the Whisper GGML model (base or tiny) and ensure whisper-cli runner is installed.
pub async fn download_whisper_model(
    app_data_dir: &std::path::Path,
    model: &str, // "base" or "tiny"
    progress_cb: impl Fn(u64, u64) + Send + 'static,
) -> Result<PathBuf> {
    let models_dir = app_data_dir.join("whisper-models");
    tokio::fs::create_dir_all(&models_dir).await?;

    let (filename, url) = match model {
        "tiny" => (
            "ggml-tiny.bin",
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        ),
        _ => (
            "ggml-base.bin",
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        ),
    };

    let dest = models_dir.join(filename);

    if !dest.exists() {
        tracing::info!("Downloading Whisper model ({model}) from {url}");

        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) DABAAR/0.2.0")
            .timeout(std::time::Duration::from_secs(600))
            .build()?;

        let mut response = client.get(url).send().await?;
        let total = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut bytes: Vec<u8> = Vec::with_capacity(if total > 0 { total as usize } else { 140 * 1024 * 1024 });

        while let Some(chunk) = response.chunk().await? {
            downloaded += chunk.len() as u64;
            bytes.extend_from_slice(&chunk);
            progress_cb(downloaded, total);
        }

        tokio::fs::write(&dest, &bytes).await?;
        tracing::info!("Whisper model ({model}) downloaded: {} MB", bytes.len() / (1024 * 1024));
    }

    // Also ensure the whisper-cli runner executable is downloaded
    let bin_name = if cfg!(windows) { "whisper-cli.exe" } else { "whisper-cli" };
    let runner_path = app_data_dir.join("bin").join(bin_name);
    if !runner_path.exists() {
        let _ = download_whisper_cli(app_data_dir, |_, _| {}).await;
    }

    Ok(dest)
}

/// Offline status summary for the Settings screen.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineStatus {
    pub ffmpeg_ready: bool,
    pub yt_dlp_ready: bool,
    pub whisper_cli_ready: bool,
    pub whisper_base_ready: bool,
    pub whisper_tiny_ready: bool,
}

/// Check which offline components are already installed.
pub async fn get_offline_status(app_data_dir: &std::path::Path) -> OfflineStatus {
    let status = check_all(app_data_dir).await;
    OfflineStatus {
        ffmpeg_ready: status.ffmpeg.found,
        yt_dlp_ready: status.yt_dlp.found,
        whisper_cli_ready: status.whisper_cli.found,
        whisper_base_ready: status.whisper_model.base_available,
        whisper_tiny_ready: status.whisper_model.tiny_available,
    }
}
