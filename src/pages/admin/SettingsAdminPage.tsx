import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/hooks";

export default function SettingsAdminPage() {
  const s = useQuery(api.system.settings);
  const [retention, setRetention] = useState("");
  const [save, pending] = useAction(api.system.setSetting, { success: "Settings saved" });
  useEffect(() => { if (s) setRetention(s["leads.retentionDays"]); }, [s]);
  return (
    <>
      <PageHeader eyebrow="System" title="Platform settings" />
      {!s ? <Skeleton className="h-48 rounded-2xl" /> : (
        <Card className="max-w-2xl">
          <CardHeader title="Data & privacy (POPIA)" description="Lead data should not be kept longer than necessary." />
          <CardBody className="space-y-4">
            <Field label="Lead retention period (days)" hint="Used to flag leads for review/deletion. Agree the period with your Information Officer."><Input type="number" min={30} value={retention} onChange={(e) => setRetention(e.target.value)} /></Field>
            <Field label="Company timezone"><Input value={s["company.timezone"]} disabled /></Field>
            <Button loading={pending} onClick={() => void save({ key: "leads.retentionDays", value: retention })}>Save</Button>
          </CardBody>
        </Card>
      )}
    </>
  );
}
