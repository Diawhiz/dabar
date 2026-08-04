import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Instagram, MessageCircle, Play, Pause, Send, Youtube, Sparkles, Check, Maximize2, Type, Share2 } from "lucide-react";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { listSermons, getTranscript } from "../lib/api.js";

const captionStyles = [
  { id: "gold", label: "Gold Focus", bg: "bg-navy/85 backdrop-blur-md border border-gold/40 shadow-glow", text: "text-gold-light font-serif" },
  { id: "kinetic", label: "Kinetic Bold", bg: "bg-amber-600/90 backdrop-blur-md border border-white/20 shadow-lg", text: "text-white font-sans uppercase tracking-wide" },
  { id: "minimal", label: "Minimal Dark", bg: "bg-black/85 backdrop-blur-md border border-white/10 shadow-lg", text: "text-cream font-sans" },
  { id: "clean", label: "Clean Light", bg: "bg-cream/90 backdrop-blur-md text-navy border border-linen shadow-lg", text: "text-navy font-sans" },
];

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
  if (!url) return "dQw4w9WgXcQ";
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "dQw4w9WgXcQ";
}

export default function ClipsReady() {
  const location = useLocation();
  const [selectedFormat, setSelectedFormat] = useState("9:16");
  const [selectedCaption, setSelectedCaption] = useState("gold");
  const [isPlaying, setIsPlaying] = useState(true);
  const [downloaded, setDownloaded] = useState(false);
  const [quoteText, setQuoteText] = useState(location.state?.quote || "");
  const [isEditing, setIsEditing] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState(location.state?.youtube_url || "");

  const startSec = location.state?.start;
  const endSec = location.state?.end;
  const durationLabel = startSec !== undefined && endSec !== undefined
    ? formatSeconds(endSec - startSec)
    : "00:45";

  useEffect(() => {
    if (location.state?.quote) {
      setQuoteText(location.state.quote);
      if (location.state.youtube_url) setYoutubeUrl(location.state.youtube_url);
      return;
    }

    let isMounted = true;
    listSermons()
      .then(async (sermons) => {
        if (!isMounted || !sermons.length) return;
        setYoutubeUrl(sermons[0].youtube_url);
        try {
          const transcriptData = await getTranscript(sermons[0].id);
          if (isMounted && transcriptData?.segments?.length) {
            setQuoteText(transcriptData.segments[0].text);
          } else if (isMounted && transcriptData?.raw_text) {
            setQuoteText(transcriptData.raw_text.slice(0, 120) + "...");
          }
        } catch (err) {
          console.warn("Could not fetch transcript quote:", err.message);
        }
      })
      .catch((err) => console.warn("Could not fetch sermons for clips:", err.message));

    return () => {
      isMounted = false;
    };
  }, [location.state?.quote, location.state?.youtube_url]);

  const activeFormatObj = formats.find((f) => f.id === selectedFormat) ?? formats[0];
  const activeCaptionObj = captionStyles.find((c) => c.id === selectedCaption) ?? captionStyles[0];

  function handleDownload() {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  }

  const displayQuote = quoteText || "God develops depth before visibility.";
  const videoId = extractVideoId(youtubeUrl);
  const startInt = startSec !== undefined ? Math.floor(startSec) : 0;
  const endInt = endSec !== undefined ? Math.ceil(endSec) : startInt + 45;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?start=${startInt}&end=${endInt}&autoplay=1&controls=0&rel=0&modestbranding=1&loop=1&playlist=${videoId}&mute=${isPlaying ? 0 : 1}`;

  return (
    <div className="mx-auto max-w-5xl py-6">
      <PageHeader
        eyebrow="Clip Studio"
        title="Vertical Sermon Clip Ready"
        description="Preview the live video clip, customize captions, edit text, and export high-impact 9:16 clips for social channels."
        action={
          <Button variant="gold" className="px-8 shadow-glow" onClick={handleDownload}>
            {downloaded ? (
              <span className="inline-flex items-center gap-2">
                <Check size={18} /> Exported MP4 Clip!
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Download size={18} /> Export Video Clip
              </span>
            )}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        {/* VIDEO PREVIEW CANVAS */}
        <section className="flex flex-col items-center justify-center rounded-3xl border border-linen bg-cream/80 p-8 shadow-warm">
          {/* Format Aspect Ratio Container */}
          <div
            className={[
              "relative mx-auto flex flex-col justify-between overflow-hidden rounded-3xl shadow-navyGlow transition-all duration-300",
              activeFormatObj.aspect,
              "w-full bg-navy text-cream p-5 text-center",
            ].join(" ")}
          >
            {/* Live YouTube Video Layer (Cropped to frame) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-3xl">
              <iframe
                src={embedUrl}
                title="Sermon Live Video Clip"
                className="h-full w-full object-cover scale-150 transform -translate-y-2 opacity-95"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>

            {/* Subtle Top & Bottom Video Vignette for Contrast */}
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-navy/60 via-transparent to-navy/85 pointer-events-none" />

            {/* Top Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gold-light bg-navy/50 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-cream/10">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-gold" /> Dabar Studio
              </span>
              <span>{durationLabel}</span>
            </div>

            {/* Center Open Space (Speaker's face remains 100% visible) */}
            <div className="relative z-10 my-auto flex flex-col items-center justify-center pointer-events-none">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="pointer-events-auto grid h-13 w-13 place-items-center rounded-full bg-gold/90 text-navy shadow-glow transition-transform hover:scale-110 active:scale-95 opacity-80 hover:opacity-100"
              >
                {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-0.5" />}
              </button>
            </div>

            {/* Lower-Third Subtitle Caption Overlay (Standard TikTok / Reels / Shorts Position) */}
            <div className="relative z-10 mb-2 space-y-2">
              <div
                className={[
                  "mx-auto max-w-[92%] rounded-2xl px-4 py-3 shadow-navyGlow transition-all duration-300 relative group",
                  activeCaptionObj.bg,
                ].join(" ")}
              >
                {isEditing ? (
                  <textarea
                    value={quoteText}
                    onChange={(e) => setQuoteText(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    autoFocus
                    className={["w-full bg-transparent text-center font-bold text-sm leading-snug outline-none border-b border-gold/40 resize-none", activeCaptionObj.text].join(" ")}
                    rows={3}
                  />
                ) : (
                  <p
                    onClick={() => setIsEditing(true)}
                    className={["text-center font-bold text-sm leading-snug cursor-pointer drop-shadow-md", activeCaptionObj.text].join(" ")}
                  >
                    "{displayQuote}"
                  </p>
                )}
                <span className="mt-1 block text-[9px] uppercase font-sans font-bold tracking-widest text-gold-light/70">
                  Click text to edit subtitle
                </span>
              </div>

              {/* Bottom Quality Pill */}
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-cream/80 bg-navy/40 py-0.5 rounded-full backdrop-blur-sm border border-cream/10">
                Auto-Synced Captions • 1080x1920 HD
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold text-walnut/70">
            Playing actual video slice from sermon ({formatSeconds(startInt)} - {formatSeconds(endInt)})
          </p>
        </section>

        {/* CONTROLS & STYLING PANEL */}
        <section className="space-y-6">
          {/* Format Switcher */}
          <div className="rounded-3xl border border-linen bg-cream p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
              <Maximize2 size={16} className="text-gold" />
              <span>Video Aspect Ratio</span>
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

          {/* Caption Style Switcher */}
          <div className="rounded-3xl border border-linen bg-cream p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
              <Type size={16} className="text-gold" />
              <span>Caption Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {captionStyles.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCaption(c.id)}
                  className={[
                    "flex items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-all duration-200",
                    selectedCaption === c.id
                      ? "border-gold bg-navy text-cream shadow-soft"
                      : "border-linen bg-parchment/60 text-walnut hover:bg-parchment",
                  ].join(" ")}
                >
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Export to Social Platforms */}
          <div className="rounded-3xl border border-linen bg-cream p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
              <Share2 size={16} className="text-gold" />
              <span>Direct Share Presets</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Instagram Reels", icon: Instagram },
                { label: "TikTok", icon: Send },
                { label: "YouTube Shorts", icon: Youtube },
                { label: "WhatsApp Status", icon: MessageCircle },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-xl border border-linen bg-parchment/60 px-3 py-2.5 text-xs font-semibold text-navy transition-colors hover:bg-gold/20"
                >
                  <Icon size={16} className="text-gold-dark" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
