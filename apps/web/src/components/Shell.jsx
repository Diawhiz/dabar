import { Outlet, NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Shell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-base text-primary font-body transition-colors">
      {/* ── Top Navigation Bar ───────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-base border-b border-border transition-colors">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5 sm:px-8">
          {/* Brand Wordmark */}
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2"
            aria-label="Dabar sermon library"
          >
            <span className="w-7 h-7 rounded-md bg-surface flex items-center justify-center font-display text-base font-bold text-accent border border-border">
              ד
            </span>
            <span className="font-display text-base font-bold tracking-tight text-primary">
              DABAR
            </span>
          </NavLink>

          {/* Navigation Links — Every icon paired with a visible label */}
          <nav className="flex items-center gap-2 sm:gap-3 font-sans" aria-label="Main navigation">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-surface text-primary border border-border"
                    : "text-secondary hover:text-primary hover:bg-surface"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${isActive ? "bxs-book-open text-accent" : "bx-book-open"} text-base`} />
                  <span>Sermons</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-surface text-primary border border-border"
                    : "text-secondary hover:text-primary hover:bg-surface"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${isActive ? "bxs-cloud-upload text-accent" : "bx-cloud-upload"} text-base`} />
                  <span>Add Sermon</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? "bg-surface text-primary border border-border"
                    : "text-secondary hover:text-primary hover:bg-surface"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <i className={`bx ${isActive ? "bxs-cog text-accent" : "bx-cog"} text-base`} />
                  <span>Preferences</span>
                </>
              )}
            </NavLink>

            {/* Dark / Light Mode Toggle with visible text label */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i className={`bx ${theme === "dark" ? "bx-sun text-accent" : "bx-moon text-accent"} text-base`} />
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main Task Workspace ──────────────────────────────────── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 sm:px-8">
        <Outlet />
      </main>

      {/* ── Minimal Quiet Footer ─────────────────────────────────── */}
      <footer className="border-t border-border py-4 font-sans text-xs text-secondary">
        <div className="mx-auto max-w-5xl px-6 sm:px-8 flex items-center justify-between">
          <p className="font-serif italic">
            "The Word, taking new shape."
          </p>
          <p className="text-[11px]">
            Dabar Desktop
          </p>
        </div>
      </footer>
    </div>
  );
}
