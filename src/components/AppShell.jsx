import { Outlet, NavLink } from "react-router-dom";
import { Archive, Clapperboard, Home, Sparkles, Video, Cpu, Activity } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/processing", label: "Processing", icon: Sparkles },
  { to: "/highlights", label: "Highlights", icon: Clapperboard },
  { to: "/clips", label: "Clips Studio", icon: Video },
  { to: "/archive", label: "Archive", icon: Archive },
];

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-signal-bg text-text-primary font-sans antialiased">
      <header className="sticky top-0 z-30 border-b border-signal-border/80 bg-signal-bg/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          {/* Logo Brand */}
          <NavLink to="/" className="group flex items-center gap-3.5 focus-visible:outline-none">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-signal-panel border border-signal-border text-pulse-gold font-display text-xl font-bold shadow-pulse transition-transform duration-300 group-hover:scale-105">
              ד
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-signal-bg bg-pulse-gold animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-xl font-bold leading-none tracking-tight text-text-primary group-hover:text-pulse-gold transition-colors">
                  DABAR
                </p>
                <span className="rounded-md bg-pulse-gold/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-pulse-gold border border-pulse-gold/20">
                  70B AI
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-text-muted">
                The Word, ready to share
              </p>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 rounded-2xl border border-signal-border bg-signal-panel/90 p-1.5 shadow-signal backdrop-blur-xl md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200",
                    isActive
                      ? "bg-pulse-gold text-signal-bg shadow-pulse font-bold"
                      : "text-text-secondary hover:bg-signal-hover hover:text-text-primary",
                  ].join(" ")
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Engine Status Badge */}
          <div className="hidden items-center gap-2.5 rounded-xl border border-pulse-gold/30 bg-pulse-gold/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-pulse-gold lg:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pulse-gold opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pulse-gold" />
            </span>
            <Activity size={14} className="text-pulse-gold" />
            <span>Groq Signal Active</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-32 pt-8 sm:px-8 lg:px-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-signal-border/80 bg-signal-panel/40 py-8 text-center text-xs text-text-muted">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2 font-display text-xs font-semibold text-text-secondary">
            <span>DABAR SYSTEM</span>
            <span className="text-signal-border">•</span>
            <span className="font-mono text-xs font-normal text-text-muted">Whisper + Llama 3.3 70B Engine</span>
          </div>
          <div className="flex items-center gap-2 text-text-muted font-mono text-xs">
            <Cpu size={14} className="text-pulse-gold" />
            <span>Zero-Download FFmpeg Stream Slicing</span>
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
                isActive ? "bg-pulse-gold text-signal-bg font-bold shadow-pulse" : "text-text-secondary hover:text-text-primary",
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
