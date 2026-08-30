import { useNavigate } from "react-router-dom";

export default function SermonCard({ sermon }) {
  const navigate = useNavigate();
  const status = (sermon.status || "Processing").toLowerCase();
  const isReady =
    status.includes("clip") ||
    status.includes("ready") ||
    status.includes("complete");
  const isCancelled = status.includes("cancel");
  const isFailed = status.includes("fail") || status.includes("error");

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
            isReady
              ? "text-success"
              : isCancelled
              ? "text-muted"
              : isFailed
              ? "text-danger"
              : "text-accent"
          }`}
        >
          <i
            className={`bx ${
              isReady
                ? "bxs-check-circle"
                : isCancelled
                ? "bx-stop-circle"
                : isFailed
                ? "bx-error-circle"
                : "bx-loader-alt bx-spin"
            }`}
          />
          {isReady
            ? "Clips Ready"
            : isCancelled
            ? "Cancelled"
            : isFailed
            ? "Failed"
            : "Transcribing…"}
        </span>

        <span className="text-[11px] text-muted group-hover:text-primary font-medium transition-colors">
          {isReady ? "Open Studio →" : isCancelled ? "View Details →" : "View Progress →"}
        </span>
      </div>
    </article>
  );
}
