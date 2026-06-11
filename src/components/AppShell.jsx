import { Outlet, NavLink } from "react-router-dom";
import { Archive, Clapperboard, Home, Sparkles, Video } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/processing", label: "Processing", icon: Sparkles },
  { to: "/highlights", label: "Highlights", icon: Clapperboard },
  { to: "/clips", label: "Clips", icon: Video },
  { to: "/archive", label: "Archive", icon: Archive },
];

export default function AppShell() {
  return (
    <div className="min-h-screen bg-paper text-umber">
      <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-navy font-serif text-lg font-bold text-cream shadow-soft">
              D
            </div>
            <div>
              <p className="font-serif text-xl font-semibold leading-none text-navy">Dabar</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-gold">The Word, ready to share</p>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-1 rounded-full bg-cream/70 p-1 shadow-soft md:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-navy text-cream shadow-soft"
                      : "text-walnut hover:bg-linen/80 hover:text-navy",
                  ].join(" ")
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-28 pt-8 sm:px-8 lg:px-10">
        <Outlet />
      </main>

      <nav className="fixed bottom-3 left-1/2 z-30 flex w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 items-center justify-between rounded-full bg-cream/95 p-1.5 shadow-warm backdrop-blur-xl md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition",
                isActive ? "bg-navy text-cream" : "text-walnut",
              ].join(" ")
            }
          >
            <Icon size={17} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
