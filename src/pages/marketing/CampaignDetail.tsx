import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Target, Pencil, Plus, BarChart3 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Skeleton, EmptyState, DefinitionList } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { ChangedBanner } from "@/components/ChangedBanner";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { CampaignForm, campaignToDraft, type CampaignDraft } from "./CampaignForm";

export default function CampaignDetail() {
  const { id } = useParams();
  const can = useCan();
  const c = useQuery(api.campaigns.get, { id: id as Id<"marketingCampaigns"> });
  const [editing, setEditing] = useState<{ draft: CampaignDraft; version: number } | null>(null);
  const [update, saving] = useAction(api.campaigns.update, { success: "Campaign updated" });
  const [toggle] = useAction(api.campaigns.toggleTask);
  if (c === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (c === null) return <EmptyState icon={Target} title="Campaign not found" />;
  const done = c.tasks.filter((t) => t.done).length;
  return (
    <>
      <PageHeader back="/marketing/campaigns" eyebrow="Campaign" title={c.name} description={<StatusBadge status={c.status} />}
        actions={can("campaigns.write") && <><Button variant="secondary" asChild><Link to="/marketing/social/new"><Plus /> Add post</Link></Button><Button onClick={() => setEditing({ draft: campaignToDraft(c), version: c.version })}><Pencil /> Edit</Button></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card><CardHeader title="Overview" /><CardBody>
            <DefinitionList items={[
              { label: "Dates", value: `${c.startDate ?? "—"} → ${c.endDate ?? "—"}` }, { label: "Platforms", value: c.platforms.length ? <div className="flex flex-wrap gap-1">{c.platforms.map((p) => <Badge key={p} tone="blue">{p}</Badge>)}</div> : null },
              { label: "Description", value: c.description && <span className="whitespace-pre-wrap">{c.description}</span> }, { label: "Objectives", value: c.objectives && <span className="whitespace-pre-wrap">{c.objectives}</span> }, { label: "Notes", value: c.notes && <span className="whitespace-pre-wrap">{c.notes}</span> },
            ]} />
          </CardBody></Card>
          <Card><CardHeader title="Posts" description={`${c.posts.length} linked posts`} /><CardBody>
            {c.posts.length === 0 ? <p className="text-sm text-stone-500">No posts linked yet. Choose this campaign when creating a post.</p> : <ul className="divide-y divide-stone-100">{c.posts.map((p) => <li key={p._id}><Link to={`/marketing/social/posts/${p._id}`} className="flex items-center gap-3 py-3"><span className="line-clamp-1 flex-1 text-sm">{p.caption || "(media only)"}</span><span className="text-xs text-stone-500">{formatDateTime(p.scheduledAt)}</span><StatusBadge status={p.status} /></Link></li>)}</ul>}
          </CardBody></Card>
          <Card><CardHeader title={<span className="flex items-center gap-2"><BarChart3 className="size-4 text-stone-400" />Performance</span>} /><CardBody>
            <p className="text-sm text-stone-500">Platform metrics (reach, engagement) will appear here once a connected account's official insights API is verified. ONE HUB never estimates or fabricates performance data.</p>
          </CardBody></Card>
        </div>
        <Card className="self-start"><CardHeader title="Tasks" description={c.tasks.length ? `${done} of ${c.tasks.length} complete` : undefined} /><CardBody>
          {c.tasks.length === 0 ? <p className="text-sm text-stone-500">No tasks.</p> : (
            <>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-brand-500 transition-all" style={{ width: `${(done / c.tasks.length) * 100}%` }} /></div>
              <ul className="space-y-2">{c.tasks.map((t) => <li key={t.id}><label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={!can("campaigns.write")} className="size-4 accent-brand-500" checked={t.done} onChange={() => void toggle({ id: c._id, taskId: t.id })} /><span className={t.done ? "text-stone-400 line-through" : ""}>{t.title}</span></label></li>)}</ul>
            </>
          )}
        </CardBody></Card>
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit campaign" wide footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="campaign-edit" loading={saving}>Save</Button></>}>
        {editing && c.version !== editing.version && <ChangedBanner by="A colleague" onReload={() => setEditing({ draft: campaignToDraft(c), version: c.version })} />}
        {editing && <CampaignForm id="campaign-edit" value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} onSubmit={() => void update({ id: c._id, expectedVersion: editing.version, data: editing.draft }).then((r) => r !== undefined && setEditing(null))} />}
      </Sheet>
    </>
  );
}
