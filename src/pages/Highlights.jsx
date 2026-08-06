import { useEffect, useMemo, useState } from "react";
import { Clock3, Scissors, Sparkles, Play, Pause, Search, Volume2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { listSermons, getTranscript } from "../lib/api.js";

function formatSeconds(secs) {
  if (!secs && secs !== 0) return "00:00";
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
    <div className="mx-auto max-w-6xl py-6 pb-28">
      <PageHeader
        eyebrow="Transcript & Key Moments"
        title={sermonTitle ? `Transcript: ${sermonTitle}` : "Sermon Highlights & Transcript"}
        description="Explore timestamped sermon transcript blocks or review AI-detected key moments."
        action={
          <Link to="/clips">
            <Button variant="gold" className="px-6 shadow-pulse">
              <Scissors size={16} />
              Open Clip Studio
            </Button>
          </Link>
        }
      />

      {/* FILTER & SEARCH CONTROLS BAR */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-signal-border pb-5">
        {/* Filter Mode Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={[
              "relative rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all duration-200",
              filterMode === "all"
                ? "bg-pulse-gold text-signal-bg shadow-pulse"
                : "bg-signal-panel text-text-secondary hover:bg-signal-hover hover:text-text-primary border border-signal-border",
            ].join(" ")}
          >
            FULL TRANSCRIPT ({segments.length})
          </button>
          <button
            onClick={() => setFilterMode("highlights")}
            className={[
              "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all duration-200",
              filterMode === "highlights"
                ? "bg-pulse-amber text-white shadow-laser"
                : "bg-signal-panel text-text-secondary hover:bg-signal-hover hover:text-text-primary border border-signal-border",
            ].join(" ")}
          >
            <Sparkles size={13} className={filterMode === "highlights" ? "text-white" : "text-pulse-amber"} />
            KEY MOMENTS ({highlightCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pulse-gold" size={15} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript text..."
            className="h-10 w-full rounded-xl border border-signal-border bg-signal-panel pl-10 pr-4 text-xs font-medium text-text-primary shadow-signal outline-none transition-colors focus:border-pulse-gold/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-signal-border bg-signal-panel p-12 text-center font-mono text-xs font-semibold text-text-secondary">
          Loading sermon transcript...
        </div>
      ) : filteredSegments.length > 0 ? (
        <motion.section
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.04 },
            },
          }}
          className="space-y-4"
        >
          {filteredSegments.map((seg, idx) => {
            const isPlaying = playingSegment && playingSegment.start === seg.start;
            const timestamp = `${formatSeconds(seg.start)} - ${formatSeconds(seg.end)}`;

            return (
              <motion.article
                key={seg.id || idx}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0 },
                }}
                whileHover={{ y: -2, transition: { duration: 0.15 } }}
                className={[
                  "group rounded-2xl border p-6 shadow-signal transition-colors duration-200",
                  seg.is_highlight
                    ? "border-pulse-gold/50 bg-signal-panel/90"
                    : "border-signal-border bg-signal-panel/60",
                ].join(" ")}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2.5 lg:max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-signal-border bg-signal-bg px-3 py-1 text-pulse-gold font-semibold">
                        <Clock3 size={13} className="text-pulse-gold" />
                        {timestamp}
                      </span>
                      {seg.is_highlight && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-pulse-gold/30 bg-pulse-gold/10 px-3 py-1 font-bold text-pulse-gold uppercase tracking-wider">
                          <Sparkles size={13} className="text-pulse-gold" />
                          {seg.highlight_title || "Key Moment"}
                        </span>
                      )}
                      <span className="text-text-muted">
                        #Segment {seg.segment_index !== undefined ? seg.segment_index + 1 : idx + 1}
                      </span>
                    </div>

                    <p className="text-sm sm:text-base leading-relaxed text-text-primary font-sans">
                      "{seg.text}"
                    </p>
                  </div>

                  <div className="flex flex-row items-center gap-2.5 lg:flex-col lg:items-end lg:justify-center">
                    <Button
                      size="sm"
                      variant={isPlaying ? "gold" : "outline"}
                      onClick={() => toggleAudio(seg)}
                      className="h-9 px-3.5 font-mono text-xs"
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} className="text-pulse-gold" />}
                      <span>{isPlaying ? "Pause Preview" : "Preview Audio"}</span>
                    </Button>

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
                      <Button size="sm" variant="gold" className="h-9 px-4 text-xs font-bold">
                        <Scissors size={14} />
                        Create Clip
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </motion.section>
      ) : (
        <div className="rounded-2xl border border-signal-border bg-signal-panel p-12 text-center font-mono text-xs font-semibold text-text-secondary">
          No matching transcript segments found.
        </div>
      )}

      {/* FLOATING INTERACTIVE AUDIO PREVIEW PLAYER BAR */}
      <AnimatePresence>
        {playingSegment && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-pulse-gold/50 bg-signal-panel p-4 text-text-primary shadow-2xl backdrop-blur-xl max-w-lg"
          >
            {/* Interactive Visible YouTube Mini Player Window for browser autoplay compliance */}
            {videoId && (
              <div className="relative h-28 w-44 shrink-0 overflow-hidden rounded-xl border border-signal-border bg-black shadow-inner">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(playingSegment.start)}&end=${Math.ceil(playingSegment.end)}&autoplay=1&enablejsapi=1&rel=0`}
                  title="Segment Audio Preview"
                  className="h-full w-full object-cover"
                  allow="autoplay; encrypted-media"
                />
              </div>
            )}

            <div className="flex flex-1 flex-col justify-between space-y-2 w-full">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-pulse-gold">
                    <Volume2 size={14} className="animate-pulse" />
                    <span>AUDIO PREVIEW</span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold text-text-primary line-clamp-1">
                    Segment #{playingSegment.segment_index !== undefined ? playingSegment.segment_index + 1 : 1}
                  </p>
                </div>

                <button
                  onClick={() => setPlayingSegment(null)}
                  className="rounded-lg border border-signal-border bg-signal-bg p-1 text-text-muted hover:text-text-primary transition-colors"
                  title="Close Preview"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Animated Waveform Bars */}
              <div className="flex items-center gap-1 py-1">
                {[40, 75, 35, 90, 60, 95, 45, 80, 50, 85, 30, 70].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      height: [h * 0.3, h, h * 0.4],
                    }}
                    transition={{
                      repeat: Infinity,
                      repeatType: "reverse",
                      duration: 0.6 + (i % 3) * 0.2,
                    }}
                    style={{ height: `${h}%` }}
                    className="w-1 rounded-full bg-pulse-gold"
                  />
                ))}
                <span className="ml-2 font-mono text-[11px] font-semibold text-text-secondary">
                  {formatSeconds(playingSegment.start)} – {formatSeconds(playingSegment.end)}
                </span>
              </div>

              <p className="font-sans text-[11px] text-text-muted line-clamp-1 italic">
                "{playingSegment.text}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

