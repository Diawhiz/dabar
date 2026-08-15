import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon, pickMediaFile } from "../lib/api.js";
import Btn from "../components/Btn.jsx";

export default function Upload() {
  const [mode, setMode] = useState("file"); // "file" | "youtube"
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handlePickFile() {
    try {
      const path = await pickMediaFile();
      if (path) {
        setSelectedFile(path);
        setError("");
      }
    } catch (err) {
      setError(err.message || "Failed to open file picker.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    let source = "";
    if (mode === "youtube") {
      const trimmed = url.trim();
      if (!trimmed) {
        setError("Please paste a YouTube sermon link.");
        return;
      }
      if (!trimmed.includes("youtube.com/") && !trimmed.includes("youtu.be/")) {
        setError("That doesn't look like a valid YouTube link.");
        return;
      }
      source = trimmed;
    } else {
      if (!selectedFile) {
        setError("Please select a local audio or video file.");
        return;
      }
      source = selectedFile;
    }

    setIsSubmitting(true);
    try {
      const result = await createSermon(source);
      navigate(`/processing/${result.id}`);
    } catch (err) {
      setError(err.message || "Something went wrong — please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Add a sermon</h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Import a sermon recording or paste a YouTube link. Dabar will transcribe every word,
          structure the text, and extract key moments.
        </p>
      </div>

      {/* Mode selection tabs */}
      <div className="flex border-b border-border gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => { setMode("file"); setError(""); }}
          className={`pb-3 transition-colors relative flex items-center gap-2 ${
            mode === "file"
              ? "text-ember font-semibold border-b-2 border-ember"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bx-file text-base" aria-hidden="true" />
          Local Audio / Video
        </button>

        <button
          type="button"
          onClick={() => { setMode("youtube"); setError(""); }}
          className={`pb-3 transition-colors relative flex items-center gap-2 ${
            mode === "youtube"
              ? "text-ember font-semibold border-b-2 border-ember"
              : "text-muted hover:text-ink"
          }`}
        >
          <i className="bx bxl-youtube text-base" aria-hidden="true" />
          YouTube URL
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === "file" ? (
          <div className="space-y-3">
            <div
              onClick={handlePickFile}
              className="cursor-pointer rounded-card border-2 border-dashed border-border hover:border-ember bg-surface/50 hover:bg-surface p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center text-ember text-2xl shadow-sm">
                <i className={`bx ${selectedFile ? "bx-check" : "bx-upload"}`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {selectedFile ? selectedFile.split(/[/\\]/).pop() : "Click to select a sermon file"}
                </p>
                <p className="text-xs text-muted mt-1">
                  Supports MP4, MOV, MKV, MP3, WAV, M4A, OGG, Opus
                </p>
              </div>
              {selectedFile && (
                <span className="text-xs text-ember font-medium truncate max-w-xs block">
                  {selectedFile}
                </span>
              )}
            </div>
          </div>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-ink mb-2 block">YouTube sermon link</span>
            <div className="relative">
              <i className="bx bx-link-alt absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted" aria-hidden="true" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-card border border-border bg-paper pl-11 pr-4 py-3 text-sm text-ink placeholder:text-muted/50 outline-none transition-colors focus:border-ember"
              />
            </div>
          </label>
        )}

        {error && (
          <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember flex items-start gap-2">
            <i className="bx bx-error-circle text-lg shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Btn type="submit" className="w-full" size="lg" disabled={isSubmitting || (mode === "file" && !selectedFile)}>
          {isSubmitting ? (
            <>
              <i className="bx bx-loader-alt bx-spin text-lg" aria-hidden="true" />
              Starting pipeline…
            </>
          ) : (
            <>
              <i className="bx bx-play text-lg" aria-hidden="true" />
              Start processing
            </>
          )}
        </Btn>
      </form>

      <div className="rounded-card bg-surface px-5 py-4 text-xs text-muted leading-relaxed">
        <p>
          <strong className="text-ink">Local & Fast:</strong> Files are processed on your PC using local hardware acceleration. If connected to the internet, Dabar will also identify high-impact moments for short-form clips.
        </p>
      </div>
    </div>
  );
}
