import { useQuery } from "convex/react";
import { Plug, Info } from "lucide-react";
import { Facebook, Instagram, Linkedin } from "@/components/PlatformIcons";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";

const PLATFORMS = [
  { key: "facebook", name: "Facebook Pages", icon: Facebook, note: "Requires a Meta developer app with pages_manage_posts + pages_read_engagement (App Review)." },
  { key: "instagram", name: "Instagram professional accounts", icon: Instagram, note: "Requires instagram_content_publish via the same Meta app; media must be publicly fetchable." },
  { key: "linkedin", name: "LinkedIn Pages", icon: Linkedin, note: "Requires LinkedIn Community Management API access (application + approval)." },
] as const;

export default function AccountsPage() {
  const can = useCan();
  const accounts = useQuery(api.socialPosts.accounts);
  const [disconnect] = useAction(api.socialPosts.disconnectAccount, { success: "Account disconnected" });
  return (
    <>
      <PageHeader eyebrow="Social media" title="Connected accounts" description="Official OAuth connections only — ONE HUB never asks for social media passwords." />
      <div className="mb-6 flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>Connecting accounts needs approved developer apps from Meta and LinkedIn. Until those are registered and reviewed, the Connect buttons stay disabled and no integration is reported as working. See <code>docs/INTEGRATIONS.md</code>.</div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const list = (accounts ?? []).filter((a) => a.platform === p.key);
          return (
            <Card key={p.key}>
              <CardHeader title={<span className="flex items-center gap-2"><p.icon className="size-4" />{p.name}</span>} description={p.note} />
              <CardBody className="space-y-3">
                {accounts === undefined ? <Skeleton className="h-12" /> : list.length === 0 ? <p className="text-sm text-stone-500">No accounts connected.</p> : list.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                    {a.imageUrl ? <img src={a.imageUrl} alt="" className="size-8 rounded-full" /> : <span className="grid size-8 place-items-center rounded-full bg-white ring-1 ring-stone-200"><p.icon className="size-4" /></span>}
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{a.name}</div>{a.lastError && <div className="truncate text-xs text-red-600">{a.lastError}</div>}</div>
                    <StatusBadge status={a.status} />
                    {can("social.connect") && a.status !== "disconnected" && <Button size="sm" variant="ghost" onClick={() => void disconnect({ id: a._id })}>Disconnect</Button>}
                  </div>
                ))}
                <Button variant="secondary" className="w-full" disabled title="Available once the developer app is approved"><Plug /> Connect account</Button>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
