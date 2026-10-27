import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Target, Plus, Calendar } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Tabs, EmptyState, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { CampaignForm, emptyCampaign, type CampaignDraft } from "./CampaignForm";

type Filter = "all" | "planning" | "active" | "paused" | "completed" | "archived";

export default function CampaignsPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useQuery(api.campaigns.list, {});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft>(emptyCampaign);
  const [create, pending] = useAction(api.campaigns.create, { success: "Campaign created" });
  useEffect(() => { if (params.get("new") === "1") { setOpen(true); params.delete("new"); setParams(params, { replace: true }); } }, [params, setParams]);
  const shown = (rows ?? []).filter((c) => (filter === "all" ? c.status !== "archived" : c.status === filter));
  return (
    <>
      <PageHeader eyebrow="Campaigns" title="Marketing campaigns" description="Plan, track and connect posts and assets to each campaign." actions={can("campaigns.write") && <Button onClick={() => setOpen(true)}><Plus /> Create campaign</Button>} />
      <Tabs className="mb-5" value={filter} onChange={setFilter} items={(["all", "planning", "active", "paused", "completed", "archived"] as Filter[]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), count: v === "all" ? undefined : rows?.filter((c) => c.status === v).length }))} />
      {rows === undefined ? <Skeleton className="h-64 rounded-2xl" /> : shown.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-stone-200/70"><EmptyState icon={Target} title="No campaigns here" action={can("campaigns.write") ? <Button onClick={() => setOpen(true)}><Plus /> Create campaign</Button> : undefined} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <Link key={c._id} to={`/marketing/campaigns/${c._id}`} className="flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-stone-200/70 transition hover:shadow-pop">
              <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-stone-900">{c.name}</h3><StatusBadge status={c.status} /></div>
              <p className="mt-1 line-clamp-2 text-sm text-stone-500">{c.description ?? c.objectives ?? "—"}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{c.propertyName && <Badge>{c.propertyName}</Badge>}{c.platforms.map((p) => <Badge key={p} tone="blue">{p}</Badge>)}</div>
              <div className="mt-auto pt-4">
                {c.progress !== null && <><div className="mb-1 flex justify-between text-xs text-stone-500"><span>Tasks</span><span>{c.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-brand-500" style={{ width: `${c.progress}%` }} /></div></>}
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500"><span className="flex items-center gap-1"><Calendar className="size-3.5" />{c.startDate ?? "—"} → {c.endDate ?? "—"}</span><span>{c.postCounts.total} posts</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen} title="Create campaign" wide footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="campaign-form" loading={pending}>Create</Button></>}>
        <CampaignForm value={draft} onChange={setDraft} onSubmit={() => void create({ data: draft }).then((id) => { if (id) { setOpen(false); setDraft(emptyCampaign); navigate(`/marketing/campaigns/${id}`); } })} />
      </Sheet>
    </>
  );
}
