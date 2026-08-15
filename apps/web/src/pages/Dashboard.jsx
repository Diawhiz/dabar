import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSermons } from "../lib/api.js";
import { recentSermons } from "../data/mockData.js";
import ReelStrip from "../components/ReelStrip.jsx";
import SermonCard from "../components/SermonCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Btn from "../components/Btn.jsx";

export default function Dashboard() {
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usedMock, setUsedMock] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    listSermons()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setSermons(data);
        } else if (mounted) {
          // Fallback to mock data for demo
          setSermons(recentSermons);
          setUsedMock(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setSermons(recentSermons);
          setUsedMock(true);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-10 pb-20">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Your sermons</h1>
          <p className="mt-1 text-sm text-muted">
            {sermons.length > 0
              ? `${sermons.length} sermon${sermons.length !== 1 ? "s" : ""} in your library.`
              : "Your sermon library is empty."}
          </p>
        </div>
        <Btn onClick={() => navigate("/upload")}>
          <i className="bx bx-upload text-lg" aria-hidden="true" />
          Upload new sermon
        </Btn>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="py-16 text-center">
          <i className="bx bx-loader-alt bx-spin text-3xl text-ember mb-3" aria-hidden="true" />
          <p className="text-sm text-muted">Loading your sermon library…</p>
        </div>
      ) : sermons.length > 0 ? (
        <>
          {/* Reel strip */}
          <ReelStrip label="Recent sermon recordings">
            {sermons.map((sermon) => (
              <SermonCard key={sermon.id} sermon={sermon} />
            ))}
          </ReelStrip>

          {/* Accessible list view below the reel */}
          <section className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold text-ink">All sermons in library</h2>
              <span className="text-xs text-muted">Click any sermon to review clips or manuscript</span>
            </div>

            <div className="divide-y divide-border rounded-card border border-border bg-paper overflow-hidden shadow-card">
              {sermons.map((sermon) => {
                const isReady = (sermon.status || "").toLowerCase().includes("clip") || (sermon.status || "").toLowerCase().includes("ready") || (sermon.status || "").toLowerCase().includes("complete");
                return (
                  <button
                    key={sermon.id}
                    onClick={() => navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface focus-visible:bg-surface group"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-ink truncate group-hover:text-ember transition-colors">
                        {sermon.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {sermon.speaker && `${sermon.speaker} · `}{sermon.date || "Recent"}{sermon.duration ? ` · ${sermon.duration}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isReady ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-ember bg-ember/10 px-2.5 py-1 rounded-full">
                          <i className="bx bx-check-circle text-sm" aria-hidden="true" />
                          Clips Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted bg-surface px-2.5 py-1 rounded-full">
                          <i className="bx bx-loader-alt bx-spin text-sm" aria-hidden="true" />
                          {sermon.status || "Transcribing"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          heading="No sermons yet"
          message="Upload your first sermon to get started. Paste a YouTube link or upload an audio file."
          actionLabel="Upload sermon"
          onAction={() => navigate("/upload")}
        />
      )}
    </div>
  );
}
