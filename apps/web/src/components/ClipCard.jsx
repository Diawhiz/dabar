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
  const viralityScore = clip.virality_score || clip.score || (featured ? 95 : 88);

  if (featured) {
    return (
      <article className="reel-card featured space-y-4">
        {/* Top Tag & Reel Metrics */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="scripture-badge">
              <i className="bx bxs-star text-xs" />
              TOP PREACHING MOMENT
            </span>
            <span className="font-mono-code text-[11px] text-accent font-semibold px-2 py-0.5 rounded bg-accent-muted border border-accent/20">
              {viralityScore}% Impact
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono-code text-xs text-secondary bg-surface-hover/80 px-2.5 py-1 rounded-md border border-border">
            <i className="bx bx-time text-accent text-xs" />
            <span>{durationLabel}</span>
            <span className="text-muted">({clip.duration})</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-editorial text-lg font-bold text-primary leading-snug">
          {clip.title}
        </h3>

        {/* Spoken Excerpt / Core Insight */}
        {clip.why && (
          <div className="border-l-2 border-accent bg-surface-hover/50 p-3 rounded-r-lg space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono-code text-accent font-semibold tracking-wider">
              <i className="bx bxs-quote-left text-xs" />
              <span>Teaching Nugget</span>
            </div>
            <p className="font-editorial text-sm text-primary/90 italic leading-relaxed">
              "{clip.why}"
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/60">
          <div className="flex items-center gap-2 text-[11px] text-muted font-mono-code">
            <i className="bx bx-mobile text-accent" />
            <span>9:16 Vertical Master</span>
          </div>

          <div className="flex items-center gap-2">
            {onPreview && (
              <Btn size="sm" variant="secondary" onClick={() => onPreview(clip)}>
                <i className="bx bx-play text-sm text-accent" />
                <span>Watch Preview</span>
              </Btn>
            )}
            {onExport && (
              <Btn size="sm" variant="primary" onClick={() => onExport(clip)} disabled={isExporting}>
                <i
                  className={`bx ${
                    isExporting ? "bx-loader-alt bx-spin" : "bx-film"
                  } text-sm`}
                />
                <span>{isExporting ? "Rendering…" : "Export Video Reel"}</span>
              </Btn>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="reel-card justify-between space-y-3.5 group">
      <div className="space-y-2.5">
        {/* Top metadata */}
        <div className="flex items-center justify-between text-xs">
          <span className="scripture-badge text-[10px]">
            <i className="bx bx-mobile" />
            9:16 REEL
          </span>
          <span className="font-mono-code text-[11px] text-muted font-medium bg-surface-hover px-2 py-0.5 rounded border border-border/50">
            {durationLabel}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-editorial text-sm font-semibold text-primary leading-snug group-hover:text-accent transition-colors line-clamp-2">
          {clip.title}
        </h3>

        {/* Why / Quote note */}
        {clip.why && (
          <p className="font-editorial text-xs text-secondary/90 italic line-clamp-3 leading-relaxed border-l-2 border-border pl-2">
            "{clip.why}"
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2.5 border-t border-border/70 flex items-center gap-2">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(clip)}
            className="flex-1 py-1.5 px-2.5 rounded-md bg-surface-hover hover:bg-surface-active text-xs text-primary border border-border transition-all flex items-center justify-center gap-1.5 font-medium"
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
            className="flex-1 py-1.5 px-2.5 rounded-md bg-accent text-accent-fg hover:bg-[var(--accent-hover)] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
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
    </article>
  );
}
