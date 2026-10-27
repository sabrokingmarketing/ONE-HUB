import { useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type CampaignDraft = Omit<Doc<"marketingCampaigns">, "_id" | "_creationTime" | "createdBy" | "updatedBy" | "updatedAt" | "version" | "archivedAt"> & { propertyId?: Id<"properties">; ownerId?: Id<"users"> };
export const emptyCampaign: CampaignDraft = { name: "", status: "planning", platforms: [], tasks: [] };
export const campaignToDraft = (c: Doc<"marketingCampaigns">): CampaignDraft => ({ name: c.name, description: c.description, propertyId: c.propertyId, startDate: c.startDate, endDate: c.endDate, ownerId: c.ownerId, status: c.status, objectives: c.objectives, platforms: c.platforms, notes: c.notes, tasks: c.tasks });
const PLATFORMS = ["Facebook", "Instagram", "LinkedIn", "Email", "Print", "On-site"];

export function CampaignForm({ value, onChange, onSubmit, id = "campaign-form" }: { value: CampaignDraft; onChange: (d: CampaignDraft) => void; onSubmit: () => void; id?: string }) {
  const properties = useQuery(api.properties.options);
  const colleagues = useQuery(api.users.colleagues);
  const s = (k: keyof CampaignDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value || undefined });
  return (
    <form id={id} className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Field label="Campaign name" required><Input required value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status"><Select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as CampaignDraft["status"] })}>{["planning", "active", "paused", "completed", "archived"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</Select></Field>
        <Field label="Property"><Select value={value.propertyId ?? ""} onChange={s("propertyId")}><option value="">Portfolio-wide</option>{properties?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
        <Field label="Start date"><Input type="date" value={value.startDate ?? ""} onChange={s("startDate")} /></Field>
        <Field label="End date"><Input type="date" value={value.endDate ?? ""} onChange={s("endDate")} /></Field>
        <Field label="Owner" className="sm:col-span-2"><Select value={value.ownerId ?? ""} onChange={s("ownerId")}><option value="">Me</option>{colleagues?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
      </div>
      <Field label="Description"><Textarea className="min-h-16" value={value.description ?? ""} onChange={s("description")} /></Field>
      <Field label="Objectives"><Textarea className="min-h-16" value={value.objectives ?? ""} onChange={s("objectives")} placeholder="e.g. Increase footfall at Southdale by 10% over the school holidays" /></Field>
      <div><div className="mb-1.5 text-[13px] font-medium text-stone-700">Target platforms</div><div className="flex flex-wrap gap-4">{PLATFORMS.map((p) => <Checkbox key={p} checked={value.platforms.includes(p)} onChange={(v) => onChange({ ...value, platforms: v ? [...value.platforms, p] : value.platforms.filter((x) => x !== p) })} label={p} />)}</div></div>
      <div>
        <div className="mb-1.5 text-[13px] font-medium text-stone-700">Tasks</div>
        <div className="space-y-2">
          {value.tasks.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand-500" checked={t.done} onChange={(e) => onChange({ ...value, tasks: value.tasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} aria-label="Done" />
              <Input className="h-9" value={t.title} onChange={(e) => onChange({ ...value, tasks: value.tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <Button type="button" size="icon-sm" variant="danger-ghost" onClick={() => onChange({ ...value, tasks: value.tasks.filter((_, j) => j !== i) })} aria-label="Remove task"><Trash2 /></Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, tasks: [...value.tasks, { id: Math.random().toString(36).slice(2, 9), title: "", done: false }] })}><Plus /> Add task</Button>
        </div>
      </div>
      <Field label="Notes"><Textarea className="min-h-16" value={value.notes ?? ""} onChange={s("notes")} /></Field>
    </form>
  );
}
