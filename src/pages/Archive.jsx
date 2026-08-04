import { Search, X, BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import SermonRow from "../components/SermonRow.jsx";
import { listSermons } from "../lib/api.js";

export default function Archive() {
  const [query, setQuery] = useState("");
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    listSermons()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setSermons(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch sermon archive:", err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return sermons;

    return sermons.filter((sermon) =>
      [sermon.title, sermon.youtube_url, sermon.status].some(
        (val) => val && String(val).toLowerCase().includes(normalized)
      )
    );
  }, [query, sermons]);

  return (
    <div className="mx-auto max-w-5xl py-6">
      <PageHeader
        eyebrow="Media Library"
        title="Past Sermon Projects"
        description="Browse, search, and access all sermon teachings and transcript packages created for your church channels."
      />

      {/* SEARCH CONTROL */}
      <section className="mb-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, YouTube URL, or status..."
            className="h-14 w-full rounded-2xl border border-linen bg-cream pl-13 pr-12 text-base font-medium text-umber shadow-soft outline-none transition-all focus:border-gold/50 focus:shadow-glow"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-walnut/60 hover:bg-parchment hover:text-navy"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </section>

      {/* RESULTS LIST */}
      <section>
        <div className="mb-4 flex items-center justify-between px-1 text-xs font-semibold text-walnut">
          <span>Showing {filtered.length} sermon projects</span>
          <span>Sorted by recent date</span>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-linen bg-cream p-12 text-center text-sm font-semibold text-walnut">
            Loading sermon archive from database...
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((sermon) => <SermonRow key={sermon.id} sermon={sermon} />)
        ) : (
          <div className="rounded-3xl border border-linen bg-cream px-6 py-16 text-center shadow-soft">
            <BookOpen size={36} className="mx-auto text-gold/60" />
            <p className="mt-4 font-serif text-xl font-semibold text-navy">No sermons match your search</p>
            <p className="mt-1 text-sm text-walnut">Try clearing your search term or processing a new sermon.</p>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="mt-4 rounded-full bg-parchment px-5 py-2 text-xs font-bold text-navy hover:bg-gold/20"
              >
                Reset Search
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
