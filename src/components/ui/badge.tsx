import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-stone-100 text-stone-700",
  brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-200/60",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  dark: "bg-ink text-white",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  active: "green", connected: "green", published: "green", converted: "green", sent: "green", completed: "green", accepted: "green", approved: "green", verified: "green", operational: "green",
  new: "brand", scheduled: "blue", qualified: "blue", planning: "blue", pending: "amber", pending_approval: "amber", follow_up: "amber",
  contacted: "violet", in_production: "violet", under_review: "amber", publishing: "blue", queued: "blue", logged: "neutral",
  draft: "neutral", inactive: "neutral", closed: "neutral", cancelled: "neutral", archived: "neutral", paused: "amber", prospect: "blue",
  failed: "red", suspended: "red", expired: "red", error: "red", partial: "amber", on_leave: "amber", terminated: "red", disconnected: "neutral",
  not_configured: "neutral", configured_unverified: "amber",
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot>
      {label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
    </Badge>
  );
}
