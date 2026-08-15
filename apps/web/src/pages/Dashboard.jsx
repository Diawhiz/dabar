import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSermons } from "../lib/api.js";
import { recentSermons } from "../data/mockData.js";
import Btn from "../components/Btn.jsx";

export default function Dashboard() {
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    listSermons()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setSermons(data);
        } else if (mounted) {
          setSermons(recentSermons);
        }
      })
      .catch(() => {
        if (mounted) setSermons(recentSermons);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const filteredSermons = sermons.filter((s) => {
    const isReady = (s.status || "").toLowerCase().includes("clip") || (s.status || "").toLowerCase().includes("ready") || (s.status || "").toLowerCase().includes("complete");
    if (filter === "ready" && !isReady) return false;
    if (filter === "processing" && isReady) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (s.title || "").toLowerCase().includes(q) ||
        (s.speaker || "").toLowerCase().includes(q) ||
        (s.scripture_references || []).some((ref) => ref.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* ── Screen Header ────────────────────────────────────────── */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            Sermon Library
          </h1>
          <p className="mt-0.5 text-xs text-secondary font-sans">
            {sermons.length} sermons in your archive
          </p>
        </div>

        <Btn onClick={() => navigate("/upload")}>
          <i className="bx bx-upload text-base" />
          Add a Sermon
        </Btn>
      </div>

      {/* ── Search & Filter ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between font-sans">
        <div className="relative w-full sm:w-80">
          <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles, pastors, or scriptures…"
            className="w-full rounded-lg border border-border bg-surface pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-secondary outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {[
            { key: "all", label: "All" },
            { key: "ready", label: "Ready to Share" },
            { key: "processing", label: "In Progress" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filter === key
                  ? "bg-surface text-primary border border-border"
                  : "text-secondary hover:text-primary hover:bg-surface/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sermon Manuscript List ────────────────────────────────── */}
      {isLoading ? (
        <div className="py-24 text-center space-y-2 font-sans">
          <i className="bx bx-loader-alt bx-spin text-2xl text-accent" />
          <p className="text-xs text-secondary">Loading sermons…</p>
        </div>
      ) : filteredSermons.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
          {filteredSermons.map((sermon) => {
            const isReady = (sermon.status || "").toLowerCase().includes("clip") || (sermon.status || "").toLowerCase().includes("ready") || (sermon.status || "").toLowerCase().includes("complete");
            const clipsCount = sermon.highlights?.length || (sermon.clips_count || 0);

            return (
              <div
                key={sermon.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-hover transition-colors"
              >
                {/* Left: Metadata & Title */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-secondary font-sans">
                    <span className="font-medium text-primary">{sermon.speaker || "Speaker"}</span>
                    <span>·</span>
                    <span>{sermon.date || "Recent"}</span>
                    {sermon.duration && (
                      <>
                        <span>·</span>
                        <span>{sermon.duration}</span>
                      </>
                    )}
                  </div>

                  <h2
                    onClick={() => navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)}
                    className="font-display text-base sm:text-lg font-bold text-primary cursor-pointer hover:text-accent transition-colors"
                  >
                    {sermon.title || "Untitled Sermon"}
                  </h2>

                  {/* Scripture Badges */}
                  {sermon.scripture_references && sermon.scripture_references.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 font-sans">
                      {sermon.scripture_references.slice(0, 3).map((ref, idx) => (
                        <span key={idx} className="scripture-badge">
                          <i className="bx bx-book-open text-xs" />
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0 font-sans">
                  {isReady ? (
                    <>
                      <button
                        onClick={() => navigate(`/transcript/${sermon.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-base border border-border text-primary hover:border-accent flex items-center gap-1.5 transition-colors"
                      >
                        <i className="bx bx-file text-sm text-accent" />
                        Manuscript
                      </button>

                      <button
                        onClick={() => navigate(`/clips/${sermon.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 flex items-center gap-1.5 transition-opacity"
                      >
                        <i className="bx bx-cut text-sm" />
                        Clips ({clipsCount})
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => navigate(`/processing/${sermon.id}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary bg-base border border-border flex items-center gap-1.5"
                    >
                      <i className="bx bx-loader-alt bx-spin text-sm text-accent" />
                      In Progress…
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-12 text-center space-y-3 font-sans">
          <div className="w-10 h-10 rounded-full bg-base text-accent flex items-center justify-center mx-auto text-xl border border-border">
            <i className="bx bx-book-open" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">No sermons found</p>
            <p className="text-xs text-secondary mt-0.5">
              {searchQuery ? "Try a different search term." : "Bring in your first sermon to start."}
            </p>
          </div>
          <Btn onClick={() => navigate("/upload")} size="sm">
            Add Sermon
          </Btn>
        </div>
      )}
    </div>
  );
}
