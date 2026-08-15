import { useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
  checkDependencies,
  downloadYtDlp,
  downloadFfmpeg,
  downloadWhisperModel,
  getOfflineStatus,
  onDownloadProgress,
  getHardwareInfo,
} from "../lib/api.js";
import { useTheme } from "../context/ThemeContext.jsx";
import Btn from "../components/Btn.jsx";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    groq_api_key: "",
    output_dir: "",
    offline_mode: false,
    offline_model: "base",
    custom_vocabulary: "",
  });
  const [deps, setDeps] = useState(null);
  const [offlineStatus, setOfflineStatus] = useState(null);
  const [hardware, setHardware] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingComponent, setDownloadingComponent] = useState(null); // "ffmpeg" | "yt_dlp" | "whisper_base" | "all"
  const [downloadProgress, setDownloadProgress] = useState({});
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s) setSettings(s);
    });
    checkDependencies().then((d) => {
      if (d) setDeps(d);
    });
    getOfflineStatus().then((s) => {
      if (s) setOfflineStatus(s);
    });
    getHardwareInfo().then((h) => {
      if (h) setHardware(h);
    });

    let unlisten = null;
    onDownloadProgress((payload) => {
      if (payload && payload.component) {
        const pct =
          payload.total > 0
            ? Math.round((payload.downloaded / payload.total) * 100)
            : 0;
        setDownloadProgress((prev) => ({
          ...prev,
          [payload.component]: pct,
        }));
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (typeof unlisten === "function") unlisten();
    };
  }, []);

  async function handleSave(e) {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await saveSettings(settings);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } catch (err) {
      alert("Failed to save settings: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload(comp) {
    setDownloadingComponent(comp);
    try {
      if (comp === "yt_dlp") {
        await downloadYtDlp();
      } else if (comp === "ffmpeg") {
        await downloadFfmpeg();
      } else if (comp === "whisper_base") {
        await downloadWhisperModel("base");
      } else if (comp === "whisper_tiny") {
        await downloadWhisperModel("tiny");
      } else if (comp === "all") {
        await downloadYtDlp();
        await downloadFfmpeg();
        await downloadWhisperModel("base");
      }
      const updatedDeps = await checkDependencies();
      setDeps(updatedDeps);
      const updatedStatus = await getOfflineStatus();
      setOfflineStatus(updatedStatus);
    } catch (err) {
      alert(`Download failed: ` + (err.message || err));
    } finally {
      setDownloadingComponent(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h1 className="text-base font-semibold text-primary">Settings</h1>
          <p className="text-xs text-secondary mt-0.5">
            Manage appearance, offline tools, storage locations, and church vocabulary.
          </p>
        </div>
      </header>

      {/* ── Tabs Toolbar ──────────────────────────────────────────── */}
      <div className="px-6 py-2 border-b border-border bg-surface/30 flex gap-2 text-xs font-medium">
        {[
          { key: "general", label: "General & Storage", icon: "bx-slider" },
          { key: "offline", label: "Processing & Offline Tools", icon: "bx-chip" },
          { key: "vocabulary", label: "Church Vocabulary", icon: "bx-book" },
          { key: "diagnostics", label: "System Status", icon: "bx-pulse" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === tab.key
                ? "bg-surface-active text-primary font-semibold border border-border-strong"
                : "text-secondary hover:text-primary"
            }`}
          >
            <i className={`bx ${tab.icon} text-sm`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ───────────────────────────────────────────── */}
      <div className="page-content flex justify-center py-8">
        <div className="w-full max-w-xl space-y-6">
          {/* Tab 1: General & Storage */}
          {activeTab === "general" && (
            <form onSubmit={handleSave} className="space-y-5 text-xs">
              {/* Theme Mode */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primary block">
                  Theme Appearance
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`p-3 rounded border text-left flex items-center justify-between transition-colors ${
                      theme === "dark"
                        ? "border-accent bg-surface-active"
                        : "border-border bg-surface hover:bg-surface-hover text-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <i className="bx bx-moon text-base text-accent" />
                      <div>
                        <p className="font-semibold text-primary">Dark Mode</p>
                        <p className="text-[10px] text-muted">Pro tool dark grey</p>
                      </div>
                    </div>
                    {theme === "dark" && (
                      <i className="bx bxs-check-circle text-accent text-sm" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`p-3 rounded border text-left flex items-center justify-between transition-colors ${
                      theme === "light"
                        ? "border-accent bg-surface-active"
                        : "border-border bg-surface hover:bg-surface-hover text-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <i className="bx bx-sun text-base text-accent" />
                      <div>
                        <p className="font-semibold text-primary">Light Mode</p>
                        <p className="text-[10px] text-muted">Clean high-contrast light</p>
                      </div>
                    </div>
                    {theme === "light" && (
                      <i className="bx bxs-check-circle text-accent text-sm" />
                    )}
                  </button>
                </div>
              </div>

              {/* Cloud Speech API Key */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primary block">
                  Cloud Speech API Key (Optional)
                </label>
                <input
                  type="password"
                  value={settings.groq_api_key}
                  onChange={(e) =>
                    setSettings({ ...settings, groq_api_key: e.target.value })
                  }
                  placeholder="gsk_..."
                  className="field-input font-mono"
                />
                <p className="text-[11px] text-muted">
                  Enables 20-second high-speed cloud transcription. You can get a free key from{" "}
                  <a
                    href="https://console.groq.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    console.groq.com
                  </a>.
                </p>
              </div>

              {/* Output Directory */}
              <div className="space-y-1.5">
                <label className="font-semibold text-primary block">
                  Clips Output Folder
                </label>
                <input
                  type="text"
                  value={settings.output_dir}
                  onChange={(e) =>
                    setSettings({ ...settings, output_dir: e.target.value })
                  }
                  placeholder="Videos/Dabar"
                  className="field-input font-mono"
                />
                <p className="text-[11px] text-muted">
                  The folder on your computer where finished video clips are saved.
                </p>
              </div>

              {savedNotice && (
                <div className="p-2.5 rounded border border-success/30 bg-success-muted text-success flex items-center gap-2">
                  <i className="bx bxs-check-circle text-base" />
                  <span>Settings saved successfully.</span>
                </div>
              )}

              <Btn type="submit" disabled={isSaving}>
                <i
                  className={`bx ${
                    isSaving ? "bx-loader-alt bx-spin" : "bx-check"
                  } text-sm`}
                />
                <span>{isSaving ? "Saving…" : "Save Settings"}</span>
              </Btn>
            </form>
          )}

          {/* Tab 2: Processing & Offline Tools */}
          {activeTab === "offline" && (
            <div className="space-y-6 text-xs">
              {/* Engine Choice */}
              <div className="space-y-2">
                <label className="font-semibold text-primary block">
                  Transcription Method
                </label>
                <div className="space-y-2">
                  <div
                    onClick={() =>
                      setSettings({ ...settings, offline_mode: false })
                    }
                    className={`cursor-pointer border rounded-md p-3 transition-colors ${
                      !settings.offline_mode
                        ? "border-accent bg-surface-active"
                        : "border-border bg-surface hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary flex items-center gap-1.5">
                        <i className="bx bx-cloud text-accent text-sm" />
                        <span>High-Speed Cloud Mode (Recommended)</span>
                      </span>
                      {!settings.offline_mode && (
                        <i className="bx bxs-check-circle text-accent text-sm" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Transcribes a 45-minute sermon in ~20 seconds with highest accuracy on church worship acoustics. Requires internet connection.
                    </p>
                  </div>

                  <div
                    onClick={() =>
                      setSettings({ ...settings, offline_mode: true })
                    }
                    className={`cursor-pointer border rounded-md p-3 transition-colors ${
                      settings.offline_mode
                        ? "border-accent bg-surface-active"
                        : "border-border bg-surface hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary flex items-center gap-1.5">
                        <i className="bx bx-laptop text-accent text-sm" />
                        <span>Private Offline Mode</span>
                      </span>
                      {settings.offline_mode && (
                        <i className="bx bxs-check-circle text-accent text-sm" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Processes everything locally on your computer with zero internet required. All data stays on your machine.
                    </p>
                  </div>
                </div>
              </div>

              {/* Offline Tools Manager */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-primary">
                      Offline Processing Tools
                    </h3>
                    <p className="text-[11px] text-muted">
                      Install components to process and export video clips without internet.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownload("all")}
                    disabled={Boolean(downloadingComponent)}
                    className="px-2.5 py-1 rounded bg-accent text-white hover:bg-[var(--accent-hover)] text-xs font-medium transition-colors"
                  >
                    {downloadingComponent === "all" ? "Downloading…" : "Install All Tools"}
                  </button>
                </div>

                <div className="border border-border rounded-md bg-surface divide-y divide-border overflow-hidden">
                  {/* Video Processor */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary">Video Clip Processor</p>
                      <p className="text-[10px] text-muted">
                        Trims, frames, and exports vertical video clips
                      </p>
                      {downloadProgress.ffmpeg !== undefined &&
                        downloadingComponent === "ffmpeg" && (
                          <div className="w-36 mt-1.5">
                            <div className="download-bar-track">
                              <div
                                className="download-bar-fill"
                                style={{ width: `${downloadProgress.ffmpeg}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-muted">
                              {downloadProgress.ffmpeg}%
                            </span>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      {deps?.ffmpeg?.found ? (
                        <span className="status-pill ready">
                          <i className="bx bxs-check-circle text-xs" />
                          <span>Installed</span>
                        </span>
                      ) : (
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload("ffmpeg")}
                          disabled={Boolean(downloadingComponent)}
                        >
                          <i className="bx bx-download text-xs" />
                          <span>Install</span>
                        </Btn>
                      )}
                    </div>
                  </div>

                  {/* Link Downloader */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary">Web Link Downloader</p>
                      <p className="text-[10px] text-muted">
                        Retrieves audio directly from YouTube and Google Drive links
                      </p>
                      {downloadProgress.yt_dlp !== undefined &&
                        downloadingComponent === "yt_dlp" && (
                          <div className="w-36 mt-1.5">
                            <div className="download-bar-track">
                              <div
                                className="download-bar-fill"
                                style={{ width: `${downloadProgress.yt_dlp}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-muted">
                              {downloadProgress.yt_dlp}%
                            </span>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      {deps?.yt_dlp?.found ? (
                        <span className="status-pill ready">
                          <i className="bx bxs-check-circle text-xs" />
                          <span>Installed</span>
                        </span>
                      ) : (
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload("yt_dlp")}
                          disabled={Boolean(downloadingComponent)}
                        >
                          <i className="bx bx-download text-xs" />
                          <span>Install</span>
                        </Btn>
                      )}
                    </div>
                  </div>

                  {/* Speech Model */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary">
                        Offline Speech Recognition Engine (~140MB)
                      </p>
                      <p className="text-[10px] text-muted">
                        Local language package for offline speech transcription
                      </p>
                      {downloadProgress.whisper_base !== undefined &&
                        downloadingComponent === "whisper_base" && (
                          <div className="w-36 mt-1.5">
                            <div className="download-bar-track">
                              <div
                                className="download-bar-fill"
                                style={{
                                  width: `${downloadProgress.whisper_base}%`,
                                }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-muted">
                              {downloadProgress.whisper_base}%
                            </span>
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                      {offlineStatus?.whisper_base_ready ||
                      deps?.whisper_model?.base_available ? (
                        <span className="status-pill ready">
                          <i className="bx bxs-check-circle text-xs" />
                          <span>Installed</span>
                        </span>
                      ) : (
                        <Btn
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload("whisper_base")}
                          disabled={Boolean(downloadingComponent)}
                        >
                          <i className="bx bx-download text-xs" />
                          <span>Install</span>
                        </Btn>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {savedNotice && (
                <div className="p-2.5 rounded border border-success/30 bg-success-muted text-success flex items-center gap-2">
                  <i className="bx bxs-check-circle text-base" />
                  <span>Settings saved.</span>
                </div>
              )}

              <Btn onClick={handleSave} disabled={isSaving}>
                <i
                  className={`bx ${
                    isSaving ? "bx-loader-alt bx-spin" : "bx-check"
                  } text-sm`}
                />
                <span>Save Settings</span>
              </Btn>
            </div>
          )}

          {/* Tab 3: Church Vocabulary */}
          {activeTab === "vocabulary" && (
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-primary block">
                  Preacher Names, Ministry Terms & Scripture Words
                </label>
                <textarea
                  rows={6}
                  value={settings.custom_vocabulary}
                  onChange={(e) =>
                    setSettings({ ...settings, custom_vocabulary: e.target.value })
                  }
                  placeholder="Pastor Daniel, Yahweh, Ruach HaKodesh, Gethsemane, Pentecost, Habakkuk, Melchizedek..."
                  className="field-input leading-relaxed font-mono"
                />
                <p className="text-[11px] text-muted">
                  Comma-separated list of church names and biblical terms. Dabar will automatically spell and format these words correctly in all manuscripts and clips.
                </p>
              </div>

              {savedNotice && (
                <div className="p-2.5 rounded border border-success/30 bg-success-muted text-success flex items-center gap-2">
                  <i className="bx bxs-check-circle text-base" />
                  <span>Vocabulary saved.</span>
                </div>
              )}

              <Btn type="submit" disabled={isSaving}>
                <i
                  className={`bx ${
                    isSaving ? "bx-loader-alt bx-spin" : "bx-check"
                  } text-sm`}
                />
                <span>Save Vocabulary</span>
              </Btn>
            </form>
          )}

          {/* Tab 4: System Status */}
          {activeTab === "diagnostics" && (
            <div className="space-y-4 text-xs">
              {/* System Profile */}
              <div className="border border-border bg-surface p-4 rounded-md space-y-2">
                <h3 className="font-semibold text-primary flex items-center gap-1.5">
                  <i className="bx bx-chip text-accent text-sm" />
                  <span>System Hardware</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-muted block">System Memory</span>
                    <span className="text-primary font-bold">
                      {hardware?.ram_gb || "16"} GB
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block">Rendering Speed</span>
                    <span className="text-primary font-bold">
                      {hardware?.is_low_end ? "Balanced" : "High Performance"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status List */}
              <div className="border border-border rounded-md bg-surface divide-y divide-border overflow-hidden">
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-primary block">
                      Video Processing Engine
                    </span>
                    <span className="text-[10px] text-muted">
                      {deps?.ffmpeg?.found ? "Ready for video export" : "Not yet installed"}
                    </span>
                  </div>
                  <span className={`status-pill ${deps?.ffmpeg?.found ? "ready" : "failed"}`}>
                    <i className={`bx ${deps?.ffmpeg?.found ? "bxs-check-circle" : "bx-x-circle"} text-xs`} />
                    <span>{deps?.ffmpeg?.found ? "Ready" : "Missing"}</span>
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-primary block">
                      Web Link Downloader
                    </span>
                    <span className="text-[10px] text-muted">
                      {deps?.yt_dlp?.found ? "Ready to import URLs" : "Not yet installed"}
                    </span>
                  </div>
                  <span className={`status-pill ${deps?.yt_dlp?.found ? "ready" : "failed"}`}>
                    <i className={`bx ${deps?.yt_dlp?.found ? "bxs-check-circle" : "bx-x-circle"} text-xs`} />
                    <span>{deps?.yt_dlp?.found ? "Ready" : "Missing"}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
