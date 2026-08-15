import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSermons } from "../lib/api.js";
import { recentSermons } from "../data/mockData.js";
import Btn from "../components/Btn.jsx";

export default function Dashboard() {
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all" | "ready" | "processing"
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

  // Filtered sermons
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

  const totalClipsCount = sermons.reduce((acc, s) => acc + (s.highlights?.length || (s.clips_count || 0)), 0);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner & Quick Stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Sermon Desk
          </h1>
          <p className="mt-1 text-sm text-muted">
            {sermons.length > 0
              ? `${sermons.length} sermons in your archive · ${totalClipsCount} moments ready to share`
              : "Your sermon library is empty."}
          </p>
        </div>

        <Btn onClick={() => navigate("/upload")} className="shrink-0 shadow-sm">
          <i className="bx bx-plus text-lg" aria-hidden="true" />
          Add a Sermon
        </Btn>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between font-sans">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <i className="bx bx-search absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-base" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, speaker, Bible verse…"
            className="w-full rounded-xl border border-border bg-paper pl-9 pr-3.5 py-2 text-xs text-ink placeholder:text-muted/60 outline-none transition-colors focus:border-amber"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs"
            >
              <i className="bx bx-x" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "all", label: "All Sermons" },
            { key: "ready", label: "Ready to Share" },
            { key: "processing", label: "In Progress" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === key
                  ? "bg-surface text-ink border border-border shadow-xs"
                  : "text-muted hover:text-ink hover:bg-surface/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sermon Grid */}
      {isLoading ? (
        <div className="py-24 text-center space-y-3">
          <i className="bx bx-loader-alt bx-spin text-3xl text-amber" aria-hidden="true" />
          <p className="text-sm text-muted font-sans">Opening your sermon archive…</p>
        </div>
      ) : filteredSermons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredSermons.map((sermon) => {
            const isReady = (sermon.status || "").toLowerCase().includes("clip") || (sermon.status || "").toLowerCase().includes("ready") || (sermon.status || "").toLowerCase().includes("complete");
            const clipCount = sermon.highlights?.length || (sermon.clips_count || 0);

            return (
              <div
                key={sermon.id}
                className="group relative rounded-2xl border border-border/90 bg-paper p-5 transition-all duration-200 hover:border-amber/60 hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Metadata Strip */}
                  <div className="flex items-center justify-between text-xs text-muted font-sans">
                    <span className="font-medium text-ink-secondary">
                      {sermon.speaker || "Pastor"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{sermon.date || "Recent"}</span>
                      {sermon.duration && (
                        <>
                          <span>·</span>
                          <span>{sermon.duration}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h2
                    onClick={() => navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)}
                    className="font-display text-lg font-bold text-ink leading-snug cursor-pointer group-hover:text-amber transition-colors line-clamp-2"
                  >
                    {sermon.title || "Untitled Sermon"}
                  </h2>

                  {/* Scripture Badges if detected */}
                  {sermon.scripture_references && sermon.scripture_references.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {sermon.scripture_references.slice(0, 3).map((ref, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber bg-surface px-2.5 py-0.5 rounded-full border border-border/80"
                        >
                          <i className="bx bx-bookmark text-xs" />
                          {ref}
                        </span>
                      ))}
                      {sermon.scripture_references.length > 3 && (
                        <span className="text-[10px] text-muted self-center">
                          +{sermon.scripture_references.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between font-sans">
                  {isReady ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber">
                      <i className="bx bx-check-circle text-sm" />
                      {clipCount > 0 ? `${clipCount} moments ready` : "Ready"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      <i className="bx bx-loader-alt bx-spin text-sm" />
                      {sermon.status || "Transcribing…"}
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/clips/${sermon.id}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink bg-surface hover:bg-surface-warm transition-colors"
                    >
                      Open Studio
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-surface text-amber flex items-center justify-center mx-auto text-2xl">
            <i className="bx bx-book-open" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">No sermons found</h3>
            <p className="text-xs text-muted font-sans mt-1">
              {searchQuery ? "Try searching for a different keyword or Bible reference." : "Bring in your first sermon recording to get started."}
            </p>
          </div>
          <Btn onClick={() => navigate("/upload")} size="sm">
            Add a sermon
          </Btn>
        </div>
      )}
    </div>
  );
}
