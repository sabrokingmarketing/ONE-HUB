import { useQuery } from "convex/react";
import { Mail } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, EmptyState, LoadingRows } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { emailStatus } from "@/lib/emailStatus";

export default function EmailLogPage() {
  const data = useQuery(api.emails.history);
  return (
    <>
      <PageHeader eyebrow="Communication" title="Email log" description={data ? <>Delivery mode: <Badge tone={data.mode === "live" ? "green" : "amber"}>{data.mode}</Badge> {data.mode !== "live" && "— no email reaches real recipients in this mode."}</> : undefined} />
      <Card className="overflow-hidden">
        {!data ? <LoadingRows /> : data.jobs.length === 0 ? <EmptyState icon={Mail} title="No emails yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-zinc-100 text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase"><tr><th className="px-5 py-3">Recipient</th><th className="px-5 py-3">Subject</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Queued</th><th className="px-5 py-3">Delivered</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {data.jobs.map((j) => (
                  <tr key={j._id}>
                    <td className="px-5 py-3">{j.to}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-zinc-700">{j.subject}</td>
                    <td className="px-5 py-3"><Badge>{j.kind.replace(/_/g, " ")}</Badge></td>
                    <td className="px-5 py-3">
                      <span title={emailStatus(j.status).hint}><Badge tone={emailStatus(j.status).tone} dot>{emailStatus(j.status).label}</Badge></span>
                      {j.deferredReason && j.status === "queued" && <div className="mt-1 text-xs text-amber-700">Waiting: {j.deferredReason}</div>}
                      {j.error && <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={j.error}>{j.error}</div>}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{formatDateTime(j._creationTime)}</td>
                    <td className="px-5 py-3 text-zinc-500">{j.deliveredAt ? formatDateTime(j.deliveredAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
