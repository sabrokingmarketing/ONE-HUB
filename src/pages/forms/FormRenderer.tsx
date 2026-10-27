import type { Doc } from "../../../convex/_generated/dataModel";
import { Input, Select, Textarea } from "@/components/ui/input";

export type FormField = Doc<"leadForms">["fields"][number];
export type Answers = Record<string, string | string[] | boolean>;

const INPUT_TYPE: Partial<Record<FormField["type"], string>> = { email: "email", phone: "tel", date: "date" };
const AUTOCOMPLETE: Partial<Record<FormField["type"], string>> = { first_name: "given-name", last_name: "family-name", email: "email", phone: "tel", company: "organization", address: "street-address" };

/** Renders the fields of a lead form. Used by both the builder preview and the public page. */
export function FormRenderer({ fields, answers, onChange, accent = "#F26B1D", disabled }: { fields: FormField[]; answers: Answers; onChange: (a: Answers) => void; accent?: string; disabled?: boolean }) {
  const set = (id: string, v: string | string[] | boolean) => onChange({ ...answers, [id]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const half = ["first_name", "last_name", "email", "phone"].includes(f.type);
        const id = `f-${f.id}`;
        const label = <label htmlFor={id} className="text-[13px] font-medium text-zinc-700">{f.label}{f.required && <span style={{ color: accent }}> *</span>}</label>;
        let control: React.ReactNode;
        switch (f.type) {
          case "textarea":
            control = <Textarea id={id} required={f.required} disabled={disabled} placeholder={f.placeholder} value={(answers[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} maxLength={2000} />;
            break;
          case "dropdown":
            control = <Select id={id} required={f.required} disabled={disabled} value={(answers[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)}><option value="">Select…</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</Select>;
            break;
          case "multiple_choice":
            control = <div className="space-y-2" role="radiogroup" aria-label={f.label}>{f.options?.map((o) => (
              <label key={o} className="flex items-center gap-2.5 text-sm"><input type="radio" name={id} required={f.required} disabled={disabled} checked={answers[f.id] === o} onChange={() => set(f.id, o)} style={{ accentColor: accent }} />{o}</label>
            ))}</div>;
            break;
          case "checkboxes": {
            const cur = (answers[f.id] as string[]) ?? [];
            control = <div className="space-y-2">{f.options?.map((o) => (
              <label key={o} className="flex items-center gap-2.5 text-sm"><input type="checkbox" disabled={disabled} checked={cur.includes(o)} onChange={(e) => set(f.id, e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} style={{ accentColor: accent }} />{o}</label>
            ))}</div>;
            break;
          }
          case "consent":
            return (
              <label key={f.id} className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 sm:col-span-2">
                <input type="checkbox" className="mt-0.5" required={f.required} disabled={disabled} checked={answers[f.id] === true} onChange={(e) => set(f.id, e.target.checked)} style={{ accentColor: accent }} />
                <span>{f.label}{f.required && <span style={{ color: accent }}> *</span>}</span>
              </label>
            );
          default:
            control = <Input id={id} type={INPUT_TYPE[f.type] ?? "text"} autoComplete={AUTOCOMPLETE[f.type]} required={f.required} disabled={disabled} placeholder={f.placeholder} value={(answers[f.id] as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} maxLength={500} />;
        }
        return <div key={f.id} className={`flex flex-col gap-1.5 ${half ? "" : "sm:col-span-2"}`}>{label}{control}</div>;
      })}
    </div>
  );
}
