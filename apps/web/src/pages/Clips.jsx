import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  listSermons,
  getSermon,
  getAssetUrl,
} from "../lib/api.js";
import { cleanSermonTitle, formatSeconds } from "../lib/formatters.js";
import ChapterCard from "../components/ChapterCard.jsx";
import Btn from "../components/Btn.jsx";

export default function Clips() {
  const { sermonId } = useParams();
  const navigate = useNavigate();
  const [sermon, setSermon] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [mediaAssetUrl, setMediaAssetUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const audioRef = useRef(null);

  async function loadChapters() {
    try {
      let targetId = sermonId;
      if (!targetId) {
        const list = await listSermons();
        if (list && list.length > 0) targetId = list[0].id;
      }
      if (!targetId) {
        setIsLoading(false);
        return;
      }

      const data = await getSermon(targetId);
      if (!data) {
        setIsLoading(false);
        return;
      }

      setSermon(data);
      const sourceUrl = data.audio_path || data.youtube_url || "";

      // Resolve asset protocol URL for local audio
      if (sourceUrl && !sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
        getAssetUrl(sourceUrl).then((assetUrl) => {
          setMediaAssetUrl(assetUrl);
        });
      } else if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
        setMediaAssetUrl(sourceUrl);
      }

      // Check for structured chapters or fallback highlights
      const chList = Array.isArray(data.chapters) ? data.chapters : [];
      if (chList.length > 0) {
        setChapters(chList);
      } else if (Array.isArray(data.highlights) && data.highlights.length > 0) {
        setChapters(
          data.highlights.map((hl) => ({
            id: hl.id,
            title: hl.title,
            summary: hl.reason || hl.suggested_hook_text || "Key sermon moment",
            start_time: hl.start_time,
            end_time: hl.end_time,
          }))
        );
      } else {
        setChapters([]);
      }
    } catch (err) {
      console.warn("Could not load sermon chapters:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    loadChapters();
  }, [sermonId]);

  const cleanTitle = cleanSermonTitle(sermon?.title);

  // Filtered chapters by search query
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const q = searchQuery.toLowerCase().trim();
    return chapters.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.summary && c.summary.toLowerCase().includes(q))
    );
  }, [chapters, searchQuery]);

  function handlePlayChapter(chapter) {
    if (!audioRef.current) return;
    const isThisPlaying =
      isPlaying &&
      playbackTime >= chapter.start_time &&
      playbackTime < chapter.end_time;

    if (isThisPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.currentTime = chapter.start_time || 0;
      audioRef.current.play().catch((err) => {
        console.warn("Audio play failed:", err);
      });
    }
  }

  function handleReadChapter(chapter) {
    const targetTime = Math.floor(chapter.start_time || 0);
    navigate(`/transcript/${sermonId || sermon?.id}?t=${targetTime}`);
  }

  function handleToggleGlobalPlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("Audio play failed:", err);
      });
    }
  }

  function handleSeek(e) {
    const val = parseFloat(e.target.value);
    setPlaybackTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  }

  const statusStr = (sermon?.status || "").toLowerCase();
  const isProcessing =
    statusStr.includes("queued") ||
    statusStr.includes("download") ||
    statusStr.includes("transcrib") ||
    statusStr.includes("detect") ||
    statusStr.includes("process");

  return (
    <div className="flex flex-col min-h-screen pb-24 space-y-6">
      {/* Real HTML5 Audio Element */}
      {mediaAssetUrl && (
        <audio
          ref={audioRef}
          src={mediaAssetUrl}
          style={{ display: "none" }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setPlaybackTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || 0);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-secondary flex-wrap">
            <span>
              {chapters.length} {chapters.length === 1 ? "Chapter" : "Chapters"}
            </span>
            {sermon?.speaker && (
              <>
                <span>·</span>
                <span className="text-primary font-medium">{sermon.speaker}</span>
              </>
            )}
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-primary truncate">
            {cleanTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Btn
            variant="secondary"
            onClick={() => navigate(`/transcript/${sermonId || sermon?.id}`)}
          >
            <i className="bx bx-file text-sm text-accent" />
            <span>Full Transcript</span>
          </Btn>
          <Btn
            variant="primary"
            onClick={() => navigate(`/clips/${sermonId || sermon?.id}`)}
          >
            <i className="bx bx-film text-sm" />
            <span>Sermon Clips</span>
          </Btn>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 space-y-5">
        {isLoading ? (
          <div className="studio-card py-24 text-center space-y-2.5">
            <i className="bx bx-loader-alt bx-spin text-2xl text-accent" />
            <p className="text-xs text-secondary font-mono">
              Loading sermon chapters…
            </p>
          </div>
        ) : isProcessing ? (
          <div className="studio-card p-10 text-center space-y-4 max-w-md mx-auto my-8">
            <div className="w-10 h-10 rounded-full bg-surface-elevated text-accent flex items-center justify-center mx-auto text-xl border border-border">
              <i className="bx bx-loader-alt bx-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                Chapters Generating…
              </p>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Audio is currently being transcribed and segmented into topic chapters.
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
        ) : chapters.length > 0 ? (
          <>
            {/* Search Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
                <input
                  type="text"
                  placeholder="Filter chapters by topic or keyword…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-surface border border-border rounded-md text-primary placeholder:text-muted focus:outline-none focus:border-accent font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                    aria-label="Clear search"
                  >
                    <i className="bx bx-x text-sm" />
                  </button>
                )}
              </div>

              <div className="text-xs text-secondary font-mono">
                Showing {filteredChapters.length} of {chapters.length} chapters
              </div>
            </div>

            {/* Chapters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredChapters.map((chapter, idx) => {
                const isPlayingThis =
                  isPlaying &&
                  playbackTime >= chapter.start_time &&
                  playbackTime < chapter.end_time;

                return (
                  <ChapterCard
                    key={chapter.id || idx}
                    chapter={chapter}
                    index={idx}
                    isPlayingThisChapter={isPlayingThis}
                    onPlay={handlePlayChapter}
                    onRead={handleReadChapter}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <div className="studio-card p-10 text-center space-y-4 max-w-md mx-auto my-8">
            <div className="w-10 h-10 rounded-full bg-surface-elevated text-secondary flex items-center justify-center mx-auto text-xl border border-border">
              <i className="bx bx-book-bookmark" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                No Chapters Available Yet
              </p>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Configure your Groq API key in Settings to automatically generate topic chapters and sermon summaries.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Btn size="sm" onClick={() => navigate("/settings")}>
                <i className="bx bx-cog text-sm" />
                <span>Configure Settings</span>
              </Btn>
              <Btn
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/transcript/${sermonId || sermon?.id}`)}
              >
                <i className="bx bx-file text-sm" />
                <span>Read Manuscript</span>
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed Bottom Audio Player Bar ─────────────────────────── */}
      {mediaAssetUrl && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border rounded-lg px-4 py-2 shadow-md flex items-center gap-3 text-xs">
          <button
            onClick={handleToggleGlobalPlay}
            className="w-7 h-7 rounded btn-studio-primary flex items-center justify-center transition-opacity"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            <i className={`bx ${isPlaying ? "bx-pause" : "bx-play"} text-base`} />
          </button>

          <span className="font-mono text-xs text-primary shrink-0">
            {formatSeconds(playbackTime)}
          </span>

          <div className="w-28 sm:w-48 h-1.5 bg-surface-elevated rounded-full overflow-hidden cursor-pointer border border-border">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={playbackTime}
              onChange={handleSeek}
              className="w-full accent-accent h-1.5 opacity-0 cursor-pointer"
              aria-label="Seek audio"
            />
          </div>

          <span className="font-mono text-xs text-secondary shrink-0">
            {formatSeconds(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
