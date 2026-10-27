import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";

/**
 * Free-tier reference limits. These are the values documented in
 * docs/FREE_TIER.md at the time of writing — VERIFY against each provider's
 * current pricing page before relying on them; they change.
 */
const LIMITS = { convexStorageBytes: 1024 ** 3, resendPerDay: 100, resendPerMonth: 3000 };

function Meter({ label, used, limit, format = (n: number) => n.toLocaleString() }: { label: string; used: number; limit: number; format?: (n: number) => string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-stone-800">{label}</span><span className="text-stone-500 tabular-nums">{format(used)} / {format(limit)}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100"><div className={pct > 80 ? "h-full bg-red-500" : pct > 60 ? "h-full bg-amber-500" : "h-full bg-brand-500"} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function UsagePage() {
  const h = useQuery(api.system.health);
  const emails = useQuery(api.emails.history);
  const today = Date.now() - 86400_000;
  const sentToday = emails?.jobs.filter((j) => j.status === "sent" && (j.sentAt ?? 0) > today).length ?? 0;
  return (
    <>
      <PageHeader eyebrow="System" title="Usage & limits" description="Measured from ONE HUB's own data. Provider dashboards remain the source of truth for billing." />
      {!h ? <Skeleton className="h-64 rounded-2xl" /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader title="Storage" description="Convex file storage (free tier reference)" /><CardBody><Meter label="Files stored" used={h.storage.bytes} limit={LIMITS.convexStorageBytes} format={formatBytes} /></CardBody></Card>
          <Card><CardHeader title="Email" description="Resend free tier reference" /><CardBody className="space-y-4"><Meter label="Delivered in the last 24h" used={sentToday} limit={LIMITS.resendPerDay} /><p className="text-xs text-stone-500">Queue paces sends automatically; bulk announcements larger than the daily allowance continue the next day.</p></CardBody></Card>
          <Card className="lg:col-span-2"><CardBody className="text-sm text-stone-600">Database bandwidth and function-call counts are only visible in the Convex dashboard (Project → Usage). Check it monthly; see <code className="rounded bg-stone-100 px-1">docs/FREE_TIER.md</code> for the thresholds that would require a paid plan.</CardBody></Card>
        </div>
      )}
    </>
  );
}
