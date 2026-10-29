import { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Building2, Pencil, Contact, ClipboardList, FileText, Archive, RotateCcw, ImagePlus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Skeleton, EmptyState, DefinitionList } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { ChangedBanner } from "@/components/ChangedBanner";
import { useAction, uploadFile } from "@/lib/hooks";
import { errorMessage } from "@/lib/utils";
import { useCan } from "@/lib/session";
import { PropertyForm, propertyToDraft, propertyDraftToInput, PROPERTY_TYPES, type PropertyDraft } from "./PropertyForm";

export default function PropertyProfile() {
  const { id } = useParams();
  const can = useCan();
  const p = useQuery(api.properties.get, { id: id as Id<"properties"> });
  const [editing, setEditing] = useState<{ draft: PropertyDraft; version: number } | null>(null);
  const [update, saving] = useAction(api.properties.update, { success: "Property updated" });
  const [setArchived] = useAction(api.properties.setArchived);
  const genUrl = useMutation(api.properties.generateUploadUrl);
  const setCover = useMutation(api.properties.setCover);
  const [removeCover, removing] = useAction(api.properties.removeCover, { success: "Cover image removed" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  if (p === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (p === null) return <EmptyState icon={Building2} title="Property not found" />;

  const Linked = ({ title, icon: Icon, items, empty }: { title: string; icon: typeof Contact; items: { key: string; label: string; to?: string; extra?: React.ReactNode }[]; empty: string }) => (
    <Card><CardHeader title={<span className="flex items-center gap-2"><Icon className="size-4 text-zinc-400" />{title}</span>} description={`${items.length} linked`} />
      <CardBody className="pt-3">{items.length === 0 ? <p className="text-sm text-zinc-500">{empty}</p> : <ul className="divide-y divide-zinc-100">{items.map((i) => <li key={i.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">{i.to ? <Link className="font-medium hover:text-brand-600" to={i.to}>{i.label}</Link> : <span>{i.label}</span>}{i.extra}</li>)}</ul>}</CardBody>
    </Card>
  );

  const onCover = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try {
      const sid = await uploadFile(await genUrl(), f);
      const r = await setCover({ id: p._id, storageId: sid as Id<"_storage"> });
      if (r.error) toast.error(r.error);
      else toast.success("Cover image updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const canWrite = can("properties.write");

  return (
    <>
      {(p.coverUrl || canWrite) && (
        <div className="relative mb-6 h-48 overflow-hidden rounded-2xl bg-ink shadow-card sm:h-64 lg:h-72">
          {p.coverUrl
            ? <img src={p.coverUrl} alt={`${p.name} cover`} className="absolute inset-0 size-full object-cover" />
            : <div className="absolute inset-0 grid place-items-center text-center text-white/70">
                <div><Building2 className="mx-auto size-8 text-brand-400" /><p className="mt-2 text-sm">Add a cover image to show this property at a glance.</p></div>
              </div>}
          {canWrite && (
            <div className="absolute right-3 bottom-3 flex gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(ev) => void onCover(ev.target.files?.[0])} />
              {p.coverUrl && <Button variant="secondary" size="sm" loading={removing} onClick={() => void removeCover({ id: p._id })}><Trash2 /> Remove</Button>}
              <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><ImagePlus /> {p.coverUrl ? "Change cover" : "Upload cover"}</Button>
            </div>
          )}
        </div>
      )}
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
          {can("brokers.read") && <Linked title="Brokers" icon={Contact} items={p.brokers.map((b) => ({ key: b._id, label: b.fullName, to: `/directors/brokers/${b._id}`, extra: <span className="text-xs text-zinc-400">{b.company}</span> }))} empty="No brokers linked." />}
          <Linked title="Lead forms" icon={ClipboardList} items={p.forms.map((f) => ({ key: f._id, label: f.title, to: `/forms/${f._id}`, extra: <span className="text-xs text-zinc-400">{f.submissionCount} leads</span> }))} empty="No lead forms." />
          <Linked title="Documents" icon={FileText} items={p.documents.map((a) => ({ key: a._id, label: a.name, to: `/directors/documents?doc=${a._id}`, extra: <span className="text-xs text-zinc-400">{a.category}</span> }))} empty="No documents." />
        </div>
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Edit ${p.name}`} wide footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="property-edit" loading={saving}>Save</Button></>}>
        {editing && p.version !== editing.version && <ChangedBanner by="A colleague" onReload={() => setEditing({ draft: propertyToDraft(p), version: p.version })} />}
        {editing && <PropertyForm id="property-edit" value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} onSubmit={() => void update({ id: p._id, expectedVersion: editing.version, data: propertyDraftToInput(editing.draft) }).then((r) => r !== undefined && setEditing(null))} />}
      </Sheet>
    </>
  );
}
