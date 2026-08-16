import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Shell() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-base text-primary ethereal-glow-bg relative selection:bg-accent/20">
      {/* ── Fixed Atmospheric Grain Overlay (GPU safe) ─────────────── */}
      <div className="grain-overlay" />

      {/* ── The "Fluid Island" Floating Top Navigation Bar ─────────── */}
      <header className="fixed top-4 left-0 right-0 z-50 px-4">
        <nav
          className="fluid-island-nav mx-auto max-w-5xl"
          aria-label="Studio Master Navigation"
        >
          {/* Brand Seal */}
          <NavLink to="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-[#92400E] p-[1px] shadow-[0_0_15px_var(--accent-glow)] transition-transform duration-500 group-hover:scale-105">
              <div className="w-full h-full rounded-full bg-surface flex items-center justify-center font-editorial font-bold text-accent text-sm">
                ד
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-editorial text-base font-bold tracking-tight text-primary leading-none group-hover:text-accent transition-colors duration-300">
                DABAR
              </span>
              <span className="font-mono-code text-[8.5px] uppercase tracking-[0.25em] text-accent/80 font-semibold leading-tight mt-0.5">
                Studio
              </span>
            </div>
          </NavLink>

          {/* Navigation Links Island */}
          <div className="flex items-center gap-1 bg-surface-hover/60 border border-white/[0.06] p-1 rounded-full backdrop-blur-md">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-500 ease-fluid flex items-center gap-1.5 ${
                  isActive
                    ? "bg-accent text-accent-fg shadow-[0_2px_12px_var(--accent-glow)]"
                    : "text-secondary hover:text-primary hover:bg-white/5"
                }`
              }
            >
              <i className="bx bx-film text-sm" />
              <span>Library</span>
            </NavLink>

            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-500 ease-fluid flex items-center gap-1.5 ${
                  isActive
                    ? "bg-accent text-accent-fg shadow-[0_2px_12px_var(--accent-glow)]"
                    : "text-secondary hover:text-primary hover:bg-white/5"
                }`
              }
            >
              <i className="bx bx-plus text-sm" />
              <span>New Sermon</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-500 ease-fluid flex items-center gap-1.5 ${
                  isActive
                    ? "bg-accent text-accent-fg shadow-[0_2px_12px_var(--accent-glow)]"
                    : "text-secondary hover:text-primary hover:bg-white/5"
                }`
              }
            >
              <i className="bx bx-cog text-sm" />
              <span>Settings</span>
            </NavLink>
          </div>

          {/* Engine Status & Theme Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="font-mono-code text-[10px] text-secondary font-medium tracking-wide">
                Groq v3 · GPT-OSS
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] hover:border-accent/40 text-secondary hover:text-accent flex items-center justify-center transition-all duration-300"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <i className={`bx ${theme === "dark" ? "bx-sun" : "bx-moon"} text-base`} />
            </button>
          </div>
        </nav>
      </header>

      {/* ── Main Canvas Viewport (Macro-Whitespace & Spatial Rhythm) ── */}
      <main className="pt-24 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
