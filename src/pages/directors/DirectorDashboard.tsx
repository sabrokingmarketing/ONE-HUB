import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Contact, UserPlus, CalendarPlus, ClipboardList, Upload, Send, Inbox, Users, CalendarDays, ArrowUpRight, Megaphone, FileText, MapPin, Video, CheckCircle2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { StatCard, Skeleton, Avatar } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useMe, useCan } from "@/lib/session";
import { formatDate, formatTime, timeAgo } from "@/lib/utils";

const QUICK = [
  { label: "Add broker", to: "/directors/brokers?new=1", icon: Contact, perm: "brokers.write" as const },
  { label: "Add employee", to: "/directors/employees?new=1", icon: UserPlus, perm: "employees.write" as const },
  { label: "New meeting", to: "/calendar?new=1", icon: CalendarPlus, perm: "meetings.manage" as const },
  { label: "New lead form", to: "/forms/new", icon: ClipboardList, perm: "forms.write" as const },
  { label: "Upload file", to: "/directors/documents?upload=1", icon: Upload, perm: "documents.write" as const },
  { label: "Send update", to: "/directors/employees/announcements", icon: Send, perm: "announcements.send" as const },
];

/** Scrollable list area inside a fixed-height card, so long lists never stretch a row. */
function CardScroll({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">{children}</div>;
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900">
      View all <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Inbox; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-400">
      <Icon className="size-5" />
      {text}
    </div>
  );
}

