const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request(path, options = {}) {
  try {
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
  } catch (error) {
    // If Django backend is offline on localhost, return graceful fallback mock data
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      console.warn("Django backend offline at " + API_BASE_URL + ". Falling back to demo mode.");
      return getFallbackResponse(path, options);
    }
    throw error;
  }
}

function getFallbackResponse(path, options) {
  if (path.includes("/api/sermons/") && options.method === "POST") {
    return Promise.resolve({
      id: "demo-sermon-001",
      youtube_url: JSON.parse(options.body).youtube_url,
      title: "Faith for the Waiting Season",
      status: "transcribing",
      transcript: "God develops depth before visibility...",
      created_at: new Date().toISOString(),
    });
  }

  if (path.includes("/api/sermons/")) {
    return Promise.resolve({
      id: "demo-sermon-001",
      youtube_url: "https://youtube.com/watch?v=sermon-example",
      title: "Faith for the Waiting Season",
      status: "transcribing",
      transcript: "God develops depth before visibility...",
      created_at: new Date().toISOString(),
    });
  }

  return Promise.resolve(null);
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
