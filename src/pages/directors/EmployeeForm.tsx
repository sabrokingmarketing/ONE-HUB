import type { Doc } from "../../../convex/_generated/dataModel";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export type EmployeeDraft = { firstName: string; lastName: string; email: string; phone: string; department: string; jobTitle: string; office: string; manager: string; employmentStatus: "active" | "on_leave" | "terminated"; startDate: string; notes: string };
export const emptyEmployee: EmployeeDraft = { firstName: "", lastName: "", email: "", phone: "", department: "", jobTitle: "", office: "", manager: "", employmentStatus: "active", startDate: "", notes: "" };

export const employeeToDraft = (e: Doc<"employees">): EmployeeDraft => ({
  firstName: e.firstName, lastName: e.lastName, email: e.email ?? "", phone: e.phone ?? "", department: e.department ?? "", jobTitle: e.jobTitle ?? "",
  office: e.office ?? "", manager: e.manager ?? "", employmentStatus: e.employmentStatus, startDate: e.startDate ?? "", notes: e.notes ?? "",
});
export const employeeDraftToInput = (d: EmployeeDraft) => {
  const o = (s: string) => s.trim() || undefined;
  return { firstName: d.firstName, lastName: d.lastName, email: o(d.email), phone: o(d.phone), department: o(d.department), jobTitle: o(d.jobTitle), office: o(d.office), manager: o(d.manager), employmentStatus: d.employmentStatus, startDate: o(d.startDate), notes: o(d.notes) };
};

export function EmployeeForm({ value, onChange, onSubmit, id = "employee-form", departments }: { value: EmployeeDraft; onChange: (d: EmployeeDraft) => void; onSubmit: () => void; id?: string; departments?: string[] }) {
  const set = <K extends keyof EmployeeDraft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <form id={id} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="grid gap-4 sm:grid-cols-2">
      <Field label="First name" required><Input required value={value.firstName} onChange={set("firstName")} /></Field>
      <Field label="Last name" required><Input required value={value.lastName} onChange={set("lastName")} /></Field>
      <Field label="Email"><Input type="email" value={value.email} onChange={set("email")} /></Field>
      <Field label="Telephone"><Input type="tel" value={value.phone} onChange={set("phone")} /></Field>
      <Field label="Department"><Input list="departments" value={value.department} onChange={set("department")} /><datalist id="departments">{departments?.map((d) => <option key={d} value={d} />)}</datalist></Field>
      <Field label="Job title"><Input value={value.jobTitle} onChange={set("jobTitle")} /></Field>
      <Field label="Office"><Input value={value.office} onChange={set("office")} /></Field>
      <Field label="Manager"><Input value={value.manager} onChange={set("manager")} /></Field>
      <Field label="Employment status"><Select value={value.employmentStatus} onChange={set("employmentStatus")}><option value="active">Active</option><option value="on_leave">On leave</option><option value="terminated">Terminated</option></Select></Field>
      <Field label="Start date"><Input type="date" value={value.startDate} onChange={set("startDate")} /></Field>
      <Field label="Notes" className="sm:col-span-2"><Textarea value={value.notes} onChange={set("notes")} /></Field>
    </form>
  );
}
