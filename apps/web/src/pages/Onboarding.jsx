import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getOfflineStatus,
  downloadYtDlp,
  downloadFfmpeg,
  downloadWhisperModel,
  createSermon,
  pickMediaFile,
} from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const SAMPLE_CLIPS = [
  {
    id: "clip-1",
    title: "Mounting on Wings of Eagles",
    start: 252, // 04:12
    end: 298, // 04:58
    duration: "46s",
    verse: "Isaiah 40:31",
    theme: "Renewed Strength",
    caption:
      "Those who wait upon the Lord shall renew their strength. They shall mount up with wings like eagles, they shall run and not grow weary.",
    subtitleStyle: "Sacred Amber",
  },
  {
    id: "clip-2",
    title: "All Things Working for Good",
    start: 750, // 12:30
    end: 795, // 13:15
    duration: "45s",
    verse: "Romans 8:28",
    theme: "Divine Purpose",
    caption:
      "And we know with absolute certainty that God works all things together for the good of those who love Him and walk in His purpose.",
    subtitleStyle: "Royal Navy",
  },
  {
    id: "clip-3",
    title: "The Overcoming Light",
    start: 1630, // 27:10
    end: 1675, // 27:55
    duration: "45s",
    verse: "John 1:5",
    theme: "Victory in Darkness",
    caption:
      "The light shines right into the darkest valley, and no darkness in this world has ever had the power to overcome it.",
    subtitleStyle: "Porcelain White",
  },
];

