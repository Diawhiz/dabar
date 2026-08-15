import { useState } from "react";
import Btn from "./Btn.jsx";
import { openInExplorer } from "../lib/api.js";

const FORMAT_OPTIONS = [
  {
    id: "vertical",
    label: "Phone Size",
    subtitle: "Reels, TikTok & Shorts (9:16)",
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
    subtitle: "Instagram & Facebook Feed (1:1)",
    ratioClass: "aspect-square w-48",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: "widescreen",
    label: "Landscape",
    subtitle: "YouTube & Presentation (16:9)",
    ratioClass: "aspect-video w-56",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
      </svg>
    ),
  },
];

const CAPTION_STYLES = [
  { id: "ember", label: "Warm Gold", desc: "Highlighted words glow in amber" },
  { id: "minimal", label: "Classic Editorial", desc: "Cream serif typography" },
  { id: "subtitle", label: "Clear Caption", desc: "Subtle background bar for readability" },
];

export default function ExportModal({ clip, sermonTitle, videoId, onClose, onConfirmExport, isRendering, exportedPath }) {
  const [selectedFormat, setSelectedFormat] = useState("vertical");
  const [selectedCaption, setSelectedCaption] = useState("ember");
  const [fileName, setFileName] = useState(() => {
    const cleanTitle = (clip?.highlight_title || clip?.title || "Sermon Clip")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim();
    return `${cleanTitle} (Phone Clip)`;
  });

  if (!clip) return null;

  const currentFormat = FORMAT_OPTIONS.find((f) => f.id === selectedFormat) || FORMAT_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-paper shadow-2xl flex flex-col">
        {/* Modal Top Strip */}
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Save Video Clip</h2>
            <p className="text-xs text-muted mt-0.5">
              Choose your video format and caption layout before rendering.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors"
          >
            <i className="bx bx-x text-2xl" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Live Format Preview */}
          <div className="flex flex-col items-center justify-center bg-base-dark rounded-2xl p-6 border border-border-dark min-h-[380px] relative overflow-hidden">
            <span className="text-[10px] font-bold text-amber uppercase tracking-wider mb-3">
              Preview ({currentFormat.label})
            </span>

            {/* Simulated frame */}
            <div className={`relative ${currentFormat.ratioClass} bg-[#120F0D] rounded-xl overflow-hidden border border-border-dark shadow-2xl flex items-center justify-center transition-all duration-300`}>
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(clip.start || 0)}&end=${Math.ceil(clip.end || 60)}&autoplay=1&mute=1&controls=0&loop=1&rel=0`}
                  title="Clip Reflow Preview"
                  className="w-full h-full object-cover scale-150 pointer-events-none opacity-75"
                />
              ) : (
                <div className="text-center p-4">
                  <i className="bx bx-movie-play text-3xl text-amber mb-2" />
                  <p className="text-[10px] text-[#8A7F73]">Sermon Feed</p>
                </div>
              )}

              {/* Caption Overlay */}
              <div className="absolute bottom-5 left-2 right-2 text-center pointer-events-none px-2">
                {selectedCaption === "ember" && (
                  <div className="px-2.5 py-1 bg-black/60 backdrop-blur-xs rounded-lg inline-block shadow-sm">
                    <p className="font-display text-[11px] text-[#FAF6EF] leading-relaxed">
                      "The Word is <span className="text-amber font-bold">living</span> and active."
                    </p>
                  </div>
                )}
                {selectedCaption === "minimal" && (
                  <p className="font-display text-[11px] text-[#FAF6EF] drop-shadow-md leading-relaxed">
                    "{clip.text ? clip.text.slice(0, 45) + "…" : "Sermon message clip"}"
                  </p>
                )}
                {selectedCaption === "subtitle" && (
                  <div className="bg-black px-2 py-0.5 rounded inline-block">
                    <p className="font-sans text-[10px] font-bold text-white uppercase tracking-wider">
                      {clip.highlight_title || "Key Teaching Moment"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs font-semibold text-[#FAF6EF] truncate max-w-xs">
                {clip.highlight_title || clip.title || "Sermon Highlight"}
              </p>
              <p className="text-[10px] text-[#8A7F73] mt-0.5">
                Length: {Math.round((clip.end || 30) - (clip.start || 0))} seconds
              </p>
            </div>
          </div>

          {/* Right Column: Choices */}
          <div className="space-y-6">
            {/* Format choice */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                1. Video Size
              </span>
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
                          const base = prev.replace(/\s*\((Phone Clip|Square|Landscape)\)/i, "");
                          return `${base} (${fmt.label})`;
                        });
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-amber bg-amber-light/60 text-ink shadow-xs ring-1 ring-amber"
                          : "border-border bg-paper hover:bg-surface text-muted hover:text-ink"
                      }`}
                    >
                      <div className={`mb-1.5 ${isSelected ? "text-amber" : "text-muted"}`}>
                        {fmt.icon}
                      </div>
                      <p className="text-xs font-bold text-ink leading-tight">{fmt.label}</p>
                      <p className="text-[10px] text-muted mt-0.5 leading-tight">{fmt.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caption style */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                2. Caption Style
              </span>
              <div className="space-y-1.5">
                {CAPTION_STYLES.map((style) => {
                  const isSelected = selectedCaption === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedCaption(style.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-amber bg-amber-light/60 text-ink shadow-xs"
                          : "border-border bg-paper hover:bg-surface text-muted hover:text-ink"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-ink">{style.label}</p>
                        <p className="text-[11px] text-muted">{style.desc}</p>
                      </div>
                      {isSelected && (
                        <i className="bx bx-check text-lg text-amber" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filename input */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                3. File Name
              </span>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full rounded-xl border border-border bg-paper px-3 py-2 text-xs text-ink outline-none focus:border-amber"
                placeholder="Clip file name"
              />
              <p className="text-[11px] text-muted">
                Saves directly into your computer's <strong className="text-ink">Videos/Dabar/</strong> folder.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-ink hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <Btn
                size="md"
                onClick={() => onConfirmExport(clip, selectedFormat, selectedCaption, fileName)}
                disabled={isRendering}
              >
                <i className={`bx ${isRendering ? "bx-loader-alt bx-spin" : "bx-download"} text-base`} />
                {isRendering ? "Rendering Clip…" : "Save Video Clip"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
