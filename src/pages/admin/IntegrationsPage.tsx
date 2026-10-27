import { useQuery } from "convex/react";
import { Database, Mail, CalendarDays, Cloud, HardDrive } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";

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

export default function IntegrationsPage() {
  const h = useQuery(api.system.health);
  return (
    <>
      <PageHeader eyebrow="System" title="Integrations & health" description="Only integrations that have been tested end-to-end are marked Verified." />
      {!h ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="space-y-6">
          <Card><CardBody className="divide-y divide-zinc-100 py-1">
            <Row icon={Database} name="Convex (database & jobs)" status={h.convex.status} detail={h.convex.detail} />
            <Row icon={Mail} name="Resend (email)" status={h.resend.status} detail={<>Mode: <Badge tone={h.resend.mode === "live" ? "green" : "amber"}>{h.resend.mode}</Badge> · {h.resend.queued} queued · {h.resend.failed} failed · {h.resend.detail}</>} />
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
