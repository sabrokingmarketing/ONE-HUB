import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Bell, ChevronsUpDown, LogOut, Menu as MenuIcon, Search, Settings, X, Check } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useMe, useCan } from "@/lib/session";
import { NAV, PORTAL_HOME, PORTAL_LABEL, portalFromPath, portalsFor, type Portal } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ROLE_LABELS } from "../../../convex/lib/permissionMatrix";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPopover } from "./NotificationsPopover";
import { Logo } from "./Logo";

const PORTAL_KEY = "onehub.portal";

function usePortal(): Portal {
  const me = useMe();
  const { pathname } = useLocation();
  const allowed = portalsFor(me.role!);
  const fromPath = portalFromPath(pathname);
  const [last, setLast] = useState<Portal | null>(() => {
    try { return localStorage.getItem(PORTAL_KEY) as Portal | null; } catch { return null; }
  });
  useEffect(() => {
    if (fromPath && allowed.includes(fromPath) && fromPath !== last) {
      setLast(fromPath);
      try { localStorage.setItem(PORTAL_KEY, fromPath); } catch { /* storage unavailable */ }
    }
  }, [fromPath, allowed, last]);
  if (fromPath && allowed.includes(fromPath)) return fromPath;
  if (last && allowed.includes(last)) return last;
  return allowed[0];
}

function Sidebar({ portal, onNavigate }: { portal: Portal; onNavigate?: () => void }) {
  const me = useMe();
  const can = useCan();
  const navigate = useNavigate();
  const allowed = portalsFor(me.role!);
  return (
    <div className="flex h-full flex-col bg-ink text-stone-300">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo />
      </div>

      {allowed.length > 1 ? (
        <div className="px-3 pb-3">
          <Menu>
            <MenuTrigger className="flex w-full items-center justify-between rounded-xl bg-white/[0.06] px-3 py-2.5 text-left ring-1 ring-white/10 hover:bg-white/10">
              <span>
                <span className="block text-[11px] tracking-wide text-stone-400 uppercase">Portal</span>
                <span className="block text-sm font-medium text-white">{PORTAL_LABEL[portal]}</span>
              </span>
              <ChevronsUpDown className="size-4 text-stone-400" />
            </MenuTrigger>
            <MenuContent align="start" className="w-56">
              <MenuLabel>Switch view</MenuLabel>
              {allowed.map((p) => (
                <MenuItem key={p} onSelect={() => { navigate(PORTAL_HOME[p]); onNavigate?.(); }}>
                  {p === portal ? <Check /> : <span className="size-4" />}
                  {PORTAL_LABEL[p]} portal
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      ) : (
        <div className="px-5 pb-3 text-[11px] tracking-wide text-stone-500 uppercase">{PORTAL_LABEL[portal]} portal</div>
      )}

      <nav className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Main">
        {NAV[portal].map((section, i) => {
          const items = section.items.filter((it) => !it.perm || can(...it.perm));
          if (!items.length) return null;
          return (
            <div key={i}>
              {section.title && <div className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-stone-500 uppercase">{section.title}</div>}
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <li key={it.to + it.label}>
                    <NavLink
                      to={it.to}
                      end={it.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors",
                          isActive ? "bg-white/[0.08] text-white" : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-100",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />}
                          <it.icon className={cn("size-[18px]", isActive ? "text-brand-400" : "text-stone-500 group-hover:text-stone-300")} />
                          {it.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link to="/settings" onClick={onNavigate} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/[0.05]">
          <Avatar name={me.name} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{me.name}</div>
            <div className="truncate text-xs text-stone-500">{ROLE_LABELS[me.role!]}</div>
          </div>
          <Settings className="size-4 text-stone-500" />
        </Link>
      </div>
    </div>
  );
}

export function AppShell() {
  const me = useMe();
  const portal = usePortal();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const unread = useQuery(api.notifications.unreadCount) ?? 0;

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar portal={portal} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50 animate-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-72 shadow-pop animate-in">
            <Sidebar portal={portal} onNavigate={() => setMobileOpen(false)} />
            <button className="absolute top-4 -right-12 rounded-full bg-white/10 p-2 text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button className="-ml-1 rounded-xl p-2 text-stone-600 hover:bg-stone-200/60 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <div className="lg:hidden"><Logo dark compact /></div>

          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-10 items-center gap-2.5 rounded-xl bg-white px-3 text-sm text-stone-400 ring-1 ring-stone-200 transition-colors hover:ring-stone-300 sm:w-72 lg:ml-0 lg:w-96"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search brokers, leads, documents…</span>
            <kbd className="ml-auto hidden rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-500 sm:inline">⌘K</kbd>
          </button>

          <div className="flex items-center gap-1 lg:ml-auto">
            <NotificationsPopover unread={unread}>
              <button className="relative rounded-xl p-2.5 text-stone-600 hover:bg-stone-200/60" aria-label={`Notifications (${unread} unread)`}>
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white ring-2 ring-canvas">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            </NotificationsPopover>

            <Menu>
              <MenuTrigger className="rounded-full p-1 hover:bg-stone-200/60" aria-label="Account menu">
                <Avatar name={me.name} size="sm" />
              </MenuTrigger>
              <MenuContent className="w-60">
                <div className="px-2.5 py-2">
                  <div className="truncate text-sm font-medium text-stone-900">{me.name}</div>
                  <div className="truncate text-xs text-stone-500">{me.email}</div>
                </div>
                <MenuSeparator />
                <MenuItem onSelect={() => navigate("/settings")}><Settings /> Account & notifications</MenuItem>
                <MenuItem danger onSelect={() => void signOut().then(() => navigate("/login"))}><LogOut /> Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
