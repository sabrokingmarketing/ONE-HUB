import * as P from "@radix-ui/react-popover";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, FileText, Inbox, Megaphone, AlertTriangle, Users, Target, UserPlus, Info } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, timeAgo } from "@/lib/utils";
import type { Doc } from "../../../convex/_generated/dataModel";

export const NOTIFICATION_ICONS: Record<Doc<"notifications">["type"], typeof Bell> = {
  lead: Inbox, meeting: CalendarDays, announcement: Megaphone, document: FileText, employee: Users,
  post_failed: AlertTriangle, campaign: Target, invitation: UserPlus, system: Info,
};

export function NotificationRow({ n, onOpen }: { n: Doc<"notifications">; onOpen: (n: Doc<"notifications">) => void }) {
  const Icon = NOTIFICATION_ICONS[n.type];
  return (
    <button onClick={() => onOpen(n)} className={cn("flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-stone-50", !n.readAt && "bg-brand-50/40")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", n.type === "post_failed" ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-600")}><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-stone-900">{n.title}</span>
        {n.body && <span className="mt-0.5 block truncate text-xs text-stone-500">{n.body}</span>}
        <span className="mt-1 block text-[11px] text-stone-400">{timeAgo(n._creationTime)}</span>
      </span>
      {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
    </button>
  );
}

export function NotificationsPopover({ children, unread }: { children: React.ReactNode; unread: number }) {
  const list = useQuery(api.notifications.list, {});
  const markRead = useMutation(api.notifications.markRead);
  const markAll = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();
  return (
    <P.Root>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={8} className="z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl bg-white shadow-pop ring-1 ring-stone-200 animate-in">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <div className="text-sm font-semibold">Notifications</div>
            {unread > 0 && <button onClick={() => void markAll()} className="text-xs font-medium text-brand-600 hover:text-brand-700">Mark all as read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {list === undefined ? (
              <p className="p-6 text-center text-sm text-stone-400">Loading…</p>
            ) : list.length === 0 ? (
              <div className="p-8 text-center"><Bell className="mx-auto mb-2 size-5 text-stone-300" /><p className="text-sm text-stone-500">You're all caught up.</p></div>
            ) : (
              list.slice(0, 12).map((n) => (
                <P.Close asChild key={n._id}>
                  <div><NotificationRow n={n} onOpen={(x) => { void markRead({ id: x._id }); if (x.link) navigate(x.link); }} /></div>
                </P.Close>
              ))
            )}
          </div>
          <div className="border-t border-stone-100 p-2">
            <P.Close asChild><Link to="/notifications" className="block rounded-xl py-2 text-center text-sm font-medium text-stone-600 hover:bg-stone-50">View all</Link></P.Close>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
