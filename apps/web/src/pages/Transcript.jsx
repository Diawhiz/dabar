import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listSermons, getSermon } from "../lib/api.js";
import { highlights as mockHighlights } from "../data/mockData.js";
import { cleanSermonTitle, formatSeconds } from "../lib/formatters.js";
import ManuscriptView from "../components/ManuscriptView.jsx";

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
          // Fallback mock segments with real text
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
    return () => { mounted = false; };
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

  const durationStr = segments.length > 0 ? formatSeconds(segments[segments.length - 1].end) : null;

  return (
    <div className="space-y-6 pb-28">
      {/* ── Screen Header — High contrast, fully legible ──────────── */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          {/* Render real metadata only if present */}
          {(sermon?.speaker || durationStr || sermon?.date) && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-sans text-secondary">
              <span className="font-semibold text-accent">Manuscript</span>
              {sermon?.speaker && (
                <>
                  <span>·</span>
                  <span className="text-primary font-medium">{sermon.speaker}</span>
                </>
              )}
              {durationStr && (
                <>
                  <span>·</span>
                  <span>{durationStr}</span>
                </>
              )}
            </div>
          )}

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary leading-snug">
            {cleanTitle}
          </h1>
        </div>

        {/* Task navigation */}
        <div className="flex items-center gap-2 font-sans shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/clips/${sermonId || sermon?.id}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-hover text-primary border border-border transition-colors"
          >
            <i className="bx bx-cut text-base text-accent" />
            <span>Clips ({highlightsCount})</span>
          </button>
        </div>
      </div>

      {/* ── Search Bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 font-sans max-w-xl">
        <div className="relative flex-1">
          <i className="bx bx-search absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary text-base" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search words or Bible verses in transcript…"
            className="w-full rounded-lg border border-border bg-surface px-9 py-2 text-xs text-primary placeholder:text-secondary outline-none focus:border-accent transition-colors"
          />
        </div>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-secondary hover:text-primary px-2.5 py-1.5 rounded bg-surface"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Manuscript Column ────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-24 text-center space-y-2 font-sans">
          <i className="bx bx-loader-alt bx-spin text-2xl text-accent" />
          <p className="text-xs text-secondary">Opening sermon manuscript…</p>
        </div>
      ) : (
        <div className="pt-2">
          <ManuscriptView
            segments={filteredSegments}
            currentTime={playbackTime}
            isPlaying={isPlaying}
            onSeek={handleSeek}
            onTogglePlay={handleTogglePlay}
            onUpdateSegmentText={handleUpdateSegmentText}
          />
        </div>
      )}

      {/* ── Floating Quiet Audio Dock ────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border shadow-lg rounded-full px-4 py-2 flex items-center gap-4 text-xs font-sans">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label={isPlaying ? "Pause playback" : "Play playback"}
        >
          <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-lg`} />
        </button>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="font-bold text-primary">{formatSeconds(playbackTime)}</span>
          {durationStr && (
            <>
              <span className="text-secondary">/</span>
              <span className="text-secondary">{durationStr}</span>
            </>
          )}
        </div>

        <div
          className="w-24 sm:w-44 h-1.5 bg-base rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const total = segments.length > 0 ? segments[segments.length - 1].end : 2700;
            handleSeek(ratio * total);
          }}
        >
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${Math.min(100, (playbackTime / (segments.length > 0 ? segments[segments.length - 1].end : 2700)) * 100)}%` }}
          />
        </div>

        <span className="text-[11px] text-secondary hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded bg-base border border-border text-[9px] font-mono text-primary font-bold">Space</kbd> Play/Pause
        </span>
      </div>
    </div>
  );
}
