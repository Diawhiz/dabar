import { Outlet, NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Shell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell bg-base text-primary sanctuary-bg">
      {/* ── Left Sidebar Navigation ─────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="sidebar-seal shadow-md">
            <span>ד</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-editorial text-base font-bold tracking-tight text-primary leading-none">
              DABAR
            </span>
            <span className="font-mono-code text-[9.5px] text-accent font-semibold tracking-wider uppercase mt-1">
              Pulpit Studio
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <i className={`bx ${isActive ? "bxs-film text-accent" : "bx-film"} text-base`} />
                <span>Sermon Library</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/upload"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <i className={`bx ${isActive ? "bxs-plus-circle text-accent" : "bx-plus-circle"} text-base`} />
                <span>New Sermon</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <i className={`bx ${isActive ? "bxs-cog text-accent" : "bx-cog"} text-base`} />
                <span>Studio Settings</span>
              </>
            )}
          </NavLink>
        </nav>

        {/* Engine Status & Footer */}
        <div className="sidebar-footer">
          {/* Active AI Status Pill */}
          <div className="mx-1 mb-2 px-2.5 py-2 rounded-md bg-surface-hover/70 border border-border flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold text-primary truncate leading-tight">
                Groq Whisper v3
              </span>
              <span className="text-[9px] text-accent truncate leading-tight font-mono-code">
                GPT-OSS Analysis
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="sidebar-nav-item w-full text-left"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <i className={`bx ${theme === "dark" ? "bx-sun text-accent" : "bx-moon text-accent"} text-base`} />
            <span>{theme === "dark" ? "Light Linen" : "Sanctuary Dark"}</span>
          </button>

          <div className="px-2.5 py-1 text-[10px] text-muted font-mono-code flex items-center justify-between">
            <span>Dabar Desktop</span>
            <span>v0.2.0</span>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace ─────────────────────────────────────────── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
