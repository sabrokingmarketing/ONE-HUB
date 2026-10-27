import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Plus, Trash2, Share2, Save, ClipboardList, GripVertical } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Skeleton, EmptyState, Tabs } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Switch, Checkbox } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { ChangedBanner } from "@/components/ChangedBanner";
import { useAction } from "@/lib/hooks";
import { useCan, useMe } from "@/lib/session";
import { FormRenderer, type Answers, type FormField } from "./FormRenderer";
import { ShareFormDialog } from "./ShareForm";

const FIELD_TYPES: { type: FormField["type"]; label: string }[] = [
  { type: "first_name", label: "First name" }, { type: "last_name", label: "Last name" }, { type: "email", label: "Email" }, { type: "phone", label: "Phone" },
  { type: "company", label: "Company" }, { type: "address", label: "Address" }, { type: "text", label: "Short text" }, { type: "textarea", label: "Long text" },
  { type: "dropdown", label: "Dropdown" }, { type: "multiple_choice", label: "Multiple choice" }, { type: "checkboxes", label: "Checkboxes" }, { type: "date", label: "Date" },
  { type: "consent", label: "Consent checkbox" },
];
const hasOptions = (t: FormField["type"]) => t === "dropdown" || t === "multiple_choice" || t === "checkboxes";
const newId = () => Math.random().toString(36).slice(2, 9);

type Draft = {
  title: string; description: string; fields: FormField[]; thankYouMessage: string; successUrl: string; notifyUserIds: Id<"users">[];
  status: "draft" | "active" | "inactive"; propertyId: string; accentColor: string; shareWithMarketing: boolean;
};

