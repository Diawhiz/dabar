import { useState } from "react";
import { ArrowRight, CalendarDays, Link2, Scissors, Sparkles, Wand2, Zap, Clock, ShieldCheck, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import { recentSermons } from "../data/mockData.js";
import { createSermon } from "../lib/api.js";

const sampleUrls = [
  { label: "Faith for the Waiting Season", url: "https://youtube.com/watch?v=faith-waiting-season" },
  { label: "The Courage to Begin Again", url: "https://youtube.com/watch?v=courage-to-begin" },
  { label: "Built on the Word", url: "https://youtube.com/watch?v=built-on-the-word" },
];

export default function Home() {
  const [url, setUrl] = useState("https://youtube.com/watch?v=sermon-example");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

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
    <div className="space-y-20">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden py-10 sm:py-16">
        {/* Subtle Background Glow Orbs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-1/2 h-96 w-96 rounded-full bg-navy/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Eyebrow Badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-cream/90 px-4 py-1.5 shadow-soft backdrop-blur-xl">
            <Sparkles size={15} className="text-gold animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-navy">
              AI-Powered Sermon Clipping Engine
            </span>
          </div>

          {/* Main Hero Heading */}
          <h1 className="mx-auto max-w-3xl font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-navy sm:text-7xl">
            Every sermon has a moment. <br className="hidden sm:inline" />
            <span className="gold-gradient-text">Find & share it in seconds.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-walnut sm:text-xl">
            Paste a sermon link and Dabar instantly transcribes, highlights conviction-rich moments, and prepares vertical clips ready for your church's social channels.
          </p>

          {/* URL Input Form */}
          <form
            className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-[2.5rem] border border-linen/90 bg-cream p-3 shadow-warm transition-all duration-300 focus-within:border-gold/50 focus-within:shadow-glow sm:flex-row"
            onSubmit={handleSubmit}
          >
            <label className="relative flex-1">
              <span className="sr-only">YouTube sermon link</span>
              <Link2 className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={20} />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste YouTube sermon link (e.g. https://youtube.com/watch?v=...)"
                className="h-14 w-full rounded-full bg-parchment/70 pl-12 pr-5 text-base font-medium text-umber outline-none transition placeholder:text-walnut/50 focus:bg-cream"
              />
            </label>
            <Button type="submit" variant="gold" className="h-14 whitespace-nowrap px-8 text-base shadow-glow">
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Wand2 size={18} className="animate-spin" /> Processing...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  Extract Sermon Clips <ArrowRight size={18} />
                </span>
              )}
            </Button>
          </form>

          {/* Quick Preset Samples */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-walnut">
            <span className="text-walnut/60">Try sample:</span>
            {sampleUrls.map((sample) => (
              <button
                key={sample.url}
                type="button"
                onClick={() => setUrl(sample.url)}
                className="rounded-full bg-parchment/90 px-3 py-1 text-navy transition-colors hover:bg-gold/20 hover:text-gold-dark"
              >
                "{sample.label}"
              </button>
            ))}
          </div>

          {error && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
        </div>
      </section>

      {/* VALUE STATS COUNTER BANNER */}
      <section className="mx-auto max-w-5xl rounded-3xl border border-gold/20 bg-gradient-to-r from-navy via-navy to-navy-dark p-8 text-cream shadow-navyGlow">
        <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3 sm:divide-x sm:divide-cream/10">
          <div className="px-4">
            <p className="font-serif text-4xl font-bold text-gold-light">1,200+</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cream/70">
              Sermon Clips Created
            </p>
          </div>
          <div className="px-4">
            <p className="font-serif text-4xl font-bold text-gold-light">3.5 Hours</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cream/70">
              Saved Per Media Team / Week
            </p>
          </div>
          <div className="px-4">
            <p className="font-serif text-4xl font-bold text-gold-light">98.4%</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cream/70">
              Key Moment Detection Accuracy
            </p>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS */}
      <section className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">Built for Church Media Teams</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-navy sm:text-4xl">
            From Sunday Pulpit to Weekly Discipleship
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-linen/80 bg-cream p-7 shadow-soft transition-transform hover:-translate-y-1">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold-dark">
              <Zap size={22} />
            </div>
            <h3 className="mt-5 font-serif text-2xl font-semibold text-navy">1. Automated Transcription</h3>
            <p className="mt-3 text-sm leading-relaxed text-walnut">
              High-accuracy speech recognition maps timestamped transcripts for full sermon searching and indexing.
            </p>
          </div>

          <div className="rounded-3xl border border-linen/80 bg-cream p-7 shadow-soft transition-transform hover:-translate-y-1">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-navy/10 text-navy">
              <Sparkles size={22} />
            </div>
            <h3 className="mt-5 font-serif text-2xl font-semibold text-navy">2. Conviction Detection</h3>
            <p className="mt-3 text-sm leading-relaxed text-walnut">
              AI analyzes speech tone, cadence, and semantic weight to pinpoint invitations, key quotes, and illustrations.
            </p>
          </div>

          <div className="rounded-3xl border border-linen/80 bg-cream p-7 shadow-soft transition-transform hover:-translate-y-1">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-800">
              <Scissors size={22} />
            </div>
            <h3 className="mt-5 font-serif text-2xl font-semibold text-navy">3. Vertical 9:16 Clips</h3>
            <p className="mt-3 text-sm leading-relaxed text-walnut">
              Export ready-to-post short videos with animated burnt-in captions for Instagram Reels, YouTube Shorts, and TikTok.
            </p>
          </div>
        </div>
      </section>

      {/* RECENT SERMONS CAROUSEL */}
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gold" />
              <h2 className="font-serif text-3xl font-semibold text-navy">Recent Sermons</h2>
            </div>
            <p className="mt-1 text-sm text-walnut">Latest teachings processed into weekly content packages.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/archive")}>
            View Full Archive
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recentSermons.map((sermon) => (
            <article
              key={sermon.id}
              onClick={() => navigate("/highlights")}
              className="group cursor-pointer rounded-3xl border border-linen/90 bg-cream p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-warm"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-navy">
                  {sermon.platform}
                </span>
                <span className="text-xs font-semibold text-walnut/70">{sermon.duration}</span>
              </div>

              <h3 className="mt-4 font-serif text-2xl font-semibold leading-snug text-navy transition-colors group-hover:text-gold-dark">
                {sermon.title}
              </h3>
              <p className="mt-2 text-sm font-medium text-walnut">{sermon.speaker}</p>

              <div className="mt-6 flex items-center justify-between border-t border-linen/60 pt-4 text-xs font-semibold text-walnut">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={15} className="text-gold" />
                  {sermon.date}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1 font-bold text-navy">
                  <Scissors size={15} className="text-gold" />
                  {sermon.clipCount}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
