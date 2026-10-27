import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDateTime } from "@/lib/utils";

/**
 * Convex free-tier storage reference (docs/FREE_TIER.md). Email caps come from the
 * deployment's ONEHUB_EMAIL_DAILY_LIMIT / ONEHUB_EMAIL_MONTHLY_LIMIT, which default
 * to the Resend free plan (100/day, 3,000/month). Verify against Resend's pricing page.
 */
const LIMITS = { convexStorageBytes: 1024 ** 3 };

function Meter({ label, used, limit, format = (n: number) => n.toLocaleString() }: { label: string; used: number; limit: number | null; format?: (n: number) => string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-zinc-800">{label}</span><span className="text-zinc-500 tabular-nums">{format(used)} / {limit ? format(limit) : "no cap"}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className={pct > 80 ? "h-full bg-red-500" : pct > 60 ? "h-full bg-amber-500" : "h-full bg-brand-500"} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function UsagePage() {
  const h = useQuery(api.system.health);
  const u = useQuery(api.emails.usage);
  return (
    <>
      <PageHeader eyebrow="System" title="Usage & limits" description="Measured from ONE HUB's own data. Provider dashboards remain the source of truth for billing." />
      {!h || !u ? <Skeleton className="h-64 rounded-2xl" /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader title="Storage" description="Convex file storage (free tier reference)" /><CardBody><Meter label="Files stored" used={h.storage.bytes} limit={LIMITS.convexStorageBytes} format={formatBytes} /></CardBody></Card>
          <Card>
            <CardHeader title="Email" description={<>Dedicated ONE HUB Resend account · mode <Badge tone={u.mode === "live" ? "green" : "amber"}>{u.mode}</Badge></>} />
            <CardBody className="space-y-4">
              <Meter label="Sent today (UTC)" used={u.sentToday} limit={u.limits.daily || null} />
              <Meter label="Sent this month" used={u.sentMonth} limit={u.limits.monthly || null} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-500">Queued</div><div className="font-semibold tabular-nums">{u.queued}</div></div>
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-500">Waiting for limit reset</div><div className="font-semibold tabular-nums">{u.deferred}</div></div>
              </div>
              <p className="text-xs text-zinc-500">
                Daily allowance resets {formatDateTime(u.resetsAt)}. Larger announcements are split across days automatically, never sent above the plan's limits.
                {!u.webhookConfigured && " Delivery confirmations are off until the Resend webhook is configured."}
              </p>
            </CardBody>
          </Card>
          <Card className="lg:col-span-2"><CardBody className="text-sm text-zinc-600">
            Resend free plan (verify on resend.com/pricing before relying on it): 3,000 emails/month, 100/day, one sending domain, API and webhooks included. A paid plan removes the daily cap; it is never activated by ONE HUB.
            Database bandwidth and function-call counts are only visible in the Convex dashboard (Project → Usage). See <code className="rounded bg-zinc-100 px-1">docs/FREE_TIER.md</code>.
          </CardBody></Card>
        </div>
      )}
    </>
  );
}
