import { Outlet, NavLink } from "react-router-dom";
import { Archive, Clapperboard, Home, Sparkles, Video, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext.jsx";

const links = [
  { to: "/", label: "Studio", icon: Home },
  { to: "/processing", label: "Processing", icon: Sparkles },
  { to: "/highlights", label: "Highlights", icon: Clapperboard },
  { to: "/clips", label: "Clip Studio", icon: Video },
  { to: "/archive", label: "Archive", icon: Archive },
];

export default function AppShell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-signal-bg text-text-primary font-sans antialiased transition-colors duration-200">
      <header className="sticky top-0 z-30 border-b border-signal-border/80 bg-signal-bg/85 backdrop-blur-2xl transition-colors duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          {/* Logo Brand */}
          <NavLink to="/" className="group flex items-center gap-3 focus-visible:outline-none">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-pulse-gold text-white font-editorial text-xl font-bold shadow-pulse"
            >
              D
            </motion.div>
            <div>
              <p className="font-editorial text-xl font-bold leading-none tracking-tight text-text-primary transition-colors group-hover:text-pulse-gold">
                DABAR
              </p>
              <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                Sermon Clip Studio
              </p>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="hidden items-center gap-1.5 rounded-2xl border border-signal-border bg-signal-panel p-1.5 shadow-signal md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors duration-200",
                    isActive
                      ? "bg-pulse-gold text-white font-bold shadow-pulse"
                      : "text-text-secondary hover:bg-signal-hover hover:text-text-primary",
                  ].join(" ")
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={toggleTheme}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal-border bg-signal-panel text-text-secondary hover:border-pulse-gold hover:text-pulse-gold shadow-sm transition-colors"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} className="text-slate-700" />
              )}
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-32 pt-8 sm:px-8 lg:px-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-signal-border/80 bg-signal-panel/50 py-8 text-center text-xs text-text-muted">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2 font-display text-xs font-semibold text-text-secondary">
            <span>DABAR STUDIO</span>
            <span className="text-signal-border">•</span>
            <span className="font-sans text-xs font-normal text-text-muted">Turn sermons into clips people actually watch</span>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl border border-signal-border bg-signal-panel/95 p-1.5 shadow-signal backdrop-blur-2xl md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-all duration-200",
                isActive ? "bg-pulse-gold text-white font-bold shadow-pulse" : "text-text-secondary hover:text-text-primary",
              ].join(" ")
            }
          >
            <Icon size={18} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}



