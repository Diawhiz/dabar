import { useState } from "react";
import { ArrowRight, CalendarDays, Link2, Scissors } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import { recentSermons } from "../data/mockData.js";
import { createSermon } from "../lib/api.js";

export default function Home() {
  const [url, setUrl] = useState("https://youtube.com/watch?v=sermon-example");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
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
      <section className="grid min-h-[58vh] place-items-center py-10">
        <div className="w-full max-w-4xl text-center">
          <p className="mx-auto mb-5 w-fit text-xs font-bold uppercase tracking-[0.24em] text-gold">
            Sermon moments for the whole week
          </p>
          <h1 className="mx-auto max-w-3xl font-serif text-5xl font-semibold leading-[1.05] tracking-normal text-navy sm:text-7xl">
            Every sermon has a moment. Find it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-walnut">
            Paste a sermon link and Dabar helps your media team uncover the phrases, invitations, and teaching moments worth carrying into the week.
          </p>

          <form
            className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-[2rem] bg-cream p-3 shadow-warm sm:flex-row"
            onSubmit={handleSubmit}
          >
            <label className="relative flex-1">
              <span className="sr-only">YouTube sermon link</span>
              <Link2 className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={19} />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste YouTube sermon link"
                className="h-14 w-full rounded-full bg-parchment/70 pl-12 pr-5 text-base text-umber outline-none transition placeholder:text-walnut/55 focus:bg-cream focus:ring-2 focus:ring-gold/35"
              />
            </label>
            <Button type="submit" className="h-14 whitespace-nowrap px-7">
              {isSubmitting ? "Submitting..." : "Process Sermon"}
              <ArrowRight size={17} />
            </Button>
          </form>
          {error && <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold text-red-700">{error}</p>}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-navy">Recent sermons</h2>
            <p className="mt-2 text-sm text-walnut">Latest teachings prepared for your channels.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/archive")}>
            View Archive
          </Button>
        </div>

        <div className="-mx-5 flex snap-x gap-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
          {recentSermons.map((sermon) => (
            <article
              key={sermon.id}
              className="min-w-[300px] snap-start rounded-[1.75rem] bg-cream p-6 shadow-soft sm:min-w-[380px]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{sermon.platform}</p>
              <h3 className="mt-4 font-serif text-2xl font-semibold leading-tight text-navy">{sermon.title}</h3>
              <p className="mt-3 text-sm text-walnut">{sermon.speaker}</p>
              <div className="mt-8 flex items-center justify-between text-sm text-walnut">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} className="text-gold" />
                  {sermon.date}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Scissors size={16} className="text-gold" />
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