export default function DirectorDashboard() {
  const me = useMe();
  const can = useCan();
  const d = useQuery(api.dashboard.director);
  const meetings = useQuery(api.meetings.upcoming, { limit: 6 });
  const docs = useQuery(api.documents.recent, { limit: 5 });
  const hour = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const quick = QUICK.filter((q) => can(q.perm));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{greeting}, {me.name.split(" ")[0]}</h1>
        <p className="text-sm text-zinc-500">{formatDate(Date.now(), { dateStyle: "full" })}</p>
      </div>

      {/* Row 1 — quick actions: equal tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {quick.map((q) => (
          <Link key={q.label} to={q.to} className="group flex h-full items-center gap-3 rounded-2xl bg-white p-3.5 text-[13px] font-semibold text-zinc-800 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700 transition group-hover:bg-brand-500 group-hover:text-white">
              <q.icon className="size-4" />
            </span>
            <span className="truncate">{q.label}</span>
          </Link>
        ))}
      </div>

      {!d ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[148px] rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Row 2 — KPIs: four identical tiles */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard tone="brand" label="New leads" value={d.newLeadCount} hint={`${d.followUps} follow-ups assigned to you`} icon={Inbox} to="/leads" />
            <StatCard tone="dark" label="Brokers" value={d.brokerCount} hint="Shared directory" icon={Contact} to="/directors/brokers" />
            <StatCard tone="dark" label="Employees" value={d.employeeCount} hint="Shared directory" icon={Users} to="/directors/employees" />
            <StatCard tone="dark" label="Upcoming meetings" value={meetings?.length ?? "–"} hint="Next on your calendar" icon={CalendarDays} to="/calendar" />
          </div>

          {/* Row 3 — two equal panels, fixed height */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card fill className="h-[440px]">
              <CardHeader title="New leads" description={<span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5 text-emerald-500" /> {d.newLeadCount} waiting for contact</span>} action={<ViewAll to="/leads" />} />
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-3">
                {d.newLeads.length === 0 ? <Empty icon={Inbox} text="No new leads — share a lead form to start capturing enquiries." /> : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                        <th className="px-4 pb-2 font-bold">Lead</th>
                        <th className="hidden px-4 pb-2 font-bold sm:table-cell">Source</th>
                        <th className="px-4 pb-2 text-right font-bold">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.newLeads.map((l) => (
                        <tr key={l._id} className="border-t border-zinc-100">
                          <td className="px-4 py-3">
                            <Link to={`/leads/${l._id}`} className="flex items-center gap-3">
                              <Avatar name={l.name} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-zinc-900">{l.name}</span>
                                <span className="block truncate text-xs text-zinc-500">{l.email ?? "—"}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="hidden max-w-0 truncate px-4 py-3 text-zinc-600 sm:table-cell">{l.source}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-zinc-500">{timeAgo(l.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card fill className="h-[440px]">
              <CardHeader title="Upcoming meetings" description="Company meetings and your private events" action={<ViewAll to="/calendar" />} />
              <CardScroll>
                {meetings === undefined ? <Skeleton className="h-40" /> : meetings.length === 0 ? <Empty icon={CalendarDays} text="Nothing scheduled." /> : (
                  <ol className="relative">
                    {meetings.map((m, i) => (
                      <li key={m._id} className="relative flex gap-4 pb-5 last:pb-0">
                        {i < meetings.length - 1 && <span className="absolute top-9 left-[17px] h-[calc(100%-2rem)] w-px bg-zinc-200" />}
                        <span className={i === 0 ? "grid size-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-soft" : "grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600"}>
                          {m.videoLink ? <Video className="size-4" /> : <CalendarDays className="size-4" />}
                        </span>
                        <Link to={`/calendar?meeting=${m._id}`} className="min-w-0 pt-0.5">
                          <div className="truncate text-sm font-semibold text-zinc-900">{m.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                            <span>{formatDate(m.startsAt, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(m.startsAt)}</span>
                            {m.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{m.location}</span>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardScroll>
            </Card>
          </div>

          {/* Row 4 — three equal panels, fixed height */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card fill className="h-[340px]">
              <CardHeader title="Recently added brokers" action={<ViewAll to="/directors/brokers" />} />
              <CardScroll>
                {d.recentBrokers.length === 0 ? <Empty icon={Contact} text="No brokers yet." /> : (
                  <ul className="space-y-3.5">{d.recentBrokers.map((b) => (
                    <li key={b._id}><Link to={`/directors/brokers/${b._id}`} className="flex items-center gap-3">
                      <Avatar name={b.fullName} size="sm" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{b.fullName}</span><span className="block truncate text-xs text-zinc-500">{b.company ?? "—"}</span></span>
                      <span className="text-xs text-zinc-400">{timeAgo(b._creationTime)}</span>
                    </Link></li>
                  ))}</ul>
                )}
              </CardScroll>
            </Card>
            <Card fill className="h-[340px]">
              <CardHeader title="Employee updates" action={<ViewAll to="/directors/employees" />} />
              <CardScroll>
                {d.recentEmployees.length === 0 ? <Empty icon={Users} text="No employees yet." /> : (
                  <ul className="space-y-3.5">{d.recentEmployees.map((e) => (
                    <li key={e._id}><Link to={`/directors/employees/${e._id}`} className="flex items-center gap-3">
                      <Avatar name={e.name} size="sm" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{e.name}</span><span className="block truncate text-xs text-zinc-500">{e.jobTitle ?? "—"}</span></span>
                      <span className="text-xs text-zinc-400">{timeAgo(e.updatedAt)}</span>
                    </Link></li>
                  ))}</ul>
                )}
              </CardScroll>
            </Card>
            <Card fill className="h-[340px] md:col-span-2 xl:col-span-1">
              <CardHeader title="Announcements & documents" action={<ViewAll to="/directors/documents" />} />
              <CardScroll>
                {d.announcements.length === 0 && !docs?.length ? <Empty icon={Megaphone} text="Nothing shared yet." /> : (
                  <ul className="space-y-3.5">
                    {d.announcements.map((a) => (
                      <li key={a._id} className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Megaphone className="size-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{a.subject}</span><span className="block text-xs text-zinc-500"><StatusBadge status={a.template} /></span></span>
                        <span className="text-xs text-zinc-400">{timeAgo(a.sentAt)}</span>
                      </li>
                    ))}
                    {docs?.map((x) => (
                      <li key={x._id} className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600"><FileText className="size-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-zinc-900">{x.name}</span><span className="block truncate text-xs text-zinc-500">{x.category}</span></span>
                        <span className="text-xs text-zinc-400">{timeAgo(x._creationTime)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardScroll>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
