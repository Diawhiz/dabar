import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listSermons } from "../lib/api.js";
import { cleanSermonTitle } from "../lib/formatters.js";
import Btn from "../components/Btn.jsx";

export default function Dashboard() {
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    listSermons()
      .then((data) => {
        if (mounted && Array.isArray(data)) {
          setSermons(data);
        } else if (mounted) {
          setSermons([]);
        }
      })
      .catch((err) => {
        console.warn("Could not list sermons:", err);
        if (mounted) setSermons([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return sermons;
    const q = filterQuery.toLowerCase();
    return sermons.filter((s) => {
      const title = (s.title || "").toLowerCase();
      const speaker = (s.speaker || "").toLowerCase();
      return title.includes(q) || speaker.includes(q);
    });
  }, [sermons, filterQuery]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h1 className="text-base font-semibold text-primary">Sermon Library</h1>
          <p className="text-xs text-secondary mt-0.5">
            {sermons.length} {sermons.length === 1 ? "recording" : "recordings"} in local storage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Btn onClick={() => navigate("/upload")}>
            <i className="bx bx-plus text-sm" />
            <span>Add Sermon</span>
          </Btn>
        </div>
      </header>

      {/* ── Search & Filter Toolbar ───────────────────────────────── */}
      <div className="px-6 py-3 border-b border-border bg-surface/50 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <i className="bx bx-search absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter by title or speaker…"
            className="w-full bg-surface border border-border rounded pl-8 pr-3 py-1 text-xs text-primary placeholder:text-muted outline-none focus:border-accent"
          />
        </div>
        {filterQuery && (
          <button
            onClick={() => setFilterQuery("")}
            className="text-xs text-secondary hover:text-primary"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* ── Table Content ─────────────────────────────────────────── */}
      <div className="page-content flex-1">
        {isLoading ? (
          <div className="py-20 text-center space-y-2">
            <i className="bx bx-loader-alt bx-spin text-xl text-accent" />
            <p className="text-xs text-secondary">Loading sermons…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="border border-border rounded-md bg-surface overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Sermon Title</th>
                  <th style={{ width: "20%" }}>Speaker</th>
                  <th style={{ width: "15%" }}>Duration</th>
                  <th style={{ width: "10%" }}>Status</th>
                  <th style={{ width: "15%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sermon) => {
                  const cleanTitle = cleanSermonTitle(sermon.title);
                  const statusStr = (sermon.status || "").toLowerCase();
                  const isReady =
                    statusStr.includes("clip") ||
                    statusStr.includes("ready") ||
                    statusStr.includes("complete");
                  const isFailed = statusStr.includes("fail") || statusStr.includes("error");
                  const chaptersCount = sermon.chapters?.length || sermon.highlights?.length || (sermon.clips_count || 0);

                  return (
                    <tr key={sermon.id}>
                      {/* Title */}
                      <td>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)
                            }
                            className="text-left font-medium text-primary hover:text-accent transition-colors leading-snug"
                          >
                            {cleanTitle}
                          </button>
                          {sermon.date && (
                            <span className="text-[11px] text-muted font-mono mt-0.5">
                              {sermon.date}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Speaker */}
                      <td className="text-secondary">
                        {sermon.speaker || <span className="text-muted">—</span>}
                      </td>

                      {/* Duration */}
                      <td>
                        {sermon.duration ? (
                          <span className="font-mono text-xs text-secondary">
                            {sermon.duration}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        {isReady ? (
                          <span className="status-pill ready">
                            <i className="bx bxs-check-circle text-xs" />
                            <span>Ready</span>
                          </span>
                        ) : isFailed ? (
                          <span className="status-pill failed">
                            <i className="bx bx-error-circle text-xs" />
                            <span>Failed</span>
                          </span>
                        ) : (
                          <span className="status-pill processing">
                            <i className="bx bx-loader-alt bx-spin text-xs" />
                            <span>Processing</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isReady ? (
                            <>
                              <button
                                type="button"
                                onClick={() => navigate(`/transcript/${sermon.id}`)}
                                className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-xs text-primary border border-border transition-colors"
                                title="Open Full Manuscript"
                              >
                                Manuscript
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/chapters/${sermon.id}`)}
                                className="px-2 py-1 rounded bg-surface-hover hover:bg-surface-active text-xs text-primary border border-border transition-colors"
                                title="Open Chapters"
                              >
                                Chapters
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/clips/${sermon.id}`)}
                                className="px-2.5 py-1 rounded bg-accent text-accent-fg hover:opacity-90 text-xs font-semibold transition-opacity flex items-center gap-1"
                                title="Open Video Clips Studio & Export"
                              >
                                <i className="bx bx-film text-xs" />
                                <span>Clips & Video</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/processing/${sermon.id}`)}
                              className="px-2 py-1 rounded bg-surface-hover text-xs text-secondary border border-border"
                            >
                              View Progress
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-border rounded-md bg-surface p-12 text-center space-y-3">
            <div className="w-8 h-8 rounded bg-surface-hover text-accent flex items-center justify-center mx-auto text-base border border-border">
              <i className="bx bx-folder" />
            </div>
            <div>
              <p className="text-xs font-semibold text-primary">No sermons found</p>
              <p className="text-[11px] text-muted mt-0.5">
                {filterQuery
                  ? "Try a different search term or clear the filter."
                  : "Add your first audio or video recording to get started."}
              </p>
            </div>
            {!filterQuery && (
              <Btn size="sm" onClick={() => navigate("/upload")}>
                <i className="bx bx-plus text-xs" />
                <span>Add Sermon</span>
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
