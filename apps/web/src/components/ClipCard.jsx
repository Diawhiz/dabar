import Btn from "./Btn.jsx";

/**
 * Format raw seconds duration into plain language ("30 sec", "1 min 15 sec")
 */
function friendlyDuration(durationStr) {
  if (!durationStr) return "Clip";
  if (durationStr.includes("–") || durationStr.includes("-")) {
    const parts = durationStr.split(/[-–]/).map((s) => s.trim());
    if (parts.length === 2) {
      const [startM, startS] = parts[0].split(":").map(Number);
      const [endM, endS] = parts[1].split(":").map(Number);
      if (!isNaN(startM) && !isNaN(startS) && !isNaN(endM) && !isNaN(endS)) {
        const totalSecs = (endM * 60 + endS) - (startM * 60 + startS);
        if (totalSecs < 60) return `${totalSecs} sec`;
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return s > 0 ? `${m}m ${s}s` : `${m} min`;
      }
    }
  }
  return durationStr;
}

/**
 * ClipCard — a single clip preview card with plain-language labels and illumination caption.
 */
export default function ClipCard({ clip, onPreview, onExport, isExporting, featured = false }) {
  const durationLabel = friendlyDuration(clip.duration);

  if (featured) {
    return (
      <article
        role="listitem"
        className="rounded-card border-2 border-ember/60 bg-paper p-6 shadow-lifted relative overflow-hidden transition-all"
      >
        <div className="absolute top-0 right-0 bg-ember/15 text-ember text-[11px] font-semibold tracking-wider uppercase px-3 py-1 rounded-bl-lg flex items-center gap-1.5">
          <i className="bx bxs-star" aria-hidden="true" />
          Top Moment
        </div>

        <div className="flex items-center gap-2 text-xs text-muted font-body mb-2.5">
          <span className="inline-flex items-center gap-1 font-medium text-ember">
            <span className="inline-block w-2.5 h-4 border-2 border-ember rounded-sm" aria-hidden="true" />
            Vertical
          </span>
          <span>·</span>
          <span>{durationLabel} ({clip.duration})</span>
        </div>

        <h3 className="font-display text-lg font-bold text-ink leading-snug">
          {clip.title}
        </h3>

        {clip.why && (
          <p className="mt-2 text-sm text-ink/90 italic bg-ember/10 border-l-2 border-ember px-3 py-2 rounded-r-md">
            "{clip.why}"
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          {onPreview && (
            <Btn size="sm" variant="ghost" onClick={() => onPreview(clip)}>
              <i className="bx bx-play text-lg" aria-hidden="true" />
              Preview moment
            </Btn>
          )}
          {onExport && (
            <Btn size="sm" variant="primary" onClick={() => onExport(clip)} disabled={isExporting}>
              <i className={`bx ${isExporting ? "bx-loader-alt bx-spin" : "bx-download"} text-base`} aria-hidden="true" />
              {isExporting ? "Rendering…" : "Export clip"}
            </Btn>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      role="listitem"
      className="w-80 shrink-0 rounded-card border border-border bg-paper p-5 shadow-card transition-all duration-200 hover:border-ember hover:shadow-lifted flex flex-col justify-between"
    >
      <div>
        {/* Top metadata strip: visual aspect ratio + friendly duration */}
        <div className="flex items-center justify-between text-xs text-muted font-body mb-2.5">
          <span className="inline-flex items-center gap-1 text-ember font-medium">
            <span className="inline-block w-2 h-3 border border-ember rounded-sm" aria-hidden="true" />
            Vertical
          </span>
          <span className="text-muted">{durationLabel} ({clip.duration})</span>
        </div>

        <h3 className="font-display text-sm font-semibold leading-snug text-ink line-clamp-2">
          {clip.title}
        </h3>

        {clip.why ? (
          <p className="mt-2 text-xs text-muted bg-surface p-2 rounded-md line-clamp-2">
            <span className="font-semibold text-ink">Why it matters:</span> {clip.why}
          </p>
        ) : clip.captions ? (
          <p className="mt-2 text-xs text-muted italic">"{clip.captions}"</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 pt-2 border-t border-border/50">
        {onPreview && (
          <Btn size="sm" variant="ghost" className="flex-1" onClick={() => onPreview(clip)}>
            <i className="bx bx-play" aria-hidden="true" />
            Preview
          </Btn>
        )}
        {onExport && (
          <Btn size="sm" variant="outline" className="flex-1" onClick={() => onExport(clip)} disabled={isExporting}>
            <i className={`bx ${isExporting ? "bx-loader-alt bx-spin" : "bx-download"}`} aria-hidden="true" />
            {isExporting ? "Rendering…" : "Export"}
          </Btn>
        )}
      </div>
    </article>
  );
}
