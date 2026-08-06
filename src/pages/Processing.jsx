import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon } from "../lib/api.js";
import Waveform from "../components/Waveform.jsx";
import Btn from "../components/Btn.jsx";

const STAGES = [
  { key: "transcribing", label: "Transcribing the sermon…", detail: "Dabar is listening to every word." },
  { key: "analyzing", label: "Finding key moments…", detail: "Looking for the quotes and teaching points that hit hardest." },
  { key: "clipping", label: "Cutting clips…", detail: "Shaping each moment into a shareable vertical video." },
  { key: "ready", label: "Your clips are ready.", detail: "Head to the clip studio to review, edit, and export." },
];

export default function Processing() {
  const { sermonId } = useParams();
  const [sermon, setSermon] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const pollRef = useRef(null);

  // Determine current stage from sermon status
  function getStageIndex(status) {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s === "ready" || s.includes("complete")) return 3;
    if (s.includes("clip") || s.includes("highlight")) return 2;
    if (s.includes("transcri")) return 1;
    return 0;
  }

  useEffect(() => {
    if (!sermonId) return;

    function fetchSermon() {
      getSermon(sermonId)
        .then((data) => {
          setSermon(data);
          const s = (data?.status || "").toLowerCase();
          if (s === "ready" || s.includes("complete")) {
            clearInterval(pollRef.current);
          }
        })
        .catch((err) => {
          setError(err.message || "We lost track of this sermon — try refreshing.");
        });
    }

    fetchSermon();
    pollRef.current = setInterval(fetchSermon, 4000);

    return () => clearInterval(pollRef.current);
  }, [sermonId]);

  const stageIndex = getStageIndex(sermon?.status);
  const currentStage = STAGES[stageIndex];
  const progress = Math.min(100, Math.round(((stageIndex + 1) / STAGES.length) * 100));
  const isComplete = stageIndex >= 3;

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

      {/* The waveform — loading or breaking depending on stage */}
      <div className="py-4">
        <Waveform mode={isComplete ? "breaking" : "loading"} barCount={48} />
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ink">{currentStage.label}</span>
          <span className="text-sm font-medium text-ember">{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-ember transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{currentStage.detail}</p>
      </div>

      {/* Stage checklist */}
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const done = i < stageIndex;
          const active = i === stageIndex;
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
          Review your clips
        </Btn>
      )}

      {/* Transcript preview */}
      {sermon?.transcript && (
        <>
          <Waveform mode="divider" />
          <div className="rounded-card bg-surface px-5 py-4">
            <p className="text-xs font-medium text-ink mb-2">Transcript preview</p>
            <p className="text-sm text-muted leading-relaxed italic">
              "{sermon.transcript.slice(0, 400)}{sermon.transcript.length > 400 ? "…" : ""}"
            </p>
          </div>
        </>
      )}
    </div>
  );
}
