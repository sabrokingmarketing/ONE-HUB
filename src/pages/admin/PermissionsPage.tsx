import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, type Role } from "../../../convex/lib/permissionMatrix";

const ROLES: Role[] = ["super_admin", "director"];
const GROUP_LABEL: Record<string, string> = {
  users: "Users", brokers: "Broker directory", employees: "Employee directory", announcements: "Announcements", properties: "Properties", forms: "Lead forms",
  leads: "Leads", meetings: "Meetings", calendar: "Calendar", documents: "Documents", settings: "System settings", audit: "Audit log", dashboard: "Dashboards",
};

export default function PermissionsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Permissions" description="The live role → permission matrix enforced by every backend function." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-zinc-100 text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            <tr><th className="px-5 py-3">Permission</th>{ROLES.map((r) => <th key={r} className="px-5 py-3 text-center">{ROLE_LABELS[r]}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {PERMISSIONS.map((p) => {
              const [group, action] = p.split(".");
              return (
                <tr key={p}>
                  <td className="px-5 py-2.5"><span className="font-medium text-zinc-800">{GROUP_LABEL[group] ?? group}</span> <span className="text-zinc-500">· {action.replace(/_/g, " ")}</span></td>
                  {ROLES.map((r) => <td key={r} className="px-5 py-2.5 text-center">{ROLE_PERMISSIONS[r].has(p) ? <Check className="mx-auto size-4 text-emerald-600" /> : <Minus className="mx-auto size-4 text-zinc-300" />}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
