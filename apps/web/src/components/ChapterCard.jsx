import { formatSeconds } from "../lib/formatters.js";
import Btn from "./Btn.jsx";

export default function ChapterCard({
  chapter,
  index,
  onPlay,
  onRead,
  isPlayingThisChapter = false,
}) {
  const durationSecs = Math.max(0, (chapter.end_time || 0) - (chapter.start_time || 0));
  const m = Math.floor(durationSecs / 60);
  const s = Math.floor(durationSecs % 60);
  const durationLabel = m > 0 ? `${m}m ${s > 0 ? `${s}s` : ""}` : `${s}s`;

  return (
    <article
      className={`border rounded-lg p-5 transition-all relative space-y-3.5 ${
        isPlayingThisChapter
          ? "border-accent bg-accent-muted/15 shadow-sm shadow-accent/5 ring-1 ring-accent/30"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/50"
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
              isPlayingThisChapter
                ? "bg-accent text-accent-fg"
                : "bg-surface-hover text-accent border border-border"
            }`}
          >
            Chapter {String(index + 1).padStart(2, "0")}
          </span>
          {isPlayingThisChapter && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-accent animate-pulse">
              <i className="bx bx-volume-full text-xs" />
              Now Playing
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
          <span>{durationLabel}</span>
          <span>·</span>
          <span>
            {formatSeconds(chapter.start_time)} – {formatSeconds(chapter.end_time)}
          </span>
        </div>
      </div>

      {/* Chapter Title */}
      <h3 className="text-sm font-semibold text-primary leading-snug">
        {chapter.title || `Chapter ${index + 1}`}
      </h3>

      {/* Chapter Summary */}
      {chapter.summary && (
        <p className="text-xs text-secondary leading-relaxed line-clamp-3">
          {chapter.summary}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2">
        <div className="flex items-center gap-2">
          <Btn
            size="sm"
            variant={isPlayingThisChapter ? "primary" : "secondary"}
            onClick={() => onPlay(chapter)}
          >
            <i
              className={`bx ${
                isPlayingThisChapter ? "bx-pause" : "bx-play"
              } text-sm`}
            />
            <span>{isPlayingThisChapter ? "Pause" : "Listen Chapter"}</span>
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={() => onRead(chapter)}
          >
            <i className="bx bx-book-open text-sm text-secondary" />
            <span>Read in Manuscript</span>
          </Btn>
        </div>
      </div>
    </article>
  );
}
