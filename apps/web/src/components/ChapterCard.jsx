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
      className={`studio-card p-4 sm:p-5 transition-all relative space-y-3 ${
        isPlayingThisChapter
          ? "border-accent bg-accent-muted/20 shadow-xs"
          : "hover:border-border-strong hover:bg-surface-hover/40"
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
              isPlayingThisChapter
                ? "bg-accent text-accent-fg"
                : "bg-surface-elevated text-accent border border-border"
            }`}
          >
            Chapter {String(index + 1).padStart(2, "0")}
          </span>
          {isPlayingThisChapter && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-accent">
              <i className="bx bx-volume-full text-xs" />
              <span>Playing</span>
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
      <h3 className="font-editorial text-base sm:text-lg font-bold text-primary leading-snug">
        {chapter.title || `Chapter ${index + 1}`}
      </h3>

      {/* Chapter Summary */}
      {chapter.summary && (
        <p className="text-xs text-secondary leading-relaxed line-clamp-3">
          {chapter.summary}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
        <div className="flex items-center gap-2">
          <Btn
            size="xs"
            variant={isPlayingThisChapter ? "primary" : "secondary"}
            onClick={() => onPlay(chapter)}
          >
            <i
              className={`bx ${
                isPlayingThisChapter ? "bx-pause" : "bx-play"
              } text-sm`}
            />
            <span>{isPlayingThisChapter ? "Pause" : "Listen"}</span>
          </Btn>
          <Btn
            size="xs"
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
