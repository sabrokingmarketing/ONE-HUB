import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { Activity } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Avatar, EmptyState, LoadingRows } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

const ENTITIES = ["", "users", "invitations", "brokers", "employees", "properties", "leads", "leadForms", "meetings", "announcements", "marketingCampaigns", "socialPosts", "marketingAssets", "marketingIdeas", "integrationSettings"];

export default function AuditPage() {
  const [entity, setEntity] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(api.system.auditLogs, { entity: entity || undefined }, { initialNumItems: 40 });
  return (
    <>
      <PageHeader eyebrow="Overview" title="Company activity & audit log" description="An immutable record of who changed what, and when." actions={<Select className="w-52" value={entity} onChange={(e) => setEntity(e.target.value)}>{ENTITIES.map((e) => <option key={e} value={e}>{e || "All record types"}</option>)}</Select>} />
      <Card className="overflow-hidden">
        {status === "LoadingFirstPage" ? <LoadingRows rows={8} /> : results.length === 0 ? <EmptyState icon={Activity} title="No activity recorded" /> : (
          <ul className="divide-y divide-stone-100">
            {results.map((r) => (
              <li key={r._id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={r.actorName} size="sm" />
                <div className="min-w-0 flex-1 text-sm">
                  <div><span className="font-medium text-stone-900">{r.actorName}</span> <span className="text-stone-600">{r.summary}</span></div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-400"><Badge>{r.entity}</Badge><Badge tone="neutral">{r.action}</Badge><span>{formatDateTime(r.at)}</span></div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {status === "CanLoadMore" && <div className="border-t border-stone-100 p-3 text-center"><Button variant="ghost" onClick={() => loadMore(40)}>Load more</Button></div>}
      </Card>
    </>
  );
}
