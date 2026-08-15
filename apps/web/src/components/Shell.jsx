import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Shell() {
  const { theme, toggleTheme } = useTheme();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-base text-primary font-body transition-colors">
      {/* ── Top Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-base/95 backdrop-blur-xs border-b border-border transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
          {/* Brand */}
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2.5 group"
            aria-label="Dabar home"
          >
            <span className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center font-display text-lg font-bold text-accent border border-border group-hover:border-accent transition-colors">
              ד
            </span>
            <div className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-primary leading-none">
                DABAR
              </span>
              <span className="text-[10px] tracking-wider uppercase text-secondary font-sans font-medium mt-0.5">
                Sermon Studio
              </span>
            </div>
          </NavLink>

          {/* Nav Actions */}
          <nav className="flex items-center gap-2 font-sans" aria-label="Main navigation">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-surface text-primary border border-border"
                    : "text-secondary hover:text-primary hover:bg-surface/50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${isActive ? "bxs-book-open" : "bx-book-open"} text-base text-accent`} />
                  <span>Sermons</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-surface text-primary border border-border"
                    : "text-secondary hover:text-primary hover:bg-surface/50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${isActive ? "bxs-cloud-upload" : "bx-cloud-upload"} text-base text-accent`} />
                  <span>Add Sermon</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-surface text-primary border border-border"
                    : "text-secondary hover:text-primary hover:bg-surface/50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${isActive ? "bxs-cog" : "bx-cog"} text-base`} />
                  <span>Preferences</span>
                </>
              )}
            </NavLink>

            {/* Dark / Light Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors ml-1"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              <i className={`bx ${theme === "dark" ? "bx-sun text-accent" : "bx-moon"} text-base`} />
              <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
            </button>

            {/* Shortcuts Guide */}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="w-8 h-8 rounded-lg text-secondary hover:text-primary hover:bg-surface flex items-center justify-center transition-colors"
              title="Keyboard Shortcuts"
              aria-label="Keyboard Shortcuts"
            >
              <i className="bx bx-command text-base" />
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-8">
        <Outlet />
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border py-5 mt-auto font-sans">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-secondary">
          <p className="italic font-serif">
            "The Word, taking new shape."
          </p>
          <div className="flex items-center gap-3 text-[11px]">
            <span>Local & Private</span>
            <span>·</span>
            <span>Church Media Made Simple</span>
          </div>
        </div>
      </footer>

      {/* ── Shortcuts Modal ──────────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="bx bx-command text-accent text-lg" />
                <h3 className="font-display text-base font-bold text-primary">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-7 h-7 rounded-lg text-secondary hover:text-primary flex items-center justify-center"
              >
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-border">
              {[
                { key: "Space", action: "Play or Pause sermon playback" },
                { key: "↑ / ↓", action: "Jump backward or forward one paragraph" },
                { key: "Enter", action: "Edit or confirm paragraph" },
                { key: "Double-click", action: "Inline edit any phrase in transcript" },
                { key: "Esc", action: "Close modal" },
              ].map(({ key, action }) => (
                <div key={key} className="flex items-center justify-between pt-2">
                  <span className="text-secondary">{action}</span>
                  <kbd className="px-2 py-0.5 rounded bg-base border border-border text-[11px] font-mono text-primary font-bold">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full py-2 rounded-lg bg-base border border-border text-primary text-xs font-semibold hover:border-accent transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
