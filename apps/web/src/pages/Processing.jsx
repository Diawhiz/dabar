import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, onPipelineProgress } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const STAGES = [
  { key: "downloading", label: "Preparing Audio", detail: "Getting the recording ready on your computer" },
  { key: "transcribing", label: "Listening & Transcribing", detail: "Converting speech into high-precision text" },
  { key: "detecting", label: "Organizing & Finding Clips", detail: "Structuring paragraphs, checking scripture, and ranking highlights" },
  { key: "ready", label: "Complete", detail: "Your sermon manuscript and clips are ready" },
];

export default function Processing() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [progressState, setProgressState] = useState({ stage: "downloading", percent: 10, detail: "" });

  useEffect(() => {
    let unlisten = null;

    getSermon(sermonId).then((s) => {
      if (s) {
        setSermon(s);
        const status = (s.status || "").toLowerCase();
        if (status === "ready" || status === "complete" || status.includes("clip")) {
          setProgressState({ stage: "ready", percent: 100, detail: "All clips and manuscript ready" });
        }
      }
    });

    onPipelineProgress((event) => {
      if (event && event.sermon_id === sermonId) {
        setProgressState({
          stage: event.stage || "transcribing",
          percent: Math.round(event.progress_percent || 0),
          detail: event.detail || "",
        });
      }
    }).then((fn) => { unlisten = fn; });

    return () => {
      if (typeof unlisten === "function") unlisten();
    };
  }, [sermonId]);

  const isComplete = progressState.stage === "ready" || progressState.percent >= 100;
  const currentStageIndex = STAGES.findIndex((s) => s.key === progressState.stage);
  const stageIndex = currentStageIndex === -1 ? 1 : currentStageIndex;

  return (
    <div className="mx-auto max-w-xl py-10 space-y-8 animate-fade-in">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-amber bg-surface px-3 py-1 rounded-full border border-border">
          {isComplete ? "Processing Complete" : "Working in Background"}
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          {sermon?.title || "Preparing your sermon…"}
        </h1>
        <p className="text-xs text-muted font-sans max-w-md mx-auto">
          {isComplete
            ? "Every word has been transcribed and key teaching moments have been curated."
            : "You can leave this window open or let it finish in the background."}
        </p>
      </div>

      {/* Progress Card */}
      <div className="rounded-2xl border border-border bg-paper p-6 shadow-sm space-y-4 font-sans">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink">
            {STAGES[stageIndex]?.label || "Processing"}
          </span>
          <span className="text-xs font-bold text-amber font-mono">
            {progressState.percent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-amber transition-all duration-500 ease-out"
            style={{ width: `${progressState.percent}%` }}
          />
        </div>

        <p className="text-[11px] text-muted">
          {progressState.detail || STAGES[stageIndex]?.detail}
        </p>
      </div>

      {/* Stage Checklist */}
      <div className="space-y-3 px-2 font-sans">
        {STAGES.map((stg, i) => {
          const done = i < stageIndex || isComplete;
          const active = i === stageIndex && !isComplete;
          return (
            <div key={stg.key} className="flex items-center gap-3.5">
              {done ? (
                <i className="bx bx-check-circle text-lg text-amber" />
              ) : active ? (
                <i className="bx bx-loader-alt bx-spin text-lg text-amber" />
              ) : (
                <i className="bx bx-circle text-lg text-border" />
              )}
              <span className={`text-xs ${done ? "text-muted line-through" : active ? "text-ink font-semibold" : "text-muted/50"}`}>
                {stg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Complete CTA */}
      {isComplete ? (
        <Btn onClick={() => navigate(`/clips/${sermonId}`)} size="lg" className="w-full shadow-md">
          <i className="bx bx-film text-lg" />
          Open Manuscript & Clips Studio
        </Btn>
      ) : (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-xs text-muted hover:text-ink font-sans underline underline-offset-4"
          >
            Back to Sermon Desk (continues in background)
          </button>
        </div>
      )}

      {/* Live Incoming Transcript preview */}
      {sermon?.transcript_segments && sermon.transcript_segments.length > 0 && (
        <div className="rounded-2xl bg-surface/70 p-5 border border-border/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted">
              Live Transcript Preview
            </span>
            <span className="text-[10px] font-sans text-amber font-medium">
              {sermon.transcript_segments.length} sentences captured
            </span>
          </div>
          <p className="text-xs text-ink-secondary leading-relaxed italic font-serif">
            "{sermon.transcript_segments.slice(0, 6).map((s) => s.text).join(" ").slice(0, 240)}…"
          </p>
        </div>
      )}
    </div>
  );
}
