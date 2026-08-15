import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";

const navLinks = [
  { to: "/dashboard", label: "Sermons", icon: "bx-book-open" },
  { to: "/upload", label: "Add Sermon", icon: "bx-plus-circle" },
  { to: "/settings", label: "Preferences", icon: "bx-slider-alt" },
];

export default function Shell() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink font-body selection:bg-amber selection:text-white">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-md border-b border-border/80 transition-all">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-10">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2.5 group transition-all"
              aria-label="Dabar home"
            >
              <span className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center font-display text-lg font-bold text-amber shadow-sm border border-border group-hover:border-amber transition-colors">
                ד
              </span>
              <div className="flex flex-col">
                <span className="font-display text-lg font-bold tracking-tight text-ink leading-none">
                  DABAR
                </span>
                <span className="text-[10px] tracking-wider uppercase text-muted font-sans font-medium mt-0.5">
                  Sermon Studio
                </span>
              </div>
            </NavLink>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 font-sans" aria-label="Main navigation">
            {navLinks.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                    isActive
                      ? "bg-surface text-ink shadow-sm border border-border/60"
                      : "text-muted hover:text-ink hover:bg-surface/50"
                  }`
                }
              >
                <i className={`bx ${icon} text-base`} aria-hidden="true" />
                {label}
              </NavLink>
            ))}

            {/* Quick Keyboard Shortcuts Trigger */}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="ml-2 inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-surface/60 transition-colors"
              title="Keyboard Shortcuts"
              aria-label="Keyboard Shortcuts"
            >
              <i className="bx bx-command text-base" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 sm:px-10">
        <Outlet />
      </main>

      {/* Subtle Tranquil Footer */}
      <footer className="border-t border-border/60 py-6 mt-auto">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted font-sans">
          <p className="italic font-serif">
            "The Word, taking new shape."
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Local & Private</span>
            <span>·</span>
            <span>Church Media Made Simple</span>
          </div>
        </div>
      </footer>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 font-sans animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-paper p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="bx bx-command text-amber text-xl" />
                <h3 className="font-display text-lg font-bold text-ink">Manuscript Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-surface flex items-center justify-center transition-colors"
              >
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {[
                { key: "Space", action: "Play or Pause sermon audio" },
                { key: "↑ / ↓", action: "Jump backward or forward one paragraph" },
                { key: "Enter", action: "Edit or confirm current paragraph" },
                { key: "Double-click", action: "Inline edit any spoken phrase" },
                { key: "Esc", action: "Close modal / cancel editing" },
              ].map(({ key, action }) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted">{action}</span>
                  <kbd className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-mono font-bold text-ink">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full py-2 rounded-xl bg-surface text-ink text-xs font-semibold hover:bg-surface-warm transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
