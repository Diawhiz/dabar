import { useEffect, useState } from "react";
import { ArrowRight, Link2, Scissors, Sparkles, Wand2, Zap, PlayCircle, Radio, Disc } from "lucide-react";
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
    <div className="space-y-16">
      {/* HERO SECTION */}
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden py-12 sm:py-16 rounded-3xl border border-signal-border bg-signal-panel/80 px-6 sm:px-12 shadow-signal"
      >
        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-pulse-gold/30 bg-signal-bg px-4 py-1.5 shadow-sm">
            <Radio size={14} className="text-pulse-gold animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-pulse-gold">
              Sermon Clip Studio
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-6xl">
            Long-form preaching. <br />
            <span className="text-pulse-gold">Distilled into clips that travel.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Paste any YouTube sermon link. Dabar automatically transcribes the audio, detects key teaching moments, and slices ready-to-share video clips in seconds.
          </p>

          {/* Interactive Acoustic Distillation Waveform Ribbon */}
          <div className="my-8 flex items-center justify-center gap-1 sm:gap-1.5 py-4 px-6 rounded-2xl border border-signal-border/80 bg-signal-bg/90 shadow-inner">
            {[40, 65, 30, 85, 95, 45, 75, 100, 60, 90, 50, 80, 100, 70, 40, 90, 60, 85, 35, 75, 95, 50, 30, 60].map((h, i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.3, 1, 0.4] }}
                transition={{
                  repeat: Infinity,
                  repeatType: "reverse",
                  duration: 0.8 + (i % 4) * 0.2,
                }}
                style={{ height: `${h}%` }}
                className={`w-1 sm:w-1.5 rounded-full ${
                  i >= 7 && i <= 14 ? "bg-pulse-gold shadow-pulse" : "bg-signal-border/90 opacity-60"
                }`}
              />
            ))}
            <div className="ml-3 flex items-center gap-1.5 rounded-md bg-pulse-gold/10 px-2.5 py-1 font-mono text-[11px] font-bold text-pulse-gold border border-pulse-gold/30">
              <Disc size={12} className="animate-spin" />
              <span>CLIP DETECTED</span>
            </div>
          </div>

          {/* INPUT FORM */}
          <form
            className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 rounded-2xl border border-signal-border bg-signal-bg p-2.5 shadow-signal transition-colors focus-within:border-pulse-gold sm:flex-row"
            onSubmit={handleSubmit}
          >
            <label className="relative flex-1">
              <span className="sr-only">YouTube sermon link</span>
              <Link2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pulse-gold" size={18} />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste YouTube sermon URL (e.g. https://youtube.com/watch?v=...)"
                className="h-12 w-full rounded-xl bg-signal-panel pl-11 pr-4 text-sm font-medium text-text-primary outline-none transition placeholder:text-text-muted focus:bg-signal-card"
              />
            </label>
            <Button type="submit" variant="gold" className="h-12 whitespace-nowrap px-7 text-sm font-bold shadow-pulse">
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Wand2 size={16} className="animate-spin" /> Processing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  Extract Sermon Clips <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>

          {/* Sample Buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-text-muted">
            <span>Try sample:</span>
            {sampleUrls.map((sample) => (
              <button
                key={sample.url}
                type="button"
                onClick={() => setUrl(sample.url)}
                className="rounded-lg border border-signal-border bg-signal-card px-2.5 py-1 text-text-secondary transition-colors hover:border-pulse-gold hover:text-pulse-gold"
              >
                "{sample.label}"
              </button>
            ))}
          </div>

          {error && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
              {error}
            </div>
          )}
        </div>
      </motion.section>

      {/* FEATURE SEQUENCE */}
      <section className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-pulse-gold">WORKFLOW</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-text-primary sm:text-3xl">
            From Pulpit Audio to Shareable Clips
          </h2>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.15 } },
          }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-signal-border bg-signal-panel/80 p-6 shadow-signal transition-colors duration-200 hover:border-pulse-gold/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-pulse-gold/30 bg-pulse-gold/10 text-pulse-gold">
              <Zap size={20} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-text-primary">1. High-Precision Transcription</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Transcribes sermon audio with exact punctuation and precise segment timestamps.
            </p>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-signal-border bg-signal-panel/80 p-6 shadow-signal transition-colors duration-200 hover:border-pulse-gold/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-pulse-amber/30 bg-pulse-amber/10 text-pulse-amber">
              <Sparkles size={20} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-text-primary">2. Key Moment Mining</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Identifies high-impact quotes, core teaching points, and altar calls for 30–90 second clip moments.
            </p>
          </motion.div>

          <motion.div
            variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
            whileHover={{ y: -4 }}
            className="rounded-2xl border border-signal-border bg-signal-panel/80 p-6 shadow-signal transition-colors duration-200 hover:border-pulse-gold/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-pulse-cyan/30 bg-pulse-cyan/10 text-pulse-cyan">
              <Scissors size={20} />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-text-primary">3. Instant Clip Generation</h3>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              Generates ready-to-share MP4 video clips or instant timestamped social share links.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* RECENT SERMONS CAROUSEL */}
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pulse-gold animate-pulse" />
              <h2 className="font-display text-2xl font-bold text-text-primary">Recent Sermons</h2>
            </div>
            <p className="mt-1 text-xs font-mono text-text-muted">Indexed preachings in your sermon repository.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/archive")}>
            View Full Archive
          </Button>
        </div>

        {isLoadingSermons ? (
          <div className="rounded-2xl border border-signal-border bg-signal-panel p-10 text-center font-mono text-xs font-semibold text-text-secondary">
            Loading recent sermons from server...
          </div>
        ) : sermons.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon) => (
              <motion.article
                key={sermon.id}
                whileHover={{ y: -3 }}
                onClick={() => navigate(`/processing/${sermon.id}`)}
                className="group cursor-pointer rounded-2xl border border-signal-border bg-signal-panel/90 p-5 shadow-signal transition-colors duration-200 hover:border-pulse-gold/50 hover:bg-signal-card"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md border border-pulse-gold/30 bg-pulse-gold/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-pulse-gold">
                    {sermon.status}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {new Date(sermon.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="mt-3 font-display text-lg font-bold leading-snug text-text-primary transition-colors group-hover:text-pulse-gold">
                  {sermon.title || sermon.youtube_url}
                </h3>
                <p className="mt-3 font-mono text-xs text-text-muted truncate border-t border-signal-border/50 pt-2.5">
                  {sermon.youtube_url}
                </p>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-signal-border bg-signal-panel p-10 text-center">
            <PlayCircle size={32} className="mx-auto text-pulse-gold/60" />
            <p className="mt-3 font-display text-lg font-bold text-text-primary">No sermons in repository yet</p>
            <p className="mt-1 text-xs text-text-muted">Paste a YouTube sermon link above to process your first message!</p>
          </div>
        )}
      </section>
    </div>
  );
}

