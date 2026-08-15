import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  listSermons,
  getSermon,
  renderClip,
  openInExplorer,
  getAssetUrl,
} from "../lib/api.js";
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
  const [mediaAssetUrl, setMediaAssetUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewClip, setPreviewClip] = useState(null);
  const [exportModalClip, setExportModalClip] = useState(null);
  const [renderingClipId, setRenderingClipId] = useState(null);
  const [exportedNotice, setExportedNotice] = useState(null);
  const videoRef = useRef(null);

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
        const sourceUrl = data.youtube_url || "";
        setSermonUrl(sourceUrl);

        // If local file path, resolve asset URL for video/audio playback
        if (sourceUrl && !sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
          getAssetUrl(sourceUrl).then((assetUrl) => {
            if (mounted) setMediaAssetUrl(assetUrl);
          });
        }

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
          // Real empty state — zero fake mock data
          setHighlights([]);
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

  // When previewClip changes and local media element exists, seek to clip.start
  useEffect(() => {
    if (previewClip && videoRef.current) {
      videoRef.current.currentTime = previewClip.start || 0;
      videoRef.current.play().catch(() => {});
    }
  }, [previewClip]);

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

  const statusStr = (sermon?.status || "").toLowerCase();
  const isProcessing =
    statusStr.includes("queued") ||
    statusStr.includes("download") ||
    statusStr.includes("transcrib") ||
    statusStr.includes("detect") ||
    statusStr.includes("process");
  const isFailed = statusStr.includes("fail") || statusStr.includes("error");

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
        ) : highlights.length > 0 ? (
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

            {/* ── Universal Clip Preview Player (YouTube + Local Video/Audio) ── */}
            {previewClip && (
              <div className="border border-border bg-surface rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-accent flex items-center gap-1">
                      <i className="bx bx-play-circle text-sm" />
                      Previewing Clip Moment
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

                {videoId ? (
                  /* YouTube Embed Player */
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
                ) : mediaAssetUrl ? (
                  /* Local Video / Audio Player */
                  <div className="rounded overflow-hidden border border-border bg-black flex flex-col items-center justify-center p-2">
                    <video
                      ref={videoRef}
                      src={mediaAssetUrl}
                      controls
                      className="max-h-80 w-full rounded"
                      onLoadedMetadata={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = previewClip.start || 0;
                          videoRef.current.play().catch(() => {});
                        }
                      }}
                      onTimeUpdate={() => {
                        if (
                          videoRef.current &&
                          previewClip.end &&
                          videoRef.current.currentTime >= previewClip.end
                        ) {
                          videoRef.current.pause();
                        }
                      }}
                    />
                  </div>
                ) : (
                  /* Audio Range Fallback */
                  <div className="border border-border bg-base p-4 rounded-md space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">
                        Moment Time Range
                      </span>
                      <span className="font-mono text-accent">
                        {formatSeconds(previewClip.start)} –{" "}
                        {formatSeconds(previewClip.end)}
                      </span>
                    </div>
                    {previewClip.why && (
                      <p className="text-xs text-secondary leading-relaxed italic">
                        "{previewClip.why}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : isProcessing ? (
          /* Processing state */
          <div className="border border-border rounded-md bg-surface p-10 text-center space-y-4 max-w-md mx-auto my-8">
            <div className="w-10 h-10 rounded-full bg-surface-hover text-accent flex items-center justify-center mx-auto text-xl border border-border">
              <i className="bx bx-loader-alt bx-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                Highlights are being generated…
              </p>
              <p className="text-xs text-secondary mt-1">
                The sermon is currently processing speech-to-text and highlight detection.
              </p>
            </div>
            <Btn
              size="sm"
              onClick={() => navigate(`/processing/${sermonId || sermon?.id}`)}
            >
              <i className="bx bx-time text-sm" />
              <span>View Live Progress</span>
            </Btn>
          </div>
        ) : isFailed ? (
          /* Failed state */
          <div className="border border-danger/30 bg-danger-muted p-8 rounded-md text-center space-y-3 max-w-md mx-auto my-8">
            <i className="bx bx-error-circle text-2xl text-danger" />
            <div>
              <p className="text-sm font-semibold text-danger">
                Highlight Generation Failed
              </p>
              <p className="text-xs text-secondary mt-1">
                {sermon?.error_message ||
                  "An error occurred while analyzing key moments for this sermon."}
              </p>
            </div>
            <Btn
              size="sm"
              variant="secondary"
              onClick={() => navigate("/dashboard")}
            >
              Return to Library
            </Btn>
          </div>
        ) : (
          /* Empty ready state */
          <div className="border border-border rounded-md bg-surface p-10 text-center space-y-3 max-w-md mx-auto my-8">
            <div className="w-8 h-8 rounded bg-surface-hover text-accent flex items-center justify-center mx-auto text-base border border-border">
              <i className="bx bx-cut" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary">
                No highlights generated yet for this sermon
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                No key moments were flagged for vertical clips during processing.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Btn
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/transcript/${sermonId || sermon?.id}`)}
              >
                Read Full Manuscript
              </Btn>
              <Btn size="sm" onClick={() => navigate("/dashboard")}>
                Return to Library
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* ── Export Modal ─────────────────────────────────────────── */}
      {exportModalClip && (
        <ExportModal
          clip={exportModalClip}
          sermonTitle={cleanTitle}
          videoId={videoId}
          mediaAssetUrl={mediaAssetUrl}
          onClose={() => setExportModalClip(null)}
          onConfirmExport={handleConfirmExport}
          isRendering={renderingClipId === exportModalClip.id}
          exportedPath={exportedNotice?.path}
        />
      )}
    </div>
  );
}
