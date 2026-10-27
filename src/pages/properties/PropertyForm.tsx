import type { Doc } from "../../../convex/_generated/dataModel";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PROVINCES } from "../directors/BrokerForm";

export const PROPERTY_TYPES = { shopping_centre: "Shopping centre", office: "Office", industrial: "Industrial", residential: "Residential", mixed_use: "Mixed use", land: "Land", other: "Other" } as const;
export type PropertyDraft = { name: string; type: Doc<"properties">["type"]; location: string; province: string; description: string; gla: string; contacts: string; notes: string };
export const emptyProperty: PropertyDraft = { name: "", type: "shopping_centre", location: "", province: "", description: "", gla: "", contacts: "", notes: "" };
export const propertyToDraft = (p: Doc<"properties">): PropertyDraft => ({ name: p.name, type: p.type, location: p.location, province: p.province ?? "", description: p.description ?? "", gla: p.gla?.toString() ?? "", contacts: p.contacts ?? "", notes: p.notes ?? "" });
export const propertyDraftToInput = (d: PropertyDraft) => ({ name: d.name, type: d.type, location: d.location, province: d.province || undefined, description: d.description || undefined, gla: d.gla ? Number(d.gla) : undefined, contacts: d.contacts || undefined, notes: d.notes || undefined });

export function PropertyForm({ value, onChange, onSubmit, id = "property-form" }: { value: PropertyDraft; onChange: (d: PropertyDraft) => void; onSubmit: () => void; id?: string }) {
  const set = <K extends keyof PropertyDraft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <form id={id} className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Field label="Property name" required className="sm:col-span-2"><Input required value={value.name} onChange={set("name")} /></Field>
      <Field label="Type"><Select value={value.type} onChange={set("type")}>{Object.entries(PROPERTY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="GLA (m²)"><Input type="number" min={0} value={value.gla} onChange={set("gla")} /></Field>
      <Field label="Location / address" required><Input required value={value.location} onChange={set("location")} /></Field>
      <Field label="Province"><Select value={value.province} onChange={set("province")}><option value="">—</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
      <Field label="Description" className="sm:col-span-2"><Textarea value={value.description} onChange={set("description")} /></Field>
      <Field label="Relevant contacts" className="sm:col-span-2" hint="Centre manager, leasing contact, etc."><Textarea className="min-h-16" value={value.contacts} onChange={set("contacts")} /></Field>
      <Field label="Internal notes" className="sm:col-span-2"><Textarea className="min-h-16" value={value.notes} onChange={set("notes")} /></Field>
    </form>
  );
}
