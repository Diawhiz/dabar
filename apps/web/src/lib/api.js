/**
 * Dabar Tauri Desktop IPC API Client
 *
 * Calls native Rust commands via Tauri IPC (`invoke`) and listens for real-time
 * pipeline progress events (`listen`).
 */

// Check if running inside Tauri runtime
export const isTauri = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

async function getTauriCore() {
  if (!isTauri) return null;
  try {
    return await import("@tauri-apps/api/core");
  } catch (e) {
    console.warn("Tauri core import failed:", e);
    return null;
  }
}

async function getTauriEvent() {
  if (!isTauri) return null;
  try {
    return await import("@tauri-apps/api/event");
  } catch (e) {
    console.warn("Tauri event import failed:", e);
    return null;
  }
}

async function getTauriDialog() {
  if (!isTauri) return null;
  try {
    return await import("@tauri-apps/plugin-dialog");
  } catch (e) {
    console.warn("Tauri dialog import failed:", e);
    return null;
  }
}

/**
 * List all sermons in local SQLite database.
 */
export async function listSermons() {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("list_sermons");
  }
  // Browser fallback for UI preview
  const local = localStorage.getItem("dabar_sermons");
  return local ? JSON.parse(local) : [];
}

/**
 * Get a single sermon by ID with its highlights and transcript segments.
 */
export async function getSermon(id) {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("get_sermon", { id });
  }
  const local = localStorage.getItem("dabar_sermons");
  const list = local ? JSON.parse(local) : [];
  return list.find((s) => s.id === id) || null;
}

/**
 * Start the pipeline for a YouTube URL or local audio/video file.
 * Returns the created sermon ID immediately.
 */
export async function createSermon(source) {
  const core = await getTauriCore();
  if (core) {
    const sermonId = await core.invoke("start_pipeline", { source });
    return { id: sermonId };
  }
  // Browser mock
  const mockId = "mock-" + Date.now();
  return { id: mockId };
}

/**
 * Render a vertical clip to disk and return the output file path.
 */
export async function renderClip(sermonId, highlightId) {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("render_clip", { sermonId, highlightId });
  }
  return "C:\\Users\\Mock\\Videos\\Dabar\\mock_clip.mp4";
}

/**
 * Open native OS file dialog to select audio or video file(s).
 */
export async function pickMediaFile() {
  const dialog = await getTauriDialog();
  if (dialog) {
    return await dialog.open({
      multiple: false,
      filters: [
        {
          name: "Audio & Video",
          extensions: ["mp4", "mov", "webm", "mkv", "mp3", "wav", "m4a", "ogg", "opus", "aac", "flac"],
        },
      ],
    });
  }
  return null;
}

/**
 * Open a folder or file in the OS file explorer.
 */
export async function openInExplorer(path) {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("open_in_explorer", { path });
  }
  console.log("Mock openInExplorer:", path);
}

/**
 * Get user settings.
 */
export async function getSettings() {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("get_settings");
  }
  const local = localStorage.getItem("dabar_settings");
  return local
    ? JSON.parse(local)
    : {
        groq_api_key: "",
        output_dir: "Videos/Dabar",
        offline_mode: false,
        offline_model: "base",
        custom_vocabulary: "",
      };
}

/**
 * Save user settings.
 */
export async function saveSettings(settings) {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("save_settings", { settings });
  }
  localStorage.setItem("dabar_settings", JSON.stringify(settings));
}

/**
 * Check external tool statuses (ffmpeg, yt-dlp, whisper models).
 */
export async function checkDependencies() {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("check_dependencies");
  }
  return {
    ffmpeg: { found: true, path: "ffmpeg", version: "mock ffmpeg" },
    yt_dlp: { found: true, path: "yt-dlp", version: "mock yt-dlp" },
    whisper_model: { base_available: true, tiny_available: false, base_path: null, tiny_path: null },
  };
}

/**
 * Download yt-dlp binary on-demand.
 */
export async function downloadYtDlp() {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("download_yt_dlp");
  }
}

/**
 * Get hardware info.
 */
export async function getHardwareInfo() {
  const core = await getTauriCore();
  if (core) {
    return await core.invoke("get_hardware_info");
  }
  return { ram_gb: 16, is_low_end: false, recommended_ffmpeg_preset: "veryfast" };
}

/**
 * Subscribe to real-time pipeline progress events.
 * Returns an unlisten function.
 */
export async function onPipelineProgress(callback) {
  const tauriEvent = await getTauriEvent();
  if (tauriEvent) {
    return await tauriEvent.listen("pipeline-progress", (event) => {
      callback(event.payload);
    });
  }
  return () => {};
}
