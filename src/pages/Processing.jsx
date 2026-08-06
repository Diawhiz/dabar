import { CheckCircle2, Download, FileText, Sparkles, Wand2, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../components/Button.jsx";
import { getSermon } from "../lib/api.js";

const stageDefinitions = [
  { key: "downloading", label: "Ingesting Sermon Audio", detail: "Connecting to sermon video stream and preparing audio signal.", icon: Download },
  { key: "transcribing", label: "Speech-to-Text Transcription", detail: "Generating timestamped sermon transcript.", icon: FileText },
  { key: "ready", label: "AI Key Moment Mining", detail: "Identifying conviction points, key illustrations, and shareable quotes.", icon: Sparkles },
];

export default function Processing() {
  const { sermonId } = useParams();
  const [sermon, setSermon] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(sermonId));

  useEffect(() => {
    if (!sermonId) return;

    let isMounted = true;

    async function fetchSermonStatus() {
      try {
        const data = await getSermon(sermonId);
        if (isMounted) {
          setSermon(data);
          setIsLoading(false);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message);
          setIsLoading(false);
        }
      }
    }

    fetchSermonStatus();

    const interval = setInterval(() => {
      if (sermon?.status !== "ready" && sermon?.status !== "failed") {
        fetchSermonStatus();
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sermonId, sermon?.status]);

  const stages = useMemo(() => {
    const statusMap = {
      queued: 0,
      downloading: 0,
      transcribing: 1,
      detecting: 2,
      ready: 3,
    };

    const currentIdx = statusMap[sermon?.status] ?? 0;

    return stageDefinitions.map((stage, index) => {
      if (sermon?.status === "ready") return { ...stage, state: "complete" };
      if (sermon?.status === "failed") return { ...stage, state: "upcoming" };
      if (index < currentIdx) return { ...stage, state: "complete" };
      if (index === currentIdx) return { ...stage, state: "active" };
      return { ...stage, state: "upcoming" };
    });
  }, [sermon?.status]);

  const progress = sermon?.status === "ready" ? 100 : sermon?.status === "transcribing" ? 65 : sermon?.status === "downloading" ? 30 : 15;

  const heading = sermon?.title || sermon?.youtube_url || "Sermon Submitted";
  const description =
    sermon?.status === "queued"
      ? "Dabar has received the link and queued it for audio processing."
      : sermon?.status === "ready"
      ? "Processing complete! Sermon key moments are ready for review."
      : "Dabar is analyzing sermon audio, extracting high-impact quotes, and preparing social clips.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl py-6"
    >
      {/* Header Banner */}
      <div className="rounded-3xl border border-signal-border bg-signal-panel p-8 text-text-primary shadow-signal">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-pulse-gold/30 bg-pulse-gold/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-pulse-gold">
              <Wand2 size={14} className={sermon?.status === "ready" ? "" : "animate-spin"} />
              Status: {sermon?.status || "Processing"}
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold leading-snug sm:text-3xl">
              {isLoading ? "Loading sermon..." : heading}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{description}</p>
          </div>

          <div className="shrink-0 text-center md:text-right font-mono">
            <p className="font-display text-4xl font-bold text-pulse-gold">{progress}%</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-text-muted">
              {sermon?.status === "ready" ? "Complete" : "Processing"}
            </p>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-signal-bg">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full rounded-full bg-pulse-gold shadow-pulse"
          />
        </div>
      </div>

      {error && (
        <div className="my-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      {/* Live AI Speech Ticker */}
      {sermon?.transcript && (
        <div className="my-8 rounded-2xl border border-signal-border bg-signal-panel p-5 shadow-signal">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-pulse-gold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Extracted Sermon Transcript</span>
          </div>
          <p className="mt-2 font-sans text-sm leading-relaxed italic text-text-secondary">
            "{sermon.transcript.slice(0, 300)}..."
          </p>
        </div>
      )}

      {/* Processing Stages Breakdown */}
      <section className="mt-8 rounded-3xl border border-signal-border bg-signal-panel px-6 py-8 shadow-signal sm:px-10">

        <div className="space-y-0">
          {stages.map(({ label, detail, icon: Icon, state }, index) => (
            <div key={label} className="grid grid-cols-[3.5rem_1fr] gap-5">
              <div className="relative flex justify-center">
                {index < stages.length - 1 && <div className="absolute top-14 h-full w-0.5 bg-signal-border" />}
                <div
                  className={[
                    "relative z-10 grid h-12 w-12 place-items-center rounded-xl border transition-colors duration-200",
                    state === "complete" && "border-pulse-gold bg-pulse-gold text-signal-bg shadow-pulse font-bold",
                    state === "active" && "border-pulse-gold bg-signal-bg text-pulse-gold shadow-pulse animate-pulse",
                    state === "upcoming" && "border-signal-border bg-signal-bg text-text-muted",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {state === "complete" ? <CheckCircle2 size={22} /> : <Icon size={21} />}
                </div>
              </div>

              <div className="pb-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-xl font-bold text-text-primary">{label}</h2>
                  <span
                    className={[
                      "font-mono text-xs font-bold uppercase tracking-wider",
                      state === "complete" && "text-pulse-gold",
                      state === "active" && "text-pulse-amber font-extrabold",
                      state === "upcoming" && "text-text-muted",
                    ].join(" ")}
                  >
                    {state === "active" ? "In Progress..." : state}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t border-signal-border pt-6 gap-4">
          <p className="font-mono text-xs text-text-muted">
            You can review generated key moments as soon as transcript processing completes.
          </p>
          <Link to="/highlights">
            <Button variant="gold" className="px-6 font-bold shadow-pulse">
              Review Highlights <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>
    </motion.div>
  );
}

