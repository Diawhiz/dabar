import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, onPipelineProgress } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const STAGES = [
  { key: "downloading", label: "Preparing sermon recording" },
  { key: "transcribing", label: "Transcribing speech to text" },
  { key: "detecting", label: "Finding key teaching moments & Scripture" },
  { key: "ready", label: "Clips & full manuscript ready" },
];

export default function Processing() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [progressState, setProgressState] = useState({
    stage: "downloading",
    percent: 10,
    detail: "Locating sermon source…",
    isError: false,
  });

  useEffect(() => {
    let unlisten = null;

    getSermon(sermonId).then((s) => {
      if (s) {
        setSermon(s);
        const status = (s.status || "").toLowerCase();
        if (status === "ready" || status === "complete" || status.includes("clip")) {
          setProgressState({
            stage: "ready",
            percent: 100,
            detail: "Processing complete. Highlights and full transcript are ready.",
            isError: false,
          });
        }
      }
    });

    onPipelineProgress((event) => {
      if (event && event.sermon_id === sermonId) {
        setProgressState({
          stage: event.stage || "transcribing",
          percent: Math.round(event.progress || 0),
          detail: event.detail || "",
          isError: Boolean(event.is_error),
        });
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (typeof unlisten === "function") unlisten();
    };
  }, [sermonId]);

  const isComplete = progressState.stage === "ready" || progressState.percent >= 100;
  const currentStageIndex = STAGES.findIndex((s) => s.key === progressState.stage);
  const stageIndex = currentStageIndex === -1 ? 1 : currentStageIndex;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="page-header">
        <div>
          <h1 className="text-base font-semibold text-primary">Processing Pipeline</h1>
          <p className="text-xs text-secondary mt-0.5">
            {sermon?.title || "Transcribing sermon recording…"}
          </p>
        </div>
      </header>

      <div className="page-content flex justify-center py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Progress Card */}
          <div className="border border-border rounded-md bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                {STAGES[stageIndex]?.label || "Processing…"}
              </span>
              <span className="font-mono text-xs font-bold text-accent">
                {progressState.percent}%
              </span>
            </div>

            {/* Progress Track */}
            <div className="download-bar-track">
              <div
                className="download-bar-fill"
                style={{ width: `${progressState.percent}%` }}
              />
            </div>

            {progressState.detail && (
              <p className="text-[11px] text-secondary font-mono">
                {progressState.detail}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="border border-border rounded-md bg-surface divide-y divide-border overflow-hidden">
            {STAGES.map((stg, i) => {
              const isDone = i < stageIndex || isComplete;
              const isActive = i === stageIndex && !isComplete;

              return (
                <div
                  key={stg.key}
                  className="px-4 py-2.5 flex items-center justify-between text-xs"
                >
                  <span
                    className={
                      isDone
                        ? "text-secondary line-through"
                        : isActive
                        ? "text-primary font-medium"
                        : "text-muted"
                    }
                  >
                    {stg.label}
                  </span>
                  <div>
                    {isDone ? (
                      <i className="bx bxs-check-circle text-success text-base" />
                    ) : isActive ? (
                      <i className="bx bx-loader-alt bx-spin text-accent text-base" />
                    ) : (
                      <i className="bx bx-circle text-muted text-base" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {isComplete ? (
            <div className="flex items-center gap-3 pt-2">
              <Btn
                variant="secondary"
                className="flex-1"
                onClick={() => navigate(`/transcript/${sermonId}`)}
              >
                <i className="bx bx-file text-sm" />
                <span>Read Manuscript</span>
              </Btn>
              <Btn
                variant="primary"
                className="flex-1"
                onClick={() => navigate(`/clips/${sermonId}`)}
              >
                <i className="bx bx-cut text-sm" />
                <span>Review Clips</span>
              </Btn>
            </div>
          ) : (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="text-xs text-secondary hover:text-primary underline underline-offset-4"
              >
                Return to library (pipeline continues in background)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
