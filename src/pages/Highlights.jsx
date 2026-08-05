import { useEffect, useMemo, useState } from "react";
import { Clock3, Scissors, Sparkles, Play, Pause, Search, Volume2, X } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { listSermons, getTranscript } from "../lib/api.js";

function formatSeconds(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function Highlights() {
  const [segments, setSegments] = useState([]);
  const [sermonTitle, setSermonTitle] = useState("");
  const [sermonYoutubeUrl, setSermonYoutubeUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [playingSegment, setPlayingSegment] = useState(null);
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
        setSermonYoutubeUrl(latestSermon.youtube_url);

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

  const videoId = extractVideoId(sermonYoutubeUrl);

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

  function toggleAudio(seg) {
    if (playingSegment && playingSegment.start === seg.start) {
      setPlayingSegment(null);
    } else {
      setPlayingSegment(seg);
    }
  }

  const highlightCount = useMemo(() => segments.filter((s) => s.is_highlight).length, [segments]);

  return (
    <div className="mx-auto max-w-6xl py-6 pb-24">
      <PageHeader
        eyebrow="Sermon Transcript & Moments"
        title={sermonTitle ? `Transcript: ${sermonTitle}` : "Sermon Highlights & Transcript"}
        description="Search through the full timestamped sermon transcript or view AI-detected conviction moments ready for short-form clips."
        action={
          <Link to="/clips">
            <Button variant="gold" className="px-7 shadow-glow">
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
            const isPlaying = playingSegment && playingSegment.start === seg.start;
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
                        Segment #{seg.segment_index !== undefined ? seg.segment_index + 1 : idx + 1}
                      </span>
                    </div>

                    <p className="text-base leading-relaxed text-umber">
                      "{seg.text}"
                    </p>
                  </div>

                  <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-end lg:justify-center">
                    <button
                      type="button"
                      onClick={() => toggleAudio(seg)}
                      className={[
                        "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-linen px-4 text-xs font-bold transition-all duration-200",
                        isPlaying
                          ? "bg-navy text-cream shadow-navyGlow"
                          : "bg-parchment text-navy hover:bg-gold/20",
                      ].join(" ")}
                    >
                      {isPlaying ? <Pause size={15} className="text-gold" /> : <Play size={15} className="text-gold" />}
                      <span>{isPlaying ? "Stop Audio" : "Preview Audio"}</span>
                    </button>

                    <Link
                      to="/clips"
                      state={{
                        quote: seg.text,
                        start: seg.start,
                        end: seg.end,
                        title: sermonTitle,
                        youtube_url: sermonYoutubeUrl,
                      }}
                    >
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
        <div className="rounded-3xl border border-linen bg-cream p-12 text-center text-sm font-semibold text-walnut">
          No matching transcript segments found.
        </div>
      )}

      {/* FLOATING AUDIO PREVIEW PLAYER BAR */}
      {playingSegment && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-gold/40 bg-navy px-6 py-4 text-cream shadow-navyGlow backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gold text-navy font-bold">
              <Volume2 size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-cream">
                Previewing Segment #{playingSegment.segment_index !== undefined ? playingSegment.segment_index + 1 : 1}
              </p>
              <p className="text-[11px] text-gold-light">
                {formatSeconds(playingSegment.start)} – {formatSeconds(playingSegment.end)}
              </p>
            </div>
          </div>

          {/* YouTube Embed Audio Engine */}
          {videoId && (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(playingSegment.start)}&end=${Math.ceil(playingSegment.end)}&autoplay=1&enablejsapi=1`}
              title="Segment Audio Preview"
              className="h-0 w-0 opacity-0 pointer-events-none"
              allow="autoplay; encrypted-media"
            />
          )}

          <button
            onClick={() => setPlayingSegment(null)}
            className="ml-2 rounded-full bg-cream/10 p-2 text-cream hover:bg-cream/20 transition-colors"
            title="Stop Audio"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
