import { useNavigate } from "react-router-dom";

export default function SermonCard({ sermon }) {
  const navigate = useNavigate();
  const status = sermon.status || "Processing";
  const isReady = status.toLowerCase().includes("clip") || status.toLowerCase().includes("ready") || status.toLowerCase().includes("complete");

  function handleClick() {
    if (sermon.id) {
      navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`);
    }
  }

  return (
    <article
      role="listitem"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className="group w-72 shrink-0 cursor-pointer rounded-2xl border border-border bg-paper p-5 shadow-xs transition-all duration-200 hover:border-amber/70 hover:shadow-md space-y-3"
    >
      <div className="flex items-center justify-between text-xs text-muted font-sans">
        <span className="font-semibold text-amber">{sermon.date || "Recent"}</span>
        <span className="font-mono">{sermon.duration || ""}</span>
      </div>

      <h3 className="font-display text-base font-bold leading-snug text-ink line-clamp-2 group-hover:text-amber transition-colors">
        {sermon.title}
      </h3>

      {sermon.speaker && (
        <p className="text-xs text-ink-secondary font-sans">{sermon.speaker}</p>
      )}

      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-sans">
        <span className={`inline-flex items-center gap-1 font-semibold ${isReady ? "text-amber" : "text-muted"}`}>
          <i className={`bx ${isReady ? "bx-check-circle" : "bx-loader-alt bx-spin"}`} />
          {isReady ? "Clips Ready" : "Transcribing…"}
        </span>

        <span className="text-[11px] text-muted group-hover:text-ink font-medium transition-colors">
          Open Studio →
        </span>
      </div>
    </article>
  );
}
