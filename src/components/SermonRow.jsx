import { CalendarDays, Scissors, Clock, ArrowUpRight, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SermonRow({ sermon }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/processing/${sermon.id}`)}
      className="group relative mb-3 flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-linen/80 bg-cream/90 p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:bg-cream hover:shadow-warm sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy/5 text-navy transition-colors duration-200 group-hover:bg-navy group-hover:text-cream">
          <PlayCircle size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
              {sermon.platform ?? "YouTube"}
            </span>
            <span className="text-xs text-walnut/60">•</span>
            <span className="text-xs font-semibold text-walnut/80">{sermon.speaker}</span>
          </div>
          <h3 className="mt-1 font-serif text-xl font-semibold leading-snug text-navy transition-colors group-hover:text-gold-dark">
            {sermon.title}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 border-t border-linen/50 pt-3 sm:border-t-0 sm:pt-0">
        <div className="flex items-center gap-4 text-xs font-semibold text-walnut">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1.5">
            <CalendarDays size={14} className="text-gold" />
            {sermon.date}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1.5">
            <Clock size={14} className="text-gold" />
            {sermon.duration}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 font-bold text-navy">
            <Scissors size={14} className="text-gold" />
            {sermon.clipCount}
          </span>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-full bg-parchment text-navy transition-transform duration-200 group-hover:scale-110 group-hover:bg-navy group-hover:text-cream">
          <ArrowUpRight size={18} />
        </div>
      </div>
    </div>
  );
}
