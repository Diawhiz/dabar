import { useEffect, useState } from "react";
import { getSettings, saveSettings, checkDependencies, downloadYtDlp, getHardwareInfo } from "../lib/api.js";
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
      alert("Could not save settings: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadTool() {
    setIsDownloadingTool(true);
    try {
      await downloadYtDlp();
      const updated = await checkDependencies();
      setDeps(updated);
    } catch (err) {
      alert("Could not download video tool: " + (err.message || err));
    } finally {
      setIsDownloadingTool(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-16 font-sans">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="border-b border-border pb-4">
        <h1 className="font-display text-2xl font-bold text-primary">
          Preferences
        </h1>
        <p className="text-xs text-secondary mt-0.5">
          Theme appearance, transcription speed, and church vocabulary.
        </p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex border-b border-border gap-6 text-xs font-semibold">
        {[
          { key: "general", label: "Appearance & Storage" },
          { key: "transcription", label: "Transcription Speed" },
          { key: "vocabulary", label: "Church Vocabulary" },
          { key: "tools", label: "System Diagnostics" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2.5 transition-colors ${
              activeTab === tab.key
                ? "text-accent border-b-2 border-accent"
                : "text-secondary hover:text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: General & Appearance ─────────────────────────── */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Theme Selector */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-primary block">Appearance Mode</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  theme === "light"
                    ? "border-accent bg-surface shadow-xs"
                    : "border-border bg-base hover:bg-surface text-secondary"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <i className="bx bx-sun text-accent text-lg" />
                  <div>
                    <p className="text-xs font-bold text-primary">Light Mode</p>
                    <p className="text-[10px] text-secondary">Warm paper parchment</p>
                  </div>
                </div>
                {theme === "light" && <i className="bx bxs-check-circle text-accent text-base" />}
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  theme === "dark"
                    ? "border-accent bg-surface shadow-xs"
                    : "border-border bg-base hover:bg-surface text-secondary"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <i className="bx bx-moon text-accent text-lg" />
                  <div>
                    <p className="text-xs font-bold text-primary">Dark Mode</p>
                    <p className="text-[10px] text-secondary">Warm charcoal walnut</p>
                  </div>
                </div>
                {theme === "dark" && <i className="bx bxs-check-circle text-accent text-base" />}
              </button>
            </div>
          </div>

          {/* Groq Key */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-primary block">Groq Cloud API Key</label>
            <input
              type="password"
              value={settings.groq_api_key}
              onChange={(e) => setSettings({ ...settings, groq_api_key: e.target.value })}
              placeholder="gsk_..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-primary outline-none focus:border-accent font-mono"
            />
            <p className="text-[11px] text-secondary">
              Free key at{" "}
              <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-accent underline font-medium">
                console.groq.com
              </a>. Enables 20-second transcription.
            </p>
          </div>

          {/* Save folder */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-primary block">Where to Save Video Clips</label>
            <input
              type="text"
              value={settings.output_dir}
              onChange={(e) => setSettings({ ...settings, output_dir: e.target.value })}
              placeholder="Videos/Dabar"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-primary outline-none focus:border-accent"
            />
          </div>

          {savedNotice && (
            <div className="rounded-lg border border-accent/40 bg-surface px-3 py-2 text-xs text-primary flex items-center gap-2">
              <i className="bx bxs-check-circle text-accent text-base" />
              <span>Preferences saved successfully.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            <i className={`bx ${isSaving ? "bx-loader-alt bx-spin" : "bx-check"} text-base`} />
            <span>{isSaving ? "Saving…" : "Save Preferences"}</span>
          </Btn>
        </form>
      )}

      {/* ── Tab 2: Transcription Speed ──────────────────────────── */}
      {activeTab === "transcription" && (
        <form onSubmit={handleSave} className="space-y-4">
          <div
            onClick={() => setSettings({ ...settings, offline_mode: false })}
            className={`cursor-pointer rounded-xl border p-4 transition-colors space-y-1 ${
              !settings.offline_mode
                ? "border-accent bg-surface"
                : "border-border bg-base hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <i className="bx bx-cloud text-accent text-base" />
                <span>Cloud Fast Track (Recommended)</span>
              </span>
              {!settings.offline_mode && <i className="bx bxs-check-circle text-accent text-base" />}
            </div>
            <p className="text-[11px] text-secondary">
              Transcribes a full 45-minute sermon in 20 seconds. Highest accuracy on church worship and acoustics.
            </p>
          </div>

          <div
            onClick={() => setSettings({ ...settings, offline_mode: true })}
            className={`cursor-pointer rounded-xl border p-4 transition-colors space-y-1 ${
              settings.offline_mode
                ? "border-accent bg-surface"
                : "border-border bg-base hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <i className="bx bx-laptop text-accent text-base" />
                <span>Offline on this Computer</span>
              </span>
              {settings.offline_mode && <i className="bx bxs-check-circle text-accent text-base" />}
            </div>
            <p className="text-[11px] text-secondary">
              Runs 100% locally on your computer with zero internet required.
            </p>
          </div>

          {savedNotice && (
            <div className="rounded-lg border border-accent/40 bg-surface px-3 py-2 text-xs text-primary flex items-center gap-2">
              <i className="bx bxs-check-circle text-accent text-base" />
              <span>Preferences saved.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            <i className={`bx ${isSaving ? "bx-loader-alt bx-spin" : "bx-check"} text-base`} />
            <span>{isSaving ? "Saving…" : "Save Preferences"}</span>
          </Btn>
        </form>
      )}

      {/* ── Tab 3: Church Names ─────────────────────────────────── */}
      {activeTab === "vocabulary" && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-primary block">
              Pastor Names, Ministry Terms & Scripture Words
            </label>
            <textarea
              rows={5}
              value={settings.custom_vocabulary}
              onChange={(e) => setSettings({ ...settings, custom_vocabulary: e.target.value })}
              placeholder="Pastor Daniel, Yahweh, Ruach HaKodesh, Gethsemane, Pentecost, Habakkuk..."
              className="w-full rounded-lg border border-border bg-surface p-3 text-xs text-primary outline-none focus:border-accent leading-relaxed"
            />
            <p className="text-[11px] text-secondary">
              Comma-separated list of names and biblical words. Dabar will automatically match and spell them correctly.
            </p>
          </div>

          {savedNotice && (
            <div className="rounded-lg border border-accent/40 bg-surface px-3 py-2 text-xs text-primary flex items-center gap-2">
              <i className="bx bxs-check-circle text-accent text-base" />
              <span>Vocabulary saved.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            <i className={`bx ${isSaving ? "bx-loader-alt bx-spin" : "bx-check"} text-base`} />
            <span>{isSaving ? "Saving…" : "Save Vocabulary"}</span>
          </Btn>
        </form>
      )}

      {/* ── Tab 4: Video Tools ──────────────────────────────────── */}
      {activeTab === "tools" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
            <p className="text-xs font-bold text-primary flex items-center gap-1.5">
              <i className="bx bx-chip text-accent text-base" />
              <span>Hardware Profile</span>
            </p>
            <p className="text-[11px] text-secondary">
              Installed Memory: <strong className="text-primary">{hardware?.ram_gb || "8"} GB RAM</strong> · Video Engine: <strong className="text-primary">{hardware?.recommended_ffmpeg_preset || "fast"}</strong>
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
            <div className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary">Video Clip Renderer</p>
                <p className="text-[10px] text-secondary">
                  {deps?.ffmpeg?.found ? "Ready to export vertical clips" : "Waiting"}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-accent flex items-center gap-1">
                <i className={`bx ${deps?.ffmpeg?.found ? "bxs-check-circle" : "bx-circle"}`} />
                <span>{deps?.ffmpeg?.found ? "Ready" : "Waiting"}</span>
              </span>
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary">YouTube Video Downloader</p>
                <p className="text-[10px] text-secondary">
                  {deps?.yt_dlp?.found ? "Ready to import video links" : "Click to install"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!deps?.yt_dlp?.found && (
                  <button
                    type="button"
                    onClick={handleDownloadTool}
                    disabled={isDownloadingTool}
                    className="px-2.5 py-1 rounded bg-accent text-white text-xs font-semibold"
                  >
                    <span>{isDownloadingTool ? "Downloading…" : "Install"}</span>
                  </button>
                )}
                <span className="text-[11px] font-semibold text-accent flex items-center gap-1">
                  <i className={`bx ${deps?.yt_dlp?.found ? "bxs-check-circle" : "bx-circle"}`} />
                  <span>{deps?.yt_dlp?.found ? "Ready" : "Not Installed"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
