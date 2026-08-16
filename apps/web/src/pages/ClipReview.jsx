import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listSermons, getSermon, renderClip, openInExplorer, getAssetUrl } from "../lib/api.js";
import ClipCard from "../components/ClipCard.jsx";
import ExportModal from "../components/ExportModal.jsx";
import ManuscriptView from "../components/ManuscriptView.jsx";
import Btn from "../components/Btn.jsx";

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
  const [mediaAssetUrl, setMediaAssetUrl] = useState(null);
  const [sermonTitle, setSermonTitle] = useState("");
  const [sermonDuration, setSermonDuration] = useState("");
  const [scriptureRefs, setScriptureRefs] = useState([]);
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

        let displayTitle = sermon.title || "Sunday Preaching Session";
        if (displayTitle.match(/\.(mp4|mp3|wav|m4a|mov|mkv)$/i)) {
          displayTitle = displayTitle.replace(/\.(mp4|mp3|wav|m4a|mov|mkv)$/i, "").replace(/[-_]/g, " ");
        }
        setSermonTitle(displayTitle);
        setSermonUrl(sermon.youtube_url || "");
        setScriptureRefs(sermon.scripture_references || []);

        const sourcePath = sermon.audio_path || sermon.youtube_url || "";
        if (sourcePath && !sourcePath.startsWith("http://") && !sourcePath.startsWith("https://")) {
          getAssetUrl(sourcePath).then((assetUrl) => {
            if (mounted) setMediaAssetUrl(assetUrl);
          });
        } else if (sourcePath.startsWith("http://") || sourcePath.startsWith("https://")) {
          setMediaAssetUrl(sourcePath);
        }

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

        setHighlights(structuredHls);
        setSegments(transcriptItems);
        if (transcriptItems.length > 0) {
          const lastSeg = transcriptItems[transcriptItems.length - 1];
          setSermonDuration(formatSeconds(lastSeg.end));
        }
      } catch (err) {
        console.warn("Failed to load sermon studio data:", err);
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
    if (!currentSermonId || !clip) return;
    const clipKey = clip.id || `clip-${clip.start}`;
    setRenderingClipId(clipKey);
    try {
      const outputPath = await renderClip(
        currentSermonId,
        clip.id,
        clip.start,
        clip.end,
        fileName || clip.highlight_title || clip.title
      );
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
    <div className="flex flex-col min-h-screen pb-32">
      {/* ── 1. Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-code text-secondary">
            <span className="scripture-badge text-[10px]">
              CLIPS STUDIO
            </span>
            <span>·</span>
            <span>{sermonDuration ? `${sermonDuration} runtime` : "Ready"}</span>
            {scriptureRefs.length > 0 && (
              <>
                <span>·</span>
                <span className="text-accent font-semibold">
                  {scriptureRefs.join(", ")}
                </span>
              </>
            )}
          </div>

          <h1 className="font-editorial text-2xl font-bold text-primary truncate leading-snug">
            {sermonTitle || "Sermon Manuscript & Clips"}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Btn size="sm" variant="secondary" onClick={() => navigate("/dashboard")}>
            <i className="bx bx-left-arrow-alt text-base" />
            <span>Library</span>
          </Btn>
          <Btn size="sm" variant="primary" onClick={() => navigate("/upload")}>
            <i className="bx bx-plus text-base" />
            <span>Add Sermon</span>
          </Btn>
        </div>
      </header>

      {/* ── 2. Content Body ─────────────────────────────────────────── */}
      <div className="page-content space-y-6 flex-1">
        {/* Export Success Toast */}
        {exportedNotice && (
          <div className="rounded-xl border border-accent/40 bg-accent-muted/40 p-4 flex items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent text-accent-fg flex items-center justify-center text-lg">
                <i className="bx bxs-check-circle" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary">
                  "{exportedNotice.title}" rendered successfully!
                </p>
                <p className="text-[11px] text-muted font-mono-code truncate max-w-md">
                  {exportedNotice.path}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Btn
                size="sm"
                variant="secondary"
                onClick={() => openInExplorer(exportedNotice.path)}
              >
                <i className="bx bx-folder-open text-base text-accent" />
                <span>Show in Folder</span>
              </Btn>
              <button
                onClick={() => setExportedNotice(null)}
                className="text-muted hover:text-primary p-1"
              >
                <i className="bx bx-x text-lg" />
              </button>
            </div>
          </div>
        )}

        {/* Studio View Switcher Tabs */}
        <div className="flex p-1 rounded-xl bg-surface border border-border max-w-xs shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("clips")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "clips"
                ? "bg-accent text-accent-fg shadow-xs"
                : "text-secondary hover:text-primary"
            }`}
          >
            <i className="bx bx-film text-sm" />
            <span>Clips ({highlights.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === "transcript"
                ? "bg-accent text-accent-fg shadow-xs"
                : "text-secondary hover:text-primary"
            }`}
          >
            <i className="bx bx-book-open text-sm" />
            <span>Manuscript</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-24 text-center space-y-3 bg-surface border border-border rounded-xl">
            <i className="bx bx-loader-alt bx-spin text-3xl text-accent" />
            <p className="text-xs text-secondary font-medium">Illuminating sermon manuscript and moments…</p>
          </div>
        ) : activeTab === "clips" ? (
          /* ── CLIPS STUDIO TAB ──────────────────────────────────────── */
          <div className="space-y-8">
            {/* Top Featured Moment */}
            {topMoment && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono-code font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <i className="bx bxs-star text-sm" />
                    Primary Teaching Highlight
                  </h2>
                  <span className="text-[11px] text-muted font-mono-code">Aspect-Ratio Safe 9:16 Reel</span>
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

            {/* Other Key Moments */}
            {otherMoments.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-editorial text-xl font-bold text-primary">
                    More Preaching Moments ({otherMoments.length})
                  </h2>
                  <p className="text-xs text-secondary">Ready to preview or render as social reels</p>
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

            {/* Universal Video/Audio In-Page Player */}
            {activeSegment && (
              <div className="rounded-xl border border-accent/30 bg-surface p-5 shadow-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="scripture-badge text-[10px]">
                      PREVIEWING MOMENT
                    </span>
                    <span className="font-editorial text-sm font-semibold text-primary truncate max-w-sm">
                      {activeSegment.highlight_title || activeSegment.title || "Selected Moment"}
                    </span>
                    <span className="text-xs text-muted font-mono-code">
                      ({formatSeconds(activeSegment.start)} – {formatSeconds(activeSegment.end)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn
                      size="sm"
                      variant="primary"
                      onClick={() => setExportModalClip(activeSegment)}
                    >
                      <i className="bx bx-film text-sm" />
                      <span>Export Video Reel</span>
                    </Btn>
                    <button
                      onClick={() => setActiveSegment(null)}
                      className="text-muted hover:text-primary text-xs p-1 rounded-md hover:bg-surface-hover transition-colors"
                      aria-label="Close clip preview"
                    >
                      <i className="bx bx-x text-xl" />
                    </button>
                  </div>
                </div>

                {videoId ? (
                  <div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(activeSegment.start)}&end=${Math.ceil(activeSegment.end)}&autoplay=1&rel=0`}
                      title="Clip preview player"
                      className="h-full w-full"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                ) : mediaAssetUrl ? (
                  <div className="w-full rounded-lg overflow-hidden border border-border bg-black/90 p-4 space-y-3">
                    <video
                      controls
                      autoPlay
                      src={mediaAssetUrl}
                      className="w-full max-h-80 rounded mx-auto bg-black"
                      onLoadedMetadata={(e) => {
                        e.target.currentTime = activeSegment.start || 0;
                      }}
                      onTimeUpdate={(e) => {
                        if (activeSegment.end && e.target.currentTime >= activeSegment.end) {
                          e.target.pause();
                          e.target.currentTime = activeSegment.start || 0;
                        }
                      }}
                    />
                    <div className="flex items-center justify-between text-xs text-secondary font-editorial italic">
                      <p>"{activeSegment.why || activeSegment.text || "Preaching clip moment"}"</p>
                      <span className="font-mono-code text-accent font-semibold shrink-0">
                        Duration: {Math.round((activeSegment.end || 0) - (activeSegment.start || 0))}s
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-2 border border-dashed border-border rounded-lg bg-base">
                    <i className="bx bx-film text-3xl text-accent" />
                    <p className="font-editorial text-sm font-semibold text-primary">
                      {activeSegment.highlight_title || activeSegment.title}
                    </p>
                    <p className="text-xs text-secondary max-w-md mx-auto italic font-editorial">
                      "{activeSegment.why || "High-impact sermon teaching clip."}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── MANUSCRIPT VIEW TAB ──────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search sermon words, Scripture citations, or topics…"
                  className="field-input pl-9 text-xs"
                />
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-xs text-accent hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-6 sm:p-10 shadow-xs">
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
      </div>

      {/* ── 3. Floating Bottom Equalizer Audio Dock ─────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface/90 backdrop-blur-xl border border-border/80 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 text-xs font-sans animate-in fade-in">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="w-8 h-8 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow-md hover:bg-accent-hover transition-all active:scale-95"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-xl`} />
        </button>

        <div className="flex items-center gap-1.5 font-mono-code font-bold text-xs text-primary">
          <div className="audio-equalizer mr-1">
            <span className="audio-equalizer-bar" />
            <span className="audio-equalizer-bar" />
            <span className="audio-equalizer-bar" />
            <span className="audio-equalizer-bar" />
          </div>
          <span>{formatSeconds(playbackTime)}</span>
          <span className="text-muted">/</span>
          <span className="text-muted">{sermonDuration || "45:00"}</span>
        </div>

        <div
          className="w-28 sm:w-44 h-1.5 bg-surface-hover rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = clickX / rect.width;
            handleSeek(ratio * 2700);
          }}
        >
          <div
            className="h-full bg-accent rounded-full shadow-[0_0_8px_var(--accent-glow)] transition-all"
            style={{ width: `${Math.min(100, (playbackTime / 2700) * 100)}%` }}
          />
        </div>

        <span className="text-[11px] text-muted hidden sm:inline font-mono-code">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-hover border border-border text-[9px] text-primary">Space</kbd> Play
        </span>
      </div>

      {/* ── 4. Export Video Modal ────────────────────────────────────── */}
      {exportModalClip && (
        <ExportModal
          clip={exportModalClip}
          sermonTitle={sermonTitle}
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
