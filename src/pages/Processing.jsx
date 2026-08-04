import { CheckCircle2, Download, FileText, Sparkles, Wand2, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../components/Button.jsx";
import { getSermon } from "../lib/api.js";

const stageDefinitions = [
  { key: "downloading", label: "Downloading Audio", detail: "Extracting audio stream from YouTube source.", icon: Download },
  { key: "transcribing", label: "Speech Transcription", detail: "Generating timestamped Whisper transcript using AI.", icon: FileText },
  { key: "ready", label: "Highlights Ready", detail: "Scoring key teaching moments, invitations, and illustrations.", icon: Sparkles },
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

    // Poll every 3 seconds while sermon status is processing
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
      ? "Dabar has received the link and queued it for processing."
      : sermon?.status === "ready"
      ? "Transcription complete! Your sermon highlights are ready for review."
      : "Dabar is analyzing speech cadence, identifying high-impact teaching quotes, and assembling social clips.";

  return (
    <div className="mx-auto max-w-4xl py-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-gold/20 bg-gradient-to-r from-navy via-navy to-navy-dark p-8 text-cream shadow-navyGlow">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-light">
              <Wand2 size={14} className={sermon?.status === "ready" ? "" : "animate-spin"} />
              Status: {sermon?.status || "Processing"}
            </div>
            <h1 className="mt-3 font-serif text-3xl font-bold leading-snug sm:text-4xl">
              {isLoading ? "Loading sermon..." : heading}
            </h1>
            <p className="mt-2 text-sm text-cream/75">{description}</p>
          </div>

          <div className="shrink-0 text-center md:text-right">
            <p className="font-serif text-5xl font-bold text-gold-light">{progress}%</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-cream/60">
              {sermon?.status === "ready" ? "Complete" : "In Progress"}
            </p>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-cream/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold via-gold-light to-amber-300 transition-all duration-500 shadow-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="my-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Live AI Speech Ticker */}
      {sermon?.transcript && (
        <div className="my-8 rounded-2xl border border-linen bg-cream p-5 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Extracted Sermon Transcript</span>
          </div>
          <p className="mt-2 font-serif text-lg italic text-walnut">
            "{sermon.transcript.slice(0, 300)}..."
          </p>
        </div>
      )}

      {/* Processing Stages Breakdown */}
      <section className="mt-8 rounded-3xl border border-linen bg-cream px-6 py-8 shadow-warm sm:px-10">
        <div className="space-y-0">
          {stages.map(({ label, detail, icon: Icon, state }, index) => (
            <div key={label} className="grid grid-cols-[3.5rem_1fr] gap-5">
              <div className="relative flex justify-center">
                {index < stages.length - 1 && <div className="absolute top-14 h-full w-0.5 bg-linen" />}
                <div
                  className={[
                    "relative z-10 grid h-14 w-14 place-items-center rounded-2xl transition-all duration-300",
                    state === "complete" && "bg-gold text-cream shadow-glow",
                    state === "active" && "soft-pulse bg-navy text-cream shadow-navyGlow",
                    state === "upcoming" && "bg-parchment text-walnut/60",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {state === "complete" ? <CheckCircle2 size={24} /> : <Icon size={23} />}
                </div>
              </div>

              <div className="pb-10">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-2xl font-semibold text-navy">{label}</h2>
                  <span
                    className={[
                      "text-xs font-bold uppercase tracking-wider",
                      state === "complete" && "text-gold",
                      state === "active" && "text-navy font-extrabold",
                      state === "upcoming" && "text-walnut/50",
                    ].join(" ")}
                  >
                    {state === "active" ? "In Progress..." : state}
                  </span>
                </div>
                <p className="mt-2 text-base leading-relaxed text-walnut">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-linen pt-6">
          <p className="text-xs font-semibold text-walnut/70">
            You can review generated moments as soon as detection completes.
          </p>
          <Link to="/highlights">
            <Button variant="gold" className="px-7">
              Review Highlights <ArrowRight size={17} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
