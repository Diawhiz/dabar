import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listSermons, createSermon, pickMediaFile } from "../lib/api.js";
import { cleanSermonTitle } from "../lib/formatters.js";
import Btn from "../components/Btn.jsx";

export default function Dashboard() {
  const [sermons, setSermons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [quickUrl, setQuickUrl] = useState("");
  const [isStartingQuick, setIsStartingQuick] = useState(false);
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

  const totalClips = useMemo(() => {
    return sermons.reduce((acc, s) => {
      const count =
        (s.highlights && s.highlights.length) ||
        (s.chapters && s.chapters.length) ||
        s.clips_count ||
        0;
      return acc + count;
    }, 0);
  }, [sermons]);

  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return sermons;
    const q = filterQuery.toLowerCase();
    return sermons.filter((s) => {
      const title = (s.title || "").toLowerCase();
      const speaker = (s.speaker || "").toLowerCase();
      return title.includes(q) || speaker.includes(q);
    });
  }, [sermons, filterQuery]);

  async function handleQuickSubmit(e) {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setIsStartingQuick(true);
    try {
      const res = await createSermon(quickUrl.trim());
      if (res?.id) {
        navigate(`/processing/${res.id}`);
      }
    } catch (err) {
      alert("Failed to start sermon processing: " + (err.message || err));
    } finally {
      setIsStartingQuick(false);
    }
  }

  async function handlePickLocal() {
    try {
      const path = await pickMediaFile();
      if (path) {
        const res = await createSermon(path);
        if (res?.id) {
          navigate(`/processing/${res.id}`);
        }
      }
    } catch (err) {
      alert("File selection error: " + (err.message || err));
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <header className="page-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono-code text-[10px] text-accent uppercase tracking-widest font-semibold">
              Archival & Production
            </span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-primary tracking-tight">
            Sermon Library & Studio Desk
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Btn variant="secondary" onClick={handlePickLocal}>
            <i className="bx bx-folder-open text-base text-accent" />
            <span>Select Local Media</span>
          </Btn>
          <Btn variant="primary" onClick={() => navigate("/upload")}>
            <i className="bx bx-plus text-base" />
            <span>New Sermon</span>
          </Btn>
        </div>
      </header>

      <div className="page-content space-y-6 flex-1">
        {/* ── Studio Hero Desk ────────────────────────────────────────── */}
        <div className="pulpit-hero p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="scripture-badge">דָּבָר · THE SPOKEN WORD</span>
                <span className="text-xs text-secondary font-mono-code">Local-First AI</span>
              </div>
              <h2 className="font-editorial text-xl font-bold text-primary">
                Turn hours of preaching into viral teaching clips and verified manuscripts.
              </h2>
              <p className="text-xs text-secondary leading-relaxed">
                Powered by Groq Whisper Large v3 Turbo (Nigerian & global English accents) with 
                GPT-OSS semantic Scripture citation indexing.
              </p>
            </div>

            {/* Studio Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-surface/80 border border-border rounded-lg p-3 text-center">
                <span className="font-mono-code text-lg font-bold text-accent">
                  {sermons.length}
                </span>
                <p className="text-[10px] text-secondary uppercase tracking-wider font-semibold mt-0.5">
                  Recordings
                </p>
              </div>
              <div className="bg-surface/80 border border-border rounded-lg p-3 text-center">
                <span className="font-mono-code text-lg font-bold text-success">
                  {totalClips}
                </span>
                <p className="text-[10px] text-secondary uppercase tracking-wider font-semibold mt-0.5">
                  Ready Moments
                </p>
              </div>
              <div className="bg-surface/80 border border-border rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                <span className="font-mono-code text-lg font-bold text-primary">
                  100%
                </span>
                <p className="text-[10px] text-secondary uppercase tracking-wider font-semibold mt-0.5">
                  Local Storage
                </p>
              </div>
            </div>
          </div>

          {/* Quick Paste Dispatch */}
          <form onSubmit={handleQuickSubmit} className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <i className="bx bxl-youtube absolute left-3.5 top-1/2 -translate-y-1/2 text-red-500 text-lg" />
              <input
                type="text"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                placeholder="Paste YouTube sermon URL or local path to begin immediately…"
                className="field-input pl-10"
              />
            </div>
            <Btn type="submit" variant="primary" disabled={isStartingQuick || !quickUrl.trim()}>
              {isStartingQuick ? (
                <>
                  <i className="bx bx-loader-alt bx-spin" />
                  <span>Transcribing…</span>
                </>
              ) : (
                <>
                  <i className="bx bx-zap text-base" />
                  <span>Start Pipeline</span>
                </>
              )}
            </Btn>
          </form>
        </div>

        {/* ── Search & Filter Toolbar ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search sermons by title, preacher, or Scripture reference…"
              className="field-input pl-9 text-xs"
            />
          </div>
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="text-xs text-accent hover:underline self-start sm:self-center font-medium"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* ── Table Content ─────────────────────────────────────────── */}
        <div>
          {isLoading ? (
            <div className="py-20 text-center space-y-3 bg-surface border border-border rounded-xl">
              <i className="bx bx-loader-alt bx-spin text-2xl text-accent" />
              <p className="text-xs text-secondary font-medium">Loading sermon recordings…</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "42%" }}>Sermon & Passage</th>
                    <th style={{ width: "20%" }}>Preacher</th>
                    <th style={{ width: "12%" }}>Duration</th>
                    <th style={{ width: "10%" }}>Pipeline</th>
                    <th style={{ width: "16%", textAlign: "right" }}>Studio Actions</th>
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
                    const chaptersCount =
                      sermon.highlights?.length ||
                      sermon.chapters?.length ||
                      sermon.clips_count ||
                      0;

                    return (
                      <tr key={sermon.id} className="group">
                        {/* Title & Metadata */}
                        <td>
                          <div className="flex flex-col space-y-1">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)
                              }
                              className="text-left font-editorial text-sm font-semibold text-primary group-hover:text-accent transition-colors leading-snug"
                            >
                              {cleanTitle}
                            </button>
                            <div className="flex items-center gap-2 text-[11px] text-muted font-mono-code">
                              {sermon.date && <span>{sermon.date}</span>}
                              {chaptersCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-accent font-semibold">
                                    {chaptersCount} clips detected
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Preacher */}
                        <td>
                          <span className="text-xs text-secondary font-medium">
                            {sermon.speaker || <span className="text-muted italic">Unknown speaker</span>}
                          </span>
                        </td>

                        {/* Duration */}
                        <td>
                          {sermon.duration ? (
                            <span className="font-mono-code text-xs text-secondary">
                              {sermon.duration}
                            </span>
                          ) : (
                            <span className="text-muted font-mono-code text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          {isReady ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success-muted text-success text-[11px] font-semibold">
                              <i className="bx bxs-check-circle text-xs" />
                              <span>Ready</span>
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-danger-muted text-danger text-[11px] font-semibold">
                              <i className="bx bx-error-circle text-xs" />
                              <span>Failed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-muted text-accent text-[11px] font-semibold">
                              <i className="bx bx-loader-alt bx-spin text-xs" />
                              <span>Transcribing</span>
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
                                  className="px-2.5 py-1 rounded-md bg-surface-hover hover:bg-surface-active text-xs text-primary border border-border font-medium transition-colors"
                                  title="Open Full Manuscript"
                                >
                                  Manuscript
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/clips/${sermon.id}`)}
                                  className="px-3 py-1 rounded-md bg-accent text-accent-fg hover:opacity-90 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                                  title="Open Video Clips Studio & Export"
                                >
                                  <i className="bx bx-film text-xs" />
                                  <span>Clips & Reels</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(`/processing/${sermon.id}`)}
                                className="px-3 py-1 rounded-md bg-surface-hover text-xs text-secondary border border-border hover:text-primary transition-colors"
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
            <div className="border border-border border-dashed rounded-xl bg-surface/50 p-14 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-accent-muted text-accent flex items-center justify-center mx-auto text-2xl border border-accent/20">
                <i className="bx bx-film" />
              </div>
              <div className="space-y-1">
                <h3 className="font-editorial text-lg font-bold text-primary">No sermon recordings found</h3>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  {filterQuery
                    ? "No recordings match your search filter. Try clearing the query."
                    : "Add your first sermon via YouTube URL or local video/audio file to begin producing clips."}
                </p>
              </div>
              {!filterQuery && (
                <Btn size="md" onClick={() => navigate("/upload")}>
                  <i className="bx bx-plus text-base" />
                  <span>Add First Sermon</span>
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
