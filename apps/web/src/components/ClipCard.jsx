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

  if (featured) {
    return (
      <article className="border border-border bg-surface rounded-md p-4 relative space-y-3">
        {/* Top Tag */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
            <i className="bx bxs-star text-xs" />
            Primary Highlight
          </span>
          <div className="flex items-center gap-2 font-mono text-[11px] text-secondary">
            <span>{durationLabel}</span>
            <span>·</span>
            <span>{clip.duration}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-primary leading-snug">
          {clip.title}
        </h3>

        {/* Pastoral why */}
        {clip.why && (
          <div className="border-l-2 border-accent/40 bg-surface-hover/60 px-3 py-1.5 rounded-r">
            <p className="text-xs text-secondary leading-relaxed">
              "{clip.why}"
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onPreview && (
            <Btn size="sm" variant="secondary" onClick={() => onPreview(clip)}>
              <i className="bx bx-play text-xs text-accent" />
              <span>Preview</span>
            </Btn>
          )}
          {onExport && (
            <Btn size="sm" onClick={() => onExport(clip)} disabled={isExporting}>
              <i
                className={`bx ${
                  isExporting ? "bx-loader-alt bx-spin" : "bx-download"
                } text-xs`}
              />
              <span>{isExporting ? "Exporting…" : "Export Clip"}</span>
            </Btn>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="border border-border bg-surface rounded-md p-3.5 flex flex-col justify-between space-y-3 hover:border-border-strong transition-colors">
      <div className="space-y-1.5">
        {/* Top metadata */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-accent font-medium flex items-center gap-1">
            <i className="bx bx-mobile text-xs" />
            Vertical
          </span>
          <span className="font-mono text-muted">{durationLabel}</span>
        </div>

        {/* Title */}
        <h3 className="text-xs font-semibold text-primary leading-snug line-clamp-2">
          {clip.title}
        </h3>

        {/* Why note */}
        {clip.why && (
          <p className="text-[11px] text-secondary line-clamp-2 leading-relaxed">
            {clip.why}
          </p>
        )}
      </div>

      {/* Buttons */}
      <div className="pt-2 border-t border-border flex items-center gap-1.5">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(clip)}
            className="flex-1 py-1 px-2 rounded bg-surface-hover hover:bg-surface-active text-xs text-primary border border-border transition-colors flex items-center justify-center gap-1"
          >
            <i className="bx bx-play text-xs text-accent" />
            <span>Preview</span>
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={() => onExport(clip)}
            disabled={isExporting}
            className="flex-1 py-1 px-2 rounded bg-accent text-white hover:bg-[var(--accent-hover)] text-xs font-medium transition-colors flex items-center justify-center gap-1"
          >
            <i
              className={`bx ${
                isExporting ? "bx-loader-alt bx-spin" : "bx-download"
              } text-xs`}
            />
            <span>{isExporting ? "Saving…" : "Export"}</span>
          </button>
        )}
      </div>
    </article>
  );
}
