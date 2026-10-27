import { useState } from "react";
import { usePaginatedQuery, useQuery, useConvex } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Inbox, Download, Plus, ClipboardList } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { PageHeader, Tabs, SearchInput, EmptyState, LoadingRows, Avatar } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/dialog";
import { useAction, useDebounced } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { downloadFile, timeAgo } from "@/lib/utils";
import { toCsv } from "@/lib/share";

type Status = Doc<"leads">["status"];
const STATUSES: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" }, { value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "qualified", label: "Qualified" },
  { value: "follow_up", label: "Follow-up" }, { value: "converted", label: "Converted" }, { value: "closed", label: "Closed" },
];

export default function LeadsPage() {
  const can = useCan();
  const convex = useConvex();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(params.get("mine") === "1");
  const dq = useDebounced(search);
  const counts = useQuery(api.leads.counts);
  const { results, status: loadStatus, loadMore } = usePaginatedQuery(api.leads.list, { status: status === "all" ? undefined : status, search: dq || undefined, mine: mine || undefined }, { initialNumItems: 30 });
  const [logExport] = useAction(api.brokers.logExport);
  const [addOpen, setAddOpen] = useState(false);

  const exportCsv = async () => {
    const rows = await convex.query(api.leads.exportAll, {});
    downloadFile(`one-hub-leads-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    void logExport({ entity: "leads", count: rows.length });
  };

  return (
    <>
      <PageHeader eyebrow="Leads & forms" title="Leads" description="Every submission from every form lands here, shared with authorised colleagues in real time."
        actions={<>
          <Button variant="secondary" asChild><Link to="/forms"><ClipboardList /> Lead forms</Link></Button>
          {can("leads.write") && <Button variant="secondary" onClick={() => void exportCsv()}><Download /> Export</Button>}
          {can("leads.write") && <Button onClick={() => setAddOpen(true)}><Plus /> Add lead</Button>}
        </>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={status} onChange={setStatus} items={STATUSES.map((s) => ({ ...s, count: s.value === "all" ? undefined : counts?.[s.value] }))} />
        <div className="flex items-center gap-4 lg:ml-auto">
          {can("leads.write") && <Checkbox checked={mine} onChange={setMine} label="Assigned to me" />}
          <SearchInput className="flex-1 lg:w-72" value={search} onChange={setSearch} placeholder="Search leads…" />
        </div>
      </div>
      <Card className="overflow-hidden">
        {loadStatus === "LoadingFirstPage" ? <LoadingRows /> : results.length === 0 ? (
          <EmptyState icon={Inbox} title="No leads here yet" description="Publish a lead form and share its link — submissions appear instantly." action={can("forms.write") ? <Button asChild><Link to="/forms/new">Create lead form</Link></Button> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-zinc-100 text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase"><tr><th className="px-5 py-3">Lead</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Assigned</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Submitted</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {results.map((l) => (
                  <tr key={l._id} className="cursor-pointer hover:bg-zinc-50/60" onClick={() => navigate(`/leads/${l._id}`)}>
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={l.name} size="sm" /><div><div className="font-medium text-zinc-900">{l.name}</div><div className="text-xs text-zinc-500">{l.email ?? l.phone ?? "—"}</div></div></div></td>
                    <td className="px-5 py-3 text-zinc-600">{l.source}</td>
                    <td className="px-5 py-3 text-zinc-600">{l.assignedToName ?? <span className="text-zinc-400">Unassigned</span>}</td>
                    <td className="px-5 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3 text-zinc-500">{timeAgo(l.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {loadStatus === "CanLoadMore" && <div className="border-t border-zinc-100 p-3 text-center"><Button variant="ghost" onClick={() => loadMore(30)}>Load more</Button></div>}
      </Card>
      <AddLeadSheet open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function AddLeadSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", source: "Phone call", notes: "" });
  const [create, pending] = useAction(api.leads.createManual, { success: "Lead added" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add a lead manually" footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="lead-add" loading={pending}>Save lead</Button></>}>
      <form id="lead-add" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create({ ...f, email: f.email || undefined, phone: f.phone || undefined, company: f.company || undefined, notes: f.notes || undefined }).then((id) => { if (id) { onOpenChange(false); navigate(`/leads/${id}`); } }); }}>
        <Field label="Name" required><Input required value={f.name} onChange={set("name")} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input type="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Company"><Input value={f.company} onChange={set("company")} /></Field>
        <Field label="Source"><Input value={f.source} onChange={set("source")} /></Field>
        <Field label="Notes"><Input value={f.notes} onChange={set("notes")} /></Field>
      </form>
    </Sheet>
  );
}
