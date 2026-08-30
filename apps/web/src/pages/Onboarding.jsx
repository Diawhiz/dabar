import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getOfflineStatus,
  downloadYtDlp,
  downloadFfmpeg,
  downloadWhisperModel,
} from "../lib/api.js";

export default function Onboarding() {
  const navigate = useNavigate();
  const [offlineStatus, setOfflineStatus] = useState(null);

  // Background dependency check & install
  useEffect(() => {
    async function initTools() {
      try {
        const status = await getOfflineStatus();
        setOfflineStatus(status);
        if (!status?.yt_dlp_ready) downloadYtDlp().catch(() => {});
        if (!status?.ffmpeg_ready) downloadFfmpeg().catch(() => {});
        if (!status?.whisper_tiny_ready) downloadWhisperModel("tiny").catch(() => {});
      } catch {
        // Silently continue
      }
    }
    initTools();
  }, []);

  function handleStart(destination = "/upload") {
    localStorage.setItem("dabaar_onboarded", "true");
    navigate(destination);
  }

  return (
    <div className="min-h-[100dvh] bg-base text-primary flex flex-col justify-between selection:bg-orange/20 overflow-x-hidden">
      {/* ── Top Atmospheric Accent Line ──────────────────────────────────── */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-orange to-transparent opacity-80" />

      {/* ── Top Minimal Header ───────────────────────────────────────────── */}
      <header className="w-full px-6 sm:px-12 py-6 flex items-center justify-between border-b border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-white/10 text-primary flex items-center justify-center font-editorial font-bold text-lg shadow-sm relative group">
            <span className="text-orange-light select-none">ד</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange ring-2 ring-base animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-editorial text-xl font-bold tracking-tight text-primary">
                DABAR
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-orange bg-orange/10 px-2 py-0.5 rounded-full border border-orange/20">
                דָּבָר
              </span>
            </div>
            <p className="text-[11px] text-muted tracking-tight">
              Sovereign Preaching & Sermon Intelligence Studio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-[11px] text-secondary font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span>Local Neural Core Ready</span>
          </div>

          <button
            onClick={() => handleStart("/dashboard")}
            className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-surface-elevated border border-transparent hover:border-border font-medium"
          >
            <span>Skip to Library</span>
            <i className="bx bx-right-arrow-alt text-sm" />
          </button>
        </div>
      </header>

      {/* ── Main Editorial Showcase ──────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 sm:px-12 py-12 sm:py-16 w-full flex-1 flex flex-col justify-center space-y-16">
        {/* ── Section 1: Hero & Purpose ──────────────────────────────────── */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-elevated border border-white/10 text-[11px] font-medium text-secondary">
            <span className="text-orange font-bold font-mono">01</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>The Sacred Word Transformed for the Digital Age</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-editorial font-bold text-primary tracking-tight leading-[1.12]">
            Turn Sunday sermons into{" "}
            <span className="text-orange font-editorial italic underline decoration-orange/30 decoration-wavy underline-offset-4">
              scriptural chapters
            </span>{" "}
            and high-impact reels.
          </h1>

          <p className="text-secondary text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Dabar is a private, local-first preaching media studio. It transcribes hours of sermon
            recordings with sub-second accuracy, identifies key theological revelations, and
            surfaces ready-to-publish vertical clips with zero cloud lock-in.
          </p>

          {/* Primary Nested CTA Button */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleStart("/upload")}
              className="group relative inline-flex items-center gap-3.5 px-7 py-3.5 rounded-full bg-orange hover:bg-orange-hover text-white font-sans text-sm font-semibold transition-all duration-300 shadow-[0_4px_24px_-4px_rgba(234,88,12,0.4)] hover:shadow-[0_8px_32px_-4px_rgba(234,88,12,0.5)] active:scale-[0.98]"
            >
              <span>Get Started · Ingest Sermon</span>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-[1px]">
                <i className="bx bx-right-arrow-alt text-lg text-white" />
              </div>
            </button>

            <button
              onClick={() => handleStart("/dashboard")}
              className="px-6 py-3.5 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-secondary hover:text-primary text-sm font-medium transition-colors"
            >
              Open Studio Workspace
            </button>
          </div>
        </div>

        {/* ── Section 2: Visual Pipeline Architecture ─────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase font-mono tracking-[0.2em] text-muted">
              How Dabar Processes Preaching
            </h2>
            <span className="text-[11px] font-mono text-orange/80">3-Stage Neural Pipeline</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Ingest & Acoustic Clean */}
            <div className="double-bezel group">
              <div className="double-bezel-inner p-6 space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-orange/10 border border-orange/20 text-orange flex items-center justify-center text-xl">
                    <i className="bx bx-waveform" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-orange">STAGE 01</span>
                      <h3 className="font-editorial text-lg font-bold text-primary">
                        Acoustic Pre-Processing
                      </h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Accepts YouTube live streams, 4K camera files, or audio master tracks. Removes
                      low-frequency room rumble, isolates speech, and balances dynamic volume.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted">
                  <span>DSP Filtering</span>
                  <span className="text-emerald-500 font-semibold">16kHz Mono</span>
                </div>
              </div>
            </div>

            {/* Card 2: Whisper Transcription */}
            <div className="double-bezel group">
              <div className="double-bezel-inner p-6 space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
                    <i className="bx bx-text" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-400">STAGE 02</span>
                      <h3 className="font-editorial text-lg font-bold text-primary">
                        Word-Level Transcription
                      </h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Generates timestamped transcripts with syllable-level precision. Completely
                      private on your device with offline GGML Whisper, or turbocharged via Groq
                      API.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted">
                  <span>Syllable Sync</span>
                  <span className="text-blue-400 font-semibold">Millisecond Precision</span>
                </div>
              </div>
            </div>

            {/* Card 3: Scripture & Clip Intelligence */}
            <div className="double-bezel group">
              <div className="double-bezel-inner p-6 space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
                    <i className="bx bx-film" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-purple-400">STAGE 03</span>
                      <h3 className="font-editorial text-lg font-bold text-primary">
                        Theological Intelligence
                      </h3>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">
                      Detects Scripture references (e.g. <em>Isaiah 40:31</em>), creates logical sermon
                      divisions, and extracts 1–5 minute high-impact moments ready for social reels.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted">
                  <span>Smart Highlights</span>
                  <span className="text-purple-400 font-semibold">9:16 Kinetic Video</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Visual Output Showcase (Editorial Bento) ──────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase font-mono tracking-[0.2em] text-muted">
              Artifacts Generated For Every Sermon
            </h2>
            <span className="text-[11px] font-mono text-secondary">Zero Manual Cutting Required</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Artifact: Vertical 9:16 Reel Specimen */}
            <div className="lg:col-span-7 double-bezel">
              <div className="double-bezel-inner p-6 space-y-5 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange animate-ping" />
                    <span className="text-xs font-semibold text-primary">
                      Vertical Reel · Sacred Typography Specimen
                    </span>
                  </div>
                  <span className="scripture-badge">Isaiah 40:31</span>
                </div>

                {/* Simulated Screen Card */}
                <div className="relative rounded-2xl bg-surface-elevated/70 border border-white/10 p-6 sm:p-8 flex flex-col justify-between overflow-hidden shadow-inner space-y-6">
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                    <span className="text-orange font-bold">04:12 — 05:45</span>
                    <span>1m 33s Duration</span>
                  </div>

                  <div className="space-y-3 text-center max-w-lg mx-auto py-2">
                    <p className="text-lg sm:text-2xl font-editorial font-bold text-amber-300 leading-snug tracking-tight">
                      “Those who wait upon the Lord shall renew their strength; they shall mount up
                      with wings like eagles.”
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange/10 border border-orange/30 text-orange text-xs font-semibold">
                      <span>Divine Impartation & Renewal</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-muted font-mono">
                      <span>Kinetic Subtitles</span>
                      <span className="text-emerald-400 font-semibold">Synced with Speaker Cadence</span>
                    </div>
                    <div className="w-full bg-base h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-orange to-amber-400 h-full w-2/3 rounded-full" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-secondary">
                  <div className="flex items-center gap-2">
                    <i className="bx bx-check-double text-orange text-base" />
                    <span>Auto-detects high-energy preaching & prayer peaks</span>
                  </div>
                  <span className="font-mono text-[11px] text-muted">MP4 1080x1920</span>
                </div>
              </div>
            </div>

            {/* Right Artifact: Topic Chapters & Scripture Breakdown */}
            <div className="lg:col-span-5 double-bezel">
              <div className="double-bezel-inner p-6 space-y-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-primary">
                      Structured Sermon Chapters
                    </span>
                    <span className="meta-chip">Thematic Shifts</span>
                  </div>
                  <p className="text-xs text-secondary leading-relaxed">
                    Dabar monitors shifts in preaching vocabulary and theological themes to generate
                    meaningful chapter markers with scripture citations.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">01. The Nature of the Covenant</span>
                      <span className="font-mono text-[11px] text-orange">00:00 — 12:40</span>
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      Scriptural foundation in Genesis 15 and Romans 4.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-elevated border border-orange/40 bg-orange/5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-orange-light">02. Walking in Divine Authority</span>
                      <span className="font-mono text-[11px] text-orange font-bold">12:40 — 38:15</span>
                    </div>
                    <p className="text-[11px] text-secondary truncate">
                      Exposition on Luke 10:19 · Overcoming obstacles through faith.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">03. Altar Call & Impartation</span>
                      <span className="font-mono text-[11px] text-orange">38:15 — 52:00</span>
                    </div>
                    <p className="text-[11px] text-muted truncate">
                      Closing prayer and call to repentance.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted">
                  <span>Export Formats</span>
                  <span className="text-secondary">YouTube Timestamps · Markdown · PDF</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Privacy & Bottom Action Card ─────────────────────── */}
        <div className="double-bezel">
          <div className="double-bezel-inner p-8 text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <i className="bx bx-shield-quarter text-sm" />
              <span>100% Local-First & Private Preaching Archive</span>
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h3 className="font-editorial text-2xl font-bold text-primary">
                Ready to transform your church media workflow?
              </h3>
              <p className="text-xs sm:text-sm text-secondary">
                Drop your recorded sermon file or paste a YouTube stream link to immediately begin
                transcription and clip extraction.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleStart("/upload")}
                className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-orange hover:bg-orange-hover text-white font-sans text-sm font-semibold transition-all duration-300 shadow-[0_4px_20px_rgba(234,88,12,0.35)] active:scale-[0.98]"
              >
                <span>Import a Sermon Now</span>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
                  <i className="bx bx-upload text-sm text-white" />
                </div>
              </button>

              <button
                onClick={() => handleStart("/dashboard")}
                className="px-6 py-3.5 rounded-full bg-surface hover:bg-surface-hover border border-border text-secondary hover:text-primary text-sm font-medium transition-colors"
              >
                Enter Sermon Library
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="w-full px-6 sm:px-12 py-6 border-t border-border/40 backdrop-blur-md bg-surface/20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>© 2026 DABAAR Studio · Private Preaching Intelligence System</p>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] text-orange">v0.2.0</span>
            <span className="text-border">|</span>
            <span>Local Neural Core</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
