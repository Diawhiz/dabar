import { Outlet, NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Shell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell bg-base text-primary">
      {/* ── Left Sidebar Navigation ─────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="w-6 h-6 rounded bg-accent text-white flex items-center justify-center font-mono font-bold text-xs">
            ד
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-xs font-bold tracking-tight text-primary leading-none">
              DABAR
            </span>
            <span className="font-mono text-[9px] text-secondary leading-tight mt-0.5">
              studio
            </span>
          </div>
        </div>

        {/* Navigation Items — Every icon paired with a visible label */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <i className={`bx ${isActive ? "bxs-folder-open text-accent" : "bx-folder"} text-base`} />
                <span>Sermons</span>
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
                <span>Add Sermon</span>
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
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </nav>

        {/* Sidebar Footer: Theme toggle + version */}
        <div className="sidebar-footer">
          <button
            type="button"
            onClick={toggleTheme}
            className="sidebar-nav-item w-full text-left"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <i className={`bx ${theme === "dark" ? "bx-sun text-accent" : "bx-moon text-accent"} text-base`} />
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>

          <div className="px-2.5 py-1 text-[10px] text-muted font-mono flex items-center justify-between">
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
