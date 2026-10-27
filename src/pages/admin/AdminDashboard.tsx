import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, Contact, Inbox, CalendarDays, Mail, AlertTriangle, UserCog, Building2, FileText, ArrowUpRight, Plug } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { StatCard, Skeleton, Avatar } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";
import { formatDate, timeAgo } from "@/lib/utils";

export default function AdminDashboard() {
  const me = useMe();
  const d = useQuery(api.dashboard.admin);
  const hour = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{greeting}, {me.name.split(" ")[0]}</h1>
          <p className="text-sm text-zinc-500">{formatDate(Date.now(), { dateStyle: "full" })} · company-wide overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild><Link to="/admin/integrations"><Plug /> Integrations</Link></Button>
          <Button asChild><Link to="/admin/users"><UserCog /> Invite user</Link></Button>
        </div>
      </div>

      {!d ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[184px] rounded-2xl" />)}</div>
      ) : (
        <>
          {d.totals.emailFailures > 0 && (
            <Link to="/admin/email" className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-medium text-amber-800 shadow-card">
              <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700"><AlertTriangle className="size-4" /></span>
              {d.totals.emailFailures} email(s) failed to send — review the email log
              <ArrowUpRight className="ml-auto size-4" />
            </Link>
          )}

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard tone="brand" label="Active users" value={d.totals.users} hint={`${d.totals.admins} admins · ${d.totals.directors} directors`} icon={Users} to="/admin/users" />
            <StatCard tone="dark" label="New leads" value={d.totals.newLeads} hint={`${d.totals.leads30d} in the last 30 days`} icon={Inbox} to="/leads" />
            <StatCard tone="dark" label="Brokers" value={d.totals.brokers} hint="Shared directory" icon={Contact} to="/directors/brokers" />
            <StatCard tone="dark" label="Employees" value={d.totals.employees} hint="Shared directory" icon={Users} to="/directors/employees" />
            <StatCard label="Properties" value={d.totals.properties} icon={Building2} to="/properties" />
            <StatCard label="Documents" value={d.totals.documents} icon={FileText} to="/directors/documents" />
            <StatCard label="Meetings (14 days)" value={d.totals.upcomingMeetings} icon={CalendarDays} to="/calendar" />
            <StatCard label="Emails (7 days)" value={d.totals.emailsSent7d} hint={d.totals.emailFailures ? `${d.totals.emailFailures} failed` : "No failures"} icon={Mail} to="/admin/email" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card fill className="h-[420px]">
              <CardHeader title="Lead submissions" description="Last 14 days, all forms" action={<Link to="/leads" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">View all <ArrowUpRight className="size-3.5" /></Link>} />
              <div className="min-h-0 flex-1 px-4 pt-4 pb-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.leadSeries} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="4 4" />
                    <XAxis dataKey="day" tickFormatter={(v: string) => v.slice(8)} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 12px 32px -12px rgb(0 0 0 / .2)", fontSize: 13 }} labelFormatter={(l) => `Date: ${l}`} />
                    <Area type="monotone" dataKey="leads" stroke="var(--color-brand-500)" strokeWidth={3} fill="url(#lg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card fill className="h-[420px]">
              <CardHeader title="Company activity" description="Latest changes across ONE HUB" action={<Link to="/admin/audit" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">View all <ArrowUpRight className="size-3.5" /></Link>} />
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">
                {d.activity.length === 0 ? <p className="text-sm text-zinc-400">No activity yet.</p> : (
                  <ol className="relative">
                    {d.activity.map((a, i) => (
                      <li key={a._id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < d.activity.length - 1 && <span className="absolute top-8 left-[13px] h-[calc(100%-1.75rem)] w-px bg-zinc-200" />}
                        <Avatar name={a.actorName} size="sm" />
                        <div className="min-w-0 text-sm">
                          <div className="truncate"><span className="font-semibold text-zinc-900">{a.actorName}</span> <span className="text-zinc-600">{a.summary}</span></div>
                          <div className="text-xs text-zinc-400">{timeAgo(a.at)}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
