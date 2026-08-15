import { useState } from "react";
import Btn from "./Btn.jsx";
import { openInExplorer } from "../lib/api.js";

const FORMAT_OPTIONS = [
  {
    id: "vertical",
    label: "Vertical",
    subtitle: "For Reels, TikTok & Shorts",
    ratioClass: "aspect-[9/16] w-36",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="10" y1="18" x2="14" y2="18" />
      </svg>
    ),
  },
  {
    id: "square",
    label: "Square",
    subtitle: "For Instagram & Facebook feed",
    ratioClass: "aspect-square w-48",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: "widescreen",
    label: "Widescreen",
    subtitle: "For YouTube & Facebook video",
    ratioClass: "aspect-video w-56",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
      </svg>
    ),
  },
];

const CAPTION_STYLES = [
  { id: "ember", label: "Warm Ember", desc: "Amber word glow on key words" },
  { id: "minimal", label: "Clean Serif", desc: "Warm cream Fraunces captions" },
  { id: "subtitle", label: "Classic Subtitle", desc: "Black box with crisp text" },
];

export default function ExportModal({ clip, sermonTitle, videoId, onClose, onConfirmExport, isRendering, exportedPath }) {
  const [selectedFormat, setSelectedFormat] = useState("vertical");
  const [selectedCaption, setSelectedCaption] = useState("ember");
  const [fileName, setFileName] = useState(() => {
    const cleanTitle = (clip?.highlight_title || clip?.title || "Sermon Clip")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim();
    return `${cleanTitle} (Vertical)`;
  });

  if (!clip) return null;

  const currentFormat = FORMAT_OPTIONS.find((f) => f.id === selectedFormat) || FORMAT_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-card border border-border bg-paper shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Preview & Export Clip</h2>
            <p className="text-xs text-muted mt-0.5">
              Review formatting and caption layout before rendering to your disk.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-card p-1.5 text-muted hover:text-ink hover:bg-surface transition-colors"
            aria-label="Close export dialog"
          >
            <i className="bx bx-x text-2xl" aria-hidden="true" />
          </button>
        </div>

        {/* Content area: Preview on left, Controls on right */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Live Format Preview */}
          <div className="flex flex-col items-center justify-center bg-base rounded-card p-6 border border-border-dark min-h-[380px] relative overflow-hidden">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-3">
              Live Reflow Preview ({currentFormat.label})
            </div>

            {/* Dynamic aspect ratio container */}
            <div className={`relative ${currentFormat.ratioClass} bg-[#120F0D] rounded-lg overflow-hidden border border-border-dark/80 shadow-lg flex items-center justify-center transition-all duration-300`}>
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(clip.start || 0)}&end=${Math.ceil(clip.end || 60)}&autoplay=1&mute=1&controls=0&loop=1&rel=0`}
                  title="Clip Reflow Preview"
                  className="w-full h-full object-cover scale-150 pointer-events-none opacity-75"
                />
              ) : (
                <div className="text-center p-4">
                  <i className="bx bx-movie-play text-3xl text-ember mb-2" aria-hidden="true" />
                  <p className="text-[10px] text-muted">Sermon Video Feed</p>
                </div>
              )}

              {/* Simulated Caption Overlay */}
              <div className="absolute bottom-6 left-2 right-2 text-center pointer-events-none">
                {selectedCaption === "ember" && (
                  <div className="px-2 py-1 bg-base/70 backdrop-blur-xs rounded inline-block shadow-sm">
                    <p className="font-display text-xs text-paper leading-relaxed">
                      "The Word is <span className="text-ember font-bold drop-shadow-sm">living</span> and active."
                    </p>
                  </div>
                )}
                {selectedCaption === "minimal" && (
                  <p className="font-display text-xs text-paper drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-relaxed">
                    "{clip.text ? clip.text.slice(0, 50) + "…" : "Pastoral message clip"}"
                  </p>
                )}
                {selectedCaption === "subtitle" && (
                  <div className="bg-base px-2 py-1 rounded inline-block">
                    <p className="font-sans text-[11px] font-bold text-white tracking-wide uppercase">
                      {clip.highlight_title || "Key Message Moment"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs font-semibold text-paper truncate max-w-xs">
                {clip.highlight_title || clip.title || "Sermon Highlight"}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Duration: {Math.round((clip.end || 30) - (clip.start || 0))} seconds
              </p>
            </div>
          </div>

          {/* Right Column: Customization Controls */}
          <div className="space-y-6">
            {/* 1. Format Picker */}
            <div>
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-2">
                1. Choose Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_OPTIONS.map((fmt) => {
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => {
                        setSelectedFormat(fmt.id);
                        setFileName((prev) => {
                          const base = prev.replace(/\s*\((Vertical|Square|Widescreen)\)/i, "");
                          return `${base} (${fmt.label})`;
                        });
                      }}
                      className={`p-3 rounded-card border text-left transition-all ${
                        isSelected
                          ? "border-ember bg-ember/10 text-ink shadow-sm ring-1 ring-ember"
                          : "border-border bg-paper hover:bg-surface text-muted hover:text-ink"
                      }`}
                    >
                      <div className={`mb-1.5 ${isSelected ? "text-ember" : "text-muted"}`}>
                        {fmt.icon}
                      </div>
                      <p className="text-xs font-bold text-ink leading-none">{fmt.label}</p>
                      <p className="text-[10px] text-muted mt-1 leading-tight">{fmt.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Caption Style */}
            <div>
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-2">
                2. Caption Style
              </label>
              <div className="space-y-1.5">
                {CAPTION_STYLES.map((style) => {
                  const isSelected = selectedCaption === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedCaption(style.id)}
                      className={`w-full p-2.5 rounded-card border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-ember bg-ember/10 text-ink shadow-xs"
                          : "border-border bg-paper hover:bg-surface text-muted hover:text-ink"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold text-ink">{style.label}</p>
                        <p className="text-[11px] text-muted">{style.desc}</p>
                      </div>
                      {isSelected && (
                        <i className="bx bx-check text-lg text-ember" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Output File Name */}
            <div>
              <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1.5">
                3. File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full rounded-card border border-border bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-ember"
                placeholder="Clip file name"
              />
              <p className="text-[11px] text-muted mt-1">
                Will be saved to your local <code className="bg-surface px-1 py-0.5 rounded text-[10px]">Videos/Dabar/</code> folder.
              </p>
            </div>

            {/* Export Notice / Actions */}
            {exportedPath ? (
              <div className="rounded-card border border-ember/40 bg-ember/10 p-3 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <i className="bx bx-check-circle text-xl text-ember shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">Saved successfully!</p>
                    <p className="text-[11px] text-muted truncate">{exportedPath}</p>
                  </div>
                </div>
                <Btn size="sm" variant="outline" onClick={() => openInExplorer(exportedPath)}>
                  <i className="bx bx-folder-open text-base" aria-hidden="true" />
                  Show in Folder
                </Btn>
              </div>
            ) : null}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Btn size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Btn>
              <Btn
                size="md"
                variant="primary"
                onClick={() => onConfirmExport(clip, selectedFormat, selectedCaption, fileName)}
                disabled={isRendering}
              >
                <i className={`bx ${isRendering ? "bx-loader-alt bx-spin" : "bx-download"} text-base`} aria-hidden="true" />
                {isRendering ? "Rendering to Disk…" : "Export Clip Now"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
