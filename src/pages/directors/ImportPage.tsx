import { useMemo, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { FileSpreadsheet, Upload, CheckCircle2, XCircle, Copy, RefreshCw, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn, errorMessage } from "@/lib/utils";

type Entity = "brokers" | "employees";
const FIELDS: Record<Entity, { key: string; label: string; required?: boolean; aliases: string[] }[]> = {
  brokers: [
    { key: "fullName", label: "Full name", required: true, aliases: ["name", "full name", "broker", "contact name"] },
    { key: "company", label: "Company", aliases: ["company", "agency", "firm", "organisation", "organization"] },
    { key: "position", label: "Position", aliases: ["position", "title", "job title", "role"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "email address"] },
    { key: "mobile", label: "Mobile", aliases: ["mobile", "cell", "cellphone", "mobile number", "phone"] },
    { key: "office", label: "Office number", aliases: ["office", "office number", "tel", "telephone", "landline"] },
    { key: "address", label: "Physical address", aliases: ["address", "physical address", "street"] },
    { key: "province", label: "Province", aliases: ["province"] },
    { key: "region", label: "Region", aliases: ["region", "area", "city"] },
    { key: "website", label: "Website", aliases: ["website", "url", "web"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
  ],
  employees: [
    { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "name", "given name"] },
    { key: "lastName", label: "Last name", required: true, aliases: ["last name", "lastname", "surname", "family name"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "work email"] },
    { key: "phone", label: "Telephone", aliases: ["phone", "telephone", "mobile", "cell"] },
    { key: "department", label: "Department", aliases: ["department", "dept", "team"] },
    { key: "jobTitle", label: "Job title", aliases: ["job title", "title", "position", "role"] },
    { key: "office", label: "Office", aliases: ["office", "location", "branch"] },
    { key: "manager", label: "Manager", aliases: ["manager", "reports to", "line manager"] },
    { key: "startDate", label: "Start date (YYYY-MM-DD)", aliases: ["start date", "start", "date joined"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
  ],
};

type Analysis = { row: number; status: "new" | "existing" | "duplicate_in_file" | "invalid"; message?: string; existingId?: string; existingVersion?: number }[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export default function ImportPage({ entity }: { entity: Entity }) {
  const convex = useConvex();
  const navigate = useNavigate();
  const commitBrokers = useMutation(api.brokers.commitImport);
  const commitEmployees = useMutation(api.employees.commitImport);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [updateExisting, setUpdateExisting] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const fields = FIELDS[entity];
  const label = entity === "brokers" ? "brokers" : "employees";

  const load = async (file: File) => {
    setAnalysis(null);
    setFileName(file.name);
    let data: string[][] = [];
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        const sheet = await readSheet(file);
        data = sheet.map((r) => r.map((c) => (c === null || c === undefined ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))));
      } else {
        const text = await file.text();
        data = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
      }
    } catch {
      toast.error("Couldn't read that file. Use CSV or .xlsx.");
      return;
    }
    if (data.length < 2) return toast.error("The file needs a header row and at least one data row.");
    const [h, ...body] = data;
    if (body.length > 500) toast.warning(`Only the first 500 of ${body.length} rows will be imported. Split larger files.`);
    setHeaders(h);
    setRows(body.slice(0, 500));
    const auto: Record<string, number> = {};
    for (const f of fields) {
      const idx = h.findIndex((col) => f.aliases.some((a) => norm(a) === norm(col)) || norm(col) === norm(f.key));
      if (idx >= 0 && !Object.values(auto).includes(idx)) auto[f.key] = idx;
    }
    setMapping(auto);
  };

  const mapped = useMemo(
    () =>
      rows.map((r) => {
        const o: Record<string, string | undefined> = {};
        for (const f of fields) {
          const i = mapping[f.key];
          const v = i !== undefined ? (r[i] ?? "").trim() : "";
          o[f.key] = f.required ? v : v || undefined;
        }
        return o;
      }),
    [rows, mapping, fields],
  );

  const missingRequired = fields.filter((f) => f.required && mapping[f.key] === undefined);

  const analyse = async () => {
    setBusy(true);
    try {
      const res = entity === "brokers"
        ? await convex.query(api.brokers.analyseImport, { rows: mapped as never })
        : await convex.query(api.employees.analyseImport, { rows: mapped as never });
      setAnalysis(res as Analysis);
      setUpdateExisting(new Set());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const counts = analysis && {
    new: analysis.filter((a) => a.status === "new").length,
    existing: analysis.filter((a) => a.status === "existing").length,
    dup: analysis.filter((a) => a.status === "duplicate_in_file").length,
    invalid: analysis.filter((a) => a.status === "invalid").length,
  };

  const commit = async () => {
    if (!analysis) return;
    setBusy(true);
    try {
      const items = analysis
        .filter((a) => a.status === "new" || (a.status === "existing" && updateExisting.has(a.row)))
        .map((a) => ({
          action: a.status === "new" ? ("create" as const) : ("update" as const),
          data: mapped[a.row],
          ...(a.status === "existing" ? { existingId: a.existingId, existingVersion: a.existingVersion } : {}),
        }));
      const r = entity === "brokers" ? await commitBrokers({ items: items as never }) : await commitEmployees({ items: items as never });
      toast.success(`Import complete: ${r.created} created, ${r.updated} updated`, { description: r.skipped.length ? `Skipped: ${r.skipped.slice(0, 5).join(", ")}${r.skipped.length > 5 ? "…" : ""}` : "All directors can see the new records now." });
      navigate(`/directors/${entity}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const toCreate = counts?.new ?? 0;
  const toUpdate = updateExisting.size;

  return (
    <>
      <PageHeader back={`/directors/${entity}`} eyebrow="Import" title={`Import ${label}`} description="CSV or Excel (.xlsx), up to 500 rows per file. Nothing is saved until you confirm." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="1. Choose a file" />
          <CardBody>
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 p-8 text-center transition hover:border-brand-300 hover:bg-brand-50/30">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><FileSpreadsheet className="size-5" /></span>
              <span className="text-sm font-medium">{fileName || "Click to choose a CSV or .xlsx file"}</span>
              {rows.length > 0 && <span className="text-xs text-zinc-500">{rows.length} rows · {headers.length} columns</span>}
              <input type="file" accept=".csv,.xlsx,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void load(e.target.files[0])} />
            </label>
          </CardBody>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader title="2. Map columns" description="We matched what we could. Check each field." />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-zinc-700">{f.label}{f.required && <span className="text-brand-600"> *</span>}</span>
                  <Select value={mapping[f.key] ?? ""} onChange={(e) => { setAnalysis(null); setMapping((m) => { const n = { ...m }; if (e.target.value === "") delete n[f.key]; else n[f.key] = Number(e.target.value); return n; }); }}>
                    <option value="">— Don't import —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </Select>
                </div>
              ))}
            </CardBody>
            <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-5 py-4">
              <p className="text-sm text-zinc-500">{missingRequired.length ? `Map required fields: ${missingRequired.map((f) => f.label).join(", ")}` : "Ready to validate."}</p>
              <Button disabled={missingRequired.length > 0} loading={busy && !analysis} onClick={() => void analyse()}>Validate rows <ArrowRight /></Button>
            </div>
          </Card>
        )}

        {analysis && counts && (
          <Card>
            <CardHeader title="3. Review" description="Existing matches are skipped unless you choose to update them. Existing records are never silently overwritten." />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="New records" value={counts.new} icon={Plus} />
                <StatCard label="Match existing" value={counts.existing} icon={RefreshCw} />
                <StatCard label="Duplicates in file" value={counts.dup} icon={Copy} />
                <StatCard label="Invalid rows" value={counts.invalid} icon={XCircle} />
              </div>
              <div className="max-h-[28rem] overflow-auto rounded-xl ring-1 ring-zinc-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-zinc-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Action</th></tr></thead>
                  <tbody className="divide-y divide-zinc-100">
                    {analysis.map((a) => {
                      const r = mapped[a.row];
                      const title = entity === "brokers" ? r.fullName : `${r.firstName ?? ""} ${r.lastName ?? ""}`;
                      return (
                        <tr key={a.row} className={cn(a.status === "invalid" && "bg-red-50/40")}>
                          <td className="px-3 py-2 text-zinc-400 tabular-nums">{a.row + 2}</td>
                          <td className="px-3 py-2"><div className="font-medium">{title || "—"}</div><div className="text-xs text-zinc-500">{r.email}</div></td>
                          <td className="px-3 py-2">
                            {a.status === "new" && <Badge tone="green"><CheckCircle2 className="size-3" /> New</Badge>}
                            {a.status === "existing" && <Badge tone="blue">Existing</Badge>}
                            {a.status === "duplicate_in_file" && <Badge tone="amber">Duplicate</Badge>}
                            {a.status === "invalid" && <Badge tone="red">Invalid</Badge>}
                            {a.message && <div className="mt-1 text-xs text-zinc-500">{a.message}</div>}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {a.status === "new" ? "Create" : a.status === "existing" ? (
                              <label className="inline-flex items-center gap-2"><input type="checkbox" className="accent-brand-500" checked={updateExisting.has(a.row)} onChange={(e) => setUpdateExisting((s) => { const n = new Set(s); if (e.target.checked) n.add(a.row); else n.delete(a.row); return n; })} /> Update existing</label>
                            ) : "Skip"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 px-5 py-4">
              <p className="text-sm text-zinc-600"><strong>{toCreate}</strong> to create · <strong>{toUpdate}</strong> to update · {analysis.length - toCreate - toUpdate} skipped</p>
              <Button disabled={toCreate + toUpdate === 0} onClick={() => setConfirm(true)}><Upload /> Import {toCreate + toUpdate} {label}</Button>
            </div>
          </Card>
        )}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={`Import ${toCreate + toUpdate} ${label}?`} confirmLabel="Confirm import" loading={busy} onConfirm={() => void commit()}
        description={<>This will create <strong>{toCreate}</strong> and update <strong>{toUpdate}</strong> records. They become visible to every authorised director immediately, and the import is recorded in the audit log.</>} />
    </>
  );
}

