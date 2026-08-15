/**
 * Formatting and title sanitization helpers for Dabar
 * Enforces zero raw internal filenames and zero fake placeholder text.
 */

export function cleanSermonTitle(rawTitle, fallbackDate = null) {
  if (!rawTitle || typeof rawTitle !== "string") {
    return "Untitled sermon — tap to rename";
  }

  const trimmed = rawTitle.trim();

  // If it's an internal clip pattern like "dabar-clip-4630s" or "clip-001"
  if (/^dabar[-_]clip[-_]\d+/i.test(trimmed) || /^clip[-_]\d+/i.test(trimmed)) {
    return "Sunday Service Message";
  }

  // If it's a raw date-time filename like "20260812-120451.m4a" or "2026-08-14-sermon.mp3"
  if (/^\d{8}[-_]\d{6}/.test(trimmed) || /^\d{4}[-_]\d{2}[-_]\d{2}/.test(trimmed)) {
    return "Recorded Message";
  }

  // Strip file extensions (.mp4, .m4a, .mp3, .wav, .mov, .mkv, .webm)
  let clean = trimmed.replace(/\.(mp4|m4a|mp3|wav|mov|mkv|webm|opus|ogg|part)$/i, "");

  // If it contains underscores or hyphens replacing spaces, format cleanly
  if (clean.includes("_") && !clean.includes(" ")) {
    clean = clean.replace(/_/g, " ");
  }

  // If after stripping it's empty or purely numbers/garbage
  if (!clean || /^\d+$/.test(clean) || clean.toLowerCase() === "untitled" || clean.toLowerCase() === "audio") {
    return "Untitled sermon — tap to rename";
  }

  return clean;
}

export function formatSeconds(secs) {
  if (typeof secs !== "number" || isNaN(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDurationHuman(secondsOrStr) {
  if (typeof secondsOrStr === "number") {
    if (secondsOrStr < 60) return `${Math.round(secondsOrStr)}s`;
    const m = Math.floor(secondsOrStr / 60);
    const s = Math.round(secondsOrStr % 60);
    return s > 0 ? `${m}m ${s}s` : `${m} min`;
  }
  if (typeof secondsOrStr === "string" && (secondsOrStr.includes("–") || secondsOrStr.includes("-"))) {
    const parts = secondsOrStr.split(/[-–]/).map((s) => s.trim());
    if (parts.length === 2) {
      const [startM, startS] = parts[0].split(":").map(Number);
      const [endM, endS] = parts[1].split(":").map(Number);
      if (!isNaN(startM) && !isNaN(startS) && !isNaN(endM) && !isNaN(endS)) {
        const total = (endM * 60 + endS) - (startM * 60 + startS);
        if (total < 60) return `${total}s`;
        const m = Math.floor(total / 60);
        const s = total % 60;
        return s > 0 ? `${m}m ${s}s` : `${m} min`;
      }
    }
  }
  return secondsOrStr || "";
}
