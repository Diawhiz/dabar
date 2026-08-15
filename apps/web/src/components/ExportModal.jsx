import { useState } from "react";
import Btn from "./Btn.jsx";

const FORMAT_OPTIONS = [
  {
    id: "vertical",
    label: "Phone Size",
    subtitle: "9:16 vertical for Shorts, Reels & TikTok",
    ratioClass: "aspect-[9/16] w-32",
    icon: "bx-mobile",
  },
  {
    id: "square",
    label: "Square",
    subtitle: "1:1 for Instagram & Facebook feeds",
    ratioClass: "aspect-square w-36",
    icon: "bx-square",
  },
  {
    id: "widescreen",
    label: "Landscape",
    subtitle: "16:9 for YouTube & screen presentations",
    ratioClass: "aspect-video w-44",
    icon: "bx-tv",
  },
];

const CAPTION_STYLES = [
  { id: "ember", label: "Keyword Highlight", desc: "Spoken emphasis highlighted in blue" },
  { id: "minimal", label: "Clean Subtitle", desc: "Crisp, uncluttered text at the bottom" },
  { id: "subtitle", label: "Solid Bar", desc: "High-contrast dark bar behind text" },
];

export default function ExportModal({
  clip,
  sermonTitle,
  videoId,
  onClose,
  onConfirmExport,
  isRendering,
  exportedPath,
}) {
  const [selectedFormat, setSelectedFormat] = useState("vertical");
  const [selectedCaption, setSelectedCaption] = useState("ember");
  const [fileName, setFileName] = useState(() => {
    const cleanTitle = (clip?.highlight_title || clip?.title || "Sermon Clip")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim();
    return `${cleanTitle} (Vertical Clip)`;
  });

  if (!clip) return null;

  const currentFormat =
    FORMAT_OPTIONS.find((f) => f.id === selectedFormat) || FORMAT_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-surface-hover/30">
          <div>
            <h2 className="text-sm font-semibold text-primary">Export Video Clip</h2>
            <p className="text-[11px] text-secondary">
              Configure aspect ratio and caption styling for export.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded text-muted hover:text-primary flex items-center justify-center"
          >
            <i className="bx bx-x text-lg" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Left: Preview */}
          <div className="flex flex-col items-center justify-center bg-base rounded border border-border p-4 min-h-[280px]">
            <span className="text-[10px] font-mono font-semibold text-accent uppercase tracking-wider mb-2">
              {currentFormat.label} Preview
            </span>

            <div
              className={`relative ${currentFormat.ratioClass} bg-surface rounded overflow-hidden border border-border flex items-center justify-center`}
            >
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(
                    clip.start || 0
                  )}&end=${Math.ceil(clip.end || 60)}&autoplay=1&mute=1&controls=0&loop=1&rel=0`}
                  title="Clip Reflow Preview"
                  className="w-full h-full object-cover scale-150 pointer-events-none opacity-80"
                />
              ) : (
                <div className="text-center p-2">
                  <i className="bx bx-film text-xl text-accent mb-1" />
                  <p className="text-[9px] text-secondary">Local Media</p>
                </div>
              )}

              {/* Caption Overlay */}
              <div className="absolute bottom-3 left-1.5 right-1.5 text-center pointer-events-none px-1">
                {selectedCaption === "ember" && (
                  <div className="px-1.5 py-0.5 bg-black/75 rounded inline-block">
                    <p className="text-[9px] text-white leading-tight">
                      "The Word is <span className="text-accent font-bold">living</span> and active."
                    </p>
                  </div>
                )}
                {selectedCaption === "minimal" && (
                  <p className="text-[9px] text-white drop-shadow leading-tight">
                    "{clip.text ? clip.text.slice(0, 35) + "…" : "Sermon clip"}"
                  </p>
                )}
                {selectedCaption === "subtitle" && (
                  <div className="bg-black/90 px-1 py-0.5 rounded inline-block">
                    <p className="text-[8px] font-bold text-white uppercase">
                      {clip.highlight_title || "Key Teaching Moment"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted font-mono mt-2 truncate max-w-[180px]">
              {clip.highlight_title || clip.title}
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4 text-xs">
            {/* Format choice */}
            <div className="space-y-1">
              <label className="font-semibold text-primary block">
                1. Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {FORMAT_OPTIONS.map((fmt) => {
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => {
                        setSelectedFormat(fmt.id);
                        setFileName((prev) => {
                          const base = prev.replace(
                            /\s*\((Vertical Clip|Phone Size|Square|Landscape)\)/i,
                            ""
                          );
                          return `${base} (${fmt.label})`;
                        });
                      }}
                      className={`p-2 rounded border text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-surface-active"
                          : "border-border bg-surface hover:bg-surface-hover text-secondary"
                      }`}
                    >
                      <i
                        className={`bx ${fmt.icon} text-sm mb-0.5 block ${
                          isSelected ? "text-accent" : "text-muted"
                        }`}
                      />
                      <p className="font-medium text-primary leading-tight text-[11px]">
                        {fmt.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caption style */}
            <div className="space-y-1">
              <label className="font-semibold text-primary block">
                2. Caption Style
              </label>
              <div className="space-y-1">
                {CAPTION_STYLES.map((style) => {
                  const isSelected = selectedCaption === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedCaption(style.id)}
                      className={`w-full p-2 rounded border text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? "border-accent bg-surface-active"
                          : "border-border bg-surface hover:bg-surface-hover text-secondary"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-primary text-[11px]">
                          {style.label}
                        </p>
                        <p className="text-[10px] text-muted">{style.desc}</p>
                      </div>
                      {isSelected && (
                        <i className="bx bxs-check-circle text-sm text-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* File name */}
            <div className="space-y-1">
              <label className="font-semibold text-primary block">
                3. Output File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full rounded border border-border bg-base px-2.5 py-1 text-xs text-primary outline-none focus:border-accent font-mono"
              />
              <p className="text-[10px] text-muted">
                Rendered directly to local output directory via FFmpeg.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded text-xs text-secondary hover:text-primary"
              >
                Cancel
              </button>
              <Btn
                size="sm"
                onClick={() =>
                  onConfirmExport(clip, selectedFormat, selectedCaption, fileName)
                }
                disabled={isRendering}
              >
                <i
                  className={`bx ${
                    isRendering ? "bx-loader-alt bx-spin" : "bx-download"
                  } text-xs`}
                />
                <span>{isRendering ? "Rendering Clip…" : "Export Clip"}</span>
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