const DEFAULT: Draft = {
  title: "", description: "", thankYouMessage: "Thank you — a member of our team will be in touch shortly.", successUrl: "", notifyUserIds: [], status: "draft", propertyId: "", accentColor: "#F26B1D", shareWithMarketing: false,
  fields: [
    { id: newId(), type: "first_name", label: "First name", required: true },
    { id: newId(), type: "last_name", label: "Last name", required: true },
    { id: newId(), type: "email", label: "Email", required: true },
    { id: newId(), type: "phone", label: "Phone", required: false },
    { id: newId(), type: "consent", label: "I agree that ONE Property Holdings may contact me about this enquiry and process my information in line with POPIA.", required: true },
  ],
};

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useCan();
  const me = useMe();
  const existing = useQuery(api.leadForms.get, id ? { id: id as Id<"leadForms"> } : "skip");
  const properties = useQuery(api.properties.options);
  const colleagues = useQuery(api.users.colleagues);
  const [draft, setDraft] = useState<Draft | null>(id ? null : { ...DEFAULT, shareWithMarketing: me.role === "marketing" });
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<"build" | "settings">("build");
  const [preview, setPreview] = useState<Answers>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [create, creating] = useAction(api.leadForms.create, { success: "Form created" });
  const [update, updating] = useAction(api.leadForms.update, { success: "Form saved" });
  const readOnly = !can("forms.write");

  useEffect(() => {
    if (existing && !draft) {
      setDraft({
        title: existing.title, description: existing.description ?? "", fields: existing.fields, thankYouMessage: existing.thankYouMessage, successUrl: existing.successUrl ?? "",
        notifyUserIds: existing.notifyUserIds, status: existing.status, propertyId: existing.propertyId ?? "", accentColor: existing.accentColor ?? "#F26B1D", shareWithMarketing: existing.shareWithMarketing,
      });
      setVersion(existing.version);
    }
  }, [existing, draft]);

  if (id && existing === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (id && existing === null) return <EmptyState icon={ClipboardList} title="Form not found" />;
  if (!draft) return <Skeleton className="h-96 rounded-2xl" />;

  const setField = (i: number, patch: Partial<FormField>) => setDraft({ ...draft, fields: draft.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const move = (i: number, d: -1 | 1) => {
    const f = [...draft.fields];
    const j = i + d;
    if (j < 0 || j >= f.length) return;
    [f[i], f[j]] = [f[j], f[i]];
    setDraft({ ...draft, fields: f });
  };
  const add = (type: FormField["type"]) => {
    const label = FIELD_TYPES.find((t) => t.type === type)!.label;
    setDraft({ ...draft, fields: [...draft.fields, { id: newId(), type, label, required: false, ...(hasOptions(type) ? { options: ["Option 1", "Option 2"] } : {}) }] });
  };

  const payload = () => ({
    title: draft.title, description: draft.description || undefined, fields: draft.fields.map((f) => ({ ...f, options: hasOptions(f.type) ? f.options?.map((o) => o.trim()).filter(Boolean) : undefined })),
    thankYouMessage: draft.thankYouMessage, successUrl: draft.successUrl || undefined, notifyUserIds: draft.notifyUserIds, status: draft.status,
    propertyId: (draft.propertyId || undefined) as Id<"properties"> | undefined, accentColor: draft.accentColor, shareWithMarketing: draft.shareWithMarketing,
  });
  const save = async () => {
    if (id) {
      const r = await update({ id: id as Id<"leadForms">, expectedVersion: version, data: payload() });
      if (r !== undefined) setVersion(version + 1);
    } else {
      const newIdRes = await create({ data: payload() });
      if (newIdRes) navigate(`/forms/${newIdRes}`, { replace: true });
    }
  };

  return (
    <>
      <PageHeader back="/forms" eyebrow="Lead form builder" title={draft.title || "Untitled form"}
        actions={<>
          {existing && <Button variant="secondary" onClick={() => setShareOpen(true)}><Share2 /> Share</Button>}
          {!readOnly && <Button onClick={() => void save()} loading={creating || updating}><Save /> {id ? "Save changes" : "Create form"}</Button>}
        </>} />
      {existing && existing.version !== version && <ChangedBanner by="A colleague" onReload={() => { setDraft(null); }} />}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Tabs value={tab} onChange={setTab} items={[{ value: "build", label: "Fields" }, { value: "settings", label: "Settings & notifications" }]} className="w-fit" />
          {tab === "build" ? (
            <Card>
              <CardBody className="space-y-4">
                <Field label="Form title" required><Input disabled={readOnly} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Southdale leasing enquiry" /></Field>
                <Field label="Description"><Textarea disabled={readOnly} className="min-h-16" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
                <div className="space-y-2">
                  {draft.fields.map((f, i) => (
                    <div key={f.id} className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200/70">
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-4 shrink-0 text-stone-300" />
                        <Input disabled={readOnly} className="h-9 flex-1" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} aria-label="Field label" />
                        <span className="hidden shrink-0 rounded-md bg-white px-2 py-1 text-[11px] text-stone-500 ring-1 ring-stone-200 sm:inline">{FIELD_TYPES.find((t) => t.type === f.type)?.label}</span>
                      </div>
                      {!readOnly && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 pl-6">
                          <Checkbox checked={f.required} onChange={(v) => setField(i, { required: v })} label={<span className="text-xs">Required</span>} />
                          <div className="ml-auto flex gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
                            <Button size="icon-sm" variant="danger-ghost" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, j) => j !== i) })} aria-label="Remove field"><Trash2 /></Button>
                          </div>
                        </div>
                      )}
                      {hasOptions(f.type) && (
                        <Textarea disabled={readOnly} className="mt-2 ml-6 min-h-16 w-[calc(100%-1.5rem)] text-xs" value={(f.options ?? []).join("\n")} onChange={(e) => setField(i, { options: e.target.value.split("\n") })} placeholder="One option per line" aria-label="Options" />
                      )}
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <Menu>
                    <MenuTrigger asChild><Button variant="secondary" className="w-full"><Plus /> Add field</Button></MenuTrigger>
                    <MenuContent align="center" className="grid w-72 grid-cols-2">{FIELD_TYPES.map((t) => <MenuItem key={t.type} onSelect={() => add(t.type)}>{t.label}</MenuItem>)}</MenuContent>
                  </Menu>
                )}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status"><Select disabled={readOnly} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}><option value="draft">Draft</option><option value="active">Active — accepting submissions</option><option value="inactive">Inactive</option></Select></Field>
                  <Field label="Property"><Select disabled={readOnly} value={draft.propertyId} onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })}><option value="">Portfolio-wide</option>{properties?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
                  <Field label="Accent colour"><div className="flex gap-2"><input disabled={readOnly} type="color" value={draft.accentColor} onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })} className="h-10 w-12 rounded-lg ring-1 ring-stone-200" /><Input disabled={readOnly} value={draft.accentColor} onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })} /></div></Field>
                  <Field label="Success page (optional)" hint="Redirect here after submission."><Input disabled={readOnly} value={draft.successUrl} onChange={(e) => setDraft({ ...draft, successUrl: e.target.value })} placeholder="https://" /></Field>
                </div>
                <Field label="Thank-you message"><Textarea disabled={readOnly} className="min-h-16" value={draft.thankYouMessage} onChange={(e) => setDraft({ ...draft, thankYouMessage: e.target.value })} /></Field>
                <div>
                  <div className="mb-1.5 text-[13px] font-medium text-stone-700">Email notifications</div>
                  <p className="mb-2 text-xs text-stone-500">Selected colleagues get an email per submission. Everyone with lead access gets an in-app notification if nobody is selected.</p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl bg-stone-50 p-2">
                    {colleagues?.filter((c) => c.role !== "marketing" || draft.shareWithMarketing).map((c) => (
                      <Checkbox key={c._id} className="w-full rounded-lg px-2 py-1.5" checked={draft.notifyUserIds.includes(c._id)} onChange={(v) => setDraft({ ...draft, notifyUserIds: v ? [...draft.notifyUserIds, c._id] : draft.notifyUserIds.filter((x) => x !== c._id) })} label={c.name} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 p-3">
                  <div className="text-sm"><div className="font-medium">Share leads with marketing</div><div className="text-xs text-stone-500">{me.role === "marketing" ? "Always on for forms created by marketing." : "Marketing users will see submissions from this form."}</div></div>
                  <Switch disabled={readOnly || me.role === "marketing"} checked={draft.shareWithMarketing} onChange={(v) => setDraft({ ...draft, shareWithMarketing: v })} label="Share with marketing" />
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className="mb-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">Live preview</div>
          <Card className="overflow-hidden">
            <div className="h-1.5" style={{ background: draft.accentColor }} />
            <CardHeader title={draft.title || "Untitled form"} description={draft.description} />
            <CardBody>
              <FormRenderer fields={draft.fields} answers={preview} onChange={setPreview} accent={draft.accentColor} />
              <button type="button" className="mt-5 h-11 w-full rounded-xl text-sm font-semibold text-white" style={{ background: draft.accentColor }}>Submit</button>
            </CardBody>
          </Card>
        </div>
      </div>
      {existing && <ShareFormDialog open={shareOpen} onOpenChange={setShareOpen} slug={existing.slug} title={existing.title} active={existing.status === "active"} />}
    </>
  );
}
