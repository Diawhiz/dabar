import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, onPipelineProgress } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const STAGES = [
  { key: "downloading", label: "Loading sermon audio…", detail: "Retrieving audio stream or reading local file." },
  { key: "transcribing", label: "Transcribing the sermon…", detail: "Listening to every word with Whisper speech recognition." },
  { key: "detecting", label: "Finding key moments…", detail: "Analyzing teaching moments and theological highlights." },
  { key: "ready", label: "Your clips are ready.", detail: "Head to the clip studio to review, edit, and export." },
];

export default function Processing() {
  const { sermonId } = useParams();
  const [sermon, setSermon] = useState(null);
  const [currentStageKey, setCurrentStageKey] = useState("downloading");
  const [stageProgress, setStageProgress] = useState(10);
  const [statusDetail, setStatusDetail] = useState("");
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const navigate = useNavigate();

  function getStageIndex(key) {
    if (!key) return 0;
    const s = String(key).toLowerCase();
    if (s === "ready" || s.includes("complete")) return 3;
    if (s.includes("detect") || s.includes("process") || s.includes("clip")) return 2;
    if (s.includes("transcri")) return 1;
    return 0;
  }

  useEffect(() => {
    if (!sermonId) return;

    let unlistenFn = null;

    // Load initial sermon state from DB
    getSermon(sermonId)
      .then((data) => {
        if (data) {
          setSermon(data);
          const st = (data.status || "").toLowerCase();
          setCurrentStageKey(st);
          if (st === "ready") {
            setIsComplete(true);
            setStageProgress(100);
          } else if (st === "failed") {
            setError(data.error_message || "Processing failed.");
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch sermon:", err);
      });

    // Subscribe to live Tauri pipeline progress events
    onPipelineProgress((event) => {
      if (!event || event.sermon_id !== sermonId) return;

      if (event.is_error) {
        setError(event.detail || "Processing encountered an error.");
        setCurrentStageKey("failed");
      } else if (event.is_complete || event.stage === "ready") {
        setIsComplete(true);
        setCurrentStageKey("ready");
        setStageProgress(100);
        setStatusDetail(event.detail);
        // Refresh full sermon data from DB
        getSermon(sermonId).then((data) => { if (data) setSermon(data); });
      } else {
        setCurrentStageKey(event.stage);
        setStageProgress(event.progress || 50);
        if (event.detail) setStatusDetail(event.detail);
      }
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (typeof unlistenFn === "function") unlistenFn();
    };
  }, [sermonId]);

  const stageIndex = getStageIndex(currentStageKey);
  const currentStage = STAGES[stageIndex] || STAGES[0];
  const overallProgress = isComplete ? 100 : Math.min(95, Math.round(((stageIndex + stageProgress / 100) / STAGES.length) * 100));

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {isComplete ? "All done." : "Dabar is working…"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {sermon?.title || sermon?.youtube_url || "Processing your sermon."}
        </p>
      </div>

      {error && (
        <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember flex items-start gap-2">
          <i className="bx bx-error-circle text-lg shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-card border border-border bg-paper p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{currentStage.label}</span>
          <span className="text-sm font-bold text-ember">{overallProgress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-ember transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="text-xs text-muted">{statusDetail || currentStage.detail}</p>
      </div>

      {/* Stage checklist */}
      <div className="space-y-3 px-1">
        {STAGES.map((stage, i) => {
          const done = i < stageIndex || isComplete;
          const active = i === stageIndex && !isComplete;
          return (
            <div key={stage.key} className="flex items-center gap-3">
              {done ? (
                <i className="bx bx-check-circle text-xl text-ember" aria-label={`${stage.label} complete`} />
              ) : active ? (
                <i className="bx bx-loader-alt bx-spin text-xl text-ember" aria-label={`${stage.label} in progress`} />
              ) : (
                <i className="bx bx-circle text-xl text-border" aria-label={`${stage.label} pending`} />
              )}
              <span className={`text-sm ${done ? "text-muted line-through" : active ? "text-ink font-medium" : "text-muted/60"}`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTA when complete */}
      {isComplete && (
        <Btn onClick={() => navigate(`/clips/${sermonId}`)} size="lg" className="w-full">
          <i className="bx bx-film text-lg" aria-hidden="true" />
          Review clips & transcript
        </Btn>
      )}

      {/* Transcript preview */}
      {sermon?.transcript_segments && sermon.transcript_segments.length > 0 && (
        <div className="rounded-card bg-surface p-5 border border-border">
          <p className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Incoming Transcript</p>
          <p className="text-sm text-muted leading-relaxed italic">
            "{sermon.transcript_segments.slice(0, 8).map((s) => s.text).join(" ").slice(0, 300)}
            {sermon.transcript_segments.map((s) => s.text).join(" ").length > 300 ? "…" : ""}"
          </p>
        </div>
      )}
    </div>
  );
}
