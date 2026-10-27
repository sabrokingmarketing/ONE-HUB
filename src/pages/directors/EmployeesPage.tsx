import { useEffect, useState } from "react";
import { usePaginatedQuery, useQuery, useConvex } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Users, Plus, Upload, Download, Send } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, SearchInput, Tabs, EmptyState, LoadingRows, Avatar } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { useAction, useDebounced } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { downloadFile, timeAgo } from "@/lib/utils";
import { toCsv } from "@/lib/share";
import { EmployeeForm, emptyEmployee, employeeDraftToInput, type EmployeeDraft } from "./EmployeeForm";

export default function EmployeesPage() {
  const can = useCan();
  const navigate = useNavigate();
  const convex = useConvex();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [department, setDepartment] = useState("");
  const dq = useDebounced(search);
  const departments = useQuery(api.employees.departments);
  const { results, status, loadMore } = usePaginatedQuery(api.employees.list, { search: dq || undefined, department: department || undefined, archived: tab === "archived" }, { initialNumItems: 30 });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyEmployee);
  const [create, creating] = useAction(api.employees.create, { success: "Employee added — visible to all directors" });
  const [logExport] = useAction(api.brokers.logExport);
  useEffect(() => { if (params.get("new") === "1") { setOpen(true); params.delete("new"); setParams(params, { replace: true }); } }, [params, setParams]);

  const save = async () => {
    const id = await create({ data: employeeDraftToInput(draft) });
    if (id) { setOpen(false); setDraft(emptyEmployee); navigate(`/directors/employees/${id}`); }
  };
  const exportCsv = async () => {
    const rows = await convex.query(api.employees.exportAll, {});
    downloadFile(`one-hub-employees-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    void logExport({ entity: "employees", count: rows.length });
  };

  return (
    <>
      <PageHeader eyebrow="Directors" title="Employee directory" description="Shared across all directors and updated in real time."
        actions={<>
          {can("announcements.send") && <Button variant="dark" asChild><Link to="/directors/employees/announcements"><Send /> Send employee update</Link></Button>}
          {can("employees.write") && <>
            <Button variant="secondary" onClick={() => void exportCsv()}><Download /> Export</Button>
            <Button variant="secondary" asChild><Link to="/directors/employees/import"><Upload /> Import</Link></Button>
            <Button onClick={() => setOpen(true)}><Plus /> Add employee</Button>
          </>}
        </>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={tab} onChange={setTab} items={[{ value: "active", label: "All employees" }, { value: "archived", label: "Archived" }]} />
        <Select className="sm:ml-auto sm:w-56" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Filter by department"><option value="">All departments</option>{departments?.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.count})</option>)}</Select>
        <SearchInput className="sm:w-72" value={search} onChange={setSearch} placeholder="Search name, email, department…" />
      </div>
      <Card className="overflow-hidden">
        {status === "LoadingFirstPage" ? <LoadingRows /> : results.length === 0 ? (
          <EmptyState icon={Users} title={dq ? "No employees match" : "No employees yet"} description={!dq ? "Add employees one by one or import a spreadsheet." : undefined} action={!dq && can("employees.write") ? <Button onClick={() => setOpen(true)}><Plus /> Add employee</Button> : undefined} />
        ) : (
          <ul className="grid divide-y divide-zinc-100 md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
            {results.map((e) => (
              <li key={e._id} className="md:border-b md:border-zinc-100">
                <Link to={`/directors/employees/${e._id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-50/60">
                  <Avatar name={`${e.firstName} ${e.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-zinc-900">{e.firstName} {e.lastName}</div>
                    <div className="truncate text-xs text-zinc-500">{[e.jobTitle, e.department].filter(Boolean).join(" · ") || e.email || "—"}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">Updated {timeAgo(e.updatedAt)}</div>
                  </div>
                  {e.employmentStatus !== "active" && <StatusBadge status={e.employmentStatus} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {status === "CanLoadMore" && <div className="border-t border-zinc-100 p-3 text-center"><Button variant="ghost" onClick={() => loadMore(30)}>Load more</Button></div>}
      </Card>
      <Sheet open={open} onOpenChange={setOpen} title="Add employee" wide footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="employee-form" loading={creating}>Save employee</Button></>}>
        <EmployeeForm value={draft} onChange={setDraft} onSubmit={() => void save()} departments={departments?.map((d) => d.name)} />
      </Sheet>
    </>
  );
}
