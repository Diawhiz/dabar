import { useEffect, useMemo, useState } from "react";
import { Clock3, Scissors, Sparkles, Play, Pause, PlayCircle, Search, Filter } from "lucide-react";
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
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'highlights'
  const [searchQuery, setSearchQuery] = useState("");

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
          console.warn("Could not fetch transcript segments for latest sermon:", err.message);
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

  const filteredSegments = useMemo(() => {
    let result = segments;

    if (filterMode === "highlights") {
      result = result.filter((s) => s.is_highlight);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => s.text.toLowerCase().includes(q));
    }

    return result;
  }, [segments, filterMode, searchQuery]);

  function toggleAudio(id) {
    setPlayingId(playingId === id ? null : id);
  }

  const highlightCount = useMemo(() => segments.filter((s) => s.is_highlight).length, [segments]);

  return (
    <div className="mx-auto max-w-6xl py-6">
      <PageHeader
        eyebrow="Sermon Transcript & Moments"
        title={sermonTitle ? `Transcript: ${sermonTitle}` : "Sermon Highlights & Transcript"}
        description="Search through the full timestamped sermon transcript or view AI-detected conviction moments ready for short-form clips."
        action={
          <Link to="/clips">
            <Button variant="gold" className="px-7">
              <Scissors size={18} />
              Studio Clip Generator
            </Button>
          </Link>
        }
      />

      {/* FILTER & SEARCH CONTROLS BAR */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-linen pb-5">
        {/* Filter Mode Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={[
              "rounded-full px-5 py-2 text-xs font-bold transition-all duration-200",
              filterMode === "all"
                ? "bg-navy text-cream shadow-navyGlow"
                : "bg-cream text-walnut hover:bg-parchment hover:text-navy border border-linen",
            ].join(" ")}
          >
            Full Sermon ({segments.length})
          </button>
          <button
            onClick={() => setFilterMode("highlights")}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold transition-all duration-200",
              filterMode === "highlights"
                ? "bg-gold text-navy shadow-glow"
                : "bg-cream text-walnut hover:bg-parchment hover:text-navy border border-linen",
            ].join(" ")}
          >
            <Sparkles size={14} className={filterMode === "highlights" ? "text-navy" : "text-gold"} />
            AI Key Moments ({highlightCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={17} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            className="h-10 w-full rounded-full border border-linen bg-cream pl-11 pr-4 text-xs font-medium text-umber shadow-soft outline-none focus:border-gold/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-linen bg-cream p-12 text-center text-sm font-semibold text-walnut">
          Loading full sermon transcript from database...
        </div>
      ) : filteredSegments.length > 0 ? (
        <section className="space-y-4">
          {filteredSegments.map((seg, idx) => {
            const isPlaying = playingId === idx;
            const timestamp = `${formatSeconds(seg.start)} - ${formatSeconds(seg.end)}`;

            return (
              <article
                key={idx}
                className={[
                  "group rounded-3xl border p-6 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm",
                  seg.is_highlight
                    ? "border-gold/60 bg-gradient-to-r from-cream via-cream to-gold/5"
                    : "border-linen/90 bg-cream",
                ].join(" ")}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2 lg:max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3.5 py-1 text-xs font-bold text-navy">
                        <Clock3 size={14} className="text-gold" />
                        {timestamp}
                      </span>
                      {seg.is_highlight && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-navy">
                          <Sparkles size={13} className="text-gold-dark" />
                          {seg.highlight_title || "Key Highlight"}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-walnut/60">
                        Segment #{seg.segment_index ?? idx + 1}
                      </span>
                    </div>

                    <p className="text-base leading-relaxed text-umber">
                      "{seg.text}"
                    </p>
                  </div>

                  <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-end lg:justify-center">
                    <button
                      type="button"
                      onClick={() => toggleAudio(idx)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-linen bg-parchment px-4 text-xs font-bold text-navy transition-colors hover:bg-gold/20"
                    >
                      {isPlaying ? <Pause size={15} className="text-gold" /> : <Play size={15} className="text-gold" />}
                      <span>{isPlaying ? "Pause" : "Preview Audio"}</span>
                    </button>

                    <Link to="/clips" state={{ quote: seg.text }}>
                      <Button className="h-10 px-5 text-xs">
                        <Scissors size={15} />
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
          <p className="mt-4 font-serif text-xl font-semibold text-navy">No matching transcript segments found</p>
          <p className="mt-1 text-sm text-walnut">Try clearing your search query or switching to "Full Sermon".</p>
        </div>
      )}
    </div>
  );
}
