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
      alert("Could not complete tool download: " + (err.message || err));
    } finally {
      setIsDownloadingTool(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-20 animate-fade-in font-sans">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Preferences
        </h1>
        <p className="mt-1 text-xs text-muted">
          Adjust how Dabar listens to sermons, where clips are saved, and custom church spellings.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex p-1 rounded-xl bg-surface border border-border/80 text-xs font-semibold max-w-md">
        {[
          { key: "general", label: "Cloud & Storage" },
          { key: "transcription", label: "Listening Mode" },
          { key: "vocabulary", label: "Church Names" },
          { key: "system", label: "Video Tools" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeTab === tab.key
                ? "bg-paper text-ink shadow-xs border border-border/60"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Cloud & Storage ─────────────────────────────── */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-2xl border border-border bg-paper p-6 shadow-xs space-y-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-ink block">Groq Cloud Key</span>
              <input
                type="password"
                value={settings.groq_api_key}
                onChange={(e) => setSettings({ ...settings, groq_api_key: e.target.value })}
                placeholder="gsk_..."
                className="w-full rounded-xl border border-border bg-paper px-4 py-2.5 text-xs text-ink outline-none transition-colors focus:border-amber font-mono"
              />
              <span className="text-[11px] text-muted block leading-relaxed">
                Enables ultra-fast 20-second sermon transcription and AI highlight selection. Completely free at{" "}
                <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-amber underline">
                  console.groq.com
                </a>.
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-ink block">Where to Save Video Clips</span>
              <input
                type="text"
                value={settings.output_dir}
                onChange={(e) => setSettings({ ...settings, output_dir: e.target.value })}
                placeholder="Videos/Dabar"
                className="w-full rounded-xl border border-border bg-paper px-4 py-2.5 text-xs text-ink outline-none transition-colors focus:border-amber"
              />
              <span className="text-[11px] text-muted block">
                The folder on your computer where rendered 9:16 phone video clips will be placed.
              </span>
            </label>
          </div>

          {savedNotice && (
            <div className="rounded-xl border border-amber/30 bg-amber-light px-4 py-2.5 text-xs text-[#8C5516] flex items-center gap-2">
              <i className="bx bx-check-circle text-base" />
              <span>Preferences saved successfully.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Preferences"}
          </Btn>
        </form>
      )}

      {/* ── Tab 2: Listening Mode ───────────────────────────────── */}
      {activeTab === "transcription" && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-3">
            <span className="text-xs font-bold text-ink block">Choose How Dabar Transcribes</span>

            {/* Cloud Option */}
            <div
              onClick={() => setSettings({ ...settings, offline_mode: false })}
              className={`cursor-pointer rounded-2xl border p-5 transition-all space-y-1 ${
                !settings.offline_mode
                  ? "border-amber bg-amber-light/30 shadow-xs"
                  : "border-border bg-paper hover:bg-surface/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <i className="bx bx-cloud text-amber text-base" />
                  Fast Cloud Mode (Recommended)
                </span>
                {!settings.offline_mode && <i className="bx bxs-check-circle text-amber text-lg" />}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Transcribes a 45-minute message in 20 seconds with highest accuracy. Captures scripture, names, and background organ music effortlessly.
              </p>
            </div>

            {/* Offline Option */}
            <div
              onClick={() => setSettings({ ...settings, offline_mode: true })}
              className={`cursor-pointer rounded-2xl border p-5 transition-all space-y-1 ${
                settings.offline_mode
                  ? "border-amber bg-amber-light/30 shadow-xs"
                  : "border-border bg-paper hover:bg-surface/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <i className="bx bx-laptop text-amber text-base" />
                  Offline on this Computer
                </span>
                {settings.offline_mode && <i className="bx bxs-check-circle text-amber text-lg" />}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Runs 100% locally on your computer with zero internet required. Great for church rooms with spotty WiFi.
              </p>
            </div>
          </div>

          {savedNotice && (
            <div className="rounded-xl border border-amber/30 bg-amber-light px-4 py-2.5 text-xs text-[#8C5516] flex items-center gap-2">
              <i className="bx bx-check-circle text-base" />
              <span>Preferences saved successfully.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Preferences"}
          </Btn>
        </form>
      )}

      {/* ── Tab 3: Custom Church Vocabulary ─────────────────────── */}
      {activeTab === "vocabulary" && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-2xl border border-border bg-paper p-6 shadow-xs space-y-3">
            <span className="text-xs font-bold text-ink block">Pastors, Leaders & Church Terms</span>
            <textarea
              rows={6}
              value={settings.custom_vocabulary}
              onChange={(e) => setSettings({ ...settings, custom_vocabulary: e.target.value })}
              placeholder="Pastor Daniel, Yahweh, Ruach HaKodesh, Gethsemane, Grace Tabernacle, Pentecost, Habakkuk..."
              className="w-full rounded-xl border border-border bg-paper p-3 text-xs text-ink outline-none transition-colors focus:border-amber leading-relaxed"
            />
            <p className="text-[11px] text-muted">
              Add comma-separated names, places, or theological terms frequently spoken in your church. Dabar will automatically correct spelling in transcripts.
            </p>
          </div>

          {savedNotice && (
            <div className="rounded-xl border border-amber/30 bg-amber-light px-4 py-2.5 text-xs text-[#8C5516] flex items-center gap-2">
              <i className="bx bx-check-circle text-base" />
              <span>Church vocabulary saved.</span>
            </div>
          )}

          <Btn type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Vocabulary"}
          </Btn>
        </form>
      )}

      {/* ── Tab 4: System & Tools ───────────────────────────────── */}
      {activeTab === "system" && (
        <div className="space-y-6">
          {/* Hardware status */}
          <div className="rounded-2xl border border-border bg-paper p-5 shadow-xs space-y-2">
            <p className="text-xs font-bold text-ink flex items-center gap-2">
              <i className="bx bx-chip text-amber text-base" />
              Computer Performance Profile
            </p>
            <div className="text-xs text-muted space-y-1">
              <p>Memory Available: <strong className="text-ink">{hardware?.ram_gb || "8"} GB RAM</strong></p>
              <p>Video Engine Mode: <strong className="text-ink">{hardware?.is_low_end ? "Low-Spec PC Mode (Fast render)" : "Standard Quality Mode"}</strong></p>
            </div>
          </div>

          {/* External video tools */}
          <div className="rounded-2xl border border-border bg-paper divide-y divide-border overflow-hidden shadow-xs">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-ink">Video & Audio Processing Engine</p>
                <p className="text-[11px] text-muted">
                  {deps?.ffmpeg?.found
                    ? "Ready to export vertical video clips"
                    : "Not found on system"}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-amber bg-surface px-2.5 py-1 rounded-full border border-border">
                {deps?.ffmpeg?.found ? "Ready" : "Waiting"}
              </span>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-ink">YouTube Video Downloader</p>
                <p className="text-[11px] text-muted">
                  {deps?.yt_dlp?.found
                    ? "Ready to import YouTube sermons"
                    : "Click update to download latest version"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!deps?.yt_dlp?.found && (
                  <button
                    type="button"
                    onClick={handleDownloadTool}
                    disabled={isDownloadingTool}
                    className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber text-white hover:opacity-90 transition-opacity"
                  >
                    {isDownloadingTool ? "Downloading…" : "Download"}
                  </button>
                )}
                <span className="text-[11px] font-semibold text-amber bg-surface px-2.5 py-1 rounded-full border border-border">
                  {deps?.yt_dlp?.found ? "Ready" : "Not Installed"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
