const DEFAULT_API_URL =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? "https://dabar-1.onrender.com"
    : "http://127.0.0.1:8000";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL;


async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.youtube_url?.[0] ??
      data?.detail ??
      "Dabar could not complete that request.";
    throw new Error(message);
  }

  return data;
}

export function listSermons() {
  return request("/api/sermons/");
}

export function createSermon(youtubeUrl) {
  return request("/api/sermons/", {
    method: "POST",
    body: JSON.stringify({ youtube_url: youtubeUrl }),
  });
}

export function getSermon(id) {
  return request(`/api/sermons/${id}/`);
}

export function getTranscript(sermonId) {
  return request(`/api/sermons/${sermonId}/transcript/`);
}

export function triggerTranscription(sermonId, backend = "groq") {
  return request(`/api/sermons/${sermonId}/transcribe/`, {
    method: "POST",
    body: JSON.stringify({ backend }),
  });
}

/**
 * Download a video clip segment as MP4 from the backend.
 * Returns true on success, throws on failure.
 */
export async function downloadClip(youtubeUrl, start, end) {
  const params = new URLSearchParams({
    url: youtubeUrl,
    start: String(start),
    end: String(end),
  });

  const response = await fetch(`${API_BASE_URL}/api/clips/download/?${params}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Clip download failed.");
  }

  // Extract filename from Content-Disposition header or use a default
  const disposition = response.headers.get("Content-Disposition") || "";
  const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : `dabar-clip-${Math.floor(start)}s.mp4`;

  // Stream response as blob and trigger browser download
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return true;
}
