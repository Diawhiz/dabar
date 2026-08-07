import { useNavigate } from "react-router-dom";
import Waveform from "./Waveform.jsx";

/**
 * SermonCard — a single sermon "frame" in the reel strip.
 */
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
      className="group w-64 shrink-0 cursor-pointer rounded-card border border-border bg-paper p-5 shadow-card transition-shadow duration-200 hover:shadow-lifted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
    >
      {/* Mini waveform thumbnail */}
      <Waveform mode="divider" barCount={24} className="mb-4 h-5 opacity-40 group-hover:opacity-60 transition-opacity" />

      <h3 className="font-display text-base font-semibold leading-snug text-ink line-clamp-2">
        {sermon.title}
      </h3>

      {sermon.speaker && (
        <p className="mt-1.5 text-xs text-muted font-body">{sermon.speaker}</p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted font-body">
        <span>{sermon.date || ""}</span>
        <span>{sermon.duration || ""}</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {isReady ? (
          <i className="bx bx-check-circle text-ember text-sm" aria-hidden="true" />
        ) : (
          <i className="bx bx-loader-alt bx-spin text-muted text-sm" aria-hidden="true" />
        )}
        <span className={`text-xs font-medium ${isReady ? "text-ember" : "text-muted"}`}>
          {status}
        </span>
      </div>
    </article>
  );
}
