import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { Plug, Info, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Facebook, Instagram, Linkedin } from "@/components/PlatformIcons";
import { api } from "../../../convex/_generated/api";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { errorMessage, formatDate } from "@/lib/utils";
import { copy } from "@/lib/share";

const PLATFORMS = [
  { key: "facebook", provider: "meta", name: "Facebook Pages", icon: Facebook, note: "Connect with Facebook and choose the Pages ONE HUB may post to." },
  { key: "instagram", provider: "meta", name: "Instagram professional accounts", icon: Instagram, note: "Connected through the same Facebook login — the Instagram account must be linked to a Facebook Page." },
  { key: "linkedin", provider: "linkedin", name: "LinkedIn Pages", icon: Linkedin, note: "Connect with a LinkedIn profile that is an admin of the company Page." },
] as const;

export default function AccountsPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const accounts = useQuery(api.socialPosts.accounts);
  const cfg = useQuery(api.socialAuth.config);
  const start = useMutation(api.socialAuth.startConnect);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnect] = useAction(api.socialPosts.disconnectAccount, { success: "Account disconnected" });

  useEffect(() => {
    const ok = params.get("connected");
    const err = params.get("oauth_error");
    if (!ok && !err) return;
    if (ok) toast.success(`${ok === "meta" ? "Facebook/Instagram" : "LinkedIn"} connected`, { description: `${params.get("count") ?? ""} account(s) are ready to schedule.` });
    if (err) toast.error("Connection failed", { description: err });
    setParams({}, { replace: true });
  }, [params, setParams]);

  const connect = async (provider: "meta" | "linkedin") => {
    setBusy(provider);
    try {
      window.location.href = await start({ provider });
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Social media" title="Connected accounts" description="Official OAuth connections only — ONE HUB never asks for social media passwords." />
      {cfg && (!cfg.meta || !cfg.linkedin) && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-2">
            <p>{!cfg.meta && !cfg.linkedin ? "Neither Meta nor LinkedIn is configured yet." : !cfg.meta ? "Meta (Facebook & Instagram) isn't configured yet." : "LinkedIn isn't configured yet."} An administrator needs to register ONE HUB as an app with each platform and add its keys — see <code>docs/INTEGRATIONS.md</code>.</p>
            {cfg.redirectUris && (
              <div className="space-y-1 text-xs">
                <div className="font-medium">Redirect URLs to register:</div>
                {(["meta", "linkedin"] as const).map((p) => (
                  <button key={p} onClick={() => void copy(cfg.redirectUris![p], "Copied")} className="flex items-center gap-2 font-mono hover:underline"><Copy className="size-3" />{cfg.redirectUris![p]}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {PLATFORMS.map((p) => {
          const list = (accounts ?? []).filter((a) => a.platform === p.key);
          const ready = cfg?.[p.provider] ?? false;
          return (
            <Card key={p.key}>
              <CardHeader title={<span className="flex items-center gap-2"><p.icon className="size-4" />{p.name}</span>} description={p.note} />
              <CardBody className="space-y-3">
                {accounts === undefined ? <Skeleton className="h-12" /> : list.length === 0 ? <p className="text-sm text-stone-500">No accounts connected.</p> : list.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                    {a.imageUrl ? <img src={a.imageUrl} alt="" className="size-8 rounded-full" /> : <span className="grid size-8 place-items-center rounded-full bg-white ring-1 ring-stone-200"><p.icon className="size-4" /></span>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      <div className="truncate text-xs text-stone-500">{a.lastError ?? (a.parentName ? `via ${a.parentName}` : a.tokenExpiresAt ? `Access until ${formatDate(a.tokenExpiresAt)}` : a.connectedAt ? `Connected ${formatDate(a.connectedAt)}` : "")}</div>
                    </div>
                    <StatusBadge status={a.status} />
                    {can("social.connect") && a.status !== "disconnected" && <Button size="sm" variant="ghost" onClick={() => void disconnect({ id: a._id })}>Disconnect</Button>}
                  </div>
                ))}
                {cfg?.canConnect && (
                  <Button variant={list.length ? "secondary" : "primary"} className="w-full" disabled={!ready} loading={busy === p.provider} onClick={() => void connect(p.provider)}
                    title={ready ? undefined : "Not configured yet — see the note above"}>
                    {list.some((a) => a.status !== "connected") ? <RefreshCw /> : <Plug />}
                    {list.length ? "Reconnect / add more" : "Connect"}
                  </Button>
                )}
                {cfg && !cfg.canConnect && <p className="text-xs text-stone-500">Ask an admin to connect accounts or grant you social connection access.</p>}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
