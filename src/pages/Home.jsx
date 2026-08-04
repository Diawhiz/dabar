import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Link2, Scissors, Sparkles, Wand2, Zap, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
    <div className="space-y-20">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden py-10 sm:py-16">
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-1/2 h-96 w-96 rounded-full bg-navy/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-cream/90 px-4 py-1.5 shadow-soft backdrop-blur-xl">
            <Sparkles size={15} className="text-gold animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-navy">
              AI-Powered Sermon Clipping Engine
            </span>
          </div>

          <h1 className="mx-auto max-w-3xl font-serif text-5xl font-semibold leading-[1.08] tracking-tight text-navy sm:text-7xl">
            Every sermon has a moment. <br className="hidden sm:inline" />
            <span className="gold-gradient-text">Find & share it in seconds.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-walnut sm:text-xl">
            Paste a sermon link and Dabar instantly transcribes, highlights conviction-rich moments, and prepares vertical clips ready for your church's social channels.
          </p>

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
              High-accuracy Whisper speech recognition maps timestamped transcripts for full sermon searching.
            </p>
          </div>

          <div className="rounded-3xl border border-linen/80 bg-cream p-7 shadow-soft transition-transform hover:-translate-y-1">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-navy/10 text-navy">
              <Sparkles size={22} />
            </div>
            <h3 className="mt-5 font-serif text-2xl font-semibold text-navy">2. Conviction Detection</h3>
            <p className="mt-3 text-sm leading-relaxed text-walnut">
              AI analyzes speech tone, cadence, and semantic weight to pinpoint invitations and key teaching quotes.
            </p>
          </div>

          <div className="rounded-3xl border border-linen/80 bg-cream p-7 shadow-soft transition-transform hover:-translate-y-1">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-800">
              <Scissors size={22} />
            </div>
            <h3 className="mt-5 font-serif text-2xl font-semibold text-navy">3. Vertical 9:16 Clips</h3>
            <p className="mt-3 text-sm leading-relaxed text-walnut">
              Export ready-to-post short videos with burnt-in captions for Instagram Reels, YouTube Shorts, and TikTok.
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
            <p className="mt-1 text-sm text-walnut">Latest teachings processed in your Django media database.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/archive")}>
            View Full Archive
          </Button>
        </div>

        {isLoadingSermons ? (
          <div className="rounded-3xl border border-linen bg-cream p-12 text-center text-sm font-semibold text-walnut">
            Loading recent sermons from server...
          </div>
        ) : sermons.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((sermon) => (
              <article
                key={sermon.id}
                onClick={() => navigate(`/processing/${sermon.id}`)}
                className="group cursor-pointer rounded-3xl border border-linen/90 bg-cream p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-warm"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-navy">
                    {sermon.status}
                  </span>
                  <span className="text-xs font-semibold text-walnut/70">
                    {new Date(sermon.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="mt-4 font-serif text-2xl font-semibold leading-snug text-navy transition-colors group-hover:text-gold-dark">
                  {sermon.title || sermon.youtube_url}
                </h3>
                <p className="mt-2 text-xs font-semibold text-gold border-t border-linen/60 pt-3">
                  {sermon.youtube_url}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-linen bg-cream p-12 text-center">
            <PlayCircle size={36} className="mx-auto text-gold/60" />
            <p className="mt-4 font-serif text-xl font-semibold text-navy">No sermons in your database yet</p>
            <p className="mt-1 text-sm text-walnut">Paste a YouTube sermon link above to process your first message!</p>
          </div>
        )}
      </section>
    </div>
  );
}
