import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ImagePlus, X, Save, CalendarClock, Share2, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { Facebook, Instagram, Linkedin } from "@/components/PlatformIcons";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Skeleton, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ChangedBanner } from "@/components/ChangedBanner";
import { useAction, uploadFile } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { cn, errorMessage, formatDateTime, msToSastInput, sastInputToMs } from "@/lib/utils";

const PLATFORM_ICON = { facebook: Facebook, instagram: Instagram, linkedin: Linkedin };
type Media = { storageId: Id<"_storage">; url: string | null; contentType: string };

export default function PostComposer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useCan();
  const post = useQuery(api.socialPosts.get, id ? { id: id as Id<"socialPosts"> } : "skip");
  const accounts = useQuery(api.socialPosts.accounts);
  const properties = useQuery(api.properties.options);
  const campaigns = useQuery(api.campaigns.list, {});
  const genUrl = useMutation(api.socialPosts.generateUploadUrl);
  const [save, saving] = useAction(api.socialPosts.save);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [f, setF] = useState({ caption: "", hashtags: "", accountIds: [] as Id<"marketingAccounts">[], media: [] as Media[], propertyId: "", campaignId: "", when: msToSastInput(Date.now() + 24 * 3600_000).slice(0, 14) + "00" });

  useEffect(() => {
    if (post && loadedVersion === null) {
      setF({ caption: post.caption, hashtags: post.hashtags.map((h) => `#${h}`).join(" "), accountIds: post.accountIds, media: post.media, propertyId: post.propertyId ?? "", campaignId: post.campaignId ?? "", when: post.scheduledAt ? msToSastInput(post.scheduledAt) : f.when });
      setLoadedVersion(post.version);
    }
  }, [post, loadedVersion, f.when]);

  if (id && post === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (id && post === null) return <EmptyState icon={Share2} title="Post not found" />;
  const locked = !can("social.write") || (post && ["publishing", "published"].includes(post.status));
  const igSelected = accounts?.some((a) => f.accountIds.includes(a._id) && a.platform === "instagram");
  const fullCaption = [f.caption, f.hashtags].filter(Boolean).join("\n\n");

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added: Media[] = [];
      for (const file of Array.from(files).slice(0, 10 - f.media.length)) {
        if (!/^(image\/(jpeg|png)|video\/mp4)$/.test(file.type)) { toast.error(`${file.name}: use JPEG, PNG or MP4`); continue; }
        if (file.size > 100 * 1024 * 1024) { toast.error(`${file.name}: max 100 MB`); continue; }
        const sid = (await uploadFile(await genUrl(), file)) as Id<"_storage">;
        added.push({ storageId: sid, url: URL.createObjectURL(file), contentType: file.type });
      }
      setF((s) => ({ ...s, media: [...s.media, ...added] }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (intent: "draft" | "schedule") => {
    const res = await save({
      id: id as Id<"socialPosts"> | undefined,
      expectedVersion: post?.version !== undefined ? (loadedVersion ?? post.version) : undefined,
      intent,
      data: {
        caption: f.caption, hashtags: f.hashtags.split(/[\s,]+/).filter(Boolean), accountIds: f.accountIds, mediaStorageIds: f.media.map((m) => m.storageId),
        propertyId: (f.propertyId || undefined) as Id<"properties"> | undefined, campaignId: (f.campaignId || undefined) as Id<"marketingCampaigns"> | undefined,
        scheduledAt: f.when ? sastInputToMs(f.when) : undefined, timezone: "Africa/Johannesburg",
      },
    });
    if (res) {
      toast.success(intent === "draft" ? "Draft saved" : "Post scheduled — it will publish automatically");
      if (!id) navigate(`/marketing/social/posts/${res}`, { replace: true });
      else setLoadedVersion(null);
    }
  };

  return (
    <>
      <PageHeader back="/marketing/social" eyebrow="Social media" title={id ? "Edit post" : "Create post"} description={post && <span className="flex items-center gap-2"><StatusBadge status={post.status} /> Last edited by {post.updatedByName}</span>}
        actions={!locked && <>
          <Button variant="secondary" loading={saving} onClick={() => void submit("draft")}><Save /> Save draft</Button>
          <Button loading={saving} onClick={() => void submit("schedule")}><CalendarClock /> Schedule</Button>
        </>} />
      {post && loadedVersion !== null && post.version !== loadedVersion && <ChangedBanner by={post.updatedByName} onReload={() => setLoadedVersion(null)} />}
      {post?.status === "failed" && post.lastError && <div className="mb-4 flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200"><AlertTriangle className="size-4 shrink-0" /><div><div className="font-medium">Publishing failed</div>{post.lastError}<div className="mt-1 text-xs">Fix the issue, choose a new time and schedule again.</div></div></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card><CardHeader title="1. Context" /><CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Property / shopping centre"><Select disabled={!!locked} value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}><option value="">Portfolio-wide</option>{properties?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
            <Field label="Campaign"><Select disabled={!!locked} value={f.campaignId} onChange={(e) => setF({ ...f, campaignId: e.target.value })}><option value="">None</option>{campaigns?.filter((c) => c.status !== "archived").map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
          </CardBody></Card>

          <Card><CardHeader title="2. Accounts" description="Only connected accounts can be scheduled." /><CardBody>
            {accounts === undefined ? <Skeleton className="h-16" /> : accounts.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="size-4" /> No social accounts are connected yet. You can still prepare drafts.</p>
            ) : (
              <div className="flex flex-wrap gap-2">{accounts.map((a) => {
                const Icon = PLATFORM_ICON[a.platform];
                const on = f.accountIds.includes(a._id);
                return (
                  <button key={a._id} type="button" disabled={!!locked || a.status !== "connected"} onClick={() => setF({ ...f, accountIds: on ? f.accountIds.filter((x) => x !== a._id) : [...f.accountIds, a._id] })}
                    className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition disabled:opacity-40", on ? "bg-brand-50 text-brand-800 ring-brand-300" : "bg-white ring-stone-200 hover:ring-stone-300")}>
                    <Icon className="size-4" />{a.name}{on && <CheckCircle2 className="size-4 text-brand-500" />}
                  </button>
                );
              })}</div>
            )}
          </CardBody></Card>

          <Card><CardHeader title="3. Media" description="JPEG, PNG or MP4 · up to 10 files · 100 MB each" /><CardBody>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {f.media.map((m, i) => (
                <div key={m.storageId} className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
                  {m.contentType.startsWith("video/") ? <video src={m.url ?? undefined} className="size-full object-cover" muted /> : <img src={m.url ?? undefined} alt="" className="size-full object-cover" />}
                  {!locked && <button className="absolute top-1 right-1 rounded-full bg-ink/70 p-1 text-white" onClick={() => setF({ ...f, media: f.media.filter((_, j) => j !== i) })} aria-label="Remove"><X className="size-3" /></button>}
                </div>
              ))}
              {!locked && f.media.length < 10 && (
                <button onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-brand-300 hover:text-brand-500" disabled={uploading}>
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,video/mp4" onChange={(e) => void onFiles(e.target.files)} />
            {igSelected && f.media.length === 0 && <p className="mt-3 text-xs text-amber-700">Instagram requires at least one image or video.</p>}
          </CardBody></Card>

          <Card><CardHeader title="4. Caption" /><CardBody className="space-y-4">
            <Field label="Caption" hint={`${fullCaption.length} / 2,200 characters`}><Textarea disabled={!!locked} className="min-h-40" value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} maxLength={2200} /></Field>
            <Field label="Hashtags" hint="Separate with spaces"><Input disabled={!!locked} value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} placeholder="#ONEProperty #Southdale" /></Field>
          </CardBody></Card>

          <Card><CardHeader title="5. Schedule" description="Africa/Johannesburg (SAST)" /><CardBody>
            <Field label="Publish at"><Input disabled={!!locked} type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></Field>
          </CardBody></Card>

          {post && post.jobs.length > 0 && (
            <Card><CardHeader title="Publishing log" /><CardBody>
              <ul className="space-y-2 text-sm">{post.jobs.map((j) => (
                <li key={j._id} className="flex flex-wrap items-center gap-2"><StatusBadge status={j.status} /><span className="text-stone-500">attempts: {j.attempts}</span>{j.externalPostId && <Badge tone="green">ID {j.externalPostId}</Badge>}{j.finishedAt && <span className="text-xs text-stone-400">{formatDateTime(j.finishedAt)}</span>}{j.error && <span className="w-full text-xs text-red-600">{j.error}</span>}</li>
              ))}</ul>
            </CardBody></Card>
          )}
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <div className="mb-2 text-xs font-semibold tracking-wider text-stone-400 uppercase">Preview</div>
          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 p-4"><span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-bold text-white">ONE</span><div><div className="text-sm font-semibold">ONE Property Holdings</div><div className="text-xs text-stone-500">{f.when ? formatDateTime(sastInputToMs(f.when)) : "Not scheduled"}</div></div></div>
            {f.media[0] && (f.media[0].contentType.startsWith("video/") ? <video src={f.media[0].url ?? undefined} className="aspect-square w-full bg-stone-100 object-cover" controls /> : <img src={f.media[0].url ?? undefined} alt="" className="aspect-square w-full bg-stone-100 object-cover" />)}
            <div className="p-4 text-sm whitespace-pre-wrap text-stone-800">{fullCaption || <span className="text-stone-400">Your caption will appear here…</span>}</div>
            {f.media.length > 1 && <div className="px-4 pb-4 text-xs text-stone-500">+{f.media.length - 1} more media</div>}
          </Card>
          <p className="mt-3 text-xs text-stone-500">Preview is approximate — each platform crops and truncates differently.</p>
        </div>
      </div>
    </>
  );
}
