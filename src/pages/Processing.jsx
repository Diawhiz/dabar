import { CheckCircle2, Download, FileText, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../components/Button.jsx";
import { getSermon } from "../lib/api.js";

const stageDefinitions = [
  { key: "downloading", label: "Downloading", detail: "Fetching the full sermon from YouTube.", icon: Download },
  { key: "transcribing", label: "Transcribing", detail: "Listening carefully and preparing searchable text.", icon: FileText },
  { key: "detecting", label: "Detecting Highlights", detail: "Finding moments with clarity, conviction, and care.", icon: Sparkles },
];

export default function Processing() {
  const { sermonId } = useParams();
  const [sermon, setSermon] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(sermonId));

  useEffect(() => {
    if (!sermonId) return;

    let isMounted = true;
    setIsLoading(true);
    setError("");

    getSermon(sermonId)
      .then((data) => {
        if (isMounted) setSermon(data);
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sermonId]);

  const stages = useMemo(() => {
    const activeIndex = stageDefinitions.findIndex((stage) => stage.key === sermon?.status);

    return stageDefinitions.map((stage, index) => {
      if (sermon?.status === "ready") return { ...stage, state: "complete" };
      if (sermon?.status === "failed") return { ...stage, state: "upcoming" };
      if (activeIndex === -1) return { ...stage, state: index === 0 ? "active" : "upcoming" };
      if (index < activeIndex) return { ...stage, state: "complete" };
      if (index === activeIndex) return { ...stage, state: "active" };
      return { ...stage, state: "upcoming" };
    });
  }, [sermon?.status]);

  const heading = sermon?.title || "Sermon submitted";
  const description =
    sermon?.status === "queued"
      ? "Dabar has received the link and queued it for processing."
      : "Dabar is preparing the transcript and listening for moments your church can carry into the week.";

  return (
    <div className="mx-auto max-w-4xl py-8">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-gold">Processing sermon</p>
      <h1 className="font-serif text-5xl font-semibold leading-tight text-navy sm:text-6xl">
        {isLoading ? "Loading sermon..." : heading}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-walnut">
        {description}
      </p>
      {sermon?.youtube_url && <p className="mt-3 break-all text-sm font-semibold text-gold">{sermon.youtube_url}</p>}
      {error && <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>}

      <section className="mt-14 rounded-[2rem] bg-cream px-6 py-8 shadow-warm sm:px-10">
        <div className="space-y-0">
          {stages.map(({ label, detail, icon: Icon, state }, index) => (
            <div key={label} className="grid grid-cols-[3rem_1fr] gap-5">
              <div className="relative flex justify-center">
                {index < stages.length - 1 && <div className="absolute top-12 h-full w-px bg-linen" />}
                <div
                  className={[
                    "relative z-10 grid h-12 w-12 place-items-center rounded-full",
                    state === "complete" && "bg-gold text-cream",
                    state === "active" && "soft-pulse bg-navy text-cream",
                    state === "upcoming" && "bg-parchment text-walnut",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {state === "complete" ? <CheckCircle2 size={22} /> : <Icon size={21} />}
                </div>
              </div>
              <div className="pb-10">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-2xl font-semibold text-navy">{label}</h2>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold">
                    {state === "active" ? "In progress" : state}
                  </span>
                </div>
                <p className="mt-2 text-base leading-7 text-walnut">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Link to="/highlights">
            <Button>Review Highlights</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
