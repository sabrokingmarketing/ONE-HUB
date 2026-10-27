import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { ClipboardList, Plus, Share2, Pencil, Inbox } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, EmptyState, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { useCan } from "@/lib/session";
import { timeAgo } from "@/lib/utils";
import { ShareFormDialog } from "./ShareForm";

export default function FormsPage() {
  const can = useCan();
  const forms = useQuery(api.leadForms.list, {});
  const [sharing, setSharing] = useState<null | { slug: string; title: string; active: boolean }>(null);
  return (
    <>
      <PageHeader eyebrow="Leads & forms" title="Lead forms" description="Shared forms — any authorised colleague can open, share and track them." actions={can("forms.write") && <Button asChild><Link to="/forms/new"><Plus /> Create form</Link></Button>} />
      {forms === undefined ? <Skeleton className="h-64 rounded-2xl" /> : forms.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card"><EmptyState icon={ClipboardList} title="No lead forms yet" description="Build a branded form in minutes and share it by link, QR code, WhatsApp or embed." action={can("forms.write") ? <Button asChild><Link to="/forms/new"><Plus /> Create form</Link></Button> : undefined} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {forms.map((f) => (
            <div key={f._id} className="flex flex-col rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: f.accentColor ?? "var(--color-brand-500)" }}><ClipboardList className="size-5" /></span>
                <StatusBadge status={f.status} />
              </div>
              <h3 className="mt-4 font-semibold text-zinc-900">{f.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{f.description ?? `${f.fields.length} fields`}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {f.propertyName && <Badge>{f.propertyName}</Badge>}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><Inbox className="size-3.5" /> {f.submissionCount} submissions · by {f.createdByName} · {timeAgo(f._creationTime)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setSharing({ slug: f.slug, title: f.title, active: f.status === "active" })}><Share2 /> Share</Button>
                <Button size="sm" variant="secondary" className="flex-1" asChild><Link to={`/forms/${f._id}`}><Pencil /> {can("forms.write") ? "Edit" : "View"}</Link></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {sharing && <ShareFormDialog open onOpenChange={(o) => !o && setSharing(null)} {...sharing} />}
    </>
  );
}
