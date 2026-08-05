import { CalendarDays, ArrowUpRight, PlayCircle, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SermonRow({ sermon }) {
  const navigate = useNavigate();

  const formattedDate = sermon.created_at
    ? new Date(sermon.created_at).toLocaleDateString()
    : "Recent";

  return (
    <div
      onClick={() => navigate(`/processing/${sermon.id}`)}
      className="group relative mb-3 flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-signal-border bg-signal-panel/90 p-5 shadow-signal transition-all duration-300 hover:-translate-y-0.5 hover:border-pulse-gold/50 hover:bg-signal-card sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-signal-border bg-signal-bg text-pulse-gold transition-colors duration-200 group-hover:bg-pulse-gold group-hover:text-signal-bg">
          <PlayCircle size={20} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded-md bg-pulse-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pulse-gold border border-pulse-gold/20">
              YOUTUBE
            </span>
            <span className="text-text-muted">•</span>
            <span className="truncate max-w-xs text-text-muted">{sermon.youtube_url}</span>
          </div>
          <h3 className="mt-1 font-display text-lg font-bold leading-snug text-text-primary transition-colors group-hover:text-pulse-gold">
            {sermon.title || sermon.youtube_url}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 border-t border-signal-border/50 pt-3 sm:border-t-0 sm:pt-0">
        <div className="flex items-center gap-3 font-mono text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-signal-border bg-signal-bg px-3 py-1.5">
            <CalendarDays size={13} className="text-pulse-gold" />
            {formattedDate}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-pulse-gold/30 bg-pulse-gold/10 px-3 py-1.5 font-bold uppercase text-pulse-gold">
            <Activity size={13} className="text-pulse-gold" />
            {sermon.status}
          </span>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-xl border border-signal-border bg-signal-bg text-text-secondary transition-all duration-200 group-hover:bg-pulse-gold group-hover:text-signal-bg group-hover:border-pulse-gold">
          <ArrowUpRight size={18} />
        </div>
      </div>
    </div>
  );
}
