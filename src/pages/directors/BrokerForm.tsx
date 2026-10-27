import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useDebounced } from "@/lib/hooks";

export const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

export type BrokerDraft = {
  fullName: string; company: string; position: string; email: string; mobile: string; office: string; address: string; province: string; region: string; website: string;
  propertyId: string; contactStatus: "active" | "prospect" | "inactive"; notes: string; assignedTo: string;
};

export const emptyBroker: BrokerDraft = { fullName: "", company: "", position: "", email: "", mobile: "", office: "", address: "", province: "", region: "", website: "", propertyId: "", contactStatus: "active", notes: "", assignedTo: "" };

export function brokerToDraft(b: Doc<"brokers">): BrokerDraft {
  return {
    fullName: b.fullName, company: b.company ?? "", position: b.position ?? "", email: b.email ?? "", mobile: b.mobile ?? "", office: b.office ?? "", address: b.address ?? "",
    province: b.province ?? "", region: b.region ?? "", website: b.website ?? "", propertyId: b.propertyId ?? "", contactStatus: b.contactStatus, notes: b.notes ?? "", assignedTo: b.assignedTo ?? "",
  };
}

export function draftToInput(d: BrokerDraft) {
  const o = (s: string) => s.trim() || undefined;
  return {
    fullName: d.fullName, company: o(d.company), position: o(d.position), email: o(d.email), mobile: o(d.mobile), office: o(d.office), address: o(d.address),
    province: o(d.province), region: o(d.region), website: o(d.website), propertyId: (d.propertyId || undefined) as Id<"properties"> | undefined,
    contactStatus: d.contactStatus, notes: o(d.notes), assignedTo: (d.assignedTo || undefined) as Id<"users"> | undefined,
  };
}

export function BrokerForm({ value, onChange, excludeId, id = "broker-form", onSubmit }: { value: BrokerDraft; onChange: (d: BrokerDraft) => void; excludeId?: Id<"brokers">; id?: string; onSubmit: () => void }) {
  const properties = useQuery(api.properties.options);
  const colleagues = useQuery(api.users.colleagues);
  const set = <K extends keyof BrokerDraft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  const dEmail = useDebounced(value.email, 400);
  const dMobile = useDebounced(value.mobile, 400);
  const dups = useQuery(api.brokers.checkDuplicates, dEmail || dMobile ? { email: dEmail || undefined, mobile: dMobile || undefined, excludeId } : "skip");
  const [touched, setTouched] = useState(false);
  useEffect(() => setTouched(true), [dEmail, dMobile]);

  return (
    <form id={id} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-5">
      {touched && dups && dups.length > 0 && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>Possible duplicate: {dups.map((d, i) => <span key={d._id}>{i > 0 && ", "}<Link className="font-medium underline" to={`/directors/brokers/${d._id}`}>{d.fullName}</Link>{d.archived && " (archived)"}</span>)}</div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2"><Input required value={value.fullName} onChange={set("fullName")} /></Field>
        <Field label="Company"><Input value={value.company} onChange={set("company")} /></Field>
        <Field label="Position"><Input value={value.position} onChange={set("position")} /></Field>
        <Field label="Email"><Input type="email" value={value.email} onChange={set("email")} /></Field>
        <Field label="Mobile"><Input type="tel" value={value.mobile} onChange={set("mobile")} placeholder="082 000 0000" /></Field>
        <Field label="Office number"><Input type="tel" value={value.office} onChange={set("office")} /></Field>
        <Field label="Website"><Input value={value.website} onChange={set("website")} placeholder="https://" /></Field>
        <Field label="Physical address" className="sm:col-span-2"><Input value={value.address} onChange={set("address")} /></Field>
        <Field label="Province"><Select value={value.province} onChange={set("province")}><option value="">—</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <Field label="Region"><Input value={value.region} onChange={set("region")} placeholder="e.g. Johannesburg South" /></Field>
        <Field label="Associated property"><Select value={value.propertyId} onChange={set("propertyId")}><option value="">—</option>{properties?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
        <Field label="Contact status"><Select value={value.contactStatus} onChange={set("contactStatus")}><option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option></Select></Field>
        <Field label="Internal contact" className="sm:col-span-2"><Select value={value.assignedTo} onChange={set("assignedTo")}><option value="">Unassigned</option>{colleagues?.filter((c) => c.role !== "marketing").map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
        <Field label="Internal notes" hint="Never included when sharing contact details." className="sm:col-span-2"><Textarea value={value.notes} onChange={set("notes")} /></Field>
      </div>
    </form>
  );
}
