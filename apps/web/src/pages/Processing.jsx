import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, onPipelineProgress } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const STAGES = [
  { key: "downloading", label: "Preparing sermon recording & audio streams" },
  { key: "transcribing", label: "Transcribing speech via Groq Whisper Large v3 Turbo" },
  { key: "detecting", label: "Analyzing preaching moments & Scripture via GPT-OSS" },
  { key: "ready", label: "Clips & full manuscript illuminated" },
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="scripture-badge text-[10px]">
              LIVE PROCESSING
            </span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-primary">
            {sermon?.title || "Transcribing Sermon Recording…"}
          </h1>
        </div>
      </header>

      <div className="page-content flex justify-center py-12">
        <div className="w-full max-w-lg space-y-6">
          {/* Progress Card */}
          <div className="pulpit-hero p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-primary block">
                  {STAGES[stageIndex]?.label || "Processing sermon…"}
                </span>
                <span className="text-[11px] text-muted font-mono-code">
                  Stage {stageIndex + 1} of 4
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="audio-equalizer">
                  <span className="audio-equalizer-bar" />
                  <span className="audio-equalizer-bar" />
                  <span className="audio-equalizer-bar" />
                </div>
                <span className="font-mono-code text-base font-bold text-accent">
                  {progressState.percent}%
                </span>
              </div>
            </div>

            {/* Progress Track */}
            <div className="download-bar-track">
              <div
                className="download-bar-fill"
                style={{ width: `${progressState.percent}%` }}
              />
            </div>

            {progressState.detail && (
              <p className="text-xs text-secondary font-mono-code bg-surface/60 p-2.5 rounded-lg border border-border">
                {progressState.detail}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="border border-border rounded-xl bg-surface divide-y divide-border overflow-hidden shadow-xs">
            {STAGES.map((stg, i) => {
              const isDone = i < stageIndex || isComplete;
              const isActive = i === stageIndex && !isComplete;

              return (
                <div
                  key={stg.key}
                  className="px-5 py-3.5 flex items-center justify-between text-xs"
                >
                  <span
                    className={
                      isDone
                        ? "text-muted line-through"
                        : isActive
                        ? "text-primary font-semibold"
                        : "text-secondary"
                    }
                  >
                    {stg.label}
                  </span>
                  <div>
                    {isDone ? (
                      <i className="bx bxs-check-circle text-success text-lg" />
                    ) : isActive ? (
                      <i className="bx bx-loader-alt bx-spin text-accent text-lg" />
                    ) : (
                      <i className="bx bx-circle text-muted text-lg" />
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
                size="lg"
                className="flex-1"
                onClick={() => navigate(`/transcript/${sermonId}`)}
              >
                <i className="bx bx-book-open text-base text-accent" />
                <span>Read Manuscript</span>
              </Btn>
              <Btn
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => navigate(`/clips/${sermonId}`)}
              >
                <i className="bx bx-film text-base" />
                <span>Studio Clips & Reels</span>
              </Btn>
            </div>
          ) : (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="text-xs text-secondary hover:text-accent font-medium underline underline-offset-4"
              >
                Return to library (processing runs safely in the background)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
