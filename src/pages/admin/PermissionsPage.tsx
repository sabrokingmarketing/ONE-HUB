import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS, type Role } from "../../../convex/lib/permissionMatrix";

const ROLES: Role[] = ["super_admin", "director", "marketing"];
const GROUP_LABEL: Record<string, string> = {
  users: "Users", brokers: "Broker directory", employees: "Employee directory", announcements: "Announcements", properties: "Properties", forms: "Lead forms",
  leads: "Leads", meetings: "Meetings", calendar: "Calendar", library: "Marketing library", campaigns: "Campaigns", social: "Social media", ideas: "Ideas", settings: "System settings", audit: "Audit log", dashboard: "Dashboards",
};

export default function PermissionsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Permissions" description="The live role → permission matrix enforced by every backend function. Per-user grants (social connections, personal calendar) are set on the Users page." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-stone-50/80 text-left text-xs font-medium text-stone-500">
            <tr><th className="px-5 py-3">Permission</th>{ROLES.map((r) => <th key={r} className="px-5 py-3 text-center">{ROLE_LABELS[r]}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {PERMISSIONS.map((p) => {
              const [group, action] = p.split(".");
              return (
                <tr key={p}>
                  <td className="px-5 py-2.5"><span className="font-medium text-stone-800">{GROUP_LABEL[group] ?? group}</span> <span className="text-stone-500">· {action.replace(/_/g, " ")}</span></td>
                  {ROLES.map((r) => <td key={r} className="px-5 py-2.5 text-center">{ROLE_PERMISSIONS[r].has(p) ? <Check className="mx-auto size-4 text-emerald-600" /> : <Minus className="mx-auto size-4 text-stone-300" />}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
