import { useState } from "react";
import { clips as mockClips } from "../data/mockData.js";
import Waveform from "../components/Waveform.jsx";
import Btn from "../components/Btn.jsx";

const FORMATS = [
  { key: "9:16", label: "Vertical (9:16)", desc: "Reels, Shorts, TikTok" },
  { key: "1:1", label: "Square (1:1)", desc: "Instagram feed, Facebook" },
  { key: "16:9", label: "Landscape (16:9)", desc: "YouTube, web embeds" },
];

export default function Export() {
  const [selectedFormat, setSelectedFormat] = useState("9:16");
  const [copiedId, setCopiedId] = useState(null);

  function handleCopyLink(clipId) {
    // Placeholder — copy a fake share link
    navigator.clipboard.writeText(`https://dabar.app/share/${clipId}`).then(() => {
      setCopiedId(clipId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-20">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Export & share</h1>
        <p className="mt-2 text-sm text-muted">
          Download your clips as MP4 files or copy a share link.
        </p>
      </div>

      {/* Format selector */}
      <div>
        <p className="text-sm font-medium text-ink mb-3">Choose a format</p>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSelectedFormat(f.key)}
              className={`rounded-card px-4 py-2.5 text-sm font-medium border transition-colors ${
                selectedFormat === f.key
                  ? "border-ember bg-ember text-white"
                  : "border-border text-muted hover:border-ink hover:text-ink"
              }`}
            >
              <span className="block font-semibold">{f.label}</span>
              <span className="block text-xs mt-0.5 opacity-80">{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <Waveform mode="divider" />

      {/* Clip list */}
      <div className="divide-y divide-border rounded-card border border-border overflow-hidden">
        {mockClips.map((clip) => (
          <div key={clip.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-ink truncate">
                {clip.title}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {clip.duration} · {selectedFormat} · {clip.captions}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Btn size="sm" variant="ghost" onClick={() => handleCopyLink(clip.id)}>
                <i className={`bx ${copiedId === clip.id ? "bx-check" : "bx-link-alt"} text-base`} aria-hidden="true" />
                {copiedId === clip.id ? "Copied" : "Copy link"}
              </Btn>
              <Btn size="sm">
                <i className="bx bx-download text-base" aria-hidden="true" />
                Download MP4
              </Btn>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk download */}
      <div className="text-center pt-4">
        <Btn size="lg" variant="outline">
          <i className="bx bx-archive-in text-lg" aria-hidden="true" />
          Download all clips ({mockClips.length})
        </Btn>
      </div>
    </div>
  );
}
