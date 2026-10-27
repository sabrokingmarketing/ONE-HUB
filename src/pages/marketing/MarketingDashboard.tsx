import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { Share2, CalendarClock, Upload, Target, Lightbulb, ClipboardList, CheckCircle2, AlertTriangle, Inbox, Plug } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, StatCard, Skeleton, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useMe } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

const QUICK = [
  { label: "Create post", to: "/marketing/social/new", icon: Share2 },
  { label: "Schedule post", to: "/marketing/social/new?schedule=1", icon: CalendarClock },
  { label: "Upload asset", to: "/marketing/library?upload=1", icon: Upload },
  { label: "Create campaign", to: "/marketing/campaigns?new=1", icon: Target },
  { label: "Add idea", to: "/marketing/ideas?new=1", icon: Lightbulb },
  { label: "Create lead form", to: "/forms/new", icon: ClipboardList },
];

export default function MarketingDashboard() {
  const me = useMe();
  const d = useQuery(api.dashboard.marketing);
  const recent = useQuery(api.assets.recent, { limit: 6 });
  return (
    <>
      <PageHeader eyebrow="Marketing portal" title="Marketing command centre" description={`Welcome back, ${me.name.split(" ")[0]}. Your shared workspace for content, campaigns and assets.`} />
      <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
        {QUICK.map((q) => (
          <Link key={q.label} to={q.to} className="group flex shrink-0 items-center gap-3 rounded-2xl bg-white p-3.5 text-sm font-medium text-stone-800 shadow-card ring-1 ring-stone-200/70 transition hover:ring-brand-300">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white"><q.icon className="size-4" /></span>{q.label}
          </Link>
        ))}
      </div>
      {!d ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <StatCard tone="dark" label="Scheduled" value={d.counts.scheduled} icon={CalendarClock} to="/marketing/social?tab=scheduled" />
            <StatCard label="Published" value={d.counts.published} icon={CheckCircle2} to="/marketing/social?tab=published" />
            <StatCard label="Failed" value={d.counts.failed} icon={AlertTriangle} to="/marketing/social?tab=failed" />
            <StatCard label="Active campaigns" value={d.counts.activeCampaigns} icon={Target} to="/marketing/campaigns" />
            <StatCard tone="brand" label="New leads (7d)" value={d.counts.newLeads7d} icon={Inbox} to="/leads" />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Upcoming posts" action={<Button variant="ghost" size="sm" asChild><Link to="/marketing/social">Content calendar</Link></Button>} />
              <CardBody className="pt-3">
                {d.upcoming.length === 0 ? <EmptyState className="py-8" icon={CalendarClock} title="Nothing scheduled" action={<Button asChild><Link to="/marketing/social/new">Create post</Link></Button>} /> : (
                  <ul className="divide-y divide-stone-100">{d.upcoming.map((p) => <li key={p._id}><Link to={`/marketing/social/posts/${p._id}`} className="flex gap-4 py-3"><span className="w-28 shrink-0 text-xs font-medium text-stone-500">{formatDateTime(p.scheduledAt)}</span><span className="line-clamp-2 text-sm">{p.caption || "(media only)"}</span></Link></li>)}</ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Connected accounts" action={<Button variant="ghost" size="sm" asChild><Link to="/marketing/social/accounts">Manage</Link></Button>} />
              <CardBody className="pt-3">
                {d.accounts.length === 0 ? <EmptyState className="py-6" icon={Plug} title="No accounts connected" description="Connect Facebook, Instagram or LinkedIn pages once official app access is approved." /> : (
                  <ul className="space-y-2">{d.accounts.map((a) => <li key={a._id} className="flex items-center justify-between text-sm"><span>{a.name} <span className="text-stone-400">· {a.platform}</span></span><StatusBadge status={a.status} /></li>)}</ul>
                )}
              </CardBody>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Active campaigns" />
              <CardBody className="pt-3">
                {d.campaigns.length === 0 ? <p className="text-sm text-stone-500">No active campaigns.</p> : (
                  <ul className="space-y-4">{d.campaigns.map((c) => (
                    <li key={c._id}><Link to={`/marketing/campaigns/${c._id}`} className="block">
                      <div className="flex justify-between text-sm"><span className="font-medium">{c.name}</span><span className="text-xs text-stone-500">{c.endDate ? `Ends ${c.endDate}` : ""}</span></div>
                      {c.progress !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-brand-500" style={{ width: `${c.progress}%` }} /></div>}
                    </Link></li>
                  ))}</ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Recent assets" action={<Button variant="ghost" size="sm" asChild><Link to="/marketing/library">Library</Link></Button>} />
              <CardBody className="pt-3">{!recent?.length ? <p className="text-sm text-stone-500">No uploads yet.</p> : <ul className="space-y-2 text-sm">{recent.map((a) => <li key={a._id} className="truncate">{a.name} <span className="text-xs text-stone-400">· {a.category}</span></li>)}</ul>}</CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
