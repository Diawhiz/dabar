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
        if (totalSecs < 60) return `${totalSecs} sec`;
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return s > 0 ? `${m}m ${s}s` : `${m} min`;
      }
    }
  }
  return durationStr;
}

export default function ClipCard({ clip, onPreview, onExport, isExporting, featured = false }) {
  const durationLabel = friendlyDuration(clip.duration);

  if (featured) {
    return (
      <article className="rounded-2xl border-2 border-amber/70 bg-paper p-6 shadow-md relative overflow-hidden transition-all space-y-4">
        {/* Top Gold Corner Tag */}
        <div className="absolute top-0 right-0 bg-amber text-white text-[10px] font-sans font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-xs">
          <i className="bx bxs-star" />
          Primary Highlight
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted font-sans pt-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber">
            <span className="w-2.5 h-4 border-2 border-amber rounded-xs" />
            Phone Clip (9:16)
          </span>
          <span>·</span>
          <span>{durationLabel}</span>
          <span>·</span>
          <span className="font-mono text-muted/80">{clip.duration}</span>
        </div>

        {/* Title / Big Quote */}
        <h3 className="font-display text-xl font-bold text-ink leading-snug">
          {clip.title}
        </h3>

        {/* Why it was chosen */}
        {clip.why && (
          <div className="rounded-xl bg-surface/70 border border-border/80 p-3.5 space-y-1">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted block">
              Theological Rationale
            </span>
            <p className="text-xs text-ink-secondary leading-relaxed font-serif italic">
              "{clip.why}"
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-3 font-sans">
          {onPreview && (
            <Btn size="sm" variant="ghost" onClick={() => onPreview(clip)}>
              <i className="bx bx-play text-lg" />
              Watch Preview
            </Btn>
          )}
          {onExport && (
            <Btn size="sm" onClick={() => onExport(clip)} disabled={isExporting}>
              <i className={`bx ${isExporting ? "bx-loader-alt bx-spin" : "bx-download"} text-base`} />
              {isExporting ? "Rendering Video…" : "Export Phone Clip"}
            </Btn>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="w-full rounded-2xl border border-border bg-paper p-5 shadow-xs transition-all duration-200 hover:border-amber/60 hover:shadow-md flex flex-col justify-between space-y-4">
      <div className="space-y-2.5">
        {/* Top metadata */}
        <div className="flex items-center justify-between text-xs text-muted font-sans">
          <span className="inline-flex items-center gap-1.5 text-amber font-semibold">
            <span className="w-2 h-3.5 border border-amber rounded-xs" />
            Vertical
          </span>
          <span className="text-[11px] font-mono text-muted">{durationLabel}</span>
        </div>

        {/* Title */}
        <h3 className="font-display text-base font-bold leading-snug text-ink line-clamp-2">
          {clip.title}
        </h3>

        {/* Why it matters note */}
        {clip.why && (
          <p className="text-xs text-muted font-serif line-clamp-2 bg-surface/60 p-2.5 rounded-xl border border-border/40">
            {clip.why}
          </p>
        )}
      </div>

      {/* Footer buttons */}
      <div className="pt-3 border-t border-border/60 flex items-center gap-2 font-sans">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(clip)}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-ink bg-surface hover:bg-surface-warm transition-colors flex items-center justify-center gap-1"
          >
            <i className="bx bx-play text-base" />
            Preview
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={() => onExport(clip)}
            disabled={isExporting}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-amber hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
          >
            <i className={`bx ${isExporting ? "bx-loader-alt bx-spin" : "bx-download"} text-sm`} />
            {isExporting ? "Saving…" : "Export"}
          </button>
        )}
      </div>
    </article>
  );
}
