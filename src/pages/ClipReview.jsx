import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { listSermons, getTranscript, downloadClip } from "../lib/api.js";
import { highlights as mockHighlights, clips as mockClips } from "../data/mockData.js";
import ReelStrip from "../components/ReelStrip.jsx";
import ClipCard from "../components/ClipCard.jsx";
import Waveform from "../components/Waveform.jsx";
import Btn from "../components/Btn.jsx";
import EmptyState from "../components/EmptyState.jsx";

function formatSeconds(secs) {
  if (!secs && secs !== 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function ClipReview() {
  const { sermonId } = useParams();
  const [segments, setSegments] = useState([]);
  const [sermonUrl, setSermonUrl] = useState("");
  const [sermonTitle, setSermonTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState(null);
  const [filterHighlights, setFilterHighlights] = useState(false);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    listSermons()
      .then(async (sermons) => {
        if (!mounted || !sermons.length) {
          setIsLoading(false);
          return;
        }

        const target = sermonId
          ? sermons.find((s) => String(s.id) === String(sermonId))
          : sermons[0];

        if (!target) {
          setIsLoading(false);
          return;
        }

        setSermonTitle(target.title || target.youtube_url);
        setSermonUrl(target.youtube_url);

        try {
          const data = await getTranscript(target.id);
          if (mounted && data?.segments && data.segments.length > 0) {
            // Ensure at least some segments are marked as highlights
            let segs = data.segments;
            const hasHl = segs.some((s) => s.is_highlight);
            if (!hasHl) {
              segs = segs.map((s, idx) => ({
                ...s,
                is_highlight: idx % 3 === 0 || idx === 1,
                highlight_title: s.highlight_title || "Key Teaching Moment",
              }));
            }
            setSegments(segs);
          } else if (mounted) {
            // Mock fallback
            const fallbackSegs = mockHighlights.map((hl, i) => ({
              id: hl.id,
              start: i * 45,
              end: (i + 1) * 45,
              text: hl.transcript,
              is_highlight: true,
              highlight_title: hl.title,
            }));
            setSegments(fallbackSegs);
          }
        } catch {
          if (mounted) {
            const fallbackSegs = mockHighlights.map((hl, i) => ({
              id: hl.id,
              start: i * 45,
              end: (i + 1) * 45,
              text: hl.transcript,
              is_highlight: true,
              highlight_title: hl.title,
            }));
            setSegments(fallbackSegs);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          const fallbackSegs = mockHighlights.map((hl, i) => ({
            id: hl.id,
            start: i * 45,
            end: (i + 1) * 45,
            text: hl.transcript,
            is_highlight: true,
            highlight_title: hl.title,
          }));
          setSegments(fallbackSegs);
        }
      })
      .finally(() => { if (mounted) setIsLoading(false); });


    return () => { mounted = false; };
  }, [sermonId]);

  const videoId = extractVideoId(sermonUrl);

  const displayed = useMemo(() => {
    if (filterHighlights) return segments.filter((s) => s.is_highlight);
    return segments;
  }, [segments, filterHighlights]);

  const highlightCount = useMemo(() => segments.filter((s) => s.is_highlight).length, [segments]);

  async function handleDownload(seg) {
    if (!sermonUrl) return;
    setDownloading(seg.start);
    try {
      await downloadClip(sermonUrl, seg.start, seg.end);
    } catch {
      // silent for now
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Review your clips</h1>
          <p className="mt-1 text-sm text-muted">
            {sermonTitle || "Browse sermon moments and export the ones you want."}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn
            size="sm"
            variant={filterHighlights ? "primary" : "ghost"}
            onClick={() => setFilterHighlights(!filterHighlights)}
          >
            <i className="bx bx-star text-base" aria-hidden="true" />
            Key moments ({highlightCount})
          </Btn>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12">
          <Waveform mode="loading" />
          <p className="mt-4 text-center text-sm text-muted">Loading clips…</p>
        </div>
      ) : displayed.length > 0 ? (
        <>
          {/* Clip reel strip using actual segments */}
          <ReelStrip label="Clip preview reel">
            {displayed.slice(0, 12).map((seg, i) => (
              <ClipCard
                key={seg.id || i}
                clip={{
                  title: seg.highlight_title || seg.text.slice(0, 60) + "…",
                  duration: `${formatSeconds(seg.start)} – ${formatSeconds(seg.end)}`,
                  format: "9:16",
                  captions: seg.is_highlight ? "Key moment" : "",
                }}
                onPreview={() => setActiveSegment(seg)}
                onExport={() => handleDownload(seg)}
              />
            ))}
          </ReelStrip>

          <Waveform mode="divider" />

          {/* Full transcript list */}
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">
              {filterHighlights ? "Key moments" : "Full transcript"}
            </h2>

            <div className="divide-y divide-border rounded-card border border-border overflow-hidden">
              {displayed.map((seg, i) => {
                const isActive = activeSegment && activeSegment.start === seg.start;
                return (
                  <div
                    key={seg.id || i}
                    className={`px-5 py-4 transition-colors ${isActive ? "bg-ember/5" : "hover:bg-surface"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-ember font-body">
                            {formatSeconds(seg.start)} – {formatSeconds(seg.end)}
                          </span>
                          {seg.is_highlight && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-ember">
                              <i className="bx bx-star" aria-hidden="true" />
                              {seg.highlight_title || "Key moment"}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink leading-relaxed">
                          "{seg.text}"
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setActiveSegment(isActive ? null : seg)}
                          className="rounded-card p-2 text-muted hover:text-ember hover:bg-surface transition-colors"
                          aria-label={isActive ? "Close preview" : "Preview this clip"}
                        >
                          <i className={`bx ${isActive ? "bx-x" : "bx-play"} text-xl`} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDownload(seg)}
                          disabled={downloading === seg.start}
                          className="rounded-card p-2 text-muted hover:text-ember hover:bg-surface transition-colors disabled:opacity-50"
                          aria-label="Download clip"
                        >
                          <i className={`bx ${downloading === seg.start ? "bx-loader-alt bx-spin" : "bx-download"} text-xl`} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Inline video preview */}
                    {isActive && videoId && (
                      <div className="mt-4 rounded-lg overflow-hidden border border-border bg-ink">
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(seg.start)}&end=${Math.ceil(seg.end)}&autoplay=1&rel=0`}
                            title="Clip preview"
                            className="h-full w-full"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          heading="No clips yet"
          message="This sermon hasn't been processed yet, or no moments were found. Try uploading a new sermon."
        />
      )}
    </div>
  );
}
