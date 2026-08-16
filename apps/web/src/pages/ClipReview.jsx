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
    <div className="space-y-12 pb-32 animate-in fade-in duration-700">
      {/* ── Macro Header & Spatial Rhythm ────────────────────────────── */}
      <section className="space-y-3 pt-6">
        <div className="flex items-center gap-3">
          <span className="eyebrow-tag">
            CLIPS & MOMENTS STUDIO
          </span>
          <span className="font-mono-code text-xs text-muted">
            {sermonDuration ? `${sermonDuration} total runtime` : "Ready"}
          </span>
          {scriptureRefs.length > 0 && (
            <span className="scripture-badge text-[10px]">
              {scriptureRefs.join(", ")}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-editorial text-3xl sm:text-5xl font-bold tracking-tight text-primary leading-tight">
              {sermonTitle || "Sermon Manuscript & Moments"}
            </h1>
            <p className="text-secondary text-xs sm:text-sm mt-2 max-w-xl font-light">
              {highlights.length} viral teaching moments identified · Aspect-ratio safe 9:16 reels ready for export.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Btn variant="secondary" icon="bx-left-arrow-alt" onClick={() => navigate("/dashboard")}>
              Library
            </Btn>
            <Btn variant="primary" icon="bx-plus" onClick={() => navigate("/upload")}>
              New Sermon
            </Btn>
          </div>
        </div>
      </section>

      {/* ── Export Success Toast ─────────────────────────────────────── */}
      {exportedNotice && (
        <div className="doppelrand-shell border-accent/40 bg-accent-muted/20">
          <div className="doppelrand-core p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent text-accent-fg flex items-center justify-center text-xl shadow-[0_0_12px_var(--accent-glow)]">
                <i className="bx bxs-check-circle" />
              </div>
              <div>
                <p className="font-editorial text-base font-bold text-primary">
                  "{exportedNotice.title}" rendered successfully!
                </p>
                <p className="text-xs text-muted font-mono-code truncate max-w-lg">
                  {exportedNotice.path}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Btn
                size="sm"
                variant="secondary"
                icon="bx-folder-open"
                onClick={() => openInExplorer(exportedNotice.path)}
              >
                Show in Folder
              </Btn>
              <button
                onClick={() => setExportedNotice(null)}
                className="text-muted hover:text-primary p-1 transition-colors"
              >
                <i className="bx bx-x text-2xl" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Studio Mode Switcher Tabs ─────────────────────────────────── */}
      <div className="flex items-center justify-start">
        <div className="flex p-1 rounded-full bg-surface border border-white/[0.08] shadow-ambient backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab("clips")}
            className={`px-6 py-2 rounded-full text-xs font-semibold tracking-tight transition-all duration-500 ease-fluid flex items-center gap-2 ${
              activeTab === "clips"
                ? "bg-accent text-accent-fg shadow-[0_2px_12px_var(--accent-glow)]"
                : "text-secondary hover:text-primary"
            }`}
          >
            <i className="bx bx-film text-sm" />
            <span>Extracted Clips ({highlights.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            className={`px-6 py-2 rounded-full text-xs font-semibold tracking-tight transition-all duration-500 ease-fluid flex items-center gap-2 ${
              activeTab === "transcript"
                ? "bg-accent text-accent-fg shadow-[0_2px_12px_var(--accent-glow)]"
                : "text-secondary hover:text-primary"
            }`}
          >
            <i className="bx bx-book-open text-sm" />
            <span>Full Manuscript</span>
          </button>
        </div>
      </div>

      {/* ── Studio Stage Body ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="doppelrand-shell">
          <div className="doppelrand-core py-28 text-center space-y-4">
            <i className="bx bx-loader-alt bx-spin text-4xl text-accent" />
            <p className="font-editorial text-xl text-secondary">
              Illuminating sermon manuscript & preaching moments…
            </p>
          </div>
        </div>
      ) : activeTab === "clips" ? (
        <div className="space-y-12">
          {/* Featured Top Moment (Primary Highlight) */}
          {topMoment && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="eyebrow-tag text-[10px]">
                  <i className="bx bxs-star text-xs" />
                  Primary Broadcast Moment
                </span>
                <span className="text-xs text-muted font-mono-code">
                  Pre-configured 9:16 Vertical Master
                </span>
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

          {/* Secondary Moments Grid (Asymmetrical Layout) */}
          {otherMoments.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-primary">
                    More Preaching Moments ({otherMoments.length})
                  </h2>
                  <p className="text-xs text-secondary mt-0.5">
                    Click preview to inspect playback bounds or export directly
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

          {/* Active Moment In-Page Player */}
          {activeSegment && (
            <div className="doppelrand-shell animate-in fade-in duration-500">
              <div className="doppelrand-core space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="eyebrow-tag text-[10px]">
                      LIVE PREVIEW
                    </span>
                    <h3 className="font-editorial text-lg font-bold text-primary truncate max-w-md">
                      {activeSegment.highlight_title || activeSegment.title || "Selected Moment"}
                    </h3>
                    <span className="text-xs text-muted font-mono-code">
                      ({formatSeconds(activeSegment.start)} – {formatSeconds(activeSegment.end)})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Btn
                      size="sm"
                      variant="primary"
                      icon="bx-film"
                      onClick={() => setExportModalClip(activeSegment)}
                    >
                      Export Video Reel
                    </Btn>
                    <button
                      onClick={() => setActiveSegment(null)}
                      className="w-8 h-8 rounded-full bg-white/[0.04] text-muted hover:text-primary flex items-center justify-center transition-colors"
                      aria-label="Close clip preview"
                    >
                      <i className="bx bx-x text-2xl" />
                    </button>
                  </div>
                </div>

                {videoId ? (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-black shadow-ambient">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(activeSegment.start)}&end=${Math.ceil(activeSegment.end)}&autoplay=1&rel=0`}
                      title="Clip preview player"
                      className="h-full w-full"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                ) : mediaAssetUrl ? (
                  <div className="w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-black/90 p-5 space-y-4 shadow-ambient">
                    <video
                      controls
                      autoPlay
                      src={mediaAssetUrl}
                      className="w-full max-h-96 rounded-xl mx-auto bg-black"
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
                    <div className="flex items-center justify-between text-xs text-secondary font-editorial italic px-2">
                      <p>"{activeSegment.why || activeSegment.text || "Preaching teaching moment"}"</p>
                      <span className="font-mono-code text-accent font-bold shrink-0">
                        Duration: {Math.round((activeSegment.end || 0) - (activeSegment.start || 0))}s
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-14 space-y-3 border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.02]">
                    <i className="bx bx-film text-4xl text-accent" />
                    <p className="font-editorial text-lg font-bold text-primary">
                      {activeSegment.highlight_title || activeSegment.title}
                    </p>
                    <p className="text-xs text-secondary max-w-md mx-auto italic font-editorial">
                      "{activeSegment.why || "High-impact sermon teaching clip."}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── MANUSCRIPT VIEW ────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="relative w-full max-w-md">
            <i className="bx bx-search absolute left-4 top-1/2 -translate-y-1/2 text-muted text-base" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sermon words, Scripture citations, or topics…"
              className="w-full rounded-full bg-white/[0.04] border border-white/[0.08] pl-11 pr-4 py-2.5 text-xs text-primary placeholder:text-muted outline-none focus:border-accent transition-all duration-300"
            />
          </div>

          <div className="doppelrand-shell">
            <div className="doppelrand-core p-6 sm:p-12">
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
        </div>
      )}

      {/* ── Floating Equalizer Audio Dock ────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface/90 backdrop-blur-2xl border border-white/[0.12] shadow-2xl rounded-full px-6 py-3 flex items-center gap-5 text-xs font-sans animate-in fade-in duration-500">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-accent to-[#D49326] text-accent-fg flex items-center justify-center shadow-[0_0_15px_var(--accent-glow)] hover:brightness-110 active:scale-95 transition-all duration-300"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-2xl`} />
        </button>

        <div className="flex items-center gap-2 font-mono-code font-bold text-xs text-primary">
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
          className="w-32 sm:w-52 h-2 bg-white/[0.08] rounded-full overflow-hidden cursor-pointer shadow-inner-glow"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const ratio = clickX / rect.width;
            handleSeek(ratio * 2700);
          }}
        >
          <div
            className="h-full bg-gradient-to-r from-accent to-[#F59E0B] rounded-full shadow-[0_0_10px_var(--accent-glow)] transition-all duration-300"
            style={{ width: `${Math.min(100, (playbackTime / 2700) * 100)}%` }}
          />
        </div>

        <span className="text-[11px] text-muted hidden sm:inline font-mono-code">
          <kbd className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[9.5px] text-primary">Space</kbd> Play
        </span>
      </div>

      {/* ── Export Video Modal ────────────────────────────────────────── */}
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
