import { useQuery } from "convex/react";
import { Megaphone, Target } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, EmptyState, Skeleton, StatCard } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

/** Read-only marketing overview for directors. */
export default function DirectorMarketingPage() {
  const campaigns = useQuery(api.campaigns.list, {});
  const posts = useQuery(api.socialPosts.list, {});
  const counts = useQuery(api.socialPosts.counts);
  const upcoming = (posts ?? []).filter((p) => p.status === "scheduled").sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0)).slice(0, 8);
  return (
    <>
      <PageHeader eyebrow="Marketing" title="Marketing overview" description="View-only summary of campaigns and scheduled content." />
      {!campaigns || !posts || !counts ? <Skeleton className="h-80 rounded-2xl" /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Active campaigns" value={campaigns.filter((c) => c.status === "active").length} icon={Target} />
            <StatCard label="Scheduled posts" value={counts.scheduled} icon={Megaphone} />
            <StatCard label="Published" value={counts.published} />
            <StatCard label="Failed" value={counts.failed} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader title="Campaigns" /><CardBody>
              {campaigns.length === 0 ? <EmptyState icon={Target} title="No campaigns yet" className="py-6" /> : <ul className="divide-y divide-stone-100">{campaigns.map((c) => <li key={c._id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><div className="font-medium">{c.name}</div><div className="text-xs text-stone-500">{c.propertyName ?? "Portfolio-wide"} · {c.postCounts.total} posts</div></div><StatusBadge status={c.status} /></li>)}</ul>}
            </CardBody></Card>
            <Card><CardHeader title="Upcoming posts" /><CardBody>
              {upcoming.length === 0 ? <EmptyState icon={Megaphone} title="Nothing scheduled" className="py-6" /> : <ul className="divide-y divide-stone-100">{upcoming.map((p) => <li key={p._id} className="py-3 text-sm"><div className="line-clamp-2">{p.caption || "(media only)"}</div><div className="mt-1 text-xs text-stone-500">{formatDateTime(p.scheduledAt)} · {p.accounts.map((a) => a.name).join(", ")}</div></li>)}</ul>}
            </CardBody></Card>
          </div>
        </div>
      )}
    </>
  );
}
