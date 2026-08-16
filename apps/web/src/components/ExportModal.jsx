import { useState } from "react";
import Btn from "./Btn.jsx";

const FORMAT_OPTIONS = [
  {
    id: "vertical",
    label: "Phone Size",
    ratioTag: "9:16",
    subtitle: "Reels, Shorts & TikTok",
    ratioClass: "aspect-[9/16] w-36",
    icon: "bx-mobile",
  },
  {
    id: "square",
    label: "Square Feed",
    ratioTag: "1:1",
    subtitle: "Instagram & Facebook feed",
    ratioClass: "aspect-square w-40",
    icon: "bx-square",
  },
  {
    id: "widescreen",
    label: "Cinema",
    ratioTag: "16:9",
    subtitle: "YouTube & church archive",
    ratioClass: "aspect-video w-48",
    icon: "bx-tv",
  },
];

const CAPTION_STYLES = [
  { id: "ember", label: "Pulpit Highlight", desc: "Key biblical emphasis highlighted in warm gold" },
  { id: "minimal", label: "Clean Subtitle", desc: "Crisp, unobtrusive lower-third typography" },
  { id: "solid", label: "Solid Bar", desc: "High-contrast dark card behind spoken text" },
];

export default function ExportModal({
  clip,
  sermonTitle,
  videoId,
  mediaAssetUrl,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-hover/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center text-lg">
              <i className="bx bx-film" />
            </div>
            <div>
              <h2 className="font-editorial text-base font-bold text-primary">Export Video Reel</h2>
              <p className="text-[11px] text-secondary font-mono-code">
                Render aspect-ratio safe MP4 with custom caption overlay
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md text-muted hover:text-primary hover:bg-surface-hover flex items-center justify-center transition-colors"
          >
            <i className="bx bx-x text-xl" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Preview Canvas */}
          <div className="flex flex-col items-center justify-center bg-base rounded-xl border border-border p-5 min-h-[300px]">
            <div className="flex items-center justify-between w-full mb-3 px-1">
              <span className="text-[10px] font-mono-code font-bold text-accent uppercase tracking-wider">
                {currentFormat.label} ({currentFormat.ratioTag})
              </span>
              <span className="text-[10px] font-mono-code text-muted">
                1080p HD Ready
              </span>
            </div>

            <div
              className={`relative ${currentFormat.ratioClass} bg-surface rounded-lg overflow-hidden border border-border/80 shadow-lg flex items-center justify-center`}
            >
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(
                    clip.start || 0
                  )}&end=${Math.ceil(clip.end || 60)}&autoplay=1&mute=1&controls=0&loop=1&rel=0`}
                  title="Clip Reflow Preview"
                  className="w-full h-full object-cover scale-150 pointer-events-none opacity-85"
                />
              ) : mediaAssetUrl ? (
                <video
                  src={mediaAssetUrl}
                  className="w-full h-full object-cover pointer-events-none opacity-85"
                  onLoadedMetadata={(e) => {
                    e.target.currentTime = clip.start || 0;
                  }}
                />
              ) : (
                <div className="text-center p-3 space-y-1">
                  <i className="bx bx-movie-play text-2xl text-accent" />
                  <p className="text-[10px] text-secondary font-mono-code">Aspect Ratio Master</p>
                </div>
              )}

              {/* Caption Overlay Live Simulation */}
              <div className="absolute bottom-3 left-2 right-2 text-center pointer-events-none">
                {selectedCaption === "ember" && (
                  <div className="px-2 py-1 bg-black/80 backdrop-blur-xs rounded border border-white/10 inline-block shadow-sm">
                    <p className="text-[10px] text-white leading-tight font-sans">
                      "Faith comes by <span className="text-accent font-bold">hearing</span> the Word."
                    </p>
                  </div>
                )}
                {selectedCaption === "minimal" && (
                  <p className="text-[10px] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-tight font-medium">
                    "{clip.text ? clip.text.slice(0, 38) + "…" : "Sermon insight"}"
                  </p>
                )}
                {selectedCaption === "solid" && (
                  <div className="bg-black/90 px-2 py-1 rounded inline-block border-l-2 border-accent">
                    <p className="text-[9px] font-bold text-white uppercase font-mono-code">
                      {clip.highlight_title || clip.title || "Preaching Moment"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted font-editorial italic mt-3 truncate max-w-[200px] text-center">
              "{clip.highlight_title || clip.title}"
            </p>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4 text-xs">
            {/* Format choice */}
            <div className="space-y-1.5">
              <label className="font-semibold text-primary block text-xs">
                1. Aspect Ratio Format
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
                          const base = prev.replace(
                            /\s*\((Vertical Clip|Phone Size|Square|Landscape|Cinema|Square Feed)\)/i,
                            ""
                          );
                          return `${base} (${fmt.label})`;
                        });
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-accent bg-accent-muted/40 shadow-xs"
                          : "border-border bg-surface hover:bg-surface-hover text-secondary"
                      }`}
                    >
                      <i
                        className={`bx ${fmt.icon} text-base mb-1 block ${
                          isSelected ? "text-accent" : "text-muted"
                        }`}
                      />
                      <p className="font-semibold text-primary leading-tight text-[11px]">
                        {fmt.label}
                      </p>
                      <p className="text-[9.5px] text-muted font-mono-code mt-0.5">
                        {fmt.ratioTag}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caption style */}
            <div className="space-y-1.5">
              <label className="font-semibold text-primary block text-xs">
                2. Caption Typography Style
              </label>
              <div className="space-y-1.5">
                {CAPTION_STYLES.map((style) => {
                  const isSelected = selectedCaption === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedCaption(style.id)}
                      className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? "border-accent bg-accent-muted/30"
                          : "border-border bg-surface hover:bg-surface-hover text-secondary"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-primary text-[11.5px]">
                          {style.label}
                        </p>
                        <p className="text-[10px] text-muted">{style.desc}</p>
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
            <div className="space-y-1.5">
              <label className="font-semibold text-primary block text-xs">
                3. File Output Title
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="field-input text-xs font-mono-code"
              />
              <p className="text-[10px] text-muted">
                Renders MP4 to your configured <code className="text-accent">Videos/Dabar</code> folder.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs text-secondary hover:text-primary transition-colors font-medium"
              >
                Cancel
              </button>
              <Btn
                size="md"
                variant="primary"
                onClick={() =>
                  onConfirmExport(clip, selectedFormat, selectedCaption, fileName)
                }
                disabled={isRendering}
              >
                <i
                  className={`bx ${
                    isRendering ? "bx-loader-alt bx-spin" : "bx-film"
                  } text-base`}
                />
                <span>{isRendering ? "Rendering Video…" : "Export Video Clip"}</span>
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
