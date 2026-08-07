import Btn from "./Btn.jsx";

/**
 * ClipCard — a single clip preview in the reel strip or list.
 */
export default function ClipCard({ clip, onPreview, onExport }) {
  return (
    <article
      role="listitem"
      className="w-72 shrink-0 rounded-card border border-border bg-paper p-5 shadow-card transition-shadow duration-200 hover:shadow-lifted"
    >
      {/* Clip visual placeholder — waveform slice */}
      <div className="flex h-20 items-end justify-center gap-px rounded-lg bg-surface mb-4 overflow-hidden px-3">
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={i}
            className="bg-ember/60 rounded-sm"
            style={{ width: "3px", height: `${25 + ((i * 11 + 7) % 55)}%` }}
            aria-hidden="true"
          />
        ))}
      </div>

      <h3 className="font-display text-sm font-semibold leading-snug text-ink line-clamp-2">
        {clip.title}
      </h3>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted font-body">
        <span className="inline-flex items-center gap-1">
          <i className="bx bx-time text-sm" aria-hidden="true" />
          {clip.duration}
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 font-medium text-ink">
          {clip.format}
        </span>
      </div>

      {clip.captions && (
        <p className="mt-1.5 text-xs text-muted">{clip.captions}</p>
      )}

      <div className="mt-4 flex gap-2">
        {onPreview && (
          <Btn size="sm" variant="ghost" onClick={() => onPreview(clip)}>
            <i className="bx bx-play" aria-hidden="true" />
            Preview
          </Btn>
        )}
        {onExport && (
          <Btn size="sm" variant="primary" onClick={() => onExport(clip)}>
            <i className="bx bx-download" aria-hidden="true" />
            Export
          </Btn>
        )}
      </div>
    </article>
  );
}
