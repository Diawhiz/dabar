import { useNavigate } from "react-router-dom";

export default function SermonCard({ sermon }) {
  const navigate = useNavigate();
  const status = sermon.status || "Processing";
  const isReady =
    status.toLowerCase().includes("clip") ||
    status.toLowerCase().includes("ready") ||
    status.toLowerCase().includes("complete");

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
      className="studio-card-interactive group w-72 shrink-0 p-4 space-y-2.5"
    >
      <div className="flex items-center justify-between text-xs text-muted font-sans">
        <span className="meta-chip text-[10.5px] font-semibold text-accent">
          {sermon.date || "Recent"}
        </span>
        <span className="font-mono text-[11px]">{sermon.duration || ""}</span>
      </div>

      <h3 className="font-editorial text-base font-bold leading-snug text-primary line-clamp-2 group-hover:text-accent transition-colors">
        {sermon.title}
      </h3>

      {sermon.speaker && (
        <p className="text-xs text-secondary font-sans">{sermon.speaker}</p>
      )}

      <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-sans">
        <span
          className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
            isReady ? "text-success" : "text-accent"
          }`}
        >
          <i
            className={`bx ${
              isReady ? "bxs-check-circle" : "bx-loader-alt bx-spin"
            }`}
          />
          {isReady ? "Clips Ready" : "Transcribing…"}
        </span>

        <span className="text-[11px] text-muted group-hover:text-primary font-medium transition-colors">
          Open Studio →
        </span>
      </div>
    </article>
  );
}
