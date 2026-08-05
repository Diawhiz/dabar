import { useEffect, useMemo, useState } from "react";
import { Clock3, Scissors, Sparkles, Play, Pause, Search, Volume2, X, Activity, Filter } from "lucide-react";
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
    <div className="mx-auto max-w-6xl py-6 pb-28">
      <PageHeader
        eyebrow="Sermon Transcript & Moments"
        title={sermonTitle ? `Transcript: ${sermonTitle}` : "Sermon Highlights & Transcript"}
        description="Explore timestamped sermon transcript blocks or view AI-detected key moments distilled by Llama 3.3 70B."
        action={
          <Link to="/clips">
            <Button variant="gold" className="px-6 shadow-pulse">
              <Scissors size={16} />
              Studio Clip Generator
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
              "rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all duration-200",
              filterMode === "all"
                ? "bg-pulse-gold text-signal-bg shadow-pulse"
                : "bg-signal-panel text-text-secondary hover:bg-signal-hover hover:text-text-primary border border-signal-border",
            ].join(" ")}
          >
            FULL SERMON ({segments.length})
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
            AI KEY MOMENTS ({highlightCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-pulse-gold" size={15} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript text..."
            className="h-10 w-full rounded-xl border border-signal-border bg-signal-panel pl-10 pr-4 text-xs font-medium text-text-primary shadow-signal outline-none focus:border-pulse-gold/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-signal-border bg-signal-panel p-12 text-center font-mono text-xs font-semibold text-text-secondary">
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
                  "group rounded-2xl border p-6 shadow-signal transition-all duration-300 hover:-translate-y-0.5",
                  seg.is_highlight
                    ? "border-pulse-gold/60 bg-gradient-to-r from-signal-panel via-signal-panel to-pulse-gold/10"
                    : "border-signal-border/90 bg-signal-panel",
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
                          {seg.highlight_title || "Key Highlight"}
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
                    <button
                      type="button"
                      onClick={() => toggleAudio(seg)}
                      className={[
                        "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3.5 font-mono text-xs font-semibold transition-all duration-200",
                        isPlaying
                          ? "border-pulse-gold bg-pulse-gold text-signal-bg shadow-pulse font-bold"
                          : "border-signal-border bg-signal-bg text-text-secondary hover:border-pulse-gold hover:text-text-primary",
                      ].join(" ")}
                    >
                      {isPlaying ? <Pause size={14} className="text-signal-bg" /> : <Play size={14} className="text-pulse-gold" />}
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
                      <Button size="sm" variant="gold" className="h-9 px-4 text-xs font-bold">
                        <Scissors size={14} />
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
        <div className="rounded-2xl border border-signal-border bg-signal-panel p-12 text-center font-mono text-xs font-semibold text-text-secondary">
          No matching transcript segments found.
        </div>
      )}

      {/* FLOATING AUDIO PREVIEW PLAYER BAR */}
      {playingSegment && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-2xl border border-pulse-gold/50 bg-signal-panel px-5 py-3.5 text-text-primary shadow-signal backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-pulse-gold text-signal-bg font-bold">
              <Volume2 size={18} className="animate-pulse" />
            </div>
            <div className="font-mono">
              <p className="text-xs font-bold text-text-primary">
                Previewing Segment #{playingSegment.segment_index !== undefined ? playingSegment.segment_index + 1 : 1}
              </p>
              <p className="text-[11px] text-pulse-gold">
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
            className="ml-2 rounded-xl border border-signal-border bg-signal-bg p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            title="Stop Audio"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
