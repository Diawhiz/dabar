import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  listSermons,
  getSermon,
  getAssetUrl,
  renderClipRange,
  openInExplorer,
} from "../lib/api.js";
import { cleanSermonTitle, formatSeconds } from "../lib/formatters.js";
import ManuscriptView from "../components/ManuscriptView.jsx";
import Btn from "../components/Btn.jsx";

function formatSrtTimestamp(seconds) {
  const s = Math.max(0, seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.floor((s % 1) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export default function Transcript() {
  const { sermonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [segments, setSegments] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [mediaAssetUrl, setMediaAssetUrl] = useState(null);
  const [audioError, setAudioError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Manual Clip Selection & Export State ──────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [clipRange, setClipRange] = useState({ start: null, end: null });
  const [clipTitle, setClipTitle] = useState("");
  const [isRenderingClip, setIsRenderingClip] = useState(false);
  const [clipRenderError, setClipRenderError] = useState(null);
  const [clipExportSuccess, setClipExportSuccess] = useState(null);
  const [isPreviewingRange, setIsPreviewingRange] = useState(false);
  const [previewEnd, setPreviewEnd] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const audioRef = useRef(null);

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
        const chList = Array.isArray(data.chapters) ? data.chapters : [];
        setChapters(chList);

        // Resolve audio asset URL for webview playback
        const audioSrc = data.audio_path || data.youtube_url || "";
        if (audioSrc) {
          getAssetUrl(audioSrc).then((url) => {
            if (mounted && url) setMediaAssetUrl(url);
          });
        }

        const rawSegs = Array.isArray(data.transcript_segments)
          ? data.transcript_segments
          : [];
        if (rawSegs.length > 0) {
          const items = rawSegs.map((seg, idx) => {
            return {
              id: `seg-${idx}`,
              start: seg.start,
              end: seg.end,
              text: seg.text,
            };
          });
          setSegments(items);
        } else {
          setSegments([]);
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

  // Handle URL timestamp param `?t=123`
  useEffect(() => {
    const tParam = searchParams.get("t");
    if (tParam && !isNaN(Number(tParam))) {
      const seekSec = Number(tParam);
      handleSeek(seekSec);
    }
  }, [searchParams, mediaAssetUrl]);

  const cleanTitle = cleanSermonTitle(sermon?.title);

  // Update default clip title when range changes
  useEffect(() => {
    if (clipRange.start !== null && clipRange.end !== null) {
      const defaultName = `${cleanTitle} (${formatSeconds(
        clipRange.start
      )} - ${formatSeconds(clipRange.end)})`;
      setClipTitle(defaultName);
    }
  }, [clipRange.start, clipRange.end, cleanTitle]);

  // Filter transcript segments matching search
  const filteredSegments = useMemo(() => {
    if (!searchTerm.trim()) return segments;
    const q = searchTerm.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchTerm]);

  // Filter chapters matching search
  const matchingChapters = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();
    return chapters.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.summary && c.summary.toLowerCase().includes(q))
    );
  }, [chapters, searchTerm]);

  // Determine current active chapter based on playbackTime
  const activeChapter = useMemo(() => {
    return chapters.find(
      (c) => playbackTime >= c.start_time && playbackTime < c.end_time
    );
  }, [chapters, playbackTime]);

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
    if (audioRef.current) {
      setAudioError(null);
      audioRef.current.currentTime = time;
      audioRef.current.play().catch((err) => {
        console.warn("Audio play failed on seek:", err);
        setAudioError("Couldn't play audio at this position.");
      });
    }
  }

  function handleTogglePlay() {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        setAudioError(null);
        audioRef.current.play().catch((err) => {
          console.warn("Audio play failed:", err);
          setAudioError("Couldn't load audio for this sermon.");
        });
      } else {
        audioRef.current.pause();
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }

  // ── Range Selection & Export Handlers ────────────────────────────────────

  function handleSetRangeStart(time) {
    setSelectionMode(true);
    setClipRenderError(null);
    setClipExportSuccess(null);
    setClipRange((prev) => {
      const newStart = Math.max(0, time);
      let newEnd = prev.end;
      if (newEnd !== null && newEnd <= newStart) {
        newEnd = newStart + 30;
      }
      return { start: newStart, end: newEnd };
    });
  }

  function handleSetRangeEnd(time) {
    setSelectionMode(true);
    setClipRenderError(null);
    setClipExportSuccess(null);
    setClipRange((prev) => {
      const newEnd = Math.max(0, time);
      let newStart = prev.start !== null ? prev.start : 0;
      if (newStart >= newEnd) {
        newStart = Math.max(0, newEnd - 30);
      }
      return { start: newStart, end: newEnd };
    });
  }

  function handleClearClipRange() {
    setClipRange({ start: null, end: null });
    setClipTitle("");
    setSelectionMode(false);
    setIsPreviewingRange(false);
    setPreviewEnd(null);
    setClipRenderError(null);
  }

  function handlePreviewRange() {
    if (!audioRef.current || clipRange.start === null || clipRange.end === null)
      return;

    const start = clipRange.start;
    const end = clipRange.end;

    if (end <= start) {
      setClipRenderError("Clip end timestamp must be greater than start timestamp.");
      return;
    }

    setClipRenderError(null);
    setIsPreviewingRange(true);
    setPreviewEnd(end);
    audioRef.current.currentTime = start;
    audioRef.current.play().catch((err) => {
      console.warn("Preview audio playback failed:", err);
      setClipRenderError("Audio preview playback failed.");
    });
  }

  async function handleExportClipRange() {
    if (!sermon?.id || clipRange.start === null || clipRange.end === null) return;
    if (clipRange.end <= clipRange.start) {
      setClipRenderError("Invalid clip range: end time must be greater than start time.");
      return;
    }

    setIsRenderingClip(true);
    setClipRenderError(null);
    setClipExportSuccess(null);

    try {
      const outputPath = await renderClipRange(
        sermon.id,
        clipRange.start,
        clipRange.end,
        clipTitle.trim() || undefined
      );

      setClipExportSuccess({
        title: clipTitle.trim() || "Manual Clip",
        path: outputPath,
      });
    } catch (err) {
      console.error("Clip render failed:", err);
      setClipRenderError(
        err.message || String(err) || "Failed to render video clip with FFmpeg."
      );
    } finally {
      setIsRenderingClip(false);
    }
  }

  // ── Download Transcript Handlers ────────────────────────────────────────

  function handleDownloadTranscript(format = "txt") {
    if (!segments.length) return;
    setShowDownloadMenu(false);

    let content = "";
    const safeTitle = cleanTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
    let filename = `${safeTitle}_transcript`;

    if (format === "srt") {
      filename += ".srt";
      content = segments
        .map((seg, i) => {
          const startSrt = formatSrtTimestamp(seg.start);
          const endSrt = formatSrtTimestamp(seg.end);
          return `${i + 1}\n${startSrt} --> ${endSrt}\n${seg.text.trim()}\n`;
        })
        .join("\n");
    } else {
      filename += ".txt";
      const header = `${cleanTitle}\n${
        sermon?.speaker ? `Speaker: ${sermon.speaker}\n` : ""
      }${new Date().toLocaleDateString()}\n----------------------------------------\n\n`;
      const body = segments
        .map((seg) => `[${formatSeconds(seg.start)}] ${seg.text.trim()}`)
        .join("\n");
      content = header + body;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const durationSec =
    duration > 0
      ? duration
      : segments.length > 0
      ? segments[segments.length - 1].end
      : 0;
  const durationStr = durationSec > 0 ? formatSeconds(durationSec) : null;

  const clipDurationSec =
    clipRange.start !== null && clipRange.end !== null
      ? Math.max(0, clipRange.end - clipRange.start)
      : null;

  const statusStr = (sermon?.status || "").toLowerCase();
  const isProcessing =
    statusStr.includes("queued") ||
    statusStr.includes("download") ||
    statusStr.includes("transcrib") ||
    statusStr.includes("detect") ||
    statusStr.includes("process");
  const isFailed = statusStr.includes("fail") || statusStr.includes("error");

  return (
    <div className="flex flex-col min-h-screen pb-28">
      {/* Real HTML5 Audio Element for Webview Playback */}
      <audio
        ref={audioRef}
        src={mediaAssetUrl || ""}
        preload="auto"
        style={{ display: "none" }}
        onTimeUpdate={(e) => {
          const t = e.target.currentTime;
          setPlaybackTime(t);

          // Auto-pause at clip end when previewing range
          if (isPreviewingRange && previewEnd !== null && t >= previewEnd) {
            if (audioRef.current) audioRef.current.pause();
            setIsPreviewingRange(false);
          }
        }}
        onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          setIsPreviewingRange(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setIsPreviewingRange(false);
        }}
        onError={() => {
          if (mediaAssetUrl) {
            setAudioError("Couldn't load audio for this sermon.");
          }
          setIsPlaying(false);
          setIsPreviewingRange(false);
        }}
      />

      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-secondary font-mono">
            <span className="text-accent font-semibold">Manuscript</span>
            {chapters.length > 0 && (
              <>
                <span>·</span>
                <span>{chapters.length} Chapters</span>
              </>
            )}
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
          <h1 className="font-editorial text-2xl font-bold text-primary truncate">
            {cleanTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 relative">
          {/* Clip Range Selection Toggle */}
          <Btn
            variant={selectionMode ? "primary" : "secondary"}
            onClick={() => {
              if (selectionMode) {
                handleClearClipRange();
              } else {
                setSelectionMode(true);
                if (clipRange.start === null) {
                  setClipRange({
                    start: Math.floor(playbackTime),
                    end: Math.floor(playbackTime + 30),
                  });
                }
              }
            }}
          >
            <i className="bx bx-cut text-sm" />
            <span>{selectionMode ? "Close Clip Selector" : "Select Clip"}</span>
          </Btn>

          {/* Download Transcript Dropdown */}
          <div className="relative">
            <Btn
              variant="secondary"
              onClick={() => setShowDownloadMenu((prev) => !prev)}
            >
              <i className="bx bx-download text-sm text-accent" />
              <span>Download</span>
              <i className="bx bx-chevron-down text-xs text-muted" />
            </Btn>

            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-md shadow-xl py-1 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => handleDownloadTranscript("txt")}
                  className="w-full px-3 py-2 text-left text-primary hover:bg-surface-hover flex items-center gap-2"
                >
                  <i className="bx bx-file-blank text-base text-accent" />
                  <div>
                    <p className="font-semibold">Text File (.txt)</p>
                    <p className="text-[10px] text-muted">Timestamped text</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTranscript("srt")}
                  className="w-full px-3 py-2 text-left text-primary hover:bg-surface-hover flex items-center gap-2 border-t border-border/40"
                >
                  <i className="bx bx-captions text-base text-accent" />
                  <div>
                    <p className="font-semibold">Subtitles (.srt)</p>
                    <p className="text-[10px] text-muted">For video editors</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Btn
            variant="secondary"
            onClick={() => navigate(`/clips/${sermonId || sermon?.id}`)}
          >
            <i className="bx bx-film text-sm text-accent" />
            <span>Clips & Video Studio</span>
          </Btn>
        </div>
      </header>

      {/* ── Audio Load Error Notice ────────────────────────────────── */}
      {audioError && (
        <div className="mx-6 mt-2 p-2.5 rounded border border-warning/30 bg-warning/10 text-xs text-warning flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="bx bx-volume-mute text-base shrink-0" />
            <span>{audioError}</span>
          </div>
          <button
            onClick={() => setAudioError(null)}
            className="text-muted hover:text-primary text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Clip Render Success Notice ────────────────────────────── */}
      {clipExportSuccess && (
        <div className="mx-6 mt-3 p-3 rounded-lg border border-success/30 bg-success-muted flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <i className="bx bxs-check-circle text-success text-base shrink-0" />
            <div className="truncate">
              <p className="font-semibold text-primary">
                "{clipExportSuccess.title}" rendered successfully
              </p>
              <p className="text-[11px] text-secondary font-mono truncate max-w-lg">
                {clipExportSuccess.path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => openInExplorer(clipExportSuccess.path)}
              className="px-2.5 py-1 rounded bg-surface border border-border text-primary hover:border-border-strong text-xs font-medium"
            >
              Show in Folder
            </button>
            <button
              onClick={() => setClipExportSuccess(null)}
              className="text-muted hover:text-primary p-1"
              aria-label="Dismiss notification"
            >
              <i className="bx bx-x text-base" />
            </button>
          </div>
        </div>
      )}

      {/* ── Clip Render Error Notice ──────────────────────────────── */}
      {clipRenderError && (
        <div className="mx-6 mt-3 p-3 rounded-lg border border-danger/30 bg-danger-muted flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <i className="bx bx-error-circle text-danger text-base shrink-0" />
            <div>
              <p className="font-semibold text-danger">Clip Export Failed</p>
              <p className="text-[11px] text-secondary mt-0.5 max-w-lg">
                {clipRenderError}
              </p>
            </div>
          </div>
          <button
            onClick={() => setClipRenderError(null)}
            className="text-muted hover:text-primary p-1"
            aria-label="Dismiss error"
          >
            <i className="bx bx-x text-base" />
          </button>
        </div>
      )}

      {/* ── Floating Clip Range Panel (When in Selection Mode) ────── */}
      {selectionMode && (
        <div className="mx-6 mt-3 p-4 rounded-lg border border-accent/40 bg-surface shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-accent flex items-center gap-1">
                <i className="bx bx-cut text-sm" />
                Custom Clip Range
              </span>
              <span className="font-mono text-secondary">
                {clipRange.start !== null
                  ? formatSeconds(clipRange.start)
                  : "00:00"}{" "}
                –{" "}
                {clipRange.end !== null
                  ? formatSeconds(clipRange.end)
                  : "00:00"}
              </span>
              {clipDurationSec !== null && (
                <span className="px-1.5 py-0.5 rounded bg-accent-muted text-accent font-mono text-[10px] font-semibold">
                  {Math.floor(clipDurationSec)}s duration
                </span>
              )}
            </div>

            <div className="text-[11px] text-muted">
              Click <span className="font-mono text-secondary">Set Start</span> /{" "}
              <span className="font-mono text-secondary">Set End</span> on any
              manuscript line
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            {/* Title Input */}
            <div className="sm:col-span-2">
              <input
                type="text"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                placeholder="Clip title (e.g. Powerful illustration on faith)"
                className="w-full bg-base border border-border rounded px-3 py-1.5 text-xs text-primary placeholder:text-muted outline-none focus:border-accent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 justify-end">
              <Btn
                size="sm"
                variant="secondary"
                onClick={handlePreviewRange}
                disabled={
                  clipRange.start === null ||
                  clipRange.end === null ||
                  isRenderingClip
                }
              >
                <i
                  className={`bx ${
                    isPreviewingRange ? "bx-pause" : "bx-play"
                  } text-sm`}
                />
                <span>{isPreviewingRange ? "Stop" : "Preview"}</span>
              </Btn>

              <Btn
                size="sm"
                onClick={handleExportClipRange}
                disabled={
                  clipRange.start === null ||
                  clipRange.end === null ||
                  isRenderingClip
                }
              >
                <i
                  className={`bx ${
                    isRenderingClip ? "bx-loader-alt bx-spin" : "bx-video"
                  } text-sm`}
                />
                <span>
                  {isRenderingClip ? "Rendering…" : "Export as Video"}
                </span>
              </Btn>

              <button
                type="button"
                onClick={handleClearClipRange}
                className="text-xs text-muted hover:text-primary p-1.5 rounded hover:bg-surface-hover"
                title="Cancel selection"
              >
                <i className="bx bx-x text-base" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chapter Pills Navigation Bar ──────────────────────────── */}
      {chapters.length > 0 && (
        <div className="px-6 py-2 border-b border-border bg-surface/60 overflow-x-auto flex items-center gap-2 no-scrollbar">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider shrink-0 mr-1">
            Jump to:
          </span>
          {chapters.map((ch, idx) => {
            const isThisActive = activeChapter?.id === ch.id;
            return (
              <button
                key={ch.id || idx}
                onClick={() => handleSeek(ch.start_time)}
                className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 border ${
                  isThisActive
                    ? "bg-accent text-accent-fg border-accent font-semibold shadow-sm"
                    : "bg-surface text-secondary hover:text-primary border-border hover:border-border-strong"
                }`}
                title={ch.summary || ch.title}
              >
                <span>{ch.title || `Chapter ${idx + 1}`}</span>
                <span
                  className={`text-[10px] ${
                    isThisActive ? "opacity-90" : "text-muted"
                  }`}
                >
                  {formatSeconds(ch.start_time)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Search Toolbar ────────────────────────────────────────── */}
      {segments.length > 0 && (
        <div className="px-6 py-2.5 border-b border-border bg-surface/40 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <i className="bx bx-search absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search chapters, transcript, or Scripture references…"
              className="w-full bg-surface border border-border rounded pl-8 pr-3 py-1 text-xs text-primary placeholder:text-muted outline-none focus:border-accent"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-secondary hover:text-primary font-mono"
            >
              Clear ({filteredSegments.length} segments,{" "}
              {matchingChapters.length} chapters)
            </button>
          )}
        </div>
      )}

      {/* ── Matching Chapters Search Results ──────────────────────── */}
      {matchingChapters.length > 0 && (
        <div className="px-6 pt-4 pb-2 space-y-2 bg-surface-hover/30 border-b border-border">
          <p className="text-[11px] font-semibold text-accent uppercase tracking-wider">
            Matching Chapters ({matchingChapters.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {matchingChapters.map((ch) => (
              <div
                key={ch.id}
                onClick={() => handleSeek(ch.start_time)}
                className="p-2.5 rounded border border-border bg-surface hover:border-accent cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">{ch.title}</span>
                  <span className="font-mono text-[10px] text-accent">
                    {formatSeconds(ch.start_time)} –{" "}
                    {formatSeconds(ch.end_time)}
                  </span>
                </div>
                {ch.summary && (
                  <p className="text-[11px] text-secondary line-clamp-2 leading-snug">
                    {ch.summary}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Manuscript Column ─────────────────────────────────────── */}
      <div className="page-content flex-1">
        {isLoading ? (
          <div className="py-20 text-center space-y-2">
            <i className="bx bx-loader-alt bx-spin text-xl text-accent" />
            <p className="text-xs text-secondary">Loading manuscript…</p>
          </div>
        ) : segments.length > 0 ? (
          <ManuscriptView
            segments={filteredSegments}
            currentTime={playbackTime}
            isPlaying={isPlaying}
            clipRange={clipRange}
            selectionMode={selectionMode}
            onSetRangeStart={handleSetRangeStart}
            onSetRangeEnd={handleSetRangeEnd}
            onSeek={handleSeek}
            onTogglePlay={handleTogglePlay}
            onUpdateSegmentText={handleUpdateSegmentText}
          />
        ) : isProcessing ? (
          /* Processing state */
          <div className="border border-border rounded-md bg-surface p-10 text-center space-y-4 max-w-md mx-auto my-8">
            <div className="w-10 h-10 rounded-full bg-surface-hover text-accent flex items-center justify-center mx-auto text-xl border border-border">
              <i className="bx bx-loader-alt bx-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                Transcript is being transcribed…
              </p>
              <p className="text-xs text-secondary mt-1">
                The sermon is currently processing speech-to-text and chapters.
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
                Transcription Failed
              </p>
              <p className="text-xs text-secondary mt-1">
                {sermon?.error_message ||
                  "An error occurred while transcribing this sermon."}
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
              <i className="bx bx-file" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary">
                No transcript text available
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                No spoken words were recognized for this sermon.
              </p>
            </div>
            <Btn size="sm" onClick={() => navigate("/dashboard")}>
              Return to Library
            </Btn>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Audio Bar (only if segments exist) ───────── */}
      {segments.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border rounded-full px-4 py-1.5 shadow-lg flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="w-6 h-6 rounded-full bg-accent text-accent-fg flex items-center justify-center hover:opacity-90 transition-opacity"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            <i
              className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-base`}
            />
          </button>

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span className="font-bold text-primary">
              {formatSeconds(playbackTime)}
            </span>
            {durationStr && (
              <>
                <span className="text-muted">/</span>
                <span className="text-secondary">{durationStr}</span>
              </>
            )}
          </div>

          <div
            className="w-28 sm:w-48 h-1 bg-surface-hover rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width)
              );
              const total = durationSec > 0 ? durationSec : 2700;
              handleSeek(ratio * total);
            }}
          >
            <div
              className="h-full bg-accent rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  (playbackTime / (durationSec > 0 ? durationSec : 2700)) * 100
                )}%`,
              }}
            />
          </div>

          <span className="text-[10px] text-muted hidden sm:inline font-mono">
            [Space] Play/Pause
          </span>
        </div>
      )}
    </div>
  );
}
