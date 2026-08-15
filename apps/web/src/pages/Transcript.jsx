import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listSermons, getSermon } from "../lib/api.js";
import { highlights as mockHighlights } from "../data/mockData.js";
import { cleanSermonTitle, formatSeconds } from "../lib/formatters.js";
import ManuscriptView from "../components/ManuscriptView.jsx";
import Btn from "../components/Btn.jsx";

export default function Transcript() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [segments, setSegments] = useState([]);
  const [highlightsCount, setHighlightsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    async function loadTranscript() {
      try {
        let targetId = sermonId;
        if (!targetId) {
          const list = await listSermons();
          if (list && list.length > 0) targetId = list[0].id;
        }
        if (!targetId) {
          if (mounted) setIsLoading(false);
          return;
        }

        const data = await getSermon(targetId);
        if (!mounted || !data) {
          if (mounted) setIsLoading(false);
          return;
        }

        setSermon(data);
        const hlList = Array.isArray(data.highlights) ? data.highlights : [];
        setHighlightsCount(hlList.length);

        const rawSegs = Array.isArray(data.transcript_segments) ? data.transcript_segments : [];
        if (rawSegs.length > 0) {
          const items = rawSegs.map((seg, idx) => {
            const matchingHl = hlList.find(
              (hl) => seg.start >= hl.start_time - 0.5 && seg.end <= hl.end_time + 0.5
            );
            return {
              id: matchingHl ? matchingHl.id : `seg-${idx}`,
              start: seg.start,
              end: seg.end,
              text: seg.text,
              is_highlight: Boolean(matchingHl),
              highlight_title: matchingHl ? matchingHl.title : null,
              highlight_reason: matchingHl ? matchingHl.reason : null,
            };
          });
          setSegments(items);
        } else {
          // Fallback mock segments with clean text
          const fallback = mockHighlights.map((hl, i) => ({
            id: hl.id,
            start: i * 45,
            end: (i + 1) * 45,
            text: hl.transcript,
            is_highlight: true,
            highlight_title: hl.title,
            highlight_reason: hl.why,
          }));
          setSegments(fallback);
        }
      } catch (err) {
        console.warn("Could not load transcript:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadTranscript();
    return () => {
      mounted = false;
    };
  }, [sermonId]);

  const cleanTitle = cleanSermonTitle(sermon?.title);

  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    const q = searchTerm.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchTerm]);

  function handleUpdateSegmentText(idx, newText) {
    setSegments((prev) => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], text: newText };
      }
      return updated;
    });
  }

  function handleSeek(time) {
    setPlaybackTime(time);
    setIsPlaying(true);
  }

  function handleTogglePlay() {
    setIsPlaying((prev) => !prev);
  }

  const durationStr =
    segments.length > 0 ? formatSeconds(segments[segments.length - 1].end) : null;

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-secondary font-mono">
            <span className="text-accent font-semibold">Manuscript</span>
            {sermon?.speaker && (
              <>
                <span>·</span>
                <span className="text-primary">{sermon.speaker}</span>
              </>
            )}
            {durationStr && (
              <>
                <span>·</span>
                <span>{durationStr}</span>
              </>
            )}
          </div>
          <h1 className="text-base font-semibold text-primary truncate">
            {cleanTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Btn
            variant="secondary"
            onClick={() => navigate(`/clips/${sermonId || sermon?.id}`)}
          >
            <i className="bx bx-cut text-sm text-accent" />
            <span>Clips ({highlightsCount})</span>
          </Btn>
        </div>
      </header>

      {/* ── Search Toolbar ────────────────────────────────────────── */}
      <div className="px-6 py-2.5 border-b border-border bg-surface/40 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <i className="bx bx-search absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search words or Scripture in transcript…"
            className="w-full bg-surface border border-border rounded pl-8 pr-3 py-1 text-xs text-primary placeholder:text-muted outline-none focus:border-accent"
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-secondary hover:text-primary"
          >
            Clear ({filteredSegments.length} matches)
          </button>
        )}
      </div>

      {/* ── Manuscript Column ─────────────────────────────────────── */}
      <div className="page-content flex-1">
        {isLoading ? (
          <div className="py-20 text-center space-y-2">
            <i className="bx bx-loader-alt bx-spin text-xl text-accent" />
            <p className="text-xs text-secondary">Loading manuscript…</p>
          </div>
        ) : (
          <ManuscriptView
            segments={filteredSegments}
            currentTime={playbackTime}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            onTogglePlay={handleTogglePlay}
            onUpdateSegmentText={handleUpdateSegmentText}
          />
        )}
      </div>

      {/* ── Fixed Bottom Audio Bar ────────────────────────────────── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border rounded-full px-4 py-1.5 shadow-lg flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:bg-[var(--accent-hover)] transition-colors"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-base`} />
        </button>

        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span className="font-bold text-primary">{formatSeconds(playbackTime)}</span>
          {durationStr && (
            <>
              <span className="text-muted">/</span>
              <span className="text-secondary">{durationStr}</span>
            </>
          )}
        </div>

        <div
          className="w-28 sm:w-48 h-1 bg-base rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const total =
              segments.length > 0 ? segments[segments.length - 1].end : 2700;
            handleSeek(ratio * total);
          }}
        >
          <div
            className="h-full bg-accent rounded-full"
            style={{
              width: `${Math.min(
                100,
                (playbackTime /
                  (segments.length > 0
                    ? segments[segments.length - 1].end
                    : 2700)) *
                  100
              )}%`,
            }}
          />
        </div>

        <span className="text-[10px] text-muted hidden sm:inline font-mono">
          [Space] Play/Pause
        </span>
      </div>
    </div>
  );
}