const SUBTITLE_THEMES = [
  {
    id: "amber",
    name: "Sacred Amber",
    previewClass: "text-amber-400 font-editorial italic font-bold",
  },
  {
    id: "navy",
    name: "Royal Navy",
    previewClass: "text-blue-400 font-sans font-extrabold uppercase tracking-wider",
  },
  {
    id: "white",
    name: "Porcelain White",
    previewClass: "text-white font-sans font-bold",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();

  // Mode switcher: "sample" (Interactive Studio Tour) vs "ingest" (Instant Ingestion)
  const [activeMode, setActiveMode] = useState("sample"); // "sample" | "ingest"

  // Sample Studio State
  const [activeClipId, setActiveClipId] = useState("clip-1");
  const [activeSubtitleTheme, setActiveSubtitleTheme] = useState("amber");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSec, setPlaybackSec] = useState(0);

  // Ingestion State
  const [urlInput, setUrlInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingestError, setIngestError] = useState("");

  // Dependency readiness
  const [isReady, setIsReady] = useState(false);

  // Background dependency check & install
  useEffect(() => {
    async function initTools() {
      try {
        const status = await getOfflineStatus();
        if (!status?.yt_dlp_ready) downloadYtDlp().catch(() => {});
        if (!status?.ffmpeg_ready) downloadFfmpeg().catch(() => {});
        if (!status?.whisper_tiny_ready) downloadWhisperModel("tiny").catch(() => {});
        setIsReady(true);
      } catch {
        setIsReady(true);
      }
    }
    initTools();
  }, []);

  // Simulated live playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackSec((prev) => (prev >= 45 ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeClip = SAMPLE_CLIPS.find((c) => c.id === activeClipId) || SAMPLE_CLIPS[0];
  const activeThemeObj =
    SUBTITLE_THEMES.find((t) => t.id === activeSubtitleTheme) || SUBTITLE_THEMES[0];

  async function handleFilePick() {
    try {
      const path = await pickMediaFile();
      if (path) {
        setSelectedFile(path);
        setIngestError("");
      }
    } catch (err) {
      setIngestError("Could not open file picker: " + (err.message || err));
    }
  }

  async function handleStartIngest(e) {
    if (e) e.preventDefault();
    setIngestError("");

    const targetSource = selectedFile || urlInput.trim();
    if (!targetSource) {
      setIngestError("Please select a recording file or paste a YouTube sermon URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      localStorage.setItem("dabaar_onboarded", "true");
      const res = await createSermon(targetSource);
      if (res?.id) {
        navigate(`/processing/${res.id}`);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setIngestError(err.message || "Failed to start processing. Please try again.");
      setIsSubmitting(false);
    }
  }

  function handleSkipToLibrary() {
    localStorage.setItem("dabaar_onboarded", "true");
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-base text-primary flex flex-col justify-between selection:bg-orange/20">
      {/* ── Studio Header ───────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-border bg-surface/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border text-primary flex items-center justify-center font-editorial font-bold text-base shadow-sm relative">
              <span>ד</span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange ring-1 ring-base" />
            </div>
            <div>
              <span className="font-editorial text-lg font-bold tracking-tight text-primary">
                DABAAR
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-orange ml-2">
                Studio Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-elevated border border-border text-[11px] text-secondary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Offline Speech Engine Ready</span>
            </div>

            <button
              onClick={handleSkipToLibrary}
              className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1 py-1.5 px-3 rounded-lg hover:bg-surface-elevated border border-transparent hover:border-border"
            >
              <span>Library</span>
              <i className="bx bx-right-arrow-alt text-sm" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Studio Workspace ───────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-6 w-full flex-1 flex flex-col justify-center space-y-6">
        {/* Mode Selector Tabs (Interactive Live Studio vs Instant Ingest) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
          <div className="space-y-0.5">
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-primary">
              Preaching Media Studio
            </h1>
            <p className="text-secondary text-xs sm:text-sm">
              Extract high-impact vertical reels and Scripture chapters from Sunday sermons.
            </p>
          </div>

          <div className="flex p-1 bg-surface-elevated border border-border rounded-lg text-xs font-semibold shrink-0">
            <button
              onClick={() => setActiveMode("sample")}
              className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeMode === "sample"
                  ? "bg-accent text-white shadow-xs"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <i className="bx bx-play-circle text-sm" />
              <span>Interactive Demo</span>
            </button>

            <button
              onClick={() => setActiveMode("ingest")}
              className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                activeMode === "ingest"
                  ? "bg-accent text-white shadow-xs"
                  : "text-secondary hover:text-primary"
              }`}
            >
              <i className="bx bx-upload text-sm" />
              <span>Import Your Sermon</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            MODE A: INTERACTIVE SAMPLE SERMON STUDIO (Hands-on Demo)
            ═══════════════════════════════════════════════════════════════ */}
        {activeMode === "sample" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
            {/* Left Column: 9:16 Vertical Reel Player & Subtitle Controls */}
            <div className="lg:col-span-6 space-y-4">
              <div className="studio-card p-5 space-y-4 border-border">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-primary font-semibold">
                    <i className="bx bx-mobile-alt text-orange text-base" />
                    <span>Vertical Reel 9:16 (Simulated Output)</span>
                  </div>
                  <span className="font-mono text-[11px] text-orange bg-orange/10 px-2 py-0.5 rounded border border-orange/20">
                    {activeClip.verse}
                  </span>
                </div>

                {/* 9:16 Simulated Video Canvas with Dynamic Lyrics */}
                <div className="relative aspect-[16/9] sm:aspect-[16/10] w-full rounded-xl overflow-hidden bg-surface-elevated border border-border flex flex-col justify-between p-5 shadow-inner">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span className="text-[11px] font-mono">00:0{playbackSec} / 00:45</span>
                    <span className="text-[11px] text-secondary font-medium">{activeClip.theme}</span>
                  </div>

                  {/* Animated Spoken Preaching Words */}
                  <div className="py-3 text-center max-w-md mx-auto space-y-2">
                    <p className={`text-base sm:text-lg leading-relaxed ${activeThemeObj.previewClass}`}>
                      “{activeClip.caption}”
                    </p>
                    <p className="text-xs font-semibold text-orange tracking-wider">
                      — {activeClip.verse} · Holy Bible
                    </p>
                  </div>

                  {/* Player Scrubber & Play/Pause */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="w-full bg-base h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-orange h-full rounded-full transition-all duration-300"
                        style={{ width: `${(playbackSec / 45) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="flex items-center gap-1 text-primary hover:text-orange font-medium"
                      >
                        <i className={`bx ${isPlaying ? "bx-pause-circle" : "bx-play-circle"} text-lg text-orange`} />
                        <span>{isPlaying ? "Pause Preview" : "Play Reel"}</span>
                      </button>

                      {/* Subtitle Selector */}
                      <div className="flex items-center gap-1.5">
                        {SUBTITLE_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            onClick={() => setActiveSubtitleTheme(theme.id)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                              activeSubtitleTheme === theme.id
                                ? "bg-orange text-white"
                                : "bg-base text-secondary hover:text-primary border border-border"
                            }`}
                          >
                            {theme.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Extracted Sermon Moments List & One-Click Studio Import */}
            <div className="lg:col-span-6 space-y-4">
              <div className="studio-card p-5 space-y-3 border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">
                    Detected Preaching Moments (Sample Sermon)
                  </span>
                  <span className="text-muted text-[11px]">3 Clips Surfaced</span>
                </div>

                <div className="space-y-2.5">
                  {SAMPLE_CLIPS.map((clip) => {
                    const isSelected = activeClipId === clip.id;
                    return (
                      <button
                        key={clip.id}
                        onClick={() => {
                          setActiveClipId(clip.id);
                          setPlaybackSec(0);
                          setIsPlaying(true);
                        }}
                        className={`w-full p-3 rounded-lg border text-left flex items-center justify-between gap-3 transition-all ${
                          isSelected
                            ? "bg-surface-elevated border-orange shadow-xs"
                            : "bg-surface border-border hover:bg-surface-hover"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${
                              isSelected
                                ? "bg-orange text-white"
                                : "bg-surface-elevated text-secondary"
                            }`}
                          >
                            <i className={`bx ${isSelected && isPlaying ? "bx-pause" : "bx-play"}`} />
                          </div>

                          <div className="space-y-0.5">
                            <p className="font-semibold text-xs text-primary leading-tight">
                              {clip.title}
                            </p>
                            <p className="text-[11px] text-secondary">
                              <span className="text-orange font-medium">{clip.verse}</span> · {clip.duration}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-muted">
                          {isSelected ? "Previewing" : "Click to Preview"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct Next Action Card */}
              <div className="double-bezel">
                <div className="double-bezel-inner p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs text-primary">
                        Ready to process your own sermon?
                      </p>
                      <p className="text-[11px] text-secondary">
                        Drop your church recording or paste a YouTube stream link.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Btn
                      onClick={() => setActiveMode("ingest")}
                      variant="orange"
                      size="md"
                      className="flex-1 justify-center"
                      icon="bx-upload"
                    >
                      Import My Sermon
                    </Btn>
                    <Btn
                      onClick={handleSkipToLibrary}
                      variant="secondary"
                      size="md"
                      icon="bx-library"
                    >
                      Open Library
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODE B: INSTANT SERMON INGESTION WORKSPACE
            ═══════════════════════════════════════════════════════════════ */}
        {activeMode === "ingest" && (
          <div className="max-w-xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
            <form onSubmit={handleStartIngest} className="studio-card p-6 space-y-5 border-border">
              <div className="space-y-1 text-center">
                <h2 className="font-editorial text-xl font-bold text-primary">
                  Import Your Sermon Recording
                </h2>
                <p className="text-xs text-secondary">
                  Choose a video or audio file from your computer, or paste a YouTube sermon link.
                </p>
              </div>

              {/* Native File Selector Area */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-primary block">
                  Option 1: Local Recording File
                </label>
                <div
                  onClick={handleFilePick}
                  className={`p-6 rounded-xl border border-dashed text-center cursor-pointer transition-colors ${
                    selectedFile
                      ? "border-orange bg-orange/5"
                      : "border-border hover:border-border-strong bg-surface-elevated/40"
                  }`}
                >
                  <i className="bx bx-cloud-upload text-3xl text-orange mb-2 block" />
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-primary truncate max-w-sm mx-auto">
                        {selectedFile.split(/[/\\]/).pop()}
                      </p>
                      <p className="text-[11px] text-orange">Click to change file</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-primary">
                        Click to browse sermon file (MP4, MP3, WAV, MKV)
                      </p>
                      <p className="text-[11px] text-muted">Zero cloud uploads · Processed locally on your device</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="w-full border-t border-border" />
                <span className="absolute bg-surface px-3 text-[11px] text-muted uppercase font-semibold tracking-wider">
                  OR
                </span>
              </div>

              {/* YouTube Link Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">
                  Option 2: YouTube Sermon Link
                </label>
                <div className="relative">
                  <i className="bx bxl-youtube absolute left-3 top-1/2 -translate-y-1/2 text-red-500 text-base" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      if (e.target.value) setSelectedFile(null);
                    }}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full rounded-md bg-surface-elevated border border-border pl-9 pr-3 py-2 text-xs text-primary placeholder:text-muted outline-none focus:border-orange transition-colors"
                  />
                </div>
              </div>

              {/* Error Notice */}
              {ingestError && (
                <div className="p-3 rounded-lg border border-danger/40 bg-danger-muted text-xs text-danger flex items-center gap-2">
                  <i className="bx bx-error-circle text-base shrink-0" />
                  <span>{ingestError}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <Btn
                  type="submit"
                  variant="orange"
                  size="lg"
                  className="w-full justify-center"
                  icon={isSubmitting ? "bx-loader-alt bx-spin" : "bx-zap"}
                  disabled={isSubmitting || (!selectedFile && !urlInput.trim())}
                >
                  {isSubmitting ? "Starting Transcription…" : "Transcribe & Surface Clips"}
                </Btn>
              </div>
            </form>

            <div className="text-center">
              <button
                onClick={() => setActiveMode("sample")}
                className="text-xs text-secondary hover:text-primary transition-colors"
              >
                ← Back to Interactive Demo
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Studio Footer ─────────────────────────────────────────── */}
      <footer className="px-6 py-4 border-t border-border bg-surface/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted">
          <p>© 2026 DABAAR Studio · Private On-Device Preaching Intelligence</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-orange">v0.2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
