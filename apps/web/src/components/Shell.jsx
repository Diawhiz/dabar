import { Outlet, NavLink } from "react-router-dom";
import Waveform from "./Waveform.jsx";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: "bx-grid-alt" },
  { to: "/upload", label: "Upload", icon: "bx-upload" },
  { to: "/clips", label: "Clips", icon: "bx-film" },
  { to: "/settings", label: "Settings", icon: "bx-cog" },
];

export default function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink font-body overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur-sm border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          {/* Wordmark */}
          <NavLink to="/" className="font-display text-2xl font-bold tracking-tight text-ink hover:text-ember transition-colors">
            DABAR
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
            {navLinks.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-card transition-colors duration-150 ${
                    isActive
                      ? "text-ember"
                      : "text-muted hover:text-ink"
                  }`
                }
              >
                <i className={`bx ${icon} text-lg`} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-6xl flex-1 min-w-0 px-5 py-8 sm:px-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 text-center">
          <p className="font-display text-sm text-muted">
            Dabar — The Word, taking new shape.
          </p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-paper/95 backdrop-blur-sm py-2 sm:hidden"
        aria-label="Mobile navigation"
      >
        {navLinks.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-ember" : "text-muted"
              }`
            }
          >
            <i className={`bx ${icon} text-xl`} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
