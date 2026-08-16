import Btn from "./Btn.jsx";

function friendlyDuration(durationStr) {
  if (!durationStr) return "Clip";
  if (durationStr.includes("–") || durationStr.includes("-")) {
    const parts = durationStr.split(/[-–]/).map((s) => s.trim());
    if (parts.length === 2) {
      const [startM, startS] = parts[0].split(":").map(Number);
      const [endM, endS] = parts[1].split(":").map(Number);
      if (!isNaN(startM) && !isNaN(startS) && !isNaN(endM) && !isNaN(endS)) {
        const totalSecs = (endM * 60 + endS) - (startM * 60 + startS);
        if (totalSecs < 60) return `${totalSecs}s`;
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return s > 0 ? `${m}m ${s}s` : `${m}m`;
      }
    }
  }
  return durationStr;
}

export default function ClipCard({
  clip,
  onPreview,
  onExport,
  isExporting,
  featured = false,
}) {
  const durationLabel = friendlyDuration(clip.duration);
  const viralityScore = clip.virality_score || clip.score || (featured ? 96 : 89);

  if (featured) {
    return (
      <div className="doppelrand-shell">
        <div className="doppelrand-core space-y-6">
          {/* Header Eyebrows & Score */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="eyebrow-tag">
                <i className="bx bxs-star text-xs" />
                Featured Preaching Moment
              </span>
              <span className="font-mono-code text-xs text-accent font-bold px-3 py-0.5 rounded-full bg-accent-muted border border-accent/30">
                {viralityScore}% Virality Index
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono-code text-xs text-secondary bg-white/[0.04] px-3 py-1 rounded-full border border-white/[0.08]">
              <i className="bx bx-time-five text-accent text-sm" />
              <span className="font-semibold text-primary">{durationLabel}</span>
              <span className="text-muted">({clip.duration})</span>
            </div>
          </div>

          {/* Title in High-Contrast Variable Serif */}
          <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-primary leading-tight tracking-tight">
            {clip.title}
          </h3>

          {/* Spoken Quote in Concentric Inset */}
          {clip.why && (
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-inner-glow space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase font-mono-code text-accent font-semibold tracking-widest">
                <i className="bx bxs-quote-left text-sm" />
                <span>Scriptural Teaching Excerpt</span>
              </div>
              <p className="font-editorial text-base sm:text-lg text-primary/90 italic leading-relaxed">
                "{clip.why}"
              </p>
            </div>
          )}

          {/* Action CTAs: Button-in-Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs text-muted font-mono-code">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>9:16 Vertical Reel Ready</span>
            </div>

            <div className="flex items-center gap-3">
              {onPreview && (
                <Btn
                  size="md"
                  variant="secondary"
                  icon="bx-play"
                  onClick={() => onPreview(clip)}
                >
                  Watch Preview
                </Btn>
              )}
              {onExport && (
                <Btn
                  size="md"
                  variant="primary"
                  icon={isExporting ? "bx-loader-alt bx-spin" : "bx-film"}
                  onClick={() => onExport(clip)}
                  disabled={isExporting}
                >
                  {isExporting ? "Rendering…" : "Export Video Clip"}
                </Btn>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doppelrand-shell group">
      <div className="doppelrand-core flex flex-col justify-between h-full space-y-4">
        <div className="space-y-3">
          {/* Eyebrow & Duration */}
          <div className="flex items-center justify-between">
            <span className="eyebrow-tag text-[9px] px-2.5 py-0.5">
              9:16 Reel
            </span>
            <span className="font-mono-code text-[11px] text-muted font-semibold bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.06]">
              {durationLabel}
            </span>
          </div>

          {/* Title */}
          <h4 className="font-editorial text-lg font-bold text-primary group-hover:text-accent transition-colors duration-300 line-clamp-2 leading-snug">
            {clip.title}
          </h4>

          {/* Excerpt */}
          {clip.why && (
            <p className="font-editorial text-xs text-secondary italic line-clamp-3 leading-relaxed border-l border-accent/40 pl-3">
              "{clip.why}"
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center gap-2">
          {onPreview && (
            <button
              type="button"
              onClick={() => onPreview(clip)}
              className="flex-1 py-2 px-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-primary border border-white/[0.08] transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-95"
            >
              <i className="bx bx-play text-sm text-accent" />
              <span>Preview</span>
            </button>
          )}
          {onExport && (
            <button
              type="button"
              onClick={() => onExport(clip)}
              disabled={isExporting}
              className="flex-1 py-2 px-3 rounded-full bg-gradient-to-r from-accent to-[#D49326] text-accent-fg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 shadow-[0_2px_12px_var(--accent-glow)] hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              <i
                className={`bx ${
                  isExporting ? "bx-loader-alt bx-spin" : "bx-film"
                } text-sm`}
              />
              <span>{isExporting ? "Rendering…" : "Export"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
