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
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* ── Macro Header & Spatial Rhythm ────────────────────────────── */}
      <section className="space-y-3 pt-6">
        <div className="flex items-center gap-3">
          <span className="eyebrow-tag">
            דָּבָר · THE LIVING PULPIT
          </span>
          <span className="text-xs text-muted font-mono-code">Awwwards Edition</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="font-editorial text-4xl sm:text-6xl font-bold tracking-tight text-primary">
              Preaching Archive & Studio
            </h1>
            <p className="text-secondary text-sm sm:text-base mt-2 max-w-2xl font-light">
              Transform hours of audio recordings into high-retention vertical clips, indexed Scripture passages, and verified manuscripts.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Btn variant="secondary" icon="bx-folder" onClick={handlePickLocal}>
              Import File
            </Btn>
            <Btn variant="primary" icon="bx-plus" onClick={() => navigate("/upload")}>
              New Sermon
            </Btn>
          </div>
        </div>
      </section>

      {/* ── The Asymmetrical Bento Grid ──────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Bento Hero Box: Quick Dispatch */}
        <div className="lg:col-span-8 doppelrand-shell">
          <div className="doppelrand-core flex flex-col justify-between h-full space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono-code text-accent font-semibold uppercase tracking-wider">
                <i className="bx bx-bolt-circle text-base" />
                <span>Instant Ingestion & Analysis</span>
              </div>
              <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-primary">
                Paste any YouTube sermon or select a local recording to begin.
              </h3>
              <p className="text-xs text-secondary leading-relaxed font-normal max-w-xl">
                Automatic audio segmentation with Groq Whisper Large v3 Turbo and zero-rate-limit 
                semantic window chunking via GPT-OSS.
              </p>
            </div>

            <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <i className="bx bxl-youtube absolute left-4 top-1/2 -translate-y-1/2 text-red-500 text-xl" />
                <input
                  type="text"
                  value={quickUrl}
                  onChange={(e) => setQuickUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or local recording path"
                  className="w-full rounded-full bg-white/[0.04] border border-white/[0.1] pl-12 pr-4 py-3.5 text-xs text-primary font-mono-code outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-300"
                />
              </div>
              <Btn
                type="submit"
                variant="primary"
                size="lg"
                icon={isStartingQuick ? "bx-loader-alt bx-spin" : "bx-zap"}
                disabled={isStartingQuick || !quickUrl.trim()}
              >
                {isStartingQuick ? "Transcribing…" : "Launch Pipeline"}
              </Btn>
            </form>
          </div>
        </div>

        {/* Bento Metrics Box */}
        <div className="lg:col-span-4 doppelrand-shell">
          <div className="doppelrand-core flex flex-col justify-between h-full space-y-6">
            <div className="space-y-1">
              <span className="eyebrow-tag text-[9px]">Telemetry</span>
              <h4 className="font-editorial text-xl font-bold text-primary">
                Production Engine
              </h4>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <span className="text-xs text-secondary">Total Recordings</span>
                <span className="font-mono-code text-base font-bold text-accent">
                  {sermons.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <span className="text-xs text-secondary">Extracted Clips</span>
                <span className="font-mono-code text-base font-bold text-success">
                  {totalClips}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <span className="text-xs text-secondary">Processing Mode</span>
                <span className="font-mono-code text-xs font-bold text-primary">
                  Groq v3 Turbo
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-muted font-mono-code">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Offline / Local SQLite Secure</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filter & Search Toolbar ──────────────────────────────────── */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-primary">
              All Sermon Archives
            </h2>
            <p className="text-xs text-secondary font-light">
              {sermons.length} sermons cataloged locally in SQLite
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <i className="bx bx-search absolute left-4 top-1/2 -translate-y-1/2 text-muted text-base" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by title, preacher, or verse…"
              className="w-full rounded-full bg-white/[0.04] border border-white/[0.08] pl-11 pr-4 py-2.5 text-xs text-primary placeholder:text-muted outline-none focus:border-accent transition-all duration-300"
            />
          </div>
        </div>

        {/* ── Sermons List ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="doppelrand-shell">
            <div className="doppelrand-core py-24 text-center space-y-4">
              <i className="bx bx-loader-alt bx-spin text-3xl text-accent" />
              <p className="font-editorial text-lg text-secondary">
                Loading sermon archives…
              </p>
            </div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="doppelrand-shell overflow-hidden">
            <div className="doppelrand-core p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="py-4 px-6 text-[11px] font-mono-code uppercase tracking-wider text-muted font-semibold">
                      Sermon & Passage
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono-code uppercase tracking-wider text-muted font-semibold">
                      Speaker
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono-code uppercase tracking-wider text-muted font-semibold">
                      Runtime
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono-code uppercase tracking-wider text-muted font-semibold">
                      Pipeline
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono-code uppercase tracking-wider text-muted font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
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
                      <tr
                        key={sermon.id}
                        className="hover:bg-white/[0.02] transition-colors duration-200 group"
                      >
                        {/* Title */}
                        <td className="py-4 px-6">
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(isReady ? `/clips/${sermon.id}` : `/processing/${sermon.id}`)
                              }
                              className="text-left font-editorial text-base font-bold text-primary group-hover:text-accent transition-colors duration-300 leading-snug"
                            >
                              {cleanTitle}
                            </button>
                            <div className="flex items-center gap-2 text-[11px] text-muted font-mono-code">
                              {sermon.date && <span>{sermon.date}</span>}
                              {chaptersCount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-accent font-semibold">
                                    {chaptersCount} clips ready
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Speaker */}
                        <td className="py-4 px-6 font-medium text-secondary">
                          {sermon.speaker || <span className="text-muted italic">—</span>}
                        </td>

                        {/* Duration */}
                        <td className="py-4 px-6 font-mono-code text-secondary">
                          {sermon.duration || "—"}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          {isReady ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-muted text-success text-[10.5px] font-bold tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-success" />
                              Ready
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-danger-muted text-danger text-[10.5px] font-bold tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-muted text-accent text-[10.5px] font-bold tracking-wide">
                              <i className="bx bx-loader-alt bx-spin text-xs" />
                              Transcribing
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isReady ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/transcript/${sermon.id}`)}
                                  className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-secondary hover:text-primary transition-all duration-300"
                                >
                                  Manuscript
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/clips/${sermon.id}`)}
                                  className="px-4 py-1.5 rounded-full bg-accent text-accent-fg hover:brightness-110 font-bold text-xs shadow-[0_2px_10px_var(--accent-glow)] transition-all duration-300 flex items-center gap-1.5"
                                >
                                  <i className="bx bx-film text-xs" />
                                  <span>Clips Studio</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate(`/processing/${sermon.id}`)}
                                className="px-3.5 py-1.5 rounded-full bg-white/[0.04] text-xs text-secondary hover:text-primary transition-all"
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
          </div>
        ) : (
          <div className="doppelrand-shell">
            <div className="doppelrand-core py-24 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-accent-muted text-accent flex items-center justify-center mx-auto text-3xl border border-accent/20">
                <i className="bx bx-film" />
              </div>
              <div className="space-y-1">
                <h3 className="font-editorial text-2xl font-bold text-primary">
                  No sermon archives found
                </h3>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  {filterQuery
                    ? "No recordings match your filter criteria."
                    : "Add your first audio or video recording to extract clips and full manuscript."}
                </p>
              </div>
              {!filterQuery && (
                <div className="pt-2">
                  <Btn variant="primary" icon="bx-plus" onClick={() => navigate("/upload")}>
                    Add First Sermon
                  </Btn>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
