import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border-0 bg-white px-3.5 text-sm text-zinc-900 ring-1 ring-zinc-200 placeholder:text-zinc-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500/60 disabled:bg-zinc-50 disabled:text-zinc-500 aria-[invalid=true]:ring-red-400";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, "h-10", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-24 py-2.5 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select
    ref={ref}
    className={cn(
      base,
      "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2378716c%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
      className,
    )}
    {...p}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-zinc-700", className)} {...p} />;
}

export function Field({ label, hint, error, children, className, required }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  const id = React.useId();
  const child = React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string; "aria-invalid"?: boolean }>, { id, "aria-invalid": !!error || undefined }) : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </Label>
      {child}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-50", checked ? "bg-brand-500" : "bg-zinc-300")}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-zinc-300 accent-brand-500" />
      {label}
    </label>
  );
}
