import { useState } from "react";
import Btn from "./Btn.jsx";
import { openInExplorer } from "../lib/api.js";

const FORMAT_OPTIONS = [
  {
    id: "vertical",
    label: "Phone Size",
    subtitle: "Reels, TikTok & Shorts",
    ratioClass: "aspect-[9/16] w-36",
    icon: "bx-mobile",
  },
  {
    id: "square",
    label: "Square",
    subtitle: "Instagram Feed",
    ratioClass: "aspect-square w-44",
    icon: "bx-square",
  },
  {
    id: "widescreen",
    label: "Landscape",
    subtitle: "YouTube & Screens",
    ratioClass: "aspect-video w-52",
    icon: "bx-tv",
  },
];

const CAPTION_STYLES = [
  { id: "ember", label: "Warm Glow", desc: "Key spoken words illuminated in amber" },
  { id: "minimal", label: "Clean Editorial", desc: "Warm serif subtitle text" },
  { id: "subtitle", label: "Classic Bar", desc: "High contrast for loud environments" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-base shadow-2xl flex flex-col">
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Export Video Clip</h2>
            <p className="text-xs text-secondary mt-0.5">
              Select size and caption styling before saving to your computer.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-secondary hover:text-primary flex items-center justify-center"
          >
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        {/* ── Modal Body ──────────────────────────────────────────── */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Frame Preview */}
          <div className="flex flex-col items-center justify-center bg-surface rounded-xl p-5 border border-border min-h-[340px] relative overflow-hidden">
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider mb-3">
              {currentFormat.label} Preview
            </span>

            <div className={`relative ${currentFormat.ratioClass} bg-base rounded-lg overflow-hidden border border-border flex items-center justify-center transition-all duration-200`}>
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(clip.start || 0)}&end=${Math.ceil(clip.end || 60)}&autoplay=1&mute=1&controls=0&loop=1&rel=0`}
                  title="Clip Reflow Preview"
                  className="w-full h-full object-cover scale-150 pointer-events-none opacity-75"
                />
              ) : (
                <div className="text-center p-3">
                  <i className="bx bx-film text-2xl text-accent mb-1" />
                  <p className="text-[10px] text-secondary">Video Stream</p>
                </div>
              )}

              {/* Caption Overlay */}
              <div className="absolute bottom-4 left-2 right-2 text-center pointer-events-none px-2">
                {selectedCaption === "ember" && (
                  <div className="px-2 py-0.5 bg-base/80 rounded inline-block shadow-sm">
                    <p className="font-display text-[10px] text-primary leading-tight">
                      "The Word is <span className="text-accent font-bold">living</span> and active."
                    </p>
                  </div>
                )}
                {selectedCaption === "minimal" && (
                  <p className="font-display text-[10px] text-primary drop-shadow-sm leading-tight">
                    "{clip.text ? clip.text.slice(0, 40) + "…" : "Message clip"}"
                  </p>
                )}
                {selectedCaption === "subtitle" && (
                  <div className="bg-base px-1.5 py-0.5 rounded inline-block">
                    <p className="font-sans text-[9px] font-bold text-primary uppercase">
                      {clip.highlight_title || "Key Moment"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-secondary mt-3 text-center truncate max-w-xs">
              {clip.highlight_title || clip.title} · {Math.round((clip.end || 30) - (clip.start || 0))}s
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-5">
            {/* Format choice */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-primary block">
                1. Video Format
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
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-surface shadow-xs"
                          : "border-border bg-base hover:bg-surface text-secondary"
                      }`}
                    >
                      <i className={`bx ${fmt.icon} text-base mb-1 ${isSelected ? "text-accent" : "text-secondary"}`} />
                      <p className="text-xs font-bold text-primary leading-tight">{fmt.label}</p>
                      <p className="text-[9px] text-secondary mt-0.5 leading-tight">{fmt.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caption style */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-primary block">
                2. Caption Style
              </span>
              <div className="space-y-1">
                {CAPTION_STYLES.map((style) => {
                  const isSelected = selectedCaption === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedCaption(style.id)}
                      className={`w-full p-2 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? "border-accent bg-surface"
                          : "border-border bg-base hover:bg-surface text-secondary"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-primary leading-tight">{style.label}</p>
                        <p className="text-[10px] text-secondary">{style.desc}</p>
                      </div>
                      {isSelected && (
                        <i className="bx bxs-check-circle text-base text-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File name */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary block">
                3. File Name
              </span>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-primary outline-none focus:border-accent"
                placeholder="Clip file name"
              />
              <p className="text-[10px] text-secondary">
                Saves to <strong className="text-primary">Videos/Dabar/</strong> on your PC.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <Btn
                size="sm"
                onClick={() => onConfirmExport(clip, selectedFormat, selectedCaption, fileName)}
                disabled={isRendering}
              >
                <i className={`bx ${isRendering ? "bx-loader-alt bx-spin" : "bx-download"} text-sm`} />
                {isRendering ? "Saving Clip…" : "Save Video Clip"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
