import { useQuery, useMutation } from "convex/react";
import { Database, Mail, CalendarDays, Cloud, Share2, HardDrive, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  operational: "Operational", verified: "Verified", configured_unverified: "Configured · not yet verified", not_configured: "Not configured", external: "Managed externally",
};

function Row({ icon: Icon, name, status, detail, children }: { icon: typeof Mail; name: string; status: string; detail?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-600"><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1"><div className="font-medium text-stone-900">{name}</div>{detail && <div className="text-sm text-stone-500">{detail}</div>}</div>
      <div className="flex items-center gap-3">{children}<StatusBadge status={status} label={STATUS_LABEL[status] ?? status} /></div>
    </div>
  );
}

export default function IntegrationsPage() {
  const h = useQuery(api.system.health);
  const settings = useQuery(api.system.settings);
  const setSetting = useMutation(api.system.setSetting);
  const toggle = (key: string, v: boolean) => setSetting({ key, value: String(v) }).then(() => toast.success("Setting saved"), () => toast.error("Couldn't save setting"));
  return (
    <>
      <PageHeader eyebrow="System" title="Integrations & health" description="Only integrations that have been tested end-to-end are marked Verified." />
      {!h || !settings ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="space-y-6">
          <Card><CardBody className="divide-y divide-stone-100 py-1">
            <Row icon={Database} name="Convex (database & jobs)" status={h.convex.status} detail={h.convex.detail} />
            <Row icon={Mail} name="Resend (email)" status={h.resend.status} detail={<>Mode: <Badge tone={h.resend.mode === "live" ? "green" : "amber"}>{h.resend.mode}</Badge> · {h.resend.queued} queued · {h.resend.failed} failed · {h.resend.detail}</>} />
            <Row icon={CalendarDays} name="Google Calendar" status={h.google.status} detail={`${h.google.connections} personal connections · OAuth app not yet configured`} />
            <Row icon={CalendarDays} name="Microsoft Outlook Calendar" status={h.microsoft.status} detail={`${h.microsoft.connections} personal connections · OAuth app not yet configured`} />
            <Row icon={Share2} name="Meta (Facebook & Instagram)" status={h.meta} detail="META_APP_ID / META_APP_SECRET · connect accounts under Marketing → Connected accounts" />
            <Row icon={Share2} name="LinkedIn" status={h.linkedin} detail="LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET" />
            <Row icon={Cloud} name="Cloudflare (hosting)" status={h.cloudflare.status} detail={h.cloudflare.detail} />
            <Row icon={HardDrive} name="File storage" status="operational" detail={`${h.storage.files} files · ${formatBytes(h.storage.bytes)} (Convex storage)`} />
          </CardBody></Card>

          <Card>
            <CardHeader title="Social publishing" description="Safety controls for automated posting." />
            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-6 rounded-xl bg-stone-50 p-4">
                <div><div className="font-medium">Live publishing</div><div className="text-sm text-stone-500">When off, due posts are marked Failed with a clear reason and nothing is sent to any platform. Turn on only after an account has been verified.</div></div>
                <Switch checked={settings["social.publishingEnabled"] === "true"} onChange={(v) => toggle("social.publishingEnabled", v)} label="Live publishing" />
              </div>
              <div className="flex items-start justify-between gap-6 rounded-xl bg-stone-50 p-4">
                <div><div className="font-medium">Require admin approval</div><div className="text-sm text-stone-500">Marketing posts go to “Pending approval” before being scheduled.</div></div>
                <Switch checked={settings["social.requireApproval"] === "true"} onChange={(v) => toggle("social.requireApproval", v)} label="Require approval" />
              </div>
              {h.social.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-stone-500"><Share2 className="size-4" /> No social accounts connected yet — connect them under Marketing → Connected accounts.</p>
              ) : (
                <ul className="divide-y divide-stone-100">{h.social.map((s) => <li key={s.name + s.platform} className="flex items-center justify-between py-3 text-sm"><span>{s.name} <span className="text-stone-400">· {s.platform}</span></span><StatusBadge status={s.status} /></li>)}</ul>
              )}
              {h.failedPublishingJobs > 0 && <p className="flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="size-4" /> {h.failedPublishingJobs} failed publishing jobs</p>}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
