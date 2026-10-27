import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus, MapPin } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, EmptyState, Skeleton, SearchInput } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { PropertyForm, emptyProperty, propertyDraftToInput, PROPERTY_TYPES, type PropertyDraft } from "./PropertyForm";

export default function PropertiesPage() {
  const can = useCan();
  const navigate = useNavigate();
  const rows = useQuery(api.properties.list, {});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PropertyDraft>(emptyProperty);
  const [create, pending] = useAction(api.properties.create, { success: "Property added" });
  const filtered = (rows ?? []).filter((p) => !q || `${p.name} ${p.location}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Property directory" description="One profile per property — linked to brokers, documents and lead forms."
        actions={can("properties.write") && <Button onClick={() => setOpen(true)}><Plus /> Add property</Button>} />
      <SearchInput className="mb-5 sm:w-80" value={q} onChange={setQ} placeholder="Search properties…" />
      {rows === undefined ? <Skeleton className="h-64 rounded-2xl" /> : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card"><EmptyState icon={Building2} title={q ? "No matches" : "No properties yet"} description="Add each shopping centre and property once; every module links to the same record." action={can("properties.write") && !q ? <Button onClick={() => setOpen(true)}><Plus /> Add property</Button> : undefined} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p._id} to={`/properties/${p._id}`} className="group overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-pop">
              <div className="relative h-28 bg-ink">
                <div className="absolute -right-8 -bottom-12 size-40 rounded-full border-[22px] border-brand-500/25 transition group-hover:border-brand-500/40" />
                <Building2 className="absolute top-5 left-5 size-6 text-brand-400" />
              </div>
              <div className="p-5">
                <Badge>{PROPERTY_TYPES[p.type]}</Badge>
                <h3 className="mt-2 font-semibold text-zinc-900">{p.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500"><MapPin className="size-3.5" />{p.location}{p.province && `, ${p.province}`}</p>
                {p.gla && <p className="mt-1 text-xs text-zinc-400">{p.gla.toLocaleString("en-ZA")} m² GLA</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen} title="Add property" wide footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="property-form" loading={pending}>Save property</Button></>}>
        <PropertyForm value={draft} onChange={setDraft} onSubmit={() => void create({ data: propertyDraftToInput(draft) }).then((id) => { if (id) { setOpen(false); setDraft(emptyProperty); navigate(`/properties/${id}`); } })} />
      </Sheet>
    </>
  );
}
