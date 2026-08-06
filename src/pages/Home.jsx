import { useEffect, useState } from "react";
import { ArrowRight, Link2, Scissors, Sparkles, Wand2, Zap, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Button from "../components/Button.jsx";
import { createSermon, listSermons } from "../lib/api.js";

const sampleUrls = [
  { label: "Faith for the Waiting Season", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "Built on the Word", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
];

export default function Home() {
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sermons, setSermons] = useState([]);
  const [isLoadingSermons, setIsLoadingSermons] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    setIsLoadingSermons(true);

    listSermons()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setSermons(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch recent sermons:", err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSermons(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!url.trim()) {
      setError("Please paste a valid YouTube sermon URL.");
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      const sermon = await createSermon(url);
      navigate(`/processing/${sermon.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-16 py-4">
      {/* STUDIO DECK HERO */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-signal-border bg-signal-panel p-8 sm:p-12 shadow-signal"
      >
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <h1 className="font-editorial text-4xl font-bold tracking-tight text-text-primary sm:text-6xl sm:leading-[1.15]">
            Turn any sermon into clips <span className="text-pulse-gold italic font-normal">people actually watch.</span>
          </h1>

          <p className="mx-auto max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg font-sans">
            Paste a sermon video link. Get instant key moments, exact transcript quotes, and ready-to-share vertical clips for Reels, Shorts, and TikTok.
          </p>

          {/* URL INPUT DECK */}
          <form
            className="mx-auto mt-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-signal-border bg-signal-bg p-2 shadow-signal focus-within:border-pulse-gold sm:flex-row"
            onSubmit={handleSubmit}
          >
            <label className="relative flex-1">
              <span className="sr-only">YouTube sermon link</span>
              <Link2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pulse-gold" size={18} />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste YouTube sermon link..."
                className="h-12 w-full rounded-xl bg-signal-panel pl-11 pr-4 text-sm font-medium text-text-primary outline-none transition placeholder:text-text-muted"
              />
            </label>
            <Button type="submit" variant="gold" className="h-12 whitespace-nowrap px-7 text-sm font-bold shadow-pulse">
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Wand2 size={16} className="animate-spin" /> Processing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  Extract Clips <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>

          {/* Sample Presets */}
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-text-muted pt-2">
            <span>Try a sample:</span>
            {sampleUrls.map((sample) => (
              <button
                key={sample.url}
                type="button"
                onClick={() => setUrl(sample.url)}
                className="rounded-lg border border-signal-border bg-signal-bg px-3 py-1 text-text-secondary transition-colors hover:border-pulse-gold hover:text-pulse-gold"
              >
                "{sample.label}"
              </button>
            ))}
          </div>

          {error && (
            <div className="mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-3 font-mono text-xs font-semibold text-red-400">
              {error}
            </div>
          )}
        </div>
      </motion.section>

      {/* HOW IT WORKS WORKFLOW */}
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-pulse-gold">SIMPLE 3-STEP WORKFLOW</p>
          <h2 className="mt-1.5 font-display text-2xl font-bold text-text-primary sm:text-3xl">
            From Full Message to Shareable Clips
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-signal-border bg-signal-panel p-6 shadow-signal transition-transform hover:-translate-y-1">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-signal-border bg-signal-bg text-pulse-gold">
              <Zap size={20} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-text-primary">1. Paste Sermon Link</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary font-sans">
              Provide any sermon URL from YouTube. Dabar processes the audio and generates an exact transcript with timestamps.
            </p>
          </div>

          <div className="rounded-2xl border border-signal-border bg-signal-panel p-6 shadow-signal transition-transform hover:-translate-y-1">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-signal-border bg-signal-bg text-pulse-amber">
              <Sparkles size={20} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-text-primary">2. Review Key Moments</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary font-sans">
              Browse automatically extracted preaching quotes, key points, and conviction moments ready for social sharing.
            </p>
          </div>

          <div className="rounded-2xl border border-signal-border bg-signal-panel p-6 shadow-signal transition-transform hover:-translate-y-1">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-signal-border bg-signal-bg text-pulse-cyan">
              <Scissors size={20} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-text-primary">3. Export & Share Clips</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary font-sans">
              Download vertical 9:16 MP4 video clips or share timestamped video links directly to WhatsApp, Instagram, or YouTube.
            </p>
          </div>
        </div>
      </section>

      {/* RECENT SERMONS ARCHIVE REEL */}
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-text-primary">Recent Sermon Projects</h2>
            <p className="mt-0.5 text-xs text-text-muted">Preachings indexed in your studio repository.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/archive")}>
            View All Projects
          </Button>
        </div>

        {isLoadingSermons ? (
          <div className="rounded-2xl border border-signal-border bg-signal-panel p-10 text-center font-mono text-xs text-text-secondary">
            Loading recent sermons...
          </div>
        ) : sermons.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon) => (
              <article
                key={sermon.id}
                onClick={() => navigate(`/processing/${sermon.id}`)}
                className="group cursor-pointer rounded-2xl border border-signal-border bg-signal-panel p-5 shadow-signal transition-all duration-200 hover:-translate-y-1 hover:border-pulse-gold/50"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md border border-signal-border bg-signal-bg px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-pulse-gold">
                    {sermon.status}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {new Date(sermon.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="mt-3 font-editorial text-lg font-bold leading-snug text-text-primary transition-colors group-hover:text-pulse-gold">
                  {sermon.title || sermon.youtube_url}
                </h3>
                <p className="mt-3 font-mono text-xs text-text-muted truncate border-t border-signal-border/50 pt-2.5">
                  {sermon.youtube_url}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-signal-border bg-signal-panel p-10 text-center">
            <PlayCircle size={32} className="mx-auto text-pulse-gold/60" />
            <p className="mt-3 font-display text-lg font-bold text-text-primary">No sermon projects yet</p>
            <p className="mt-1 text-xs text-text-muted">Paste a YouTube sermon link above to process your first message!</p>
          </div>
        )}
      </section>
    </div>
  );
}


