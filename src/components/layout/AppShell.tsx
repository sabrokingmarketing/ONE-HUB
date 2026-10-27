import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Bell, LogOut, Menu as MenuIcon, Search, Settings, X, LifeBuoy } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useMe, useCan } from "@/lib/session";
import { NAV, PORTAL_HOME, PORTAL_LABEL, homeFor, portalFromPath, portalsFor, type Portal } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
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

/** Current page label for the breadcrumb, taken from the navigation config. */
function usePageLabel(portal: Portal) {
  const { pathname } = useLocation();
  return useMemo(() => {
    const items = NAV[portal].flatMap((s) => s.items);
    const exact = items.find((i) => i.to === pathname);
    if (exact) return exact.label;
    const prefix = items.filter((i) => !i.end && pathname.startsWith(i.to + "/")).sort((a, b) => b.to.length - a.to.length)[0];
    if (prefix) return prefix.label;
    if (pathname.startsWith("/settings")) return "Account";
    if (pathname.startsWith("/notifications")) return "Notifications";
    return "Dashboard";
  }, [pathname, portal]);
}

function Sidebar({ portal, onNavigate }: { portal: Portal; onNavigate?: () => void }) {
  const me = useMe();
  const can = useCan();
  const navigate = useNavigate();
  const allowed = portalsFor(me.role!);
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center justify-center px-4">
        <Link to={me.role === "marketing" ? homeFor(me.role) : PORTAL_HOME[portal]} onClick={onNavigate} aria-label="ONE HUB home"><Logo className="h-11" /></Link>
      </div>
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-300/70 to-transparent" />

      {allowed.length > 1 && (
        <div className="px-3 pt-4" role="tablist" aria-label="Portal">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-200/60 p-1">
            {allowed.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={p === portal}
                onClick={() => { navigate(PORTAL_HOME[p]); onNavigate?.(); }}
                className={cn("rounded-lg py-1.5 text-[13px] font-semibold transition-all", p === portal ? "bg-white text-zinc-900 shadow-soft" : "text-zinc-500 hover:text-zinc-800")}
              >
                {PORTAL_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {NAV[portal].map((section, i) => {
          const items = section.items.filter((it) => !it.perm || can(...it.perm));
          if (!items.length) return null;
          return (
            <div key={i}>
              {section.title && <div className="mb-2 px-3 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">{section.title}</div>}
              <ul className="space-y-1">
                {items.map((it) => (
                  <li key={it.to + it.label}>
                    <NavLink
                      to={it.to}
                      end={it.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] transition-all",
                          isActive ? "bg-white font-semibold text-zinc-900 shadow-soft" : "font-medium text-zinc-500 hover:bg-white/60 hover:text-zinc-900",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg transition-all",
                            isActive ? "bg-brand-500 text-white shadow-[0_4px_12px_-2px_rgb(247_147_30/0.5)]" : "bg-white text-zinc-600 shadow-soft group-hover:text-zinc-900",
                          )}>
                            <it.icon className="size-4" />
                          </span>
                          <span className="truncate">{it.label}</span>
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

      <div className="hidden p-3 [@media(min-height:860px)]:block">
        <div className="relative overflow-hidden rounded-2xl bg-ink p-4 text-white">
          <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full border-[18px] border-brand-500/30" />
          <span className="grid size-8 place-items-center rounded-lg bg-white text-zinc-900"><LifeBuoy className="size-4" /></span>
          <div className="mt-3 text-sm font-semibold">Need help?</div>
          <div className="text-xs text-zinc-400">Signed in as {ROLE_LABELS[me.role!]}</div>
          <Link to="/settings" onClick={onNavigate} className="mt-3 block rounded-lg bg-white py-2 text-center text-xs font-bold tracking-wide text-zinc-900 uppercase transition hover:bg-zinc-100">
            My account
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const me = useMe();
  const portal = usePortal();
  const page = usePageLabel(portal);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const unread = useQuery(api.notifications.unreadCount) ?? 0;

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div className="min-h-dvh bg-canvas lg:pl-[17rem]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] p-3 lg:block">
        <div className="h-full rounded-2xl bg-canvas">
          <Sidebar portal={portal} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[18rem] bg-canvas shadow-pop animate-in">
            <Sidebar portal={portal} onNavigate={() => setMobileOpen(false)} />
            <button className="absolute top-4 -right-12 rounded-full bg-white p-2 text-zinc-700 shadow-soft" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 lg:px-6">
        <div className={cn(
          "flex h-16 items-center gap-3 rounded-2xl px-3 transition-all sm:px-4",
          scrolled ? "bg-white/80 shadow-card backdrop-blur-xl" : "bg-transparent",
        )}>
          <button className="rounded-xl p-2 text-zinc-600 hover:bg-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="truncate text-xs text-zinc-400">
              <span>{PORTAL_LABEL[portal]}</span>
              <span className="mx-1.5">/</span>
              <span className="text-zinc-700">{page}</span>
            </nav>
            <div className="truncate text-[15px] font-bold text-zinc-900">{page}</div>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-10 items-center gap-2.5 rounded-xl bg-white px-3 text-sm text-zinc-400 shadow-soft ring-1 ring-zinc-200/70 transition hover:ring-zinc-300 md:w-64"
              aria-label="Search"
            >
              <Search className="size-4" />
              <span className="hidden md:inline">Type here to search…</span>
              <kbd className="ml-auto hidden rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 md:inline">⌘K</kbd>
            </button>
            <NotificationsPopover unread={unread}>
              <button className="relative grid size-10 place-items-center rounded-xl text-zinc-600 transition hover:bg-white hover:shadow-soft" aria-label={`Notifications (${unread} unread)`}>
                <Bell className="size-[18px]" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-canvas">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            </NotificationsPopover>
            <Link to="/settings" className="hidden size-10 place-items-center rounded-xl text-zinc-600 transition hover:bg-white hover:shadow-soft sm:grid" aria-label="Settings">
              <Settings className="size-[18px]" />
            </Link>
            <Menu>
              <MenuTrigger className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-white hover:shadow-soft" aria-label="Account menu">
                <Avatar name={me.name} size="sm" />
              </MenuTrigger>
              <MenuContent className="w-60">
                <div className="px-2.5 py-2">
                  <div className="truncate text-sm font-semibold text-zinc-900">{me.name}</div>
                  <div className="truncate text-xs text-zinc-500">{me.email}</div>
                </div>
                <MenuSeparator />
                <MenuItem onSelect={() => navigate("/settings")}><Settings /> Account & notifications</MenuItem>
                <MenuItem danger onSelect={() => void signOut().then(() => navigate("/login"))}><LogOut /> Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-3 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 lg:px-6">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
