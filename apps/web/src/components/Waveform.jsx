import { useMemo } from "react";

/**
 * Waveform — the structural motif of Dabar.
 *
 * Modes:
 *   divider  — thin static waveform line, full-width, replaces <hr>
 *   hero     — larger, low-opacity background waveform
 *   loading  — animated bars pulsing
 *   breaking — bars separate into clip rectangles (processing page)
 */
export default function Waveform({ mode = "divider", barCount = 48, className = "" }) {
  const bars = useMemo(() => {
    const seed = [];
    for (let i = 0; i < barCount; i++) {
      // Deterministic pseudo-random heights from a seed
      const h = 20 + ((i * 7 + 13) % 60);
      seed.push(h);
    }
    return seed;
  }, [barCount]);

  if (mode === "divider") {
    return (
      <div className={`flex items-end justify-center gap-px h-6 w-full opacity-30 ${className}`} aria-hidden="true">
        {bars.map((h, i) => (
          <div
            key={i}
            className="bg-muted rounded-sm"
            style={{ width: "2px", height: `${h}%` }}
          />
        ))}
      </div>
    );
  }

  if (mode === "hero") {
    return (
      <div className={`flex items-end justify-center gap-px h-24 w-full opacity-[0.07] ${className}`} aria-hidden="true">
        {bars.map((h, i) => (
          <div
            key={i}
            className="bg-ink rounded-sm"
            style={{ width: "3px", height: `${h}%` }}
          />
        ))}
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div
        className={`flex items-end justify-center gap-px h-12 w-full ${className}`}
        role="status"
        aria-label="Processing sermon audio"
      >
        {bars.slice(0, 32).map((h, i) => (
          <div
            key={i}
            className="wave-bar bg-ember rounded-sm"
            style={{ width: "3px", height: `${h}%` }}
          />
        ))}
      </div>
    );
  }

  if (mode === "breaking") {
    return (
      <div
        className={`flex items-end justify-center gap-1 h-16 w-full ${className}`}
        role="status"
        aria-label="Generating clips from sermon"
      >
        {bars.slice(0, 24).map((h, i) => {
          // Every 6th group becomes a "clip block"
          const isClip = i % 6 === 0;
          return (
            <div
              key={i}
              className={`wave-bar rounded-sm transition-all duration-500 ${
                isClip
                  ? "bg-ember w-8 rounded-card"
                  : "bg-muted/40 w-[3px]"
              }`}
              style={{ height: isClip ? "100%" : `${h}%` }}
            />
          );
        })}
      </div>
    );
  }

  return null;
}
