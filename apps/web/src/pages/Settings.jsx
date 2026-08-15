import { useEffect, useState } from "react";
import { getSettings, saveSettings, checkDependencies, downloadYtDlp, getHardwareInfo } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    groq_api_key: "",
    output_dir: "",
    offline_mode: false,
    offline_model: "base",
    custom_vocabulary: "",
  });
  const [deps, setDeps] = useState(null);
  const [hardware, setHardware] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingTool, setIsDownloadingTool] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    getSettings().then((s) => { if (s) setSettings(s); });
    checkDependencies().then((d) => { if (d) setDeps(d); });
    getHardwareInfo().then((h) => { if (h) setHardware(h); });
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

  async function handleDownloadYtDlp() {
    setIsDownloadingTool(true);
    try {
      await downloadYtDlp();
      const updated = await checkDependencies();
      setDeps(updated);
    } catch (err) {
      alert("Failed to download yt-dlp: " + (err.message || err));
    } finally {
      setIsDownloadingTool(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Studio Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configure API keys, local output folders, transcription engines, and system dependencies.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 text-sm font-medium">
        {[
          { key: "general", label: "General & AI" },
          { key: "transcription", label: "Transcription & Models" },
          { key: "vocabulary", label: "Custom Vocabulary" },
          { key: "system", label: "System & Tools" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 transition-colors relative ${
              activeTab === tab.key
                ? "text-ember font-semibold border-b-2 border-ember"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: General & AI */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="space-y-6 max-w-lg">
          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Groq API Key</span>
            <input
              type="password"
              value={settings.groq_api_key}
              onChange={(e) => setSettings({ ...settings, groq_api_key: e.target.value })}
              placeholder="gsk_..."
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember font-mono"
            />
            <span className="text-xs text-muted mt-1 block">
              Required for fast cloud transcription and AI sermon highlight extraction. Get one free at{" "}
              <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-ember underline">
                console.groq.com
              </a>.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Clip Export Directory</span>
            <input
              type="text"
              value={settings.output_dir}
              onChange={(e) => setSettings({ ...settings, output_dir: e.target.value })}
              placeholder="Videos/Dabar"
              className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ember"
            />
            <span className="text-xs text-muted mt-1 block">
              Where generated 9:16 vertical MP4 video clips will be saved on your computer.
            </span>
          </label>

          {savedNotice && (
            <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-2.5 text-sm text-ember flex items-center gap-2">
              <i className="bx bx-check-circle text-lg" aria-hidden="true" />
              <span>Settings saved successfully.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Btn>
        </form>
      )}

      {/* Tab 2: Transcription Engine */}
      {activeTab === "transcription" && (
        <form onSubmit={handleSave} className="space-y-6 max-w-lg">
          <div className="space-y-3">
            <span className="text-sm font-medium text-ink block">Transcription Engine</span>
            
            <div
              onClick={() => setSettings({ ...settings, offline_mode: false })}
              className={`cursor-pointer rounded-card border p-4 transition-all ${
                !settings.offline_mode
                  ? "border-ember bg-ember/5"
                  : "border-border bg-paper hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Cloud Engine (Groq Whisper Large V3 Turbo)</p>
                  <p className="text-xs text-muted mt-0.5">
                    Fast (30-60s per sermon), highest accuracy, requires Groq API key and internet connection.
                  </p>
                </div>
                {!settings.offline_mode && <i className="bx bx-check-circle text-ember text-xl" />}
              </div>
            </div>

            <div
              onClick={() => setSettings({ ...settings, offline_mode: true })}
              className={`cursor-pointer rounded-card border p-4 transition-all ${
                settings.offline_mode
                  ? "border-ember bg-ember/5"
                  : "border-border bg-paper hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Local Engine (Offline whisper.cpp)</p>
                  <p className="text-xs text-muted mt-0.5">
                    Runs 100% locally on your computer. No internet or API key needed. Slower on low-end PCs.
                  </p>
                </div>
                {settings.offline_mode && <i className="bx bx-check-circle text-ember text-xl" />}
              </div>
            </div>
          </div>

          {settings.offline_mode && (
            <label className="block">
              <span className="text-sm font-medium text-ink mb-1 block">Local Model Size</span>
              <select
                value={settings.offline_model}
                onChange={(e) => setSettings({ ...settings, offline_model: e.target.value })}
                className="w-full rounded-card border border-border bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-ember"
              >
                <option value="base">Base (~150 MB) — Recommended balance of speed and accuracy</option>
                <option value="tiny">Tiny (~75 MB) — Fastest, best for low-spec PCs with ≤4GB RAM</option>
              </select>
            </label>
          )}

          {savedNotice && (
            <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-2.5 text-sm text-ember flex items-center gap-2">
              <i className="bx bx-check-circle text-lg" aria-hidden="true" />
              <span>Settings saved successfully.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save changes"}
          </Btn>
        </form>
      )}

      {/* Tab 3: Custom Vocabulary */}
      {activeTab === "vocabulary" && (
        <form onSubmit={handleSave} className="space-y-6 max-w-lg">
          <label className="block">
            <span className="text-sm font-medium text-ink mb-1 block">Custom Names & Church Vocabulary</span>
            <textarea
              rows={6}
              value={settings.custom_vocabulary}
              onChange={(e) => setSettings({ ...settings, custom_vocabulary: e.target.value })}
              placeholder="Pastor Daniel, Yahweh, Ruach HaKodesh, Gethsemane, Grace Community, Pentecost..."
              className="w-full rounded-card border border-border bg-paper p-4 text-sm text-ink outline-none transition-colors focus:border-ember"
            />
            <span className="text-xs text-muted mt-1 block">
              Comma-separated list of names, terms, or theological words frequently mentioned in your sermons.
            </span>
          </label>

          {savedNotice && (
            <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-2.5 text-sm text-ember flex items-center gap-2">
              <i className="bx bx-check-circle text-lg" aria-hidden="true" />
              <span>Settings saved successfully.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save vocabulary"}
          </Btn>
        </form>
      )}

      {/* Tab 4: System & Tools */}
      {activeTab === "system" && (
        <div className="space-y-6 max-w-lg">
          {/* Hardware status */}
          <div className="rounded-card border border-border p-4 bg-paper space-y-2">
            <p className="text-sm font-semibold text-ink flex items-center gap-2">
              <i className="bx bx-chip text-ember text-lg" />
              System Hardware Profile
            </p>
            <div className="text-xs text-muted space-y-1">
              <p>Detected Memory: <strong className="text-ink">{hardware?.ram_gb || "8+"} GB RAM</strong></p>
              <p>Hardware Profile: <strong className="text-ink">{hardware?.is_low_end ? "Low-Spec PC Mode (ultrafast encoder)" : "Standard PC Mode"}</strong></p>
              <p>FFmpeg Encoding Preset: <strong className="text-ink">{hardware?.recommended_ffmpeg_preset || "veryfast"}</strong></p>
            </div>
          </div>

          {/* External tools status */}
          <div className="rounded-card border border-border divide-y divide-border overflow-hidden bg-paper">
            {/* FFmpeg */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">FFmpeg Media Engine</p>
                <p className="text-xs text-muted">
                  {deps?.ffmpeg?.found
                    ? `Found (${deps.ffmpeg.version || "Installed on PATH"})`
                    : "Not found — ensure ffmpeg is on system PATH"}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded font-medium ${deps?.ffmpeg?.found ? "bg-ember/10 text-ember" : "bg-surface text-muted border border-border"}`}>
                {deps?.ffmpeg?.found ? "Ready" : "Not Detected"}
              </span>
            </div>

            {/* yt-dlp */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">yt-dlp Downloader</p>
                <p className="text-xs text-muted">
                  {deps?.yt_dlp?.found
                    ? `Found (${deps.yt_dlp.version || "Installed"})`
                    : "Not found — click download to install automatically"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!deps?.yt_dlp?.found && (
                  <Btn
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadYtDlp}
                    disabled={isDownloadingTool}
                  >
                    {isDownloadingTool ? "Downloading…" : "Download"}
                  </Btn>
                )}
                <span className={`text-xs px-2.5 py-1 rounded font-medium ${deps?.yt_dlp?.found ? "bg-ember/10 text-ember" : "bg-surface text-muted border border-border"}`}>
                  {deps?.yt_dlp?.found ? "Ready" : "Not Detected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
