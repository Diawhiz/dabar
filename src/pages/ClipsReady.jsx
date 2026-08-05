import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Instagram, MessageCircle, Send, Youtube, Sparkles, Check, Maximize2, Share2, Link2, ExternalLink, Loader2 } from "lucide-react";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { listSermons, downloadClip } from "../lib/api.js";

const formats = [
  { id: "9:16", label: "9:16 Vertical (Reels / Shorts)", aspect: "aspect-[9/16] max-w-[340px]" },
  { id: "1:1", label: "1:1 Square (Instagram Feed)", aspect: "aspect-square max-w-[420px]" },
  { id: "16:9", label: "16:9 Landscape (YouTube)", aspect: "aspect-[16/9] max-w-[540px]" },
];

function formatSeconds(secs) {
  if (!secs && secs !== 0) return "00:45";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function ClipsReady() {
  const location = useLocation();
  const [selectedFormat, setSelectedFormat] = useState("9:16");
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState(location.state?.youtube_url || "");

  const startSec = location.state?.start;
  const endSec = location.state?.end;
  const clipTitle = location.state?.title || "";
  const durationLabel = startSec !== undefined && endSec !== undefined
    ? formatSeconds(endSec - startSec)
    : "00:45";

  useEffect(() => {
    if (location.state?.youtube_url) {
      setYoutubeUrl(location.state.youtube_url);
      return;
    }

    let isMounted = true;
    listSermons()
      .then((sermons) => {
        if (isMounted && sermons.length) {
          setYoutubeUrl(sermons[0].youtube_url);
        }
      })
      .catch((err) => console.warn("Could not fetch sermons for clips:", err.message));

    return () => { isMounted = false; };
  }, [location.state?.youtube_url]);

  const activeFormatObj = formats.find((f) => f.id === selectedFormat) ?? formats[0];
  const videoId = extractVideoId(youtubeUrl);
  const startInt = startSec !== undefined ? Math.floor(startSec) : 0;
  const endInt = endSec !== undefined ? Math.ceil(endSec) : startInt + 45;

  const shareUrl = videoId
    ? `https://youtu.be/${videoId}?t=${startInt}`
    : youtubeUrl;

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?start=${startInt}&end=${endInt}&autoplay=1&enablejsapi=1&rel=0&modestbranding=1`
    : null;

  async function handleDownload() {
    if (!youtubeUrl) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloaded(false);

    try {
      await downloadClip(youtubeUrl, startInt, endInt);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 4000);
    } catch (err) {
      setDownloadError(err.message);
      setTimeout(() => setDownloadError(null), 5000);
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function handleShareOpen(platform) {
    const text = clipTitle
      ? `🔥 "${clipTitle}" — Watch this powerful sermon moment`
      : "🔥 Watch this powerful sermon moment";

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(text);

    const urls = {
      "WhatsApp": `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      "Twitter / X": `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      "Facebook": `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      "YouTube": shareUrl,
    };

    window.open(urls[platform] || shareUrl, "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-5xl py-6">
      <PageHeader
        eyebrow="Clip Studio"
        title="Sermon Video Clip"
        description="Preview the sermon clip, download the MP4 file via FFmpeg stream slicing, or share the timestamped link."
        action={
          <Button variant="gold" className="px-7 shadow-pulse" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-signal-bg" /> Slicing MP4 Clip…
              </span>
            ) : downloaded ? (
              <span className="inline-flex items-center gap-2">
                <Check size={16} /> Downloaded MP4!
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Download size={16} /> Download MP4 Clip
              </span>
            )}
          </Button>
        }
      />

      {downloadError && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 font-mono text-xs font-semibold text-red-400">
          {downloadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        {/* VIDEO PREVIEW */}
        <section className="flex flex-col items-center justify-center rounded-3xl border border-signal-border bg-signal-panel p-8 shadow-signal">
          <div
            className={[
              "relative mx-auto overflow-hidden rounded-2xl border border-signal-border shadow-signal transition-all duration-300",
              activeFormatObj.aspect,
              "w-full bg-signal-bg",
            ].join(" ")}
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Sermon Video Clip Preview"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-text-muted font-mono text-xs font-semibold">
                No video URL available
              </div>
            )}

            {/* Duration badge */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-pulse-gold bg-signal-bg/80 px-3 py-1.5 rounded-xl backdrop-blur-md border border-pulse-gold/30">
              <Sparkles size={13} className="text-pulse-gold" />
              <span>{durationLabel}</span>
            </div>
          </div>

          {/* Share Link Preview */}
          <div className="mt-5 w-full max-w-md">
            <div className="flex items-center gap-2 rounded-xl border border-signal-border bg-signal-bg px-4 py-2.5">
              <Link2 size={14} className="flex-shrink-0 text-pulse-gold" />
              <span className="truncate font-mono text-xs text-text-secondary">{shareUrl}</span>
              <button
                onClick={handleCopyLink}
                className="ml-auto flex-shrink-0 rounded-lg bg-pulse-gold px-3 py-1 font-mono text-[11px] font-bold text-signal-bg transition-colors hover:bg-yellow-400"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-center font-mono text-xs text-text-muted">
              Clip range: {formatSeconds(startInt)} – {formatSeconds(endInt)}
            </p>
          </div>
        </section>

        {/* CONTROLS PANEL */}
        <section className="space-y-6">
          {/* Format Switcher */}
          <div className="rounded-3xl border border-signal-border bg-signal-panel p-6 shadow-signal">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-pulse-gold">
              <Maximize2 size={15} className="text-pulse-gold" />
              <span>Preview Aspect Ratio</span>
            </div>
            <div className="space-y-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold transition-all duration-200",
                    selectedFormat === f.id
                      ? "bg-pulse-gold text-signal-bg shadow-pulse font-bold"
                      : "bg-signal-bg text-text-secondary border border-signal-border hover:border-pulse-gold hover:text-text-primary",
                  ].join(" ")}
                >
                  <span>{f.label}</span>
                  {selectedFormat === f.id && <Check size={15} className="text-signal-bg" />}
                </button>
              ))}
            </div>
          </div>

          {/* Download Action Card */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full rounded-3xl border border-pulse-gold/40 bg-pulse-gold/10 p-5 text-center shadow-signal transition-all duration-200 hover:bg-pulse-gold/20 hover:border-pulse-gold active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2 font-display text-sm font-bold text-pulse-gold">
              {downloading ? (
                <Loader2 size={16} className="animate-spin text-pulse-gold" />
              ) : downloaded ? (
                <Check size={16} className="text-emerald-400" />
              ) : (
                <Download size={16} className="text-pulse-gold" />
              )}
              <span>
                {downloading
                  ? "Slicing Clip (2-4s)…"
                  : downloaded
                  ? "MP4 Clip Downloaded!"
                  : "Download MP4 Video Clip"}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-text-muted">
              Slices only {formatSeconds(startInt)} – {formatSeconds(endInt)} directly from YouTube
            </p>
          </button>

          {/* Share Directly */}
          <div className="rounded-3xl border border-signal-border bg-signal-panel p-6 shadow-signal">
            <div className="mb-4 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-pulse-gold">
              <Share2 size={15} className="text-pulse-gold" />
              <span>Share Timestamped Link</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "WhatsApp", icon: MessageCircle },
                { label: "Twitter / X", icon: Send },
                { label: "Facebook", icon: Instagram },
                { label: "YouTube", icon: Youtube },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleShareOpen(label)}
                  className="flex items-center gap-2 rounded-xl border border-signal-border bg-signal-bg px-3 py-2.5 font-mono text-xs font-semibold text-text-secondary transition-colors hover:border-pulse-gold hover:text-text-primary"
                >
                  <Icon size={15} className="text-pulse-gold" />
                  <span>{label}</span>
                  <ExternalLink size={12} className="ml-auto text-text-muted" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
