import { useState } from "react";
import { Clock3, Scissors, Sparkles, Volume2, Play, Pause, Check } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { highlights } from "../data/mockData.js";

const tones = ["All Tones", "Encouraging", "Reflective", "Hopeful", "Teaching", "Pastoral"];

export default function Highlights() {
  const [selectedTone, setSelectedTone] = useState("All Tones");
  const [playingId, setPlayingId] = useState(null);

  const filteredHighlights = selectedTone === "All Tones"
    ? highlights
    : highlights.filter((h) => h.tone === selectedTone);

  function toggleAudio(id) {
    setPlayingId(playingId === id ? null : id);
  }

  return (
    <div className="mx-auto max-w-6xl py-6">
      <PageHeader
        eyebrow="AI Moment Detection"
        title="5 Sermon Highlights Found"
        description="Dabar scanned the sermon for key invitations, core theological truths, and memorable illustrations worth turning into short-form media."
        action={
          <Link to="/clips">
            <Button variant="gold" className="px-7">
              <Scissors size={18} />
              Studio Clip Generator
            </Button>
          </Link>
        }
      />

      {/* TONE FILTER CHIPS */}
      <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-linen pb-5">
        <span className="mr-2 text-xs font-bold uppercase tracking-wider text-walnut">Filter by Tone:</span>
        {tones.map((tone) => (
          <button
            key={tone}
            onClick={() => setSelectedTone(tone)}
            className={[
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200",
              selectedTone === tone
                ? "bg-navy text-cream shadow-navyGlow"
                : "bg-cream text-walnut hover:bg-parchment hover:text-navy border border-linen",
            ].join(" ")}
          >
            {tone}
          </button>
        ))}
      </div>

      {/* HIGHLIGHTS CARDS LIST */}
      <section className="space-y-6">
        {filteredHighlights.map((highlight) => {
          const isPlaying = playingId === highlight.id;

          return (
            <article
              key={highlight.id}
              className="group rounded-3xl border border-linen/90 bg-cream p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-warm"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                {/* Header Meta */}
                <div className="space-y-3 lg:max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-3.5 py-1 text-xs font-bold text-navy">
                      <Clock3 size={14} className="text-gold" />
                      {highlight.timestamp}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold-dark">
                      <Sparkles size={13} />
                      {highlight.score}% AI Confidence
                    </span>
                    <span className="rounded-full bg-parchment px-3 py-1 text-xs font-semibold text-walnut">
                      {highlight.tone}
                    </span>
                  </div>

                  <h2 className="font-serif text-2xl font-bold leading-snug text-navy transition-colors group-hover:text-gold-dark">
                    {highlight.title}
                  </h2>

                  {/* Transcript quote block */}
                  <blockquote className="rounded-2xl border-l-4 border-gold bg-parchment/60 p-4 text-base italic leading-relaxed text-umber">
                    "{highlight.transcript}"
                  </blockquote>
                </div>

                {/* Right Actions Block */}
                <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-end lg:justify-center">
                  <button
                    type="button"
                    onClick={() => toggleAudio(highlight.id)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-linen bg-parchment px-4 text-xs font-bold text-navy transition-colors hover:bg-gold/20"
                  >
                    {isPlaying ? <Pause size={16} className="text-gold" /> : <Play size={16} className="text-gold" />}
                    <span>{isPlaying ? "Pause Audio" : "Preview Audio"}</span>
                  </button>

                  <Link to="/clips">
                    <Button className="h-11 px-6">
                      <Scissors size={16} />
                      Create 9:16 Clip
                    </Button>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
