import { CalendarDays, Scissors } from "lucide-react";

export default function SermonRow({ sermon }) {
  return (
    <div className="grid gap-3 border-b border-linen px-1 py-5 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div>
        <h3 className="font-serif text-xl font-semibold text-navy">{sermon.title}</h3>
        <p className="mt-1 text-sm text-walnut">{sermon.speaker}</p>
      </div>
      <div className="flex items-center gap-5 text-sm text-walnut">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={16} className="text-gold" />
          {sermon.date}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Scissors size={16} className="text-gold" />
          {sermon.clipCount}
        </span>
      </div>
      <span className="text-sm font-semibold text-navy">{sermon.duration}</span>
    </div>
  );
}
