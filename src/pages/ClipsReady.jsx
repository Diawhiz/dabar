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
    ? `https://www.youtube-nocookie.com/embed/${videoId}?start=${startInt}&end=${endInt}&rel=0&modestbranding=1`
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
        description="Preview the sermon clip, download the MP4 file, or share the timestamped link directly."
        action={
          <Button variant="gold" className="px-8 shadow-glow" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Slicing MP4 Clip…
              </span>
            ) : downloaded ? (
              <span className="inline-flex items-center gap-2">
                <Check size={18} /> Downloaded MP4!
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Download size={18} /> Download MP4 Clip
              </span>
            )}
          </Button>
        }
      />

      {downloadError && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {downloadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        {/* VIDEO PREVIEW */}
        <section className="flex flex-col items-center justify-center rounded-3xl border border-linen bg-cream/80 p-8 shadow-warm">
          <div
            className={[
              "relative mx-auto overflow-hidden rounded-3xl shadow-navyGlow transition-all duration-300",
              activeFormatObj.aspect,
              "w-full bg-navy",
            ].join(" ")}
          >
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title="Sermon Video Clip Preview"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-cream/60 text-sm font-semibold">
                No video URL available
              </div>
            )}

            {/* Duration badge */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-light bg-navy/70 px-3 py-1.5 rounded-full backdrop-blur-md border border-cream/10">
              <Sparkles size={14} className="text-gold" />
              <span>{durationLabel}</span>
            </div>
          </div>

          {/* Share Link Preview */}
          <div className="mt-4 w-full max-w-md">
            <div className="flex items-center gap-2 rounded-xl border border-linen bg-parchment/60 px-4 py-2.5">
              <Link2 size={14} className="flex-shrink-0 text-gold-dark" />
              <span className="truncate text-xs font-mono text-walnut/80">{shareUrl}</span>
              <button
                onClick={handleCopyLink}
                className="ml-auto flex-shrink-0 rounded-lg bg-navy px-3 py-1 text-[11px] font-bold text-cream transition-colors hover:bg-gold hover:text-navy"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-center text-xs font-semibold text-walnut/60">
              Clip range: {formatSeconds(startInt)} – {formatSeconds(endInt)}
            </p>
          </div>
        </section>

        {/* CONTROLS PANEL */}
        <section className="space-y-6">
          {/* Format Switcher */}
          <div className="rounded-3xl border border-linen bg-cream p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
              <Maximize2 size={16} className="text-gold" />
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
                      ? "bg-navy text-cream shadow-navyGlow"
                      : "bg-parchment/70 text-walnut hover:bg-parchment hover:text-navy",
                  ].join(" ")}
                >
                  <span>{f.label}</span>
                  {selectedFormat === f.id && <Check size={16} className="text-gold" />}
                </button>
              ))}
            </div>
          </div>

          {/* Download Action Card */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full rounded-3xl border border-gold/40 bg-gold/15 p-5 text-center shadow-soft transition-all duration-200 hover:bg-gold/25 hover:shadow-glow active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-navy">
              {downloading ? (
                <Loader2 size={18} className="animate-spin text-navy" />
              ) : downloaded ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Download size={18} className="text-gold-dark" />
              )}
              <span>
                {downloading
                  ? "Slicing Clip (2-4s)…"
                  : downloaded
                  ? "MP4 Clip Downloaded!"
                  : "Download MP4 Video Clip"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-walnut/70">
              Slices only {formatSeconds(startInt)} – {formatSeconds(endInt)} directly from YouTube
            </p>
          </button>

          {/* Share Directly */}
          <div className="rounded-3xl border border-linen bg-cream p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
              <Share2 size={16} className="text-gold" />
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
                  className="flex items-center gap-2 rounded-xl border border-linen bg-parchment/60 px-3 py-2.5 text-xs font-semibold text-navy transition-colors hover:bg-gold/20"
                >
                  <Icon size={16} className="text-gold-dark" />
                  <span>{label}</span>
                  <ExternalLink size={12} className="ml-auto text-walnut/40" />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
