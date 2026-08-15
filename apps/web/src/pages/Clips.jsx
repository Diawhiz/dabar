import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  listSermons,
  getSermon,
  renderClip,
  openInExplorer,
} from "../lib/api.js";
import { highlights as mockHighlights } from "../data/mockData.js";
import { cleanSermonTitle, formatSeconds } from "../lib/formatters.js";
import ClipCard from "../components/ClipCard.jsx";
import ExportModal from "../components/ExportModal.jsx";
import Btn from "../components/Btn.jsx";

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
  );
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
            why: hl.reason || hl.suggested_hook_text || "Key teaching moment",
            duration: `${formatSeconds(hl.start_time)} – ${formatSeconds(
              hl.end_time
            )}`,
            is_highlight: true,
          }));
          setHighlights(structured);
        } else {
          // Fallback mock moments
          const fallback = mockHighlights.map((hl, i) => ({
            id: hl.id,
            start: i * 45,
            end: (i + 1) * 45,
            title: hl.title,
            highlight_title: hl.title,
            why: hl.why || "Teaching on steadfast faith and obedience.",
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
    return () => {
      mounted = false;
    };
  }, [sermonId]);

  const cleanTitle = cleanSermonTitle(sermon?.title);
  const videoId = extractVideoId(sermonUrl);

  const topMoment = useMemo(
    () => (highlights.length > 0 ? highlights[0] : null),
    [highlights]
  );
  const otherMoments = useMemo(
    () => (highlights.length > 1 ? highlights.slice(1) : []),
    [highlights]
  );

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
      alert("Clip render failed: " + (err.message || err));
    } finally {
      setRenderingClipId(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-secondary font-mono">
            <span className="text-accent font-semibold">Clips Studio</span>
            <span>·</span>
            <span>
              {highlights.length} {highlights.length === 1 ? "moment" : "moments"}
            </span>
            {sermon?.speaker && (
              <>
                <span>·</span>
                <span className="text-primary">{sermon.speaker}</span>
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
            onClick={() => navigate(`/transcript/${sermonId || sermon?.id}`)}
          >
            <i className="bx bx-file text-sm text-accent" />
            <span>Full Manuscript</span>
          </Btn>
        </div>
      </header>

      {/* ── Export Success Notification ───────────────────────────── */}
      {exportedNotice && (
        <div className="mx-6 mt-4 p-3 rounded border border-success/30 bg-success-muted flex items-center justify-between gap-4 text-xs font-sans">
          <div className="flex items-center gap-2.5 min-w-0">
            <i className="bx bxs-check-circle text-success text-base shrink-0" />
            <div className="truncate">
              <p className="font-semibold text-primary">
                "{exportedNotice.title}" saved successfully
              </p>
              <p className="text-[11px] text-secondary font-mono truncate max-w-md">
                {exportedNotice.path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openInExplorer(exportedNotice.path)}
              className="px-2.5 py-1 rounded bg-surface border border-border text-primary hover:border-border-strong text-xs font-medium"
            >
              Show in Folder
            </button>
            <button
              onClick={() => setExportedNotice(null)}
              className="text-muted hover:text-primary p-1"
              aria-label="Dismiss notification"
            >
              <i className="bx bx-x text-base" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="page-content flex-1 space-y-6">
        {isLoading ? (
          <div className="py-20 text-center space-y-2">
            <i className="bx bx-loader-alt bx-spin text-xl text-accent" />
            <p className="text-xs text-secondary">Gathering sermon moments…</p>
          </div>
        ) : (
          <>
            {/* Primary Featured Moment */}
            {topMoment && (
              <section className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">
                    Primary Moment
                  </span>
                  <span className="text-[11px] text-muted">
                    Highest speech clarity
                  </span>
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

            {/* Other Moments Grid */}
            {otherMoments.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">
                    Additional Highlights ({otherMoments.length})
                  </span>
                  <span className="text-[11px] text-muted">
                    Ready for vertical export
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

            {/* Inline Preview */}
            {previewClip && videoId && (
              <div className="border border-border bg-surface rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-accent">
                      Clip Preview
                    </span>
                    <span className="text-secondary font-mono">
                      {previewClip.highlight_title || previewClip.title}
                    </span>
                  </div>
                  <button
                    onClick={() => setPreviewClip(null)}
                    className="text-xs text-muted hover:text-primary flex items-center gap-0.5"
                  >
                    <i className="bx bx-x text-base" />
                    <span>Close</span>
                  </button>
                </div>
                <div className="aspect-video w-full rounded overflow-hidden border border-border bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(
                      previewClip.start
                    )}&end=${Math.ceil(previewClip.end)}&autoplay=1&rel=0`}
                    title="Clip preview"
                    className="h-full w-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Export Modal ─────────────────────────────────────────── */}
      {exportModalClip && (
        <ExportModal
          clip={exportModalClip}
          sermonTitle={cleanTitle}
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
