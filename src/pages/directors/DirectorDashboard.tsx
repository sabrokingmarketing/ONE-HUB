import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Contact, UserPlus, CalendarPlus, ClipboardList, Upload, Share2, Inbox, CalendarDays, Megaphone, FileText, ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, StatCard, Skeleton, Avatar, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMe, useCan } from "@/lib/session";
import { formatDate, formatTime, timeAgo } from "@/lib/utils";

const QUICK = [
  { label: "Add broker", to: "/directors/brokers?new=1", icon: Contact, perm: "brokers.write" as const },
  { label: "Add employee", to: "/directors/employees?new=1", icon: UserPlus, perm: "employees.write" as const },
  { label: "Create meeting", to: "/calendar?new=1", icon: CalendarPlus, perm: "meetings.manage" as const },
  { label: "Create lead form", to: "/forms/new", icon: ClipboardList, perm: "forms.write" as const },
  { label: "Upload document", to: "/directors/documents", icon: Upload, perm: "library.read" as const },
  { label: "Share contact", to: "/directors/brokers", icon: Share2, perm: "brokers.read" as const },
];

export default function DirectorDashboard() {
  const me = useMe();
  const can = useCan();
  const d = useQuery(api.dashboard.director);
  const meetings = useQuery(api.meetings.upcoming, { limit: 5 });
  const docs = useQuery(api.assets.recent, { limit: 5 });

  return (
    <>
      <PageHeader eyebrow="Directors portal" title={`Welcome back, ${me.name.split(" ")[0]}`} description={formatDate(Date.now(), { dateStyle: "full" })} />
      <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
        {QUICK.filter((q) => can(q.perm)).map((q) => (
          <Link key={q.label} to={q.to} className="group flex shrink-0 items-center gap-3 rounded-2xl bg-white p-3.5 text-sm font-medium text-stone-800 shadow-card ring-1 ring-stone-200/70 transition hover:ring-brand-300">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white"><q.icon className="size-4" /></span>
            {q.label}
          </Link>
        ))}
      </div>

      {!d ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
              <StatCard tone="brand" label="New leads" value={d.newLeadCount} icon={Inbox} to="/leads" />
              <StatCard label="My follow-ups" value={d.followUps} icon={ArrowRight} to="/leads?mine=1" />
              <StatCard label="Posts this week" value={d.marketing.postsThisWeek} icon={Megaphone} to="/directors/marketing" />
            </div>

            <Card>
              <CardHeader title="New leads" action={<Button variant="ghost" size="sm" asChild><Link to="/leads">All leads</Link></Button>} />
              <CardBody className="pt-3">
                {d.newLeads.length === 0 ? <p className="text-sm text-stone-500">No new leads. Share a lead form to start capturing enquiries.</p> : (
                  <ul className="divide-y divide-stone-100">
                    {d.newLeads.map((l) => (
                      <li key={l._id}><Link to={`/leads/${l._id}`} className="flex items-center gap-3 py-3 hover:opacity-80"><Avatar name={l.name} size="sm" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{l.name}</div><div className="truncate text-xs text-stone-500">{l.source}</div></div><span className="text-xs text-stone-400">{timeAgo(l.submittedAt)}</span></Link></li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Recently added brokers" />
                <CardBody className="pt-3">
                  {d.recentBrokers.length === 0 ? <p className="text-sm text-stone-500">No brokers yet.</p> : (
                    <ul className="space-y-3">{d.recentBrokers.map((b) => <li key={b._id}><Link to={`/directors/brokers/${b._id}`} className="flex items-center gap-3"><Avatar name={b.fullName} size="sm" /><div className="min-w-0"><div className="truncate text-sm font-medium">{b.fullName}</div><div className="truncate text-xs text-stone-500">{b.company ?? "—"}</div></div></Link></li>)}</ul>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Employee updates" />
                <CardBody className="pt-3">
                  {d.recentEmployees.length === 0 ? <p className="text-sm text-stone-500">No employees yet.</p> : (
                    <ul className="space-y-3">{d.recentEmployees.map((e) => <li key={e._id}><Link to={`/directors/employees/${e._id}`} className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{e.name}</div><div className="truncate text-xs text-stone-500">{e.jobTitle ?? "—"}</div></div><span className="text-xs text-stone-400">{timeAgo(e.updatedAt)}</span></Link></li>)}</ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="bg-ink p-5 text-white"><div className="flex items-center gap-2 text-sm text-stone-400"><CalendarDays className="size-4" /> Upcoming meetings</div></div>
              <CardBody>
                {meetings === undefined ? <Skeleton className="h-24" /> : meetings.length === 0 ? <EmptyState className="py-6" icon={CalendarDays} title="Nothing scheduled" /> : (
                  <ul className="space-y-4">{meetings.map((m) => (
                    <li key={m._id}><Link to={`/calendar?meeting=${m._id}`} className="flex gap-3">
                      <div className="w-12 shrink-0 rounded-xl bg-brand-50 py-1.5 text-center"><div className="text-[10px] font-semibold text-brand-600 uppercase">{formatDate(m.startsAt, { month: "short" })}</div><div className="text-lg leading-none font-semibold text-stone-900">{formatDate(m.startsAt, { day: "numeric" })}</div></div>
                      <div className="min-w-0"><div className="truncate text-sm font-medium">{m.title}</div><div className="text-xs text-stone-500">{formatTime(m.startsAt)} · {m.location ?? (m.videoLink ? "Video call" : "—")}</div></div>
                    </Link></li>
                  ))}</ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Announcements" />
              <CardBody className="pt-3">
                {d.announcements.length === 0 ? <p className="text-sm text-stone-500">No announcements sent yet.</p> : <ul className="space-y-3">{d.announcements.map((a) => <li key={a._id} className="text-sm"><div className="font-medium">{a.subject}</div><div className="text-xs text-stone-500"><Badge className="mr-1">{a.template}</Badge>{timeAgo(a.sentAt)}</div></li>)}</ul>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Recent documents" />
              <CardBody className="pt-3">
                {!docs?.length ? <p className="text-sm text-stone-500">No shared documents yet.</p> : <ul className="space-y-3">{docs.map((x) => <li key={x._id} className="flex items-center gap-3 text-sm"><FileText className="size-4 text-stone-400" /><span className="min-w-0 flex-1 truncate">{x.name}</span><span className="text-xs text-stone-400">{timeAgo(x._creationTime)}</span></li>)}</ul>}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
