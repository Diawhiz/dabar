import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listSermons, getSermon, renderClip, openInExplorer } from "../lib/api.js";
import { highlights as mockHighlights } from "../data/mockData.js";
import ClipCard from "../components/ClipCard.jsx";
import ExportModal from "../components/ExportModal.jsx";
import ManuscriptView from "../components/ManuscriptView.jsx";
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
  const navigate = useNavigate();
  const [currentSermonId, setCurrentSermonId] = useState(sermonId || "");
  const [activeTab, setActiveTab] = useState("clips"); // "clips" | "transcript"
  const [segments, setSegments] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [sermonUrl, setSermonUrl] = useState("");
  const [sermonTitle, setSermonTitle] = useState("");
  const [sermonDuration, setSermonDuration] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState(null);
  const [exportModalClip, setExportModalClip] = useState(null);
  const [renderingClipId, setRenderingClipId] = useState(null);
  const [exportedNotice, setExportedNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        let targetId = sermonId;

        if (!targetId) {
          const sermons = await listSermons();
          if (sermons && sermons.length > 0) {
            targetId = sermons[0].id;
          }
        }

        if (!targetId) {
          if (mounted) setIsLoading(false);
          return;
        }

        setCurrentSermonId(targetId);
        const sermon = await getSermon(targetId);
        if (!mounted || !sermon) {
          if (mounted) setIsLoading(false);
          return;
        }

        let displayTitle = sermon.title || "Sunday Sermon";
        if (displayTitle.match(/\.(mp4|mp3|wav|m4a|mov|mkv)$/i)) {
          displayTitle = displayTitle.replace(/\.(mp4|mp3|wav|m4a|mov|mkv)$/i, "").replace(/[-_]/g, " ");
        }
        setSermonTitle(displayTitle);
        setSermonUrl(sermon.youtube_url || "");

        const hlList = Array.isArray(sermon.highlights) ? sermon.highlights : [];
        const rawSegs = Array.isArray(sermon.transcript_segments) ? sermon.transcript_segments : [];

        const structuredHls = hlList.map((hl) => ({
          id: hl.id,
          start: hl.start_time,
          end: hl.end_time,
          score: hl.score,
          title: hl.title,
          highlight_title: hl.title,
          why: hl.reason || hl.suggested_hook_text || "Key pastoral teaching moment",
          text: hl.reason || hl.title,
          duration: `${formatSeconds(hl.start_time)} – ${formatSeconds(hl.end_time)}`,
          is_highlight: true,
        }));

        const transcriptItems = rawSegs.map((seg, idx) => {
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

        if (structuredHls.length > 0 || transcriptItems.length > 0) {
          setHighlights(structuredHls);
          setSegments(transcriptItems.length > 0 ? transcriptItems : structuredHls);
          if (transcriptItems.length > 0) {
            const lastSeg = transcriptItems[transcriptItems.length - 1];
            setSermonDuration(formatSeconds(lastSeg.end));
          }
        } else {
          const fallbackHls = mockHighlights.map((hl, i) => ({
            id: hl.id,
            start: i * 45,
            end: (i + 1) * 45,
            title: hl.title,
            highlight_title: hl.title,
            why: hl.why || "Pastor addresses overcoming doubt with unwavering faith.",
            text: hl.transcript,
            duration: `${formatSeconds(i * 45)} – ${formatSeconds((i + 1) * 45)}`,
            is_highlight: true,
          }));
          setHighlights(fallbackHls);
          setSegments(fallbackHls);
          setSermonDuration("45:12");
        }
      } catch (err) {
        console.warn("Failed to load sermon data:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [sermonId]);

  const videoId = extractVideoId(sermonUrl);

  const topMoment = useMemo(() => {
    if (highlights.length === 0) return null;
    return highlights[0];
  }, [highlights]);

  const otherMoments = useMemo(() => {
    if (highlights.length <= 1) return [];
    return highlights.slice(1);
  }, [highlights]);

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

  async function handleConfirmExport(clip, format, captionStyle, fileName) {
    if (!currentSermonId || !clip.id) return;
    setRenderingClipId(clip.id);
    try {
      const outputPath = await renderClip(currentSermonId, clip.id);
      setExportedNotice({
        title: clip.highlight_title || clip.title || fileName || "Clip",
        path: outputPath,
      });
      setExportModalClip(null);
    } catch (err) {
      alert("Clip export failed: " + (err.message || err));
    } finally {
      setRenderingClipId(null);
    }
  }

  function handleSeek(time) {
    setPlaybackTime(time);
    setIsPlaying(true);
  }

  function handleTogglePlay() {
    setIsPlaying((prev) => !prev);
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ── 1. Status Strip Header ───────────────────────────────── */}
      <div className="rounded-card border border-border bg-paper p-5 shadow-card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ember mb-1">
            <span>Sermon Studio</span>
            <span>·</span>
            <span>{sermonDuration ? `${sermonDuration} total runtime` : "Ready"}</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-ink leading-tight">
            {sermonTitle || "Sermon Highlights & Transcript"}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {highlights.length} {highlights.length === 1 ? "moment" : "moments"} worth sharing identified from this message.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Btn size="sm" variant="ghost" onClick={() => navigate("/dashboard")}>
            <i className="bx bx-left-arrow-alt text-base" aria-hidden="true" />
            Library
          </Btn>
          <Btn size="sm" variant="outline" onClick={() => navigate("/upload")}>
            <i className="bx bx-upload text-base" aria-hidden="true" />
            New Sermon
          </Btn>
        </div>
      </div>

      {/* ── 2. Export Success Toast ──────────────────────────────── */}
      {exportedNotice && (
        <div className="rounded-card border border-ember/40 bg-ember/10 p-4 flex items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <i className="bx bx-check-circle text-2xl text-ember shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-ink">
                "{exportedNotice.title}" rendered successfully!
              </p>
              <p className="text-xs text-muted truncate max-w-md">{exportedNotice.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn
              size="sm"
              variant="outline"
              onClick={() => openInExplorer(exportedNotice.path)}
            >
              <i className="bx bx-folder-open text-base" aria-hidden="true" />
              Show in Folder
            </Btn>
            <button
              onClick={() => setExportedNotice(null)}
              className="text-muted hover:text-ink p-1"
              aria-label="Dismiss notice"
            >
              <i className="bx bx-x text-lg" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Mode Tabs: Clips vs Transcript ─────────────────────── */}
      <div className="flex border-b border-border gap-8 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("clips")}
          className={`pb-3.5 transition-colors relative flex items-center gap-2 ${
            activeTab === "clips"
              ? "text-ember font-bold border-b-2 border-ember"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bx-film text-lg" aria-hidden="true" />
          Clips & Key Moments ({highlights.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transcript")}
          className={`pb-3.5 transition-colors relative flex items-center gap-2 ${
            activeTab === "transcript"
              ? "text-ember font-bold border-b-2 border-ember"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bx-book-open text-lg" aria-hidden="true" />
          Structured Transcript ({segments.length} segments)
        </button>
      </div>

      {/* ── 4. Main Tab Content ──────────────────────────────────── */}
      {isLoading ? (
        <div className="py-16 text-center">
          <i className="bx bx-loader-alt bx-spin text-3xl text-ember mb-3" aria-hidden="true" />
          <p className="text-sm text-muted">Illuminating sermon moments…</p>
        </div>
      ) : activeTab === "clips" ? (
        /* ── CLIPS TAB ────────────────────────────────────────── */
        <div className="space-y-8">
          {/* Top Featured Moment (Hero Card) */}
          {topMoment && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink flex items-center gap-1.5">
                  <i className="bx bxs-star text-ember" aria-hidden="true" />
                  Primary Key Moment
                </h2>
                <span className="text-xs text-muted">Ranked #1 for spiritual impact</span>
              </div>
              <ClipCard
                clip={topMoment}
                featured={true}
                onPreview={(c) => setActiveSegment(c)}
                onExport={(c) => setExportModalClip(c)}
                isExporting={renderingClipId === topMoment.id}
              />
            </section>
          )}

          {/* Other Moments Worth Sharing */}
          {otherMoments.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">
                  More moments worth sharing ({otherMoments.length})
                </h2>
                <p className="text-xs text-muted">Ready for vertical video export</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherMoments.map((moment) => (
                  <ClipCard
                    key={moment.id}
                    clip={moment}
                    onPreview={(c) => setActiveSegment(c)}
                    onExport={(c) => setExportModalClip(c)}
                    isExporting={renderingClipId === moment.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Inline Video / Audio Preview Player */}
          {activeSegment && videoId && (
            <div className="rounded-card border border-border bg-base p-4 shadow-lifted animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ember uppercase tracking-wider">Now Previewing</span>
                  <span className="text-xs text-paper font-medium truncate max-w-sm">
                    {activeSegment.highlight_title || activeSegment.title || "Selected Moment"}
                  </span>
                </div>
                <button
                  onClick={() => setActiveSegment(null)}
                  className="text-muted hover:text-paper p-1 text-sm flex items-center gap-1"
                >
                  <i className="bx bx-x text-lg" aria-hidden="true" />
                  Close
                </button>
              </div>
              <div className="aspect-video w-full rounded-lg overflow-hidden border border-border-dark">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(activeSegment.start)}&end=${Math.ceil(activeSegment.end)}&autoplay=1&rel=0`}
                  title="Clip preview player"
                  className="h-full w-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── TRANSCRIPT TAB (MANUSCRIPT READING & CORRECTION VIEW) ── */
        <div className="space-y-6">
          {/* Transcript Search & Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <i className="bx bx-search absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-muted" aria-hidden="true" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search words, verses, or themes in sermon transcript…"
                className="w-full rounded-card border border-border bg-paper pl-10 pr-4 py-2.5 text-xs text-ink outline-none focus:border-ember"
              />
            </div>
            {searchTerm && (
              <Btn size="sm" variant="ghost" onClick={() => setSearchTerm("")}>
                Clear
              </Btn>
            )}
          </div>

          {/* Manuscript Container */}
          <div className="rounded-card border border-border bg-paper p-6 sm:p-8 shadow-card">
            <ManuscriptView
              segments={filteredSegments}
              currentTime={playbackTime}
              isPlaying={isPlaying}
              onSeek={handleSeek}
              onTogglePlay={handleTogglePlay}
              onUpdateSegmentText={handleUpdateSegmentText}
            />
          </div>
        </div>
      )}

      {/* ── 5. Export Modal ──────────────────────────────────────── */}
      {exportModalClip && (
        <ExportModal
          clip={exportModalClip}
          sermonTitle={sermonTitle}
          videoId={videoId}
          onClose={() => setExportModalClip(null)}
          onConfirmExport={handleConfirmExport}
          isRendering={renderingClipId === exportModalClip.id}
          exportedPath={exportedNotice?.path}
        />
      )}
    </div>
  );
}
