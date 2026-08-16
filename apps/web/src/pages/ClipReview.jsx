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

        let displayTitle = sermon.title || "Sunday Sermon";
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
    <div className="space-y-6 pb-28 animate-fade-in">
      {/* ── 1. Sermon Header Banner ─────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-paper p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-sans text-muted">
            <span className="font-semibold text-amber uppercase tracking-wider">
              Sermon Studio
            </span>
            <span>·</span>
            <span>{sermonDuration ? `${sermonDuration} total runtime` : "Ready"}</span>
            {scriptureRefs.length > 0 && (
              <>
                <span>·</span>
                <span className="text-ink font-medium">
                  {scriptureRefs.join(", ")}
                </span>
              </>
            )}
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-snug">
            {sermonTitle || "Sermon Manuscript & Moments"}
          </h1>
          <p className="text-xs text-muted font-sans">
            {highlights.length} {highlights.length === 1 ? "moment" : "moments"} ready for social video export · Full manuscript available below.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 font-sans">
          <Btn size="sm" variant="ghost" onClick={() => navigate("/dashboard")}>
            <i className="bx bx-left-arrow-alt text-base" />
            Sermon Desk
          </Btn>
          <Btn size="sm" variant="outline" onClick={() => navigate("/upload")}>
            <i className="bx bx-plus text-base" />
            Add Another
          </Btn>
        </div>
      </div>

      {/* ── 2. Export Success Toast ──────────────────────────────── */}
      {exportedNotice && (
        <div className="rounded-2xl border border-amber/30 bg-amber-light/90 p-4 flex items-center justify-between gap-4 shadow-sm font-sans animate-fade-in">
          <div className="flex items-center gap-3">
            <i className="bx bx-check-circle text-2xl text-amber shrink-0" />
            <div>
              <p className="text-xs font-bold text-ink">
                "{exportedNotice.title}" is saved!
              </p>
              <p className="text-[11px] text-muted truncate max-w-md">{exportedNotice.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn
              size="sm"
              variant="outline"
              onClick={() => openInExplorer(exportedNotice.path)}
            >
              <i className="bx bx-folder-open text-base" />
              Show in Folder
            </Btn>
            <button
              onClick={() => setExportedNotice(null)}
              className="text-muted hover:text-ink p-1"
            >
              <i className="bx bx-x text-lg" />
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Tabs Switcher ─────────────────────────────────────── */}
      <div className="flex p-1 rounded-xl bg-surface border border-border/80 font-sans max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab("clips")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "clips"
              ? "bg-paper text-ink shadow-xs border border-border/60"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bx-film text-base" />
          Clips ({highlights.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transcript")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === "transcript"
              ? "bg-paper text-ink shadow-xs border border-border/60"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bx-book-open text-base" />
          Manuscript ({segments.length})
        </button>
      </div>

      {/* ── 4. Main Content Area ─────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 font-sans">
          <i className="bx bx-loader-alt bx-spin text-3xl text-amber" />
          <p className="text-xs text-muted">Illuminating sermon manuscript…</p>
        </div>
      ) : activeTab === "clips" ? (
        /* ── CLIPS STUDIO ────────────────────────────────────────── */
        <div className="space-y-8">
          {/* Featured Top Moment */}
          {topMoment && (
            <section className="space-y-2">
              <div className="flex items-center justify-between font-sans">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1.5">
                  <i className="bx bxs-star text-sm" />
                  Most Impactful Moment
                </h2>
                <span className="text-xs text-muted">Ready for phone video export</span>
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

          {/* More Moments Worth Sharing */}
          {otherMoments.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between font-sans">
                <h2 className="font-display text-lg font-bold text-ink">
                  More Moments Worth Sharing ({otherMoments.length})
                </h2>
                <p className="text-xs text-muted">Choose any clip to preview or save</p>
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

          {/* Universal Video/Audio Moment Preview Player */}
          {activeSegment && (
            <div className="rounded-2xl border border-border bg-base-dark p-5 shadow-xl animate-fade-in font-sans text-white">
              <div className="flex items-center justify-between mb-3 border-b border-border-dark pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber uppercase tracking-wider px-2 py-0.5 rounded bg-amber/10 border border-amber/20">
                    Previewing Clip
                  </span>
                  <span className="text-sm font-semibold text-white truncate max-w-sm">
                    {activeSegment.highlight_title || activeSegment.title || "Selected Moment"}
                  </span>
                  <span className="text-xs text-muted font-mono">
                    ({formatSeconds(activeSegment.start)} – {formatSeconds(activeSegment.end)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Btn
                    size="sm"
                    onClick={() => setExportModalClip(activeSegment)}
                  >
                    <i className="bx bx-download text-sm" />
                    <span>Download This Clip</span>
                  </Btn>
                  <button
                    onClick={() => setActiveSegment(null)}
                    className="text-muted hover:text-white text-xs p-1 rounded hover:bg-surface-dark transition-colors"
                    aria-label="Close clip preview"
                  >
                    <i className="bx bx-x text-xl" />
                  </button>
                </div>
              </div>

              {videoId ? (
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-border-dark bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?start=${Math.floor(activeSegment.start)}&end=${Math.ceil(activeSegment.end)}&autoplay=1&rel=0`}
                    title="Clip preview player"
                    className="h-full w-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              ) : mediaAssetUrl ? (
                <div className="w-full rounded-xl overflow-hidden border border-border-dark bg-black/90 p-4 space-y-3">
                  <video
                    controls
                    autoPlay
                    src={mediaAssetUrl}
                    className="w-full max-h-80 rounded-lg mx-auto bg-black"
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
                  <div className="flex items-center justify-between text-xs text-muted">
                    <p className="italic">
                      "{activeSegment.why || activeSegment.text || "Preaching clip moment"}"
                    </p>
                    <span className="font-mono text-amber shrink-0">
                      Duration: {Math.round((activeSegment.end || 0) - (activeSegment.start || 0))}s
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-2 border border-dashed border-border-dark rounded-xl bg-surface-dark/40">
                  <i className="bx bx-film text-3xl text-amber" />
                  <p className="text-sm font-medium text-white">
                    {activeSegment.highlight_title || activeSegment.title}
                  </p>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    {activeSegment.why || "High-impact sermon teaching clip."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── MANUSCRIPT VIEW ──────────────────────────────────────── */
        <div className="space-y-5">
          {/* Search bar inside manuscript */}
          <div className="flex items-center gap-3 font-sans">
            <div className="relative flex-1">
              <i className="bx bx-search absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search words, verses, or topics in transcript…"
                className="w-full rounded-xl border border-border bg-paper pl-9 pr-4 py-2 text-xs text-ink outline-none focus:border-amber transition-colors"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs text-muted hover:text-ink px-2.5 py-1.5 rounded-lg bg-surface"
              >
                Clear search
              </button>
            )}
          </div>

          {/* Reading Parchment Box */}
          <div className="rounded-2xl border border-border bg-paper p-6 sm:p-10 shadow-xs">
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

      {/* ── 5. Floating Bottom Audio Dock ─────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-paper/95 backdrop-blur-md border border-border shadow-xl rounded-full px-5 py-2.5 flex items-center gap-4 text-xs font-sans animate-fade-in">
        <button
          type="button"
          onClick={handleTogglePlay}
          className="w-8 h-8 rounded-full bg-amber text-white flex items-center justify-center shadow-xs hover:opacity-90 transition-opacity"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-xl`} />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-ink">
            {formatSeconds(playbackTime)}
          </span>
          <span className="text-muted">/</span>
          <span className="font-mono text-muted">
            {sermonDuration || "45:00"}
          </span>
        </div>

        <div className="w-28 sm:w-48 h-1.5 bg-surface rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const ratio = clickX / rect.width;
          const totalSecs = 2700; // ~45 mins
          handleSeek(ratio * totalSecs);
        }}>
          <div
            className="h-full bg-amber rounded-full"
            style={{ width: `${Math.min(100, (playbackTime / 2700) * 100)}%` }}
          />
        </div>

        <span className="text-[11px] text-muted hidden sm:inline">
          <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[9px] font-mono text-ink">Space</kbd> Play/Pause
        </span>
      </div>

      {/* ── 6. Export Modal ──────────────────────────────────────── */}
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
