import { Clock3, Scissors } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import { highlights } from "../data/mockData.js";

export default function Highlights() {
  return (
    <div className="mx-auto max-w-6xl py-8">
      <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gold">Highlights</p>
          <h1 className="font-serif text-5xl font-semibold text-navy sm:text-6xl">5 moments found</h1>
        </div>
        <p className="max-w-md text-base leading-7 text-walnut">
          Review each suggested moment with the same care you give the message itself.
        </p>
      </div>

      <section>
        {highlights.map((highlight) => (
          <article
            key={highlight.id}
            className="grid gap-5 border-b border-linen py-7 last:border-b-0 lg:grid-cols-[11rem_1fr_auto] lg:items-center"
          >
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-parchment px-4 py-2 text-sm font-semibold text-navy">
                <Clock3 size={15} className="text-gold" />
                {highlight.timestamp}
              </span>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold leading-tight text-navy">{highlight.title}</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-walnut">"{highlight.transcript}"</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-gold">
                {highlight.tone} · {highlight.score}% confidence
              </p>
            </div>
            <div className="lg:justify-self-end">
              <Link to="/clips">
                <Button>
                  <Scissors size={16} />
                  Generate Clip
                </Button>
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
