import { useState } from "react";
import Btn from "./Btn.jsx";
import { openInExplorer } from "../lib/api.js";

const ASPECT_RATIOS = [
  {
    key: "9:16",
    label: "Vertical Reel (9:16)",
    sub: "Instagram Reels, TikTok, YouTube Shorts",
    icon: "bx-mobile-alt",
    widthClass: "w-36 h-64",
  },
  {
    key: "1:1",
    label: "Square Post (1:1)",
    sub: "Instagram Feed, Facebook, Twitter/X",
    icon: "bx-square",
    widthClass: "w-48 h-48",
  },
  {
    key: "16:9",
    label: "Widescreen (16:9)",
    sub: "YouTube Landscape, Church Website",
    icon: "bx-tv",
    widthClass: "w-64 h-36",
  },
];

const CAPTION_STYLES = [
  {
    key: "editorial",
    label: "Living Pulpit",
    preview: "High-contrast serif, warm gold speaker highlight",
    cssClass: "font-editorial text-amber-300 font-bold",
  },
  {
    key: "bold",
    label: "Kinetic Punch",
    preview: "Bold uppercase, high-retention viral style",
    cssClass: "font-sans uppercase font-extrabold text-yellow-400 tracking-wider",
  },
  {
    key: "clean",
    label: "Minimal Classic",
    preview: "Crisp white subtitle with soft shadow",
    cssClass: "font-sans font-semibold text-white",
  },
];

export default function ExportModal({
  clip,
  sermonTitle,
  videoId,
  mediaAssetUrl,
  onClose,
  onConfirmExport,
  isRendering = false,
  exportedPath = null,
}) {
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [captionStyle, setCaptionStyle] = useState("editorial");
  const [customFileName, setCustomFileName] = useState(
    clip?.highlight_title || clip?.title || "sermon_clip"
  );

  const durationSec =
    clip?.start && clip?.end ? Math.round(clip.end - clip.start) : 45;

  const currentCaptionObj =
    CAPTION_STYLES.find((c) => c.key === captionStyle) || CAPTION_STYLES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className="doppelrand-shell max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="doppelrand-core space-y-6">
          {/* ── Modal Header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="eyebrow-tag text-[9px]">
                  STUDIO RENDER CHASSIS
                </span>
                <span className="text-xs text-muted font-mono-code">
                  ~{durationSec}s Runtime
                </span>
              </div>
              <h2 className="font-editorial text-2xl font-bold text-primary">
                Export Preaching Reel
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-muted hover:text-primary flex items-center justify-center transition-colors"
              aria-label="Close export dialog"
            >
              <i className="bx bx-x text-2xl" />
            </button>
          </div>

          {/* ── Render Layout: Preview Stage vs Controls ────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Aspect Ratio Canvas Simulator */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-black/70 border border-white/[0.08] shadow-inner-glow min-h-[360px]">
              <span className="text-[10px] uppercase font-mono-code text-muted font-semibold tracking-wider mb-4">
                Render Canvas · {aspectRatio}
              </span>

              <div
                className={`relative bg-neutral-950 border border-white/[0.15] rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between p-3 transition-all duration-500 ${
                  aspectRatio === "9:16"
                    ? "w-44 h-72"
                    : aspectRatio === "1:1"
                    ? "w-56 h-56"
                    : "w-72 h-44"
                }`}
              >
                {/* Background Video / Audio Pulse Simulation */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/90 pointer-events-none z-10" />

                {/* Top Badge */}
                <div className="relative z-20 flex items-center justify-between text-[9px] font-mono-code text-white/80">
                  <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs font-semibold">
                    DABAR
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    REC
                  </span>
                </div>

                {/* Middle Preaching Clip Simulation */}
                <div className="relative z-20 my-auto text-center px-1 space-y-1">
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center mx-auto text-sm">
                    <i className="bx bx-play" />
                  </div>
                  <p className="font-editorial text-[10.5px] text-white/90 font-bold truncate">
                    {clip?.highlight_title || clip?.title || "Preaching Moment"}
                  </p>
                </div>

                {/* Subtitle / Caption Typography Overlay */}
                <div className="relative z-20 text-center pb-1">
                  <p
                    className={`${currentCaptionObj.cssClass} text-[11px] leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]`}
                  >
                    "{clip?.why ? clip.why.slice(0, 50) + "…" : "Faith cometh by hearing the word…"}"
                  </p>
                </div>
              </div>

              <span className="text-[10px] text-muted font-mono-code mt-4">
                Target: {aspectRatio === "9:16" ? "1080 × 1920 px (FHD Vertical)" : aspectRatio === "1:1" ? "1080 × 1080 px" : "1920 × 1080 px"}
              </span>
            </div>

            {/* Render Settings */}
            <div className="md:col-span-7 space-y-6">
              {/* Aspect Ratio Options */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-primary block">
                  Aspect Ratio & Frame Format
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {ASPECT_RATIOS.map((fmt) => (
                    <button
                      key={fmt.key}
                      type="button"
                      onClick={() => setAspectRatio(fmt.key)}
                      className={`p-3 rounded-xl border text-left transition-all duration-300 ${
                        aspectRatio === fmt.key
                          ? "border-accent bg-accent-muted/40 shadow-xs"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-secondary"
                      }`}
                    >
                      <i
                        className={`bx ${fmt.icon} text-lg ${
                          aspectRatio === fmt.key ? "text-accent" : "text-muted"
                        }`}
                      />
                      <p className="font-semibold text-xs text-primary mt-1">
                        {fmt.key}
                      </p>
                      <p className="text-[10px] text-muted line-clamp-1">
                        {fmt.label.split("(")[0]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitle Aesthetic */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-primary block">
                  Subtitle & Typography Style
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {CAPTION_STYLES.map((cap) => (
                    <button
                      key={cap.key}
                      type="button"
                      onClick={() => setCaptionStyle(cap.key)}
                      className={`p-3 rounded-xl border text-left transition-all duration-300 ${
                        captionStyle === cap.key
                          ? "border-accent bg-accent-muted/40 shadow-xs"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-secondary"
                      }`}
                    >
                      <p className="font-semibold text-xs text-primary">
                        {cap.label}
                      </p>
                      <p className="text-[9.5px] text-muted mt-0.5 line-clamp-2">
                        {cap.preview}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Filename */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-primary block">
                  File Title
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] px-4 py-2.5 text-xs text-primary font-mono-code outline-none focus:border-accent"
                />
                <span className="text-[10.5px] text-muted block font-mono-code">
                  Saved to: Videos/Dabar/{customFileName.replace(/\s+/g, "_")}.mp4
                </span>
              </div>
            </div>
          </div>

          {/* ── Render Feedback & Actions ───────────────────────────── */}
          {exportedPath && (
            <div className="p-3.5 rounded-xl border border-success/30 bg-success-muted flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs text-success font-medium">
                <i className="bx bxs-check-circle text-lg" />
                <span>Render completed and saved.</span>
              </div>
              <Btn
                size="sm"
                variant="secondary"
                icon="bx-folder-open"
                onClick={() => openInExplorer(exportedPath)}
              >
                Open in Explorer
              </Btn>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-secondary hover:text-primary transition-colors"
            >
              Cancel
            </button>

            <Btn
              size="lg"
              variant="primary"
              icon={isRendering ? "bx-loader-alt bx-spin" : "bx-film"}
              disabled={isRendering}
              onClick={() =>
                onConfirmExport(clip, aspectRatio, captionStyle, customFileName)
              }
            >
              {isRendering ? "Processing Video Stream…" : "Render & Save Video"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
