import { useEffect, useState } from "react";
import { Clock3, Scissors, Sparkles, Play, Pause, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { listSermons, getTranscript } from "../lib/api.js";

function formatSeconds(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Highlights() {
  const [segments, setSegments] = useState([]);
  const [sermonTitle, setSermonTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    listSermons()
      .then(async (sermons) => {
        if (!isMounted || !sermons.length) {
          setIsLoading(false);
          return;
        }

        const latestSermon = sermons[0];
        setSermonTitle(latestSermon.title || latestSermon.youtube_url);

        try {
          const transcriptData = await getTranscript(latestSermon.id);
          if (isMounted && transcriptData?.segments) {
            setSegments(transcriptData.segments);
          }
        } catch (err) {
          console.warn("No transcript segments found for latest sermon:", err.message);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch sermons:", err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function toggleAudio(id) {
    setPlayingId(playingId === id ? null : id);
  }

  return (
    <div className="mx-auto max-w-6xl py-6">
      <PageHeader
        eyebrow="AI Moment Detection"
        title={sermonTitle ? `Highlights: ${sermonTitle}` : "Sermon Highlights"}
        description="Dabar transcribes and segments the sermon into timestamped teaching quotes ready for media production."
        action={
          <Link to="/clips">
            <Button variant="gold" className="px-7">
              <Scissors size={18} />
              Studio Clip Generator
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="rounded-3xl border border-linen bg-cream p-12 text-center text-sm font-semibold text-walnut">
          Loading transcript segments from database...
        </div>
      ) : segments.length > 0 ? (
        <section className="space-y-6">
          {segments.map((seg, idx) => {
            const isPlaying = playingId === idx;
            const timestamp = `${formatSeconds(seg.start)} - ${formatSeconds(seg.end)}`;

            return (
              <article
                key={idx}
                className="group rounded-3xl border border-linen/90 bg-cream p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-warm"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-3 lg:max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3.5 py-1 text-xs font-bold text-navy">
                        <Clock3 size={14} className="text-gold" />
                        {timestamp}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold-dark">
                        <Sparkles size={13} />
                        Segment #{seg.segment_index ?? idx + 1}
                      </span>
                    </div>

                    <blockquote className="rounded-2xl border-l-4 border-gold bg-parchment/60 p-4 text-base italic leading-relaxed text-umber">
                      "{seg.text}"
                    </blockquote>
                  </div>

                  <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-end lg:justify-center">
                    <button
                      type="button"
                      onClick={() => toggleAudio(idx)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-linen bg-parchment px-4 text-xs font-bold text-navy transition-colors hover:bg-gold/20"
                    >
                      {isPlaying ? <Pause size={16} className="text-gold" /> : <Play size={16} className="text-gold" />}
                      <span>{isPlaying ? "Pause" : "Preview Segment"}</span>
                    </button>

                    <Link to="/clips" state={{ quote: seg.text }}>
                      <Button className="h-11 px-6">
                        <Scissors size={16} />
                        Create Clip
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="rounded-3xl border border-linen bg-cream p-12 text-center">
          <PlayCircle size={36} className="mx-auto text-gold/60" />
          <p className="mt-4 font-serif text-xl font-semibold text-navy">No transcript segments available yet</p>
          <p className="mt-1 text-sm text-walnut">Process a sermon link first to view extracted teaching moments!</p>
        </div>
      )}
    </div>
  );
}
