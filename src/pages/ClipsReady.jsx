import { useState } from "react";
import { Download, Instagram, MessageCircle, Play, Pause, Send, Youtube, Sparkles, Check, Maximize2, Type, Share2 } from "lucide-react";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { clips } from "../data/mockData.js";

const captionStyles = [
  { id: "gold", label: "Gold Focus", bg: "bg-navy", text: "text-gold-light" },
  { id: "kinetic", label: "Kinetic Bold", bg: "bg-amber-600", text: "text-white" },
  { id: "minimal", label: "Minimal Dark", bg: "bg-black/90", text: "text-cream" },
  { id: "clean", label: "Clean Light", bg: "bg-cream", text: "text-navy" },
];

const formats = [
  { id: "9:16", label: "9:16 Vertical (Reels / Shorts)", aspect: "aspect-[9/16] max-w-[340px]" },
  { id: "1:1", label: "1:1 Square (Instagram Feed)", aspect: "aspect-square max-w-[420px]" },
  { id: "16:9", label: "16:9 Landscape (YouTube)", aspect: "aspect-[16/9] max-w-[540px]" },
];

export default function ClipsReady() {
  const [selectedFormat, setSelectedFormat] = useState("9:16");
  const [selectedCaption, setSelectedCaption] = useState("gold");
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const featuredClip = clips[0];
  const activeFormatObj = formats.find((f) => f.id === selectedFormat) ?? formats[0];
  const activeCaptionObj = captionStyles.find((c) => c.id === selectedCaption) ?? captionStyles[0];

  function handleDownload() {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  }

  return (
    <div className="mx-auto max-w-5xl py-6">
      <PageHeader
        eyebrow="Clip Studio"
        title="Vertical Sermon Clip Ready"
        description="Preview, customize captions, and export high-impact 9:16 video clips tailored for your church's social engagement."
        action={
          <Button variant="gold" className="px-8 shadow-glow" onClick={handleDownload}>
            {downloaded ? (
              <span className="inline-flex items-center gap-2">
                <Check size={18} /> Downloaded!
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Download size={18} /> Export MP4 Clip
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
              "w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-navy-light via-navy to-navy-dark text-cream p-8 text-center",
            ].join(" ")}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gold-light">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} /> Dabar HD Clip
              </span>
              <span>00:48</span>
            </div>

            {/* Middle Video Quote / Soundwave */}
            <div className="my-auto space-y-6 py-6">
              {/* Animated Sound Wave Spectrum */}
              <div className="flex items-center justify-center gap-1">
                {[40, 75, 30, 90, 50, 85, 45, 95, 60, 35, 80, 50].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: isPlaying ? `${h}%` : '20%', minHeight: '8px' }}
                    className="w-1.5 rounded-full bg-gold transition-all duration-300"
                  />
                ))}
              </div>

              {/* Caption Overlay Box */}
              <div
                className={[
                  "mx-auto rounded-2xl p-5 shadow-soft transition-all duration-300",
                  activeCaptionObj.bg,
                ].join(" ")}
              >
                <p className={["font-serif text-2xl font-bold leading-snug", activeCaptionObj.text].join(" ")}>
                  "God develops depth before visibility."
                </p>
              </div>

              {/* Play Toggle Button */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-navy shadow-glow transition-transform hover:scale-110 active:scale-95"
              >
                {isPlaying ? <Pause fill="currentColor" size={26} /> : <Play fill="currentColor" size={26} className="ml-1" />}
              </button>
            </div>

            {/* Bottom Caption Pill */}
            <div className="text-center text-xs font-semibold tracking-wider text-cream/70">
              Auto-Synced Captions • 1080x1920 HD
            </div>
          </div>

          <p className="mt-4 text-xs font-semibold text-walnut/70">
            Click play to test live audio & caption rendering preview
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
