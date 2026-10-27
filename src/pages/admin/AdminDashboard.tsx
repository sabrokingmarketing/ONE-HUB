import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, Contact, Inbox, Target, Share2, CalendarDays, Mail, AlertTriangle, UserCog, Megaphone, CheckCircle2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, StatCard, Skeleton, Avatar } from "@/components/ui/misc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";
import { timeAgo } from "@/lib/utils";

export default function AdminDashboard() {
  const me = useMe();
  const d = useQuery(api.dashboard.admin);
  const hour = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        eyebrow="Admin portal"
        title={`${greeting}, ${me.name.split(" ")[0]}`}
        description="Company-wide overview of people, pipeline and marketing activity."
        actions={<>
          <Button variant="secondary" asChild><Link to="/admin/users"><UserCog /> Invite user</Link></Button>
          <Button asChild><Link to="/marketing/social/new"><Share2 /> Create post</Link></Button>
        </>}
      />
      {!d ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard tone="dark" label="Active users" value={d.totals.users} hint={`${d.totals.directors} directors · ${d.totals.marketing} marketing`} icon={Users} to="/admin/users" />
            <StatCard tone="brand" label="New leads" value={d.totals.newLeads} hint={`${d.totals.leads30d} in the last 30 days`} icon={Inbox} to="/leads" />
            <StatCard label="Brokers" value={d.totals.brokers} icon={Contact} to="/directors/brokers" />
            <StatCard label="Employees" value={d.totals.employees} icon={Users} to="/directors/employees" />
            <StatCard label="Active campaigns" value={d.totals.activeCampaigns} icon={Target} to="/marketing/campaigns" />
            <StatCard label="Scheduled posts" value={d.totals.scheduledPosts} hint={`${d.totals.publishedPosts} published`} icon={Share2} to="/marketing/social" />
            <StatCard label="Meetings (14 days)" value={d.totals.upcomingMeetings} icon={CalendarDays} to="/calendar" />
            <StatCard label="Emails (7 days)" value={d.totals.emailsSent7d} hint={d.totals.emailFailures ? `${d.totals.emailFailures} failed` : "No failures"} icon={Mail} to="/admin/email" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Lead submissions" description="Last 14 days, all forms" />
              <CardBody className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.leadSeries} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e7e5e4" strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={(v: string) => v.slice(8)} tick={{ fontSize: 12, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 13 }} labelFormatter={(l) => `Date: ${l}`} />
                    <Area type="monotone" dataKey="leads" stroke="var(--color-brand-500)" strokeWidth={2.5} fill="url(#lg)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="System alerts" />
              <CardBody className="space-y-3">
                {d.totals.failedPosts > 0 && (
                  <Link to="/marketing/social?tab=failed" className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 hover:bg-red-100">
                    <AlertTriangle className="size-4" /> {d.totals.failedPosts} social post(s) failed to publish
                  </Link>
                )}
                {d.totals.emailFailures > 0 && (
                  <Link to="/admin/email" className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 hover:bg-amber-100">
                    <Mail className="size-4" /> {d.totals.emailFailures} email(s) failed to send
                  </Link>
                )}
                {d.totals.failedPosts === 0 && d.totals.emailFailures === 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="size-4" /> No active alerts</div>
                )}
                <Link to="/admin/integrations" className="flex items-center gap-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-700 hover:bg-stone-100"><Megaphone className="size-4" /> Review integration status</Link>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Company activity" description="Latest changes across ONE HUB" action={<Button variant="ghost" size="sm" asChild><Link to="/admin/audit">View all</Link></Button>} />
            <CardBody>
              {d.activity.length === 0 ? (
                <p className="text-sm text-stone-500">No activity yet.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {d.activity.map((a) => (
                    <li key={a._id} className="flex items-center gap-3 py-3">
                      <Avatar name={a.actorName} size="sm" />
                      <div className="min-w-0 flex-1 text-sm"><span className="font-medium text-stone-900">{a.actorName}</span> <span className="text-stone-600">{a.summary}</span></div>
                      <span className="shrink-0 text-xs text-stone-400">{timeAgo(a.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
