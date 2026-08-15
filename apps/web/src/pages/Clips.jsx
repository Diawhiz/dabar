import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listSermons, getSermon, renderClip, openInExplorer } from "../lib/api.js";
import { highlights as mockHighlights } from "../data/mockData.js";
import ClipCard from "../components/ClipCard.jsx";
import ExportModal from "../components/ExportModal.jsx";

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

export default function Clips() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [sermonUrl, setSermonUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [previewClip, setPreviewClip] = useState(null);
  const [exportModalClip, setExportModalClip] = useState(null);
  const [renderingClipId, setRenderingClipId] = useState(null);
  const [exportedNotice, setExportedNotice] = useState(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    async function loadClips() {
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
        setSermonUrl(data.youtube_url || "");

        const hlList = Array.isArray(data.highlights) ? data.highlights : [];
        if (hlList.length > 0) {
          const structured = hlList.map((hl) => ({
            id: hl.id,
            start: hl.start_time,
            end: hl.end_time,
            score: hl.score,
            title: hl.title,
            highlight_title: hl.title,
            why: hl.reason || hl.suggested_hook_text || "Key pastoral teaching moment",
            duration: `${formatSeconds(hl.start_time)} – ${formatSeconds(hl.end_time)}`,
            is_highlight: true,
          }));
          setHighlights(structured);
        } else {
          // Fallback mock
          const fallback = mockHighlights.map((hl, i) => ({
            id: hl.id,
            start: i * 45,
            end: (i + 1) * 45,
            title: hl.title,
            highlight_title: hl.title,
            why: hl.why || "Message on unwavering faith and trust.",
            text: hl.transcript,
            duration: `${formatSeconds(i * 45)} – ${formatSeconds((i + 1) * 45)}`,
            is_highlight: true,
          }));
          setHighlights(fallback);
        }
      } catch (err) {
        console.warn("Could not load clips:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadClips();
    return () => { mounted = false; };
  }, [sermonId]);

  const videoId = extractVideoId(sermonUrl);

  const topMoment = useMemo(() => (highlights.length > 0 ? highlights[0] : null), [highlights]);
  const otherMoments = useMemo(() => (highlights.length > 1 ? highlights.slice(1) : []), [highlights]);

  async function handleConfirmExport(clip, format, captionStyle, fileName) {
    if (!sermon?.id || !clip.id) return;
    setRenderingClipId(clip.id);
    try {
      const outputPath = await renderClip(sermon.id, clip.id);
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

  return (
    <div className="space-y-8 pb-20">
      {/* ── Screen Header ────────────────────────────────────────── */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans text-secondary mb-1">
            <span className="font-semibold text-accent">Clips Studio</span>
            <span>·</span>
            <span>{highlights.length} {highlights.length === 1 ? "moment" : "moments"} ready</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            {sermon?.title || "Sermon Clips"}
          </h1>
        </div>

        {/* Task navigation */}
        <div className="flex items-center gap-2 font-sans">
          <button
            type="button"
            onClick={() => navigate(`/transcript/${sermonId || sermon?.id}`)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-hover text-primary border border-border transition-colors"
          >
            <i className="bx bx-file text-base text-accent" />
            Read Full Manuscript
          </button>
        </div>
      </div>

      {/* ── Export Success Toast ──────────────────────────────────── */}
      {exportedNotice && (
        <div className="rounded-xl border border-accent/40 bg-surface p-4 flex items-center justify-between gap-4 font-sans animate-fade-in">
          <div className="flex items-center gap-3">
            <i className="bx bx-check-circle text-2xl text-accent shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary">
                "{exportedNotice.title}" saved successfully!
              </p>
              <p className="text-[11px] text-secondary truncate max-w-md">{exportedNotice.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openInExplorer(exportedNotice.path)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-base border border-border text-primary hover:border-accent flex items-center gap-1.5 transition-colors"
            >
              <i className="bx bx-folder text-base" />
              Show in Folder
            </button>
            <button
              onClick={() => setExportedNotice(null)}
              className="text-secondary hover:text-primary p-1"
            >
              <i className="bx bx-x text-lg" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-24 text-center space-y-2 font-sans">
          <i className="bx bx-loader-alt bx-spin text-2xl text-accent" />
          <p className="text-xs text-secondary">Gathering sermon moments…</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top Featured Moment */}
          {topMoment && (
            <section className="space-y-3">
              <div className="flex items-center justify-between font-sans">
                <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <i className="bx bxs-star text-sm" />
                  Primary Highlight
                </span>
                <span className="text-xs text-secondary">Highest spiritual clarity</span>
              </div>
              <ClipCard
                clip={topMoment}
                featured={true}
                onPreview={(c) => setPreviewClip(c)}
                onExport={(c) => setExportModalClip(c)}
                isExporting={renderingClipId === topMoment.id}
              />
            </section>
          )}

          {/* Secondary Moments */}
          {otherMoments.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between font-sans">
                <h2 className="font-display text-lg font-bold text-primary">
                  More Moments Worth Sharing ({otherMoments.length})
                </h2>
                <p className="text-xs text-secondary">Ready for phone video export</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherMoments.map((moment) => (
                  <ClipCard
                    key={moment.id}
                    clip={moment}
                    onPreview={(c) => setPreviewClip(c)}
                    onExport={(c) => setExportModalClip(c)}
                    isExporting={renderingClipId === moment.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Inline Video Player Modal/Section */}
          {previewClip && videoId && (
            <div className="rounded-2xl border border-border bg-[#120F0D] p-5 shadow-xl font-sans">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-accent uppercase tracking-wider">Previewing Clip</span>
                  <span className="text-[#F5EFE6] font-medium truncate max-w-sm">
                    {previewClip.highlight_title || previewClip.title}
                  </span>
                </div>
                <button
                  onClick={() => setPreviewClip(null)}
                  className="text-secondary hover:text-white text-xs flex items-center gap-1"
                >
                  <i className="bx bx-x text-lg" />
                  Close
                </button>
              </div>
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-border">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(previewClip.start)}&end=${Math.ceil(previewClip.end)}&autoplay=1&rel=0`}
                  title="Clip preview"
                  className="h-full w-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Export Modal ─────────────────────────────────────────── */}
      {exportModalClip && (
        <ExportModal
          clip={exportModalClip}
          sermonTitle={sermon?.title}
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
