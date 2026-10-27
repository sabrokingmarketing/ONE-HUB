import { useEffect, useState } from "react";
import { usePaginatedQuery, useQuery, useConvex } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Contact, Plus, Upload, Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, SearchInput, Tabs, EmptyState, LoadingRows, Avatar } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { useAction, useDebounced } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { timeAgo, downloadFile, errorCode } from "@/lib/utils";
import { toCsv } from "@/lib/share";
import { BrokerForm, emptyBroker, draftToInput, type BrokerDraft } from "./BrokerForm";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useMutation } from "convex/react";

export default function BrokersPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const convex = useConvex();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [propertyId, setPropertyId] = useState("");
  const dq = useDebounced(search);
  const properties = useQuery(api.properties.options);
  const { results, status, loadMore } = usePaginatedQuery(
    api.brokers.list,
    { search: dq || undefined, archived: tab === "archived", propertyId: (propertyId || undefined) as Id<"properties"> | undefined },
    { initialNumItems: 30 },
  );
  const [open, setOpen] = useState(params.get("new") === "1");
  const [draft, setDraft] = useState<BrokerDraft>(emptyBroker);
  const createRaw = useMutation(api.brokers.create);
  const [creating, setCreating] = useState(false);
  const [logExport] = useAction(api.brokers.logExport);
  useEffect(() => { if (params.get("new") === "1") { setOpen(true); params.delete("new"); setParams(params, { replace: true }); } }, [params, setParams]);

  const create = async (allowDuplicate = false) => {
    setCreating(true);
    try {
      const id = await createRaw({ data: draftToInput(draft), allowDuplicate });
      toast.success("Broker added — now visible to every director");
      setOpen(false);
      setDraft(emptyBroker);
      navigate(`/directors/brokers/${id}`);
    } catch (e) {
      if (errorCode(e) === "DUPLICATE") {
        toast.warning("Possible duplicate", { description: "A broker with this email or mobile exists.", action: { label: "Add anyway", onClick: () => void create(true) } });
      } else toast.error("Couldn't add broker", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const exportCsv = async () => {
    const rows = await convex.query(api.brokers.exportAll, {});
    downloadFile(`one-hub-brokers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    void logExport({ entity: "brokers", count: rows.length });
  };

  return (
    <>
      <PageHeader
        eyebrow="Directors"
        title="Broker directory"
        description="One shared, real-time directory for every director."
        actions={can("brokers.write") && <>
          <Button variant="secondary" onClick={() => void exportCsv()}><Download /> Export</Button>
          <Button variant="secondary" asChild><Link to="/directors/brokers/import"><Upload /> Import</Link></Button>
          <Button onClick={() => setOpen(true)}><Plus /> Add broker</Button>
        </>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={tab} onChange={setTab} items={[{ value: "active", label: "All brokers" }, { value: "archived", label: "Archived" }]} />
        <Select className="sm:ml-auto sm:w-56" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} aria-label="Filter by property"><option value="">All properties</option>{properties?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select>
        <SearchInput className="sm:w-72" value={search} onChange={setSearch} placeholder="Search name, company, email…" />
      </div>
      <Card className="overflow-hidden">
        {status === "LoadingFirstPage" ? <LoadingRows /> : results.length === 0 ? (
          <EmptyState icon={Contact} title={dq ? "No brokers match your search" : tab === "archived" ? "No archived brokers" : "No brokers yet"} description={!dq && tab === "active" ? "Add your first broker or import a spreadsheet." : undefined} action={!dq && tab === "active" && can("brokers.write") ? <Button onClick={() => setOpen(true)}><Plus /> Add broker</Button> : undefined} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-100 text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase"><tr><th className="px-5 py-3">Broker</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Region</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Updated</th></tr></thead>
                <tbody className="divide-y divide-zinc-100">
                  {results.map((b) => (
                    <tr key={b._id} className="cursor-pointer hover:bg-zinc-50/60" onClick={() => navigate(`/directors/brokers/${b._id}`)}>
                      <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={b.fullName} size="sm" /><div><div className="font-medium text-zinc-900">{b.fullName}</div><div className="text-xs text-zinc-500">{[b.position, b.company].filter(Boolean).join(" · ") || "—"}</div></div></div></td>
                      <td className="px-5 py-3 text-zinc-600"><div>{b.email ?? "—"}</div><div className="text-xs text-zinc-400">{b.mobile}</div></td>
                      <td className="px-5 py-3 text-zinc-600">{[b.region, b.province].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-5 py-3"><StatusBadge status={b.contactStatus} /></td>
                      <td className="px-5 py-3 text-zinc-500">{timeAgo(b.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-zinc-100 md:hidden">
              {results.map((b) => (
                <li key={b._id}><Link to={`/directors/brokers/${b._id}`} className="flex items-center gap-3 px-4 py-3.5"><Avatar name={b.fullName} /><div className="min-w-0 flex-1"><div className="truncate font-medium">{b.fullName}</div><div className="truncate text-xs text-zinc-500">{b.company ?? b.email ?? "—"}</div></div><StatusBadge status={b.contactStatus} /></Link></li>
              ))}
            </ul>
          </>
        )}
        {status === "CanLoadMore" && <div className="border-t border-zinc-100 p-3 text-center"><Button variant="ghost" onClick={() => loadMore(30)}>Load more</Button></div>}
      </Card>

      <Sheet open={open} onOpenChange={setOpen} title="Add broker" description="Visible to all directors as soon as you save." wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="broker-form" loading={creating}>Save broker</Button></>}>
        <BrokerForm value={draft} onChange={setDraft} onSubmit={() => void create()} />
      </Sheet>
    </>
  );
}
