import { useState } from "react";
import { useAction as useConvexAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Database, Mail, CalendarDays, Cloud, HardDrive } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage, formatBytes } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  operational: "Operational", verified: "Verified", configured_unverified: "Configured · not yet verified", not_configured: "Not configured", external: "Managed externally",
};

function Row({ icon: Icon, name, status, detail, children }: { icon: typeof Mail; name: string; status: string; detail?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600"><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1"><div className="font-medium text-zinc-900">{name}</div>{detail && <div className="text-sm text-zinc-500">{detail}</div>}</div>
      <div className="flex items-center gap-3">{children}<StatusBadge status={status} label={STATUS_LABEL[status] ?? status} /></div>
    </div>
  );
}

type Check = FunctionReturnType<typeof api.emails.checkConnection>;

function ResendCheck() {
  const check = useConvexAction(api.emails.checkConnection);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try { setResult(await check({})); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="pb-4 text-sm">
      <Button variant="secondary" size="sm" loading={busy} onClick={() => void run()}>Test Resend connection</Button>
      <span className="ml-2 text-xs text-zinc-500">Checks the API key and sending domain. Sends no email.</span>
      {error && <div className="mt-2 text-red-600">{error}</div>}
      {result && (
        <div className="mt-3 space-y-1 rounded-xl bg-zinc-50 p-3">
          <div className={result.keyValid ? "text-emerald-700" : "text-red-600"}>{result.message}</div>
          <div className="text-xs text-zinc-600">From: {result.fromAddress ?? "not set"} · Webhook: {result.webhookConfigured ? "configured" : "not configured"} · Mode: {result.mode}</div>
          {result.domains && <div className="text-xs text-zinc-600">Domains in account: {result.domains.map((d) => `${d.name} (${d.status})`).join(", ") || "none"}</div>}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const h = useQuery(api.system.health);
  return (
    <>
      <PageHeader eyebrow="System" title="Integrations & health" description="Only integrations that have been tested end-to-end are marked Verified." />
      {!h ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="space-y-6">
          <Card><CardBody className="divide-y divide-zinc-100 py-1">
            <Row icon={Database} name="Convex (database & jobs)" status={h.convex.status} detail={h.convex.detail} />
            <Row icon={Mail} name="Resend (email)" status={h.resend.status} detail={<>Mode: <Badge tone={h.resend.mode === "live" ? "green" : "amber"}>{h.resend.mode}</Badge> · {h.resend.queued} queued · {h.resend.failed} failed · webhook {h.resend.webhook ? "on" : "off"} · {h.resend.detail}</>} />
            <ResendCheck />
            <Row icon={CalendarDays} name="Google Calendar" status={h.google.status} detail={`${h.google.connections} personal connections · OAuth app not yet configured`} />
            <Row icon={CalendarDays} name="Microsoft Outlook Calendar" status={h.microsoft.status} detail={`${h.microsoft.connections} personal connections · OAuth app not yet configured`} />
            <Row icon={Cloud} name="Cloudflare (hosting)" status={h.cloudflare.status} detail={h.cloudflare.detail} />
            <Row icon={HardDrive} name="File storage" status="operational" detail={`${h.storage.files} files · ${formatBytes(h.storage.bytes)} (Convex storage)`} />
          </CardBody></Card>

        </div>
      )}
    </>
  );
}
