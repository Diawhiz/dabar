import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSermon, onPipelineProgress } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

const STAGES = [
  {
    key: "downloading",
    label: "Preparing Audio",
    sub: "Importing sermon recording and preparing audio for transcription",
    icon: "bx-cloud-download",
    tickers: [
      "Importing sermon recording…",
      "Optimizing audio for clear speech recognition…",
      "Preparing sermon message…",
    ],
  },
  {
    key: "transcribing",
    label: "Transcribing Sermon",
    sub: "Writing out the sermon word-for-word with accurate timestamps",
    icon: "bx-voice",
    tickers: [
      "Listening to preaching audio…",
      "Transcribing sermon paragraphs with exact timestamps…",
      "Formatting names, places, and biblical terms…",
      "Aligning spoken sermon lines…",
    ],
  },
  {
    key: "detecting",
    label: "Finding Key Moments & Chapters",
    sub: "Highlighting key sermon teaching clips and creating topic chapters",
    icon: "bx-brain",
    tickers: [
      "Finding powerful sermon quotes and key teaching moments…",
      "Finding biblical Scripture references…",
      "Creating topic chapters for easy listening…",
    ],
  },
  {
    key: "ready",
    label: "Ready to Review & Share",
    sub: "Clips surfaced, chapters organized, and manuscript ready",
    icon: "bx-check-double",
    tickers: [
      "Sermon clips ready.",
      "Topic chapters ready.",
      "Full transcript ready.",
    ],
  },
];

