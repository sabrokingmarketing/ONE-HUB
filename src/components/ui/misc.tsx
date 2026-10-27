import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: string; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <Link to={back} aria-label="Back" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-zinc-500 shadow-soft transition hover:text-zinc-900">
            <ChevronLeft className="size-4" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-[22px]">{title}</h1>
          {description && <div className="mt-0.5 text-sm text-zinc-500">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-soft">
        <Icon className="size-5" />
      </div>
      <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-zinc-200/70", className)} />;
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/5" /></div>
        </div>
      ))}
    </div>
  );
}

const AVATAR_COLORS = ["bg-brand-100 text-brand-800", "bg-sky-100 text-sky-800", "bg-emerald-100 text-emerald-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800"];
export function Avatar({ name, src, size = "md", className }: { name?: string; src?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm", xl: "size-20 text-xl" }[size];
  const color = AVATAR_COLORS[[...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  if (src) return <img src={src} alt={name ?? ""} className={cn("shrink-0 rounded-full object-cover", s, className)} />;
  return <div className={cn("grid shrink-0 place-items-center rounded-full font-semibold", s, color, className)} aria-hidden>{initials(name)}</div>;
}

/**
 * KPI tile in the ONE HUB style: solid orange / charcoal or soft white, round icon badge,
 * big figure, label and an optional trend. Always fills its grid cell so a row of tiles
 * is perfectly even.
 */
export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", to, trend }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "neutral" | "brand" | "dark"; to?: string; trend?: string }) {
  const solid = tone !== "neutral";
  const body = (
    <div className={cn(
      "group flex h-full min-h-[148px] flex-col justify-between rounded-2xl p-5 transition-all",
      tone === "dark" ? "bg-ink text-white" : tone === "brand" ? "bg-brand-500 text-white" : "bg-white shadow-card",
      solid && "shadow-soft",
      to && "hover:-translate-y-0.5 hover:shadow-pop",
    )}>
      <div className="flex items-start justify-between">
        {Icon ? (
          <span className={cn("grid size-10 place-items-center rounded-full", solid ? "bg-white text-zinc-900" : "bg-brand-50 text-brand-600")}>
            <Icon className="size-[18px]" />
          </span>
        ) : <span />}
        <span className={cn("text-lg leading-none tracking-widest", solid ? "text-white/60" : "text-zinc-300")} aria-hidden>···</span>
      </div>
      <div>
        <div className="flex items-end justify-between gap-2">
          <div className="text-[28px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
          {trend && <span className={cn("text-xs font-semibold", solid ? "text-white" : "text-emerald-600")}>{trend}</span>}
        </div>
        <div className={cn("mt-1.5 truncate text-[13px] font-medium", solid ? "text-white/75" : "text-zinc-500")}>{label}</div>
        {hint && <div className={cn("mt-0.5 truncate text-xs", solid ? "text-white/60" : "text-zinc-400")}>{hint}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1", className)}>
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all", value === i.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
        >
          {i.label}
          {i.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", value === i.value ? "bg-brand-50 text-brand-700" : "bg-zinc-200/70 text-zinc-500")}>{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border-0 bg-white pr-3 pl-9 text-sm shadow-soft ring-1 ring-zinc-200/70 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-500/60 focus:outline-none"
      />
    </div>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-zinc-100">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-3 gap-4 py-3 text-sm">
          <dt className="text-zinc-500">{i.label}</dt>
          <dd className="col-span-2 break-words text-zinc-900">{i.value || <span className="text-zinc-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
