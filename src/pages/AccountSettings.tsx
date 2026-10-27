import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { BellRing, Smartphone } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Switch } from "@/components/ui/input";
import { useAction } from "@/lib/hooks";
import { useMe } from "@/lib/session";
import { ROLE_LABELS } from "../../convex/lib/permissionMatrix";
import { isIos, isStandalone, pushSupported } from "@/lib/pwa";

const TYPES: { key: string; label: string }[] = [
  { key: "lead", label: "New leads" }, { key: "meeting", label: "Meeting invitations & reminders" }, { key: "announcement", label: "Company announcements" },
  { key: "document", label: "New documents" }, { key: "employee", label: "Employee updates" },
];

export default function AccountSettings() {
  const me = useMe();
  const prefs = useQuery(api.notifications.preferences);
  const [name, setName] = useState(me.name);
  const [jobTitle, setJobTitle] = useState(me.jobTitle ?? "");
  const [saveProfile, savingProfile] = useAction(api.users.updateProfile, { success: "Profile saved" });
  const [savePrefs] = useAction(api.notifications.savePreferences, { success: "Preferences saved" });
  const [p, setP] = useState<{ disabledTypes: string[]; emailFallback: boolean; push: boolean } | null>(null);
  useEffect(() => { if (prefs && !p) setP({ disabledTypes: prefs.disabledTypes, emailFallback: prefs.emailFallback, push: prefs.push }); }, [prefs, p]);
  const update = (next: typeof p) => { setP(next); if (next) void savePrefs(next); };

  return (
    <>
      <PageHeader title="Account & notifications" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="space-y-4">
            <Field label="Email"><Input value={me.email} disabled /></Field>
            <Field label="Role"><div><Badge tone="brand">{ROLE_LABELS[me.role!]}</Badge></div></Field>
            <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Job title"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
            <Button loading={savingProfile} onClick={() => void saveProfile({ name, jobTitle })}>Save profile</Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Notifications" description="Choose what reaches you. In-app notifications always appear in the bell." />
          <CardBody className="space-y-3">
            {!p ? <div className="h-40 animate-pulse rounded-xl bg-zinc-100" /> : (
              <>
                {TYPES.map((t) => (
                  <div key={t.key} className="flex items-center justify-between gap-4 text-sm">
                    <span>{t.label}</span>
                    <Switch checked={!p.disabledTypes.includes(t.key)} onChange={(on) => update({ ...p, disabledTypes: on ? p.disabledTypes.filter((x) => x !== t.key) : [...p.disabledTypes, t.key] })} label={t.label} />
                  </div>
                ))}
                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-zinc-50 p-3 text-sm">
                  <div><div className="font-medium">Email fallback for reminders</div><div className="text-xs text-zinc-500">Also email meeting reminders.</div></div>
                  <Switch checked={p.emailFallback} onChange={(v) => update({ ...p, emailFallback: v })} label="Email fallback" />
                </div>
              </>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={<span className="flex items-center gap-2"><Smartphone className="size-4" /> Mobile app & push</span>} />
          <CardBody className="space-y-3 text-sm text-zinc-600">
            <p>{isStandalone() ? "You're using the installed ONE HUB app." : isIos() ? "On iPhone: tap Share → “Add to Home Screen” in Safari to install ONE HUB. Push notifications on iOS require the installed app (iOS 16.4+)." : "Install ONE HUB from your browser menu (“Install app” / “Add to Home screen”)."}</p>
            <div className="flex items-center gap-3"><BellRing className="size-4" /> Push notifications: <Badge tone="amber">Coming in Phase 6</Badge> {!pushSupported() && <span className="text-xs">(not supported in this browser)</span>}</div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
