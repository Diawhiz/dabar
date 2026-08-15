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
      <article className="rounded-xl border border-accent bg-surface p-6 relative overflow-hidden transition-all space-y-4">
        {/* Top Gold Corner Tag */}
        <div className="absolute top-0 right-0 bg-accent text-white text-[10px] font-sans font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl flex items-center gap-1">
          <i className="bx bxs-star" />
          Primary Highlight
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-secondary font-sans pt-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
            <i className="bx bx-mobile text-sm" />
            Phone Clip
          </span>
          <span>·</span>
          <span>{durationLabel}</span>
          <span>·</span>
          <span className="font-mono text-secondary">{clip.duration}</span>
        </div>

        {/* Title */}
        <h3 className="font-display text-xl font-bold text-primary leading-snug">
          {clip.title}
        </h3>

        {/* Pastoral why */}
        {clip.why && (
          <div className="rounded-lg bg-base border border-border p-3 space-y-1">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-secondary block">
              Teaching Focus
            </span>
            <p className="text-xs text-primary leading-relaxed font-serif italic">
              "{clip.why}"
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center gap-3 font-sans">
          {onPreview && (
            <Btn size="sm" variant="outline" onClick={() => onPreview(clip)}>
              <i className="bx bx-play text-base text-accent" />
              Preview Moment
            </Btn>
          )}
          {onExport && (
            <Btn size="sm" onClick={() => onExport(clip)} disabled={isExporting}>
              <i className={`bx ${isExporting ? "bx-loader-alt bx-spin" : "bx-download"} text-base`} />
              {isExporting ? "Exporting…" : "Export Clip"}
            </Btn>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="w-full rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent flex flex-col justify-between space-y-4">
      <div className="space-y-2">
        {/* Top metadata */}
        <div className="flex items-center justify-between text-xs text-secondary font-sans">
          <span className="inline-flex items-center gap-1 text-accent font-semibold">
            <i className="bx bx-mobile text-sm" />
            Vertical
          </span>
          <span className="text-[11px] font-mono text-secondary">{durationLabel}</span>
        </div>

        {/* Title */}
        <h3 className="font-display text-base font-bold leading-snug text-primary line-clamp-2">
          {clip.title}
        </h3>

        {/* Note */}
        {clip.why && (
          <p className="text-xs text-secondary font-serif line-clamp-2 bg-base p-2.5 rounded-lg border border-border">
            {clip.why}
          </p>
        )}
      </div>

      {/* Footer buttons */}
      <div className="pt-3 border-t border-border flex items-center gap-2 font-sans">
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(clip)}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-primary bg-base hover:bg-surface-hover border border-border transition-colors flex items-center justify-center gap-1"
          >
            <i className="bx bx-play text-sm text-accent" />
            Preview
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={() => onExport(clip)}
            disabled={isExporting}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-accent hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
          >
            <i className={`bx ${isExporting ? "bx-loader-alt bx-spin" : "bx-download"} text-sm`} />
            {isExporting ? "Saving…" : "Export"}
          </button>
        )}
      </div>
    </article>
  );
}
