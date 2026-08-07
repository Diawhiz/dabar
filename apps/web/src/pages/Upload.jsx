import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSermon } from "../lib/api.js";
import Btn from "../components/Btn.jsx";
import Waveform from "../components/Waveform.jsx";

export default function Upload() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please paste a YouTube sermon link.");
      return;
    }

    // Basic URL check
    if (!trimmed.includes("youtube.com/") && !trimmed.includes("youtu.be/")) {
      setError("That doesn't look like a YouTube link — check and try again.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const sermon = await createSermon(trimmed);
      navigate(`/processing/${sermon.id}`);
    } catch (err) {
      setError(err.message || "Something went wrong — try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Add a sermon</h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Paste the YouTube link to your sermon video. Dabar will pull the
          audio, transcribe every word, and find the moments worth sharing.
        </p>
      </div>

      <Waveform mode="divider" />

      <form onSubmit={handleSubmit} className="space-y-5">
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

        {error && (
          <div className="rounded-card border border-ember/30 bg-ember/5 px-4 py-3 text-sm text-ember flex items-start gap-2">
            <i className="bx bx-error-circle text-lg shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Btn type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <i className="bx bx-loader-alt bx-spin text-lg" aria-hidden="true" />
              Processing…
            </>
          ) : (
            <>
              <i className="bx bx-upload text-lg" aria-hidden="true" />
              Start processing
            </>
          )}
        </Btn>
      </form>

      {/* Helpful note */}
      <div className="rounded-card bg-surface px-5 py-4 text-xs text-muted leading-relaxed">
        <p>
          <strong className="text-ink">What happens next?</strong> Dabar
          listens to the full sermon, transcribes it, and identifies the
          strongest moments for short-form clips. This usually takes a few
          minutes depending on the sermon length.
        </p>
      </div>
    </div>
  );
}
