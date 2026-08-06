import { Search, X, BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl py-6"
    >
      <PageHeader
        eyebrow="Sermon Repository"
        title="Indexed Sermon Projects"
        description="Browse, search, and access all sermon teachings and transcript packages created for your church channels."
      />

      {/* SEARCH CONTROL */}
      <section className="mb-8">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-pulse-gold" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, YouTube URL, or status..."
            className="h-12 w-full rounded-2xl border border-signal-border bg-signal-panel/80 pl-12 pr-10 text-sm font-medium text-text-primary shadow-signal outline-none transition-colors focus:border-pulse-gold/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-text-muted hover:bg-signal-hover hover:text-text-primary"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </section>

      {/* RESULTS LIST */}
      <section>
        <div className="mb-4 flex items-center justify-between px-1 font-mono text-xs text-text-muted">
          <span>Showing {filtered.length} sermon projects</span>
          <span>Sorted by recent date</span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-signal-border bg-signal-panel p-12 text-center font-mono text-xs font-semibold text-text-secondary">
            Loading sermon repository from database...
          </div>
        ) : filtered.length > 0 ? (
          <AnimatePresence>
            {filtered.map((sermon) => (
              <SermonRow key={sermon.id} sermon={sermon} />
            ))}
          </AnimatePresence>
        ) : (
          <div className="rounded-2xl border border-signal-border bg-signal-panel px-6 py-16 text-center shadow-signal">
            <BookOpen size={32} className="mx-auto text-pulse-gold/60" />
            <p className="mt-3 font-display text-lg font-bold text-text-primary">No sermons match your search</p>
            <p className="mt-1 text-xs text-text-muted">Try clearing your search term or processing a new sermon.</p>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="mt-4 rounded-xl border border-signal-border bg-signal-bg px-4 py-2 font-mono text-xs font-bold text-pulse-gold hover:border-pulse-gold"
              >
                Reset Search
              </button>
            )}
          </div>
        )}
      </section>
    </motion.div>
  );
}

