import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus, MapPin, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, EmptyState, Skeleton, SearchInput } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { PropertyForm, emptyProperty, propertyDraftToInput, PROPERTY_TYPES, FUNDS, type PropertyDraft } from "./PropertyForm";

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
            <Link key={p._id} to={`/properties/${p._id}`} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-pop">
              <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                {p.coverUrl
                  ? <img src={p.coverUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                  : <>
                      <div className="absolute -right-10 -bottom-14 size-48 rounded-full border-[26px] border-brand-500/25 transition group-hover:border-brand-500/40" />
                      <Building2 className="absolute top-5 left-5 size-7 text-brand-400" />
                    </>}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent px-4 pt-10 pb-4">
                  <span className="rounded-full bg-brand-500 px-3.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-white uppercase shadow-sm">{PROPERTY_TYPES[p.type]}</span>
                  {p.fund && <span className="flex items-center gap-1 text-xs font-semibold tracking-[0.12em] text-white uppercase">{FUNDS[p.fund]}<ChevronRight className="size-4" /></span>}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-semibold text-zinc-900">{p.name}</h3>
                <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed text-zinc-500"><MapPin className="mt-0.5 size-3.5 shrink-0" /><span>{p.location}{p.province && <><br />{p.province}</>}</span></p>
                {p.gla ? (
                  <div className="mt-auto pt-4">
                    <p className="text-2xl font-semibold text-brand-600 tabular-nums">{p.gla.toLocaleString("en-ZA")} m²<span className="ml-1 text-sm font-semibold text-zinc-700">GLA</span></p>
                    <p className="text-xs text-zinc-400">Gross lettable area</p>
                  </div>
                ) : null}
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