export default function Processing() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [progressState, setProgressState] = useState({
    stage: "downloading",
    percent: 15,
    detail: "Preparing sermon recording…",
    isError: false,
  });

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Status ticker cycle
  useEffect(() => {
    const ticker = setInterval(() => {
      setTickerIndex((prev) => prev + 1);
    }, 3200);
    return () => clearInterval(ticker);
  }, []);

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
            detail: "Processing complete. Your clips and manuscript are ready.",
            isError: false,
          });
        } else if (status.includes("transcrib")) {
          setProgressState({
            stage: "transcribing",
            percent: 50,
            detail: "Transcribing preaching audio…",
            isError: false,
          });
        } else if (status.includes("detect")) {
          setProgressState({
            stage: "detecting",
            percent: 80,
            detail: "Finding key moments and chapters…",
            isError: false,
          });
        }
      }
    });

    onPipelineProgress((event) => {
      if (event && event.sermon_id === sermonId) {
        setProgressState({
          stage: event.stage || "transcribing",
          percent: Math.max(10, Math.min(100, Math.round(event.progress || 0))),
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
  const activeStageObj = STAGES[stageIndex] || STAGES[0];
  const activeTicker = activeStageObj.tickers[tickerIndex % activeStageObj.tickers.length];

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 space-y-6 animate-in fade-in duration-300">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="pt-2">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-primary truncate max-w-2xl">
            {sermon?.title || "Transcribing Sermon…"}
          </h1>
          <p className="text-secondary text-xs sm:text-sm font-normal">
            Automated speech transcription, chapter structuring, and social media clip highlights.
          </p>
        </div>
      </header>

      {/* ── Main Processing Showcase Stage ─────────────────────────── */}
      <div className="flex justify-center py-4">
        <div className="w-full max-w-xl space-y-5">
          {/* Main Card */}
          <div className="studio-card p-6 space-y-6 relative overflow-hidden">
            {/* Top Row: Current Step & Percentage */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange" />
                  <span className="text-xs font-semibold text-primary">
                    Step {stageIndex + 1} of 4 · {activeStageObj.label}
                  </span>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {activeStageObj.sub}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-2xl font-bold text-orange font-editorial">
                  {progressState.percent}%
                </span>
              </div>
            </div>

            {/* Calming Animated Audio Waveform */}
            <div className="flex items-center justify-center gap-1.5 h-12 py-2 bg-base/60 rounded-lg border border-border px-3">
              {Array.from({ length: 24 }, (_, i) => {
                const isCenter = Math.abs(i - 12) < 6;
                const baseHeight = isCenter ? 65 : 35;
                const animDelay = (i * 0.09).toFixed(2);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-600 to-orange rounded-full transition-all duration-300"
                    style={{
                      height: isComplete ? "20%" : `${Math.max(15, (baseHeight + (Math.sin(elapsedSeconds * 3 + i) * 30)))}%`,
                      opacity: isComplete ? 0.3 : 0.5 + (i % 3) * 0.25,
                      animation: isComplete ? "none" : `pulse 1.4s infinite ease-in-out ${animDelay}s`,
                    }}
                  />
                );
              })}
            </div>

            {/* Smooth Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-surface-elevated h-2.5 rounded-full overflow-hidden border border-border">
                <div
                  className="bg-gradient-to-r from-blue-600 to-orange h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressState.percent}%` }}
                />
              </div>

              {/* Status Message */}
              <div className="flex items-center justify-between text-xs text-secondary pt-1">
                <span className="flex items-center gap-2 truncate text-primary font-medium">
                  <i className="bx bx-loader-alt bx-spin text-accent" />
                  <span className="truncate">{progressState.detail || activeTicker}</span>
                </span>
                <span className="text-muted shrink-0 pl-2">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
            </div>

            {/* Error state */}
            {progressState.isError && (
              <div className="p-3.5 rounded-lg border border-danger/40 bg-danger-muted text-xs space-y-2">
                <div className="flex items-center gap-2 text-danger font-semibold">
                  <i className="bx bx-error-circle text-base" />
                  <span>Processing Notice</span>
                </div>
                <p className="text-secondary leading-relaxed text-xs">
                  {progressState.detail || "An error occurred during sermon processing."}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Btn size="xs" variant="primary" onClick={() => window.location.reload()}>
                    Retry
                  </Btn>
                  <Btn size="xs" variant="secondary" onClick={() => navigate("/settings")}>
                    Check Settings
                  </Btn>
                </div>
              </div>
            )}
          </div>

          {/* Clean Step Checklist */}
          <div className="studio-card divide-y divide-border overflow-hidden">
            {STAGES.map((stg, i) => {
              const isDone = i < stageIndex || isComplete;
              const isActive = i === stageIndex && !isComplete;

              return (
                <div
                  key={stg.key}
                  className={`px-4 py-3.5 flex items-center justify-between transition-colors ${
                    isActive ? "bg-accent-muted/10" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all ${
                        isDone
                          ? "bg-success/15 text-success border border-success/30"
                          : isActive
                          ? "bg-accent text-accent-fg font-bold shadow-xs"
                          : "bg-surface-elevated text-muted border border-border"
                      }`}
                    >
                      <i className={`bx ${stg.icon}`} />
                    </div>
                    <div>
                      <p
                        className={`text-xs font-medium ${
                          isDone
                            ? "text-muted line-through"
                            : isActive
                            ? "text-primary font-bold"
                            : "text-secondary"
                        }`}
                      >
                        {stg.label}
                      </p>
                      <p className="text-[11px] text-muted line-clamp-1">
                        {stg.sub}
                      </p>
                    </div>
                  </div>

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

          {/* Action CTAs */}
          {isComplete ? (
            <div className="flex items-center gap-3 pt-2">
              <Btn
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => navigate(`/transcript/${sermonId}`)}
              >
                <i className="bx bx-book-open text-base text-accent" />
                <span>Read Transcript</span>
              </Btn>
              <Btn
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => navigate(`/clips/${sermonId}`)}
              >
                <i className="bx bx-film text-base" />
                <span>View Clips</span>
              </Btn>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-secondary pt-2 px-1">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="text-secondary hover:text-accent font-medium underline underline-offset-4 transition-colors"
              >
                ← Return to Library (runs in background)
              </button>

              <button
                type="button"
                onClick={() => navigate(`/transcript/${sermonId}`)}
                className="text-muted hover:text-primary transition-colors"
              >
                Read Transcript →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
