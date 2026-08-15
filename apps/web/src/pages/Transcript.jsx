import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listSermons, getSermon, getAssetUrl } from "../lib/api.js";
import { cleanSermonTitle, formatSeconds } from "../lib/formatters.js";
import ManuscriptView from "../components/ManuscriptView.jsx";
import Btn from "../components/Btn.jsx";

export default function Transcript() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [segments, setSegments] = useState([]);
  const [highlightsCount, setHighlightsCount] = useState(0);
  const [mediaAssetUrl, setMediaAssetUrl] = useState(null);
  const [audioError, setAudioError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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
        const hlList = Array.isArray(data.highlights) ? data.highlights : [];
        setHighlightsCount(hlList.length);

        // Resolve audio asset URL for webview playback
        const audioSrc = data.audio_path || data.youtube_url || "";
        if (audioSrc && !audioSrc.startsWith("http://") && !audioSrc.startsWith("https://")) {
          getAssetUrl(audioSrc).then((url) => {
            if (mounted) setMediaAssetUrl(url);
          });
        } else if (audioSrc.startsWith("http://") || audioSrc.startsWith("https://")) {
          setMediaAssetUrl(audioSrc);
        }

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
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play().catch(() => {});
    }
  }

  function handleTogglePlay() {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        setAudioError(null);
        audioRef.current.play().catch((err) => {
          console.warn("Audio play failed:", err);
          setAudioError("Could not play audio. Source file may not be reachable.");
        });
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  }

  const durationSec =
    segments.length > 0 ? segments[segments.length - 1].end : 0;
  const durationStr = durationSec > 0 ? formatSeconds(durationSec) : null;

  const statusStr = (sermon?.status || "").toLowerCase();
  const isProcessing =
    statusStr.includes("queued") ||
    statusStr.includes("download") ||
    statusStr.includes("transcrib") ||
    statusStr.includes("detect") ||
    statusStr.includes("process");
  const isFailed = statusStr.includes("fail") || statusStr.includes("error");

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Real HTML5 Audio Element */}
      {mediaAssetUrl && (
        <audio
          ref={audioRef}
          src={mediaAssetUrl}
          preload="auto"
          onTimeUpdate={(e) => setPlaybackTime(e.target.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setAudioError(
              `Source audio file could not be loaded: ${sermon?.audio_path || sermon?.youtube_url || "path missing"}`
            );
            setIsPlaying(false);
          }}
        />
      )}

      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-secondary font-mono">
            <span className="text-accent font-semibold">Manuscript</span>
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
          <h1 className="text-base font-semibold text-primary truncate">
            {cleanTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Btn
            variant="secondary"
            onClick={() => navigate(`/clips/${sermonId || sermon?.id}`)}
          >
            <i className="bx bx-cut text-sm text-accent" />
            <span>Clips ({highlightsCount})</span>
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

      {/* ── Search Toolbar (only if segments exist) ────────────────── */}
      {segments.length > 0 && (
        <div className="px-6 py-2.5 border-b border-border bg-surface/40 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <i className="bx bx-search absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search words or Scripture in transcript…"
              className="w-full bg-surface border border-border rounded pl-8 pr-3 py-1 text-xs text-primary placeholder:text-muted outline-none focus:border-accent"
            />
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-secondary hover:text-primary"
            >
              Clear ({filteredSegments.length} matches)
            </button>
          )}
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
                The sermon is currently processing speech-to-text.
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
            className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center hover:bg-[var(--accent-hover)] transition-colors"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-base`} />
          </button>

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <span className="font-bold text-primary">{formatSeconds(playbackTime)}</span>
            {durationStr && (
              <>
                <span className="text-muted">/</span>
                <span className="text-secondary">{durationStr}</span>
              </>
            )}
          </div>

          <div
            className="w-28 sm:w-48 h-1 bg-base rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
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
