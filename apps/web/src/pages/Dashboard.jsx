import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSermons } from "../lib/api.js";
import { recentSermons } from "../data/mockData.js";
import { cleanSermonTitle } from "../lib/formatters.js";
import Btn from "../components/Btn.jsx";

export default function Dashboard() {
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <div className="space-y-6 pb-16">
      {/* ── Screen Header ────────────────────────────────────────── */}
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            Sermon Library
          </h1>
          <p className="text-xs text-secondary font-sans mt-0.5">
            {sermons.length} {sermons.length === 1 ? "sermon" : "sermons"} in your local library
          </p>
        </div>

        <Btn onClick={() => navigate("/upload")}>
          <i className="bx bx-upload text-base" />
          <span>Add a Sermon</span>
        </Btn>
      </div>

      {/* ── Sermon Manuscript List ────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 text-center space-y-2 font-sans">
          <i className="bx bx-loader-alt bx-spin text-2xl text-accent" />
          <p className="text-xs text-secondary">Loading sermons…</p>
        </div>
      ) : sermons.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
          {sermons.map((sermon) => {
            const cleanTitle = cleanSermonTitle(sermon.title);
            const isReady = (sermon.status || "").toLowerCase().includes("clip") ||
              (sermon.status || "").toLowerCase().includes("ready") ||
              (sermon.status || "").toLowerCase().includes("complete");
            const clipsCount = sermon.highlights?.length || (sermon.clips_count || 0);

            return (
              <div
                key={sermon.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-hover transition-colors"
              >
                {/* Left: Metadata & Title */}
                <div className="space-y-1.5 min-w-0">
                  {/* Render actual metadata only if present — zero fake template text */}
                  {(sermon.speaker || sermon.date || sermon.duration) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-secondary font-sans">
                      {sermon.speaker && (
                        <span className="font-semibold text-primary">{sermon.speaker}</span>
                      )}
                      {sermon.speaker && (sermon.date || sermon.duration) && (
                        <span>·</span>
                      )}
                      {sermon.date && <span>{sermon.date}</span>}
                      {sermon.date && sermon.duration && <span>·</span>}
                      {sermon.duration && <span>{sermon.duration}</span>}
                    </div>
                  )}

                  {/* Clean title — fully legible, high contrast */}
                  <h2
                    onClick={() => navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)}
                    className="font-display text-base sm:text-lg font-bold text-primary cursor-pointer hover:text-accent transition-colors leading-snug"
                  >
                    {cleanTitle}
                  </h2>

                  {/* Scripture Badges if detected */}
                  {sermon.scripture_references && sermon.scripture_references.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 font-sans">
                      {sermon.scripture_references.map((ref, idx) => (
                        <span key={idx} className="scripture-badge">
                          <i className="bx bx-book-open text-xs" />
                          <span>{ref}</span>
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
                        type="button"
                        onClick={() => navigate(`/transcript/${sermon.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-base border border-border text-primary hover:border-accent transition-colors"
                      >
                        <i className="bx bx-file text-sm text-accent" />
                        <span>Manuscript</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/clips/${sermon.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
                      >
                        <i className="bx bx-cut text-sm" />
                        <span>Clips ({clipsCount})</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/processing/${sermon.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-secondary bg-base border border-border"
                    >
                      <i className="bx bx-loader-alt bx-spin text-sm text-accent" />
                      <span>Processing…</span>
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
            <p className="text-sm font-semibold text-primary">Your sermon library is empty</p>
            <p className="text-xs text-secondary mt-0.5">
              Add a sermon file or YouTube link to start.
            </p>
          </div>
          <Btn onClick={() => navigate("/upload")} size="sm">
            <i className="bx bx-upload text-sm" />
            <span>Add a Sermon</span>
          </Btn>
        </div>
      )}
    </div>
  );
}
