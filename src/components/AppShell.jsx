import { Outlet, NavLink } from "react-router-dom";
import { Archive, Clapperboard, Home, Sparkles, Video, Cpu, ShieldCheck } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/processing", label: "Processing", icon: Sparkles },
  { to: "/highlights", label: "Highlights", icon: Clapperboard },
  { to: "/clips", label: "Clips Studio", icon: Video },
  { to: "/archive", label: "Archive", icon: Archive },
];

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-umber">
      <header className="sticky top-0 z-30 border-b border-linen/60 bg-paper/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          {/* Logo Brand */}
          <NavLink to="/" className="group flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-navy via-navy to-navy-dark font-serif text-2xl font-bold text-cream shadow-navyGlow transition-transform duration-300 group-hover:scale-105">
              D
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-paper bg-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-serif text-2xl font-semibold leading-none tracking-tight text-navy">
                  Dabar
                </p>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold border border-gold/20">
                  AI v2.4
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                The Word, ready to share
              </p>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 rounded-full border border-linen bg-cream/90 p-1.5 shadow-soft backdrop-blur-xl md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-navy text-cream shadow-navyGlow"
                      : "text-walnut hover:bg-parchment hover:text-navy",
                  ].join(" ")
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Engine Status Badge */}
          <div className="hidden items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 lg:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Cpu size={14} className="text-emerald-600" />
            <span>AI Engine Online</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-32 pt-8 sm:px-8 lg:px-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-linen/70 bg-parchment/50 py-8 text-center text-xs text-walnut">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2 font-serif text-sm font-semibold text-navy">
            <span>Dabar AI</span>
            <span className="text-linen">•</span>
            <span className="text-xs font-normal text-walnut">Church Media Automation</span>
          </div>
          <div className="flex items-center gap-2 text-walnut/70">
            <ShieldCheck size={14} className="text-gold" />
            <span>Secure Sermon Processing Pipeline</span>
          </div>
        </div>
      </footer>

      {/* Mobile Floating Navigation Bar */}
      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-full border border-linen/90 bg-cream/95 p-1.5 shadow-warm backdrop-blur-2xl md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-2 py-2 text-[10px] font-semibold transition-all duration-200",
                isActive ? "bg-navy text-cream shadow-navyGlow" : "text-walnut hover:text-navy",
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
