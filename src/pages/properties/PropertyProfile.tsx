import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Building2, Pencil, Contact, Target, ClipboardList, FileText, Archive, RotateCcw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Skeleton, EmptyState, DefinitionList } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { ChangedBanner } from "@/components/ChangedBanner";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { PropertyForm, propertyToDraft, propertyDraftToInput, PROPERTY_TYPES, type PropertyDraft } from "./PropertyForm";

export default function PropertyProfile() {
  const { id } = useParams();
  const can = useCan();
  const p = useQuery(api.properties.get, { id: id as Id<"properties"> });
  const [editing, setEditing] = useState<{ draft: PropertyDraft; version: number } | null>(null);
  const [update, saving] = useAction(api.properties.update, { success: "Property updated" });
  const [setArchived] = useAction(api.properties.setArchived);
  if (p === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (p === null) return <EmptyState icon={Building2} title="Property not found" />;

  const Linked = ({ title, icon: Icon, items, empty }: { title: string; icon: typeof Contact; items: { key: string; label: string; to?: string; extra?: React.ReactNode }[]; empty: string }) => (
    <Card><CardHeader title={<span className="flex items-center gap-2"><Icon className="size-4 text-stone-400" />{title}</span>} description={`${items.length} linked`} />
      <CardBody className="pt-3">{items.length === 0 ? <p className="text-sm text-stone-500">{empty}</p> : <ul className="divide-y divide-stone-100">{items.map((i) => <li key={i.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">{i.to ? <Link className="font-medium hover:text-brand-600" to={i.to}>{i.label}</Link> : <span>{i.label}</span>}{i.extra}</li>)}</ul>}</CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader back="/properties" eyebrow={PROPERTY_TYPES[p.type]} title={p.name} description={[p.location, p.province].filter(Boolean).join(", ")}
        actions={can("properties.write") && <>
          {p.archivedAt ? <Button variant="secondary" onClick={() => void setArchived({ id: p._id, archived: false })}><RotateCcw /> Restore</Button> : <Button variant="ghost" onClick={() => void setArchived({ id: p._id, archived: true })}><Archive /> Archive</Button>}
          <Button onClick={() => setEditing({ draft: propertyToDraft(p), version: p.version })}><Pencil /> Edit</Button>
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Property information" /><CardBody>
          <DefinitionList items={[
            { label: "Type", value: <Badge>{PROPERTY_TYPES[p.type]}</Badge> }, { label: "Location", value: p.location }, { label: "GLA", value: p.gla && `${p.gla.toLocaleString("en-ZA")} m²` },
            { label: "Description", value: p.description && <span className="whitespace-pre-wrap">{p.description}</span> }, { label: "Contacts", value: p.contacts && <span className="whitespace-pre-wrap">{p.contacts}</span> }, { label: "Notes", value: p.notes && <span className="whitespace-pre-wrap">{p.notes}</span> },
          ]} />
        </CardBody></Card>
        <div className="space-y-6">
          {can("brokers.read") && <Linked title="Brokers" icon={Contact} items={p.brokers.map((b) => ({ key: b._id, label: b.fullName, to: `/directors/brokers/${b._id}`, extra: <span className="text-xs text-stone-400">{b.company}</span> }))} empty="No brokers linked." />}
          {can("campaigns.read") && <Linked title="Campaigns" icon={Target} items={p.campaigns.map((c) => ({ key: c._id, label: c.name, to: `/marketing/campaigns/${c._id}`, extra: <StatusBadge status={c.status} /> }))} empty="No campaigns." />}
          <Linked title="Lead forms" icon={ClipboardList} items={p.forms.map((f) => ({ key: f._id, label: f.title, to: `/forms/${f._id}`, extra: <span className="text-xs text-stone-400">{f.submissionCount} leads</span> }))} empty="No lead forms." />
          <Linked title="Marketing assets" icon={FileText} items={p.assets.map((a) => ({ key: a._id, label: a.name, extra: <span className="text-xs text-stone-400">{a.category}</span> }))} empty="No assets." />
        </div>
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Edit ${p.name}`} wide footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="property-edit" loading={saving}>Save</Button></>}>
        {editing && p.version !== editing.version && <ChangedBanner by="A colleague" onReload={() => setEditing({ draft: propertyToDraft(p), version: p.version })} />}
        {editing && <PropertyForm id="property-edit" value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} onSubmit={() => void update({ id: p._id, expectedVersion: editing.version, data: propertyDraftToInput(editing.draft) }).then((r) => r !== undefined && setEditing(null))} />}
      </Sheet>
    </>
  );
}
