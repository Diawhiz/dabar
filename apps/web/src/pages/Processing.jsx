import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, onPipelineProgress } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const STAGES = [
  { key: "downloading", label: "Preparing audio" },
  { key: "transcribing", label: "Transcribing speech to text" },
  { key: "detecting", label: "Structuring paragraphs & finding moments" },
  { key: "ready", label: "Ready" },
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
          setProgressState({ stage: "ready", percent: 100, detail: "Sermon processing complete" });
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
    <div className="mx-auto max-w-lg py-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="border-b border-border pb-4 space-y-1">
        <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-accent">
          {isComplete ? "Complete" : "In Progress"}
        </span>
        <h1 className="font-display text-2xl font-bold text-primary">
          {sermon?.title || "Transcribing Sermon…"}
        </h1>
      </div>

      {/* ── Progress Bar ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-5 space-y-3 font-sans">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-primary">
            {STAGES[stageIndex]?.label || "Processing"}
          </span>
          <span className="font-mono font-bold text-accent">
            {progressState.percent}%
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-base overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${progressState.percent}%` }}
          />
        </div>

        {progressState.detail && (
          <p className="text-[11px] text-secondary">
            {progressState.detail}
          </p>
        )}
      </div>

      {/* ── Step Indicators ─────────────────────────────────────── */}
      <div className="space-y-2.5 px-1 font-sans">
        {STAGES.map((stg, i) => {
          const done = i < stageIndex || isComplete;
          const active = i === stageIndex && !isComplete;
          return (
            <div key={stg.key} className="flex items-center gap-3 text-xs">
              {done ? (
                <i className="bx bxs-check-circle text-accent text-base" />
              ) : active ? (
                <i className="bx bx-loader-alt bx-spin text-accent text-base" />
              ) : (
                <i className="bx bx-circle text-secondary text-base" />
              )}
              <span className={done ? "text-secondary line-through" : active ? "text-primary font-semibold" : "text-secondary/60"}>
                {stg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Actions when complete ───────────────────────────────── */}
      {isComplete ? (
        <div className="pt-2 flex flex-col sm:flex-row gap-3 font-sans">
          <button
            onClick={() => navigate(`/transcript/${sermonId}`)}
            className="flex-1 py-2.5 px-4 rounded-lg bg-base border border-border text-primary hover:border-accent text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <i className="bx bx-file text-base text-accent" />
            Read Manuscript
          </button>
          <button
            onClick={() => navigate(`/clips/${sermonId}`)}
            className="flex-1 py-2.5 px-4 rounded-lg bg-accent text-white hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition-opacity"
          >
            <i className="bx bx-cut text-base" />
            Review Clips
          </button>
        </div>
      ) : (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-xs text-secondary hover:text-primary font-sans underline underline-offset-4"
          >
            Back to sermons (runs in background)
          </button>
        </div>
      )}
    </div>
  );
}
