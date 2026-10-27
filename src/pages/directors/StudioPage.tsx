import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen, Newspaper, PenTool, Share2, Presentation, Film, Camera, Gem, LayoutTemplate, FileText, Upload, Download,
  Eye, Star, Pencil, Archive, RotateCcw, Link2, Play, Loader2, X, Image as ImageIcon, Layers, MoreVertical, Search, Check,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState, Skeleton, Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, Sheet, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, Switch } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useAction, useDebounced, uploadFile } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { cn, errorMessage, formatBytes, formatDate, timeAgo } from "@/lib/utils";
import { copy } from "@/lib/share";

type Asset = FunctionReturnType<typeof api.studio.list>[number];
type Kind = "image" | "video" | "pdf" | "other";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Booklets: BookOpen, Brochures: Newspaper, Designs: PenTool, "Social media": Share2, Presentations: Presentation,
  Videos: Film, Photography: Camera, "Brand & logos": Gem, Templates: LayoutTemplate, Documents: FileText,
};

/** Soft, blurred colour fields used as card backdrops — one per category. */
const GRADIENTS: Record<string, string> = {
  Booklets: "radial-gradient(120% 95% at 15% 0%, #b9ecfb 0%, #7dd3f0 38%, #e8f8fd 75%, #ffffff 100%)",
  Brochures: "radial-gradient(120% 95% at 85% 0%, #ffd8a8 0%, #f7931e 40%, #fde3c4 78%, #ffffff 100%)",
  Designs: "radial-gradient(120% 95% at 20% 10%, #c4b5fd 0%, #8b5cf6 38%, #e4dcfd 76%, #ffffff 100%)",
  "Social media": "radial-gradient(120% 95% at 80% 10%, #fbcfe8 0%, #f472b6 38%, #fde2f0 76%, #ffffff 100%)",
  Presentations: "radial-gradient(120% 95% at 15% 10%, #fde68a 0%, #f2c14e 40%, #fbf0cf 78%, #ffffff 100%)",
  Videos: "radial-gradient(120% 95% at 85% 10%, #a5b4fc 0%, #6366f1 40%, #e0e3fd 78%, #ffffff 100%)",
  Photography: "radial-gradient(120% 95% at 20% 0%, #fecaca 0%, #f97362 40%, #fde0d9 78%, #ffffff 100%)",
  "Brand & logos": "radial-gradient(120% 95% at 80% 0%, #ffe4c2 0%, #fca43b 40%, #fff0de 78%, #ffffff 100%)",
  Templates: "radial-gradient(120% 95% at 15% 10%, #a7f3d0 0%, #34d399 40%, #dcf8ec 78%, #ffffff 100%)",
  Documents: "radial-gradient(120% 95% at 80% 10%, #e4e4e7 0%, #a1a1aa 40%, #f1f1f3 78%, #ffffff 100%)",
};
const gradientFor = (c: string) => GRADIENTS[c] ?? GRADIENTS.Documents;

const kindOf = (t: string): Kind => (t.startsWith("image/") ? "image" : t.startsWith("video/") ? "video" : t === "application/pdf" ? "pdf" : "other");
const extOf = (name: string, type: string) => (name.includes(".") ? name.split(".").pop()! : type.split("/").pop()!).slice(0, 5).toUpperCase();
const editedAgo = (ms: number) => `Edited ${timeAgo(ms).replace("just now", "just now")}`;

async function downloadAsset(a: { name: string; url: string | null; contentType: string }) {
  if (!a.url) return toast.error("This file is unavailable.");
  try {
    const res = await fetch(a.url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = a.name.includes(".") ? a.name : `${a.name}.${extOf(a.name, a.contentType).toLowerCase()}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  } catch {
    window.open(a.url, "_blank", "noopener");
  }
}

// ---------------------------------------------------------------- page

type Tab = "all" | "collections" | "featured";

export default function StudioPage() {
  const can = useCan();
  const writer = can("studio.write");
  const [params, setParams] = useSearchParams();
  const overview = useQuery(api.studio.overview);
  const collections = useQuery(api.studio.collections);
  const properties = useQuery(api.properties.options, can("properties.read") ? {} : "skip");
  const tab = (params.get("tab") as Tab) || "all";
  const [category, setCategory] = useState("");
  const [collection, setCollection] = useState("");
  const [kind, setKind] = useState<"" | Kind>("");
  const [sort, setSort] = useState<"newest" | "name" | "popular">("newest");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const dq = useDebounced(search);
  const assets = useQuery(api.studio.list, tab === "collections" && !collection ? "skip" : {
    search: dq || undefined, category: category || undefined, collection: collection || undefined,
    kind: kind || undefined, sort, archived: showArchived,
  });
  const featured = useQuery(api.studio.featured, tab === "featured" ? {} : "skip");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [replacing, setReplacing] = useState<Asset | null>(null);
  const openId = params.get("asset") as Id<"studioAssets"> | null;
  const recordDownload = useMutation(api.studio.recordDownload);

  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set("tab", t); p.delete("asset"); setParams(p); setCollection(""); };
  const open = (id: Id<"studioAssets">) => { params.set("asset", id); setParams(params); };
  const download = (a: Asset) => { void recordDownload({ id: a._id }); void downloadAsset(a); };
  const resetFilters = () => { setCategory(""); setCollection(""); setKind(""); setSearch(""); setShowArchived(false); };
  const filtersOn = !!(category || collection || kind || dq || showArchived);
  const shown = tab === "featured" ? featured : assets;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-zinc-900">Marketing Studio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {overview ? `${overview.total} files · ${overview.newThisWeek} new this week` : "Booklets, brochures, designs and more from the marketing team"}
          </p>
        </div>
        {writer && <Button size="lg" onClick={() => setUploadOpen(true)}><Upload /> Upload</Button>}
      </div>

      {/* Underline tabs */}
      <nav className="flex gap-7 border-b border-zinc-200" role="tablist">
        {([["all", "All files"], ["collections", "Collections"], ["featured", "Featured"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn("-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors", tab === v ? "border-brand-500 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800")}>
            {label}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* Filter panel */}
        <aside className="flex min-w-0 flex-col gap-3 self-start rounded-3xl bg-white p-4 shadow-card lg:sticky lg:top-24 lg:gap-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files"
              className="h-11 w-full rounded-2xl bg-zinc-100/80 pr-3 pl-10 text-sm outline-none placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-brand-500/50" />
          </label>

          {/* Mobile: compact category chips */}
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
            {[{ key: "", count: overview?.total ?? 0 }, ...(overview?.categories ?? [])].map((c) => (
              <button key={c.key || "all"} onClick={() => { setCategory(c.key); if (tab === "collections") setTab("all"); }}
                className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition", category === c.key ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600")}>
                {c.key || "All"} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <div className="mb-1.5 px-1 text-xs font-medium text-zinc-500">Sort by</div>
            <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-11 rounded-2xl bg-zinc-100/80 ring-0">
              <option value="newest">Last updated</option><option value="name">Name A–Z</option><option value="popular">Most downloaded</option>
            </Select>
          </div>

          <div className="hidden lg:block">
            <div className="mb-1.5 px-1 text-xs font-medium text-zinc-500">File type</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([["", "All"], ["pdf", "PDF"], ["image", "Images"], ["video", "Video"]] as const).map(([v, label]) => (
                <button key={label} onClick={() => setKind(v)} className={cn("h-9 rounded-xl text-[13px] font-semibold transition", kind === v ? "bg-ink text-white" : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70")}>{label}</button>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="mb-1.5 px-1 text-xs font-medium text-zinc-500">Categories</div>
            <ul className="space-y-0.5">
              {[{ key: "", count: overview?.total ?? 0 }, ...(overview?.categories ?? [])].map((c) => {
                const Icon = c.key ? CATEGORY_ICONS[c.key] ?? FileText : Layers;
                const active = category === c.key;
                return (
                  <li key={c.key || "all"}>
                    <button onClick={() => { setCategory(c.key); if (tab === "collections") setTab("all"); }}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13px] transition", active ? "bg-brand-50 font-semibold text-brand-800" : "text-zinc-600 hover:bg-zinc-50")}>
                      <Icon className={cn("size-4", active ? "text-brand-600" : "text-zinc-400")} />
                      <span className="flex-1 truncate">{c.key || "All files"}</span>
                      <span className={cn("text-xs tabular-nums", active ? "text-brand-700" : "text-zinc-400")}>{c.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {collections && collections.length > 0 && (
            <div className="hidden lg:block">
              <div className="mb-1.5 px-1 text-xs font-medium text-zinc-500">Collections</div>
              <div className="space-y-1.5 rounded-2xl border border-zinc-100 p-1.5">
                {collections.slice(0, 5).map((c) => (
                  <button key={c.name} onClick={() => { setCollection(collection === c.name ? "" : c.name); if (tab !== "all") setTab("all"); }}
                    className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition", collection === c.name ? "bg-brand-50" : "hover:bg-zinc-50")}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-zinc-900">{c.name}</span>
                      <span className="block text-xs text-zinc-400">{formatDate(c.updatedAt, { day: "numeric", month: "short", year: "numeric" })} · {c.count} files</span>
                    </span>
                    {collection === c.name && <Check className="size-4 text-brand-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {writer && (
            <label className="hidden items-center justify-between gap-3 px-1 text-[13px] text-zinc-600 lg:flex">
              Show archived <Switch checked={showArchived} onChange={setShowArchived} label="Show archived" />
            </label>
          )}

          {writer ? (
            <Button className="mt-1 hidden h-11 w-full rounded-2xl lg:inline-flex" onClick={() => setUploadOpen(true)}><Upload /> Upload material</Button>
          ) : filtersOn ? (
            <Button variant="secondary" className="h-11 w-full rounded-2xl" onClick={resetFilters}>Clear filters</Button>
          ) : null}
        </aside>

        {/* Content */}
        <section className="min-w-0 rounded-3xl bg-white/60 p-3 ring-1 ring-zinc-200/60 sm:p-4">
          {(filtersOn || tab === "featured") && tab !== "collections" && (
            <div className="mb-3 flex flex-wrap items-center gap-2 px-1 text-sm">
              <span className="font-semibold text-zinc-900">{tab === "featured" ? "Featured by marketing" : category || collection || "All files"}</span>
              <span className="text-zinc-400">· {shown?.length ?? "…"}</span>
              {filtersOn && <button onClick={resetFilters} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-soft hover:text-zinc-900"><X className="size-3" /> Clear</button>}
            </div>
          )}

          {tab === "collections" && !collection ? (
            collections === undefined ? <CardGridSkeleton /> : collections.length === 0 ? (
              <EmptyState icon={Layers} title="No collections yet" description={writer ? "Give uploads a collection name (e.g. “Spring 2026”) to group them here." : "The marketing team hasn't grouped any material yet."} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {collections.map((c) => (
                  <Tile key={c.name} title={c.name} subtitle={`${c.count} files · ${editedAgo(c.updatedAt)}`} gradient={gradientFor(c.mainCategory)} coverUrl={c.coverUrl}
                    icon={<GlassFolder />} badgeIcon={Layers} onOpen={() => setCollection(c.name)} />
                ))}
              </div>
            )
          ) : shown === undefined ? <CardGridSkeleton /> : shown.length === 0 ? (
            <EmptyState icon={Layers}
              title={filtersOn ? "Nothing matches these filters" : tab === "featured" ? "Nothing featured yet" : "The studio is empty"}
              description={filtersOn ? "Try another category or clear the search." : writer ? "Upload booklets, brochures, designs and more — directors see them instantly." : "The marketing team hasn't uploaded material yet."}
              action={writer && !filtersOn ? <Button onClick={() => setUploadOpen(true)}><Upload /> Upload material</Button> : filtersOn ? <Button variant="secondary" onClick={resetFilters}>Clear filters</Button> : undefined} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {shown.map((a) => (
                <Tile key={a._id} title={a.name} subtitle={editedAgo(a.updatedAt)} gradient={gradientFor(a.category)}
                  coverUrl={a.coverUrl ?? (kindOf(a.contentType) === "image" ? a.url : null)}
                  video={kindOf(a.contentType) === "video" && !a.coverUrl ? a.url : null}
                  icon={<GlassFile ext={extOf(a.name, a.contentType)} />} badgeIcon={CATEGORY_ICONS[a.category] ?? FileText}
                  flags={<>{a.featured && <span className="grid size-7 place-items-center rounded-full bg-white/90 text-brand-500 shadow-soft backdrop-blur"><Star className="size-3.5 fill-current" /></span>}{Date.now() - a._creationTime < 7 * 86400_000 && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-zinc-800 shadow-soft backdrop-blur">New</span>}</>}
                  onOpen={() => open(a._id)}
                  menu={<AssetMenu a={a} writer={writer} onOpen={() => open(a._id)} onDownload={() => download(a)} onEdit={() => setEditing(a)} onReplace={() => setReplacing(a)} />} />
              ))}
            </div>
          )}
        </section>
      </div>

      {openId && <PreviewDialog id={openId} writer={writer} onClose={() => { params.delete("asset"); setParams(params); }} onDownload={download}
        onEdit={(a) => setEditing(a)} onReplace={(a) => setReplacing(a)} />}
      {(uploadOpen || replacing) && <UploadSheet replaces={replacing} collections={overview?.collections ?? []} properties={properties ?? []} onClose={() => { setUploadOpen(false); setReplacing(null); }} />}
      {editing && <EditSheet a={editing} collections={overview?.collections ?? []} properties={properties ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CardGridSkeleton() {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[300px] rounded-3xl" />)}</div>;
}

// ---------------------------------------------------------------- cards & previews

/** Frosted-glass folder glyph that sits on the gradient backdrop. */
function GlassFolder() {
  return (
    <svg viewBox="0 0 120 96" className="w-[104px] drop-shadow-[0_18px_28px_rgba(24,24,27,0.18)]" aria-hidden>
      <path d="M10 18a10 10 0 0 1 10-10h26c3 0 5.6 1.3 7.5 3.6L60 20h40a10 10 0 0 1 10 10v48a10 10 0 0 1-10 10H20A10 10 0 0 1 10 78Z" fill="rgba(255,255,255,0.55)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
      <path d="M10 34a10 10 0 0 1 10-10h80a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H20A10 10 0 0 1 10 78Z" fill="rgba(255,255,255,0.72)" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" />
    </svg>
  );
}

/** Frosted-glass document glyph with the file extension. */
function GlassFile({ ext }: { ext: string }) {
  return (
    <div className="relative drop-shadow-[0_18px_28px_rgba(24,24,27,0.18)]">
      <svg viewBox="0 0 88 108" className="w-[78px]" aria-hidden>
        <path d="M14 4h40l26 26v64a10 10 0 0 1-10 10H14A10 10 0 0 1 4 94V14A10 10 0 0 1 14 4Z" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" />
        <path d="M54 4v18a8 8 0 0 0 8 8h18" fill="rgba(255,255,255,0.85)" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" />
      </svg>
      <span className="absolute inset-x-0 bottom-5 text-center text-[11px] font-bold tracking-wider text-zinc-700/80">{ext}</span>
    </div>
  );
}

function Tile({ title, subtitle, gradient, coverUrl, video, icon, badgeIcon: BadgeIcon, flags, onOpen, menu }: {
  title: string; subtitle: string; gradient: string; coverUrl?: string | null; video?: string | null; icon: React.ReactNode; badgeIcon: LucideIcon;
  flags?: React.ReactNode; onOpen: () => void; menu?: React.ReactNode;
}) {
  return (
    <article className="group flex h-[300px] flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-zinc-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-pop">
      <button onClick={onOpen} className="relative m-2 mb-0 flex-1 overflow-hidden rounded-[20px] text-left" aria-label={`Open ${title}`}>
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105" style={{ background: gradient }} />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(255,255,255,0.55),transparent)]" />
        {coverUrl ? (
          <img src={coverUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : video ? (
          <video src={`${video}#t=0.5`} muted preload="metadata" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center transition-transform duration-500 group-hover:scale-105">{icon}</div>
        )}
        {video && <span className="absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-white/90 text-zinc-900 shadow-pop backdrop-blur"><Play className="ml-0.5 size-4 fill-current" /></span></span>}
        {flags && <div className="absolute top-3 left-3 flex items-center gap-1.5">{flags}</div>}
      </button>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white shadow-soft"><BadgeIcon className="size-[18px]" /></span>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-zinc-900" title={title}>{title}</span>
          <span className="block truncate text-xs text-zinc-400">{subtitle}</span>
        </button>
        {menu}
      </div>
    </article>
  );
}

function AssetMenu({ a, writer, onOpen, onDownload, onEdit, onReplace }: { a: Asset; writer: boolean; onOpen: () => void; onDownload: () => void; onEdit: () => void; onReplace: () => void }) {
  const [setFeatured] = useAction(api.studio.setFeatured);
  const [setArchived] = useAction(api.studio.setArchived, { success: a.archivedAt ? "Restored" : "Archived" });
  return (
    <Menu>
      <MenuTrigger className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-50 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900" aria-label={`Actions for ${a.name}`}>
        <MoreVertical className="size-4" />
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={onOpen}><Eye /> Preview</MenuItem>
        <MenuItem onSelect={onDownload}><Download /> Download</MenuItem>
        <MenuItem onSelect={() => void copy(`${window.location.origin}/directors/studio?asset=${a._id}`, "Link copied")}><Link2 /> Copy link</MenuItem>
        {writer && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={onEdit}><Pencil /> Edit details</MenuItem>
            <MenuItem onSelect={onReplace}><Upload /> Upload new version</MenuItem>
            {!a.archivedAt && <MenuItem onSelect={() => void setFeatured({ id: a._id, featured: !a.featured })}><Star /> {a.featured ? "Remove from featured" : "Feature"}</MenuItem>}
            <MenuItem danger={!a.archivedAt} onSelect={() => void setArchived({ id: a._id, archived: !a.archivedAt })}>{a.archivedAt ? <><RotateCcw /> Restore</> : <><Archive /> Archive</>}</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

/** Small preview used inside the preview dialog when no in-browser viewer exists. */
function Thumb({ a, className }: { a: Pick<Asset, "name" | "contentType" | "url" | "coverUrl" | "category">; className?: string }) {
  const src = a.coverUrl ?? (kindOf(a.contentType) === "image" ? a.url : null);
  return (
    <div className={cn("relative grid place-items-center overflow-hidden", className)} style={{ background: gradientFor(a.category) }}>
      {src ? <img src={src} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassFile ext={extOf(a.name, a.contentType)} />}
    </div>
  );
}

function PreviewDialog({ id, writer, onClose, onDownload, onEdit, onReplace }: {
  id: Id<"studioAssets">; writer: boolean; onClose: () => void; onDownload: (a: Asset) => void; onEdit: (a: Asset) => void; onReplace: (a: Asset) => void;
}) {
  const a = useQuery(api.studio.get, { id });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [setArchived, archiving] = useAction(api.studio.setArchived);
  const [setFeatured] = useAction(api.studio.setFeatured);
  if (a === undefined) return null;
  if (a === null) return <Dialog open onOpenChange={(o) => !o && onClose()} title="File not found"><p className="text-sm text-zinc-500">It may have been removed.</p></Dialog>;
  const kind = kindOf(a.contentType);
  const shareLink = `${window.location.origin}/directors/studio?asset=${a._id}`;
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()} title={a.name} description={`${a.category}${a.collection ? ` · ${a.collection}` : ""}`} size="xl"
        footer={<>
          <Button variant="ghost" onClick={() => void copy(shareLink, "Link copied — only ONE HUB users can open it")}><Link2 /> Copy link</Button>
          {writer && <Button variant="secondary" onClick={() => onEdit(a)}><Pencil /> Edit details</Button>}
          {writer && <Button variant="secondary" onClick={() => onReplace(a)}><Upload /> New version</Button>}
          <Button onClick={() => onDownload(a)}><Download /> Download</Button>
        </>}>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-xl bg-zinc-100">
            {kind === "image" && a.url ? <img src={a.url} alt={a.name} className="max-h-[62vh] w-auto object-contain" />
              : kind === "video" && a.url ? <video src={a.url} controls className="max-h-[62vh] w-full bg-black" />
              : kind === "pdf" && a.url ? <iframe title={a.name} src={a.url} className="h-[62vh] w-full bg-white" />
              : <div className="w-full"><Thumb a={a} className="h-[320px] w-full" /><p className="p-4 text-center text-sm text-zinc-500">No in-browser preview for this file type — download to open it.</p></div>}
          </div>
          <aside className="space-y-5 text-sm">
            {a.description && <p className="whitespace-pre-wrap text-zinc-700">{a.description}</p>}
            <dl className="space-y-3">
              {[
                ["Type", `${extOf(a.name, a.contentType)} · ${formatBytes(a.size)}`],
                ["Version", `v${a.versionNumber}`],
                ["Property", a.propertyName],
                ["Downloads", String(a.downloads)],
                ["Added", formatDate(a._creationTime, { dateStyle: "medium" })],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-zinc-500">{k}</dt><dd className="text-right font-medium text-zinc-900">{v}</dd></div>
              ))}
            </dl>
            <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3"><Avatar name={a.uploaderName} size="sm" /><div><div className="font-semibold text-zinc-900">{a.uploaderName}</div><div className="text-xs text-zinc-500">Uploaded {timeAgo(a._creationTime)}</div></div></div>
            {a.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{a.tags.map((t) => <Badge key={t}>#{t}</Badge>)}</div>}
            {a.versions.length > 0 && <div><div className="mb-1.5 text-xs font-bold tracking-wider text-zinc-400 uppercase">Earlier versions</div><ul className="space-y-1 text-xs text-zinc-500">{a.versions.map((v) => <li key={v._id}>v{v.versionNumber} · {formatDate(v._creationTime)}</li>)}</ul></div>}
            {writer && (
              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <div className="flex items-center justify-between"><span className="font-medium">Featured</span><Switch checked={a.featured} disabled={!!a.archivedAt} onChange={(v) => void setFeatured({ id: a._id, featured: v })} label="Featured" /></div>
                {a.archivedAt
                  ? <Button variant="secondary" size="sm" className="w-full" loading={archiving} onClick={() => void setArchived({ id: a._id, archived: false })}><RotateCcw /> Restore</Button>
                  : <Button variant="danger-ghost" size="sm" className="w-full" onClick={() => setArchiveOpen(true)}><Archive /> Archive</Button>}
              </div>
            )}
          </aside>
        </div>
      </Dialog>
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} danger title="Archive this file?" confirmLabel="Archive" loading={archiving}
        description="It will be hidden from directors but can be restored from the Archived tab." onConfirm={() => void setArchived({ id: a._id, archived: true }).then(() => { setArchiveOpen(false); onClose(); })} />
    </>
  );
}

// ---------------------------------------------------------------- upload & edit

type Meta = { category: string; collection: string; propertyId: string; tags: string; description: string; featured: boolean };

function MetaFields({ m, set, collections, properties, showName, name, setName }: {
  m: Meta; set: (m: Meta) => void; collections: string[]; properties: { _id: Id<"properties">; name: string }[]; showName?: boolean; name?: string; setName?: (v: string) => void;
}) {
  const cats = Object.keys(CATEGORY_ICONS);
  return (
    <div className="space-y-4">
      {showName && <Field label="Name" required><Input value={name} onChange={(e) => setName?.(e.target.value)} /></Field>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" required><Select value={m.category} onChange={(e) => set({ ...m, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Collection" hint="Group material, e.g. a campaign"><Input list="studio-collections" value={m.collection} onChange={(e) => set({ ...m, collection: e.target.value })} placeholder="e.g. Spring 2026" /><datalist id="studio-collections">{collections.map((c) => <option key={c} value={c} />)}</datalist></Field>
        {properties.length > 0 && <Field label="Property"><Select value={m.propertyId} onChange={(e) => set({ ...m, propertyId: e.target.value })}><option value="">Portfolio-wide</option>{properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>}
        <Field label="Tags" hint="Comma separated"><Input value={m.tags} onChange={(e) => set({ ...m, tags: e.target.value })} placeholder="leasing, southdale" /></Field>
      </div>
      <Field label="Description"><Textarea className="min-h-20" value={m.description} onChange={(e) => set({ ...m, description: e.target.value })} placeholder="What is it and when should directors use it?" /></Field>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-zinc-50 p-3">
        <div className="text-sm"><div className="font-medium">Feature at the top of the studio</div><div className="text-xs text-zinc-500">Highlights key material for directors.</div></div>
        <Switch checked={m.featured} onChange={(v) => set({ ...m, featured: v })} label="Featured" />
      </div>
    </div>
  );
}

const metaArgs = (m: Meta) => ({
  category: m.category, collection: m.collection || undefined, propertyId: (m.propertyId || undefined) as Id<"properties"> | undefined,
  tags: m.tags.split(",").map((t) => t.trim()).filter(Boolean), description: m.description || undefined, featured: m.featured,
});

function UploadSheet({ replaces, collections, properties, onClose }: { replaces: Asset | null; collections: string[]; properties: { _id: Id<"properties">; name: string }[]; onClose: () => void }) {
  const genUrl = useMutation(api.studio.generateUploadUrl);
  const create = useMutation(api.studio.create);
  const [files, setFiles] = useState<File[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [name, setName] = useState(replaces?.name ?? "");
  const [notifyDirectors, setNotify] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [m, setM] = useState<Meta>({
    category: replaces?.category ?? "Brochures", collection: replaces?.collection ?? "", propertyId: replaces?.propertyId ?? "",
    tags: replaces?.tags.join(", ") ?? "", description: replaces?.description ?? "", featured: replaces?.featured ?? false,
  });
  const single = files.length === 1 || !!replaces;
  const total = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const add = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (f.size > 250 * 1024 * 1024) { toast.error(`${f.name} is larger than 250 MB`); return false; }
      return true;
    });
    setFiles((cur) => (replaces ? picked.slice(0, 1) : [...cur, ...picked].slice(0, 25)));
    if (picked.length === 1 && !name) setName(picked[0].name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!files.length) return toast.error("Choose at least one file.");
    try {
      let coverStorageId: Id<"_storage"> | undefined;
      if (cover && single) {
        setBusy("Uploading cover image…");
        coverStorageId = (await uploadFile(await genUrl(), cover)) as Id<"_storage">;
      }
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
        const storageId = (await uploadFile(await genUrl(), f)) as Id<"_storage">;
        await create({
          ...metaArgs(m),
          name: single && name.trim() ? name.trim() : f.name.replace(/\.[^.]+$/, ""),
          storageId,
          coverStorageId,
          replacesId: replaces?._id,
          // One notification per batch, not per file.
          notifyDirectors: notifyDirectors && i === files.length - 1,
        });
      }
      toast.success(replaces ? "New version published" : `${files.length} file(s) added to the studio`, { description: notifyDirectors ? "Directors have been notified." : undefined });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && !busy && onClose()} wide title={replaces ? `New version of “${replaces.name}”` : "Upload marketing material"}
      description={replaces ? "The current file moves to version history." : "Booklets, brochures, designs, presentations, videos, brand files…"}
      footer={<>
        <Button variant="ghost" disabled={!!busy} onClick={onClose}>Cancel</Button>
        <Button disabled={!files.length || !!busy} onClick={() => void submit()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />}{replaces ? "Publish new version" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}</Button>
      </>}>
      <div className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition", drag ? "border-brand-400 bg-brand-50" : "border-zinc-200 hover:border-brand-300 hover:bg-brand-50/40")}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-soft"><Upload className="size-5" /></span>
          <span className="text-sm font-semibold text-zinc-900">Drag & drop files here, or click to browse</span>
          <span className="text-xs text-zinc-500">PDF, InDesign/Illustrator/PSD, Office, images, MP4 video, ZIP, fonts · up to 250 MB each{!replaces && " · up to 25 at once"}</span>
          <input ref={input} type="file" hidden multiple={!replaces} onChange={(e) => add(e.target.files)} />
        </div>

        {files.length > 0 && (
          <ul className="divide-y divide-zinc-100 rounded-xl bg-zinc-50 px-3">
            {files.map((f, i) => (
              <li key={f.name + i} className="flex items-center gap-3 py-2 text-sm">
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 shadow-soft">{extOf(f.name, f.type)}</span>
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-zinc-500">{formatBytes(f.size)}</span>
                {!busy && <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-700" aria-label={`Remove ${f.name}`}><X className="size-3.5" /></button>}
              </li>
            ))}
            <li className="py-2 text-right text-xs text-zinc-500">{files.length} file(s) · {formatBytes(total)}</li>
          </ul>
        )}
        {busy && <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">{busy}</p>}

        <MetaFields m={m} set={setM} collections={collections} properties={properties} showName={single} name={name} setName={setName} />

        {single && (
          <Field label="Cover image (optional)" hint="Shown as the preview for PDFs, design files and videos.">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200/70">
              <ImageIcon className="size-4 text-zinc-500" />
              <span className="flex-1 truncate">{cover ? cover.name : "Choose an image"}</span>
              {cover && <button type="button" onClick={(e) => { e.preventDefault(); setCover(null); }} className="text-xs text-zinc-500 hover:text-zinc-900">Remove</button>}
              <input type="file" hidden accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl bg-zinc-50 p-3">
          <div className="text-sm"><div className="font-medium">Notify directors</div><div className="text-xs text-zinc-500">Sends one in-app notification for this upload.</div></div>
          <Switch checked={notifyDirectors} onChange={setNotify} label="Notify directors" />
        </div>
      </div>
    </Sheet>
  );
}

function EditSheet({ a, collections, properties, onClose }: { a: Asset; collections: string[]; properties: { _id: Id<"properties">; name: string }[]; onClose: () => void }) {
  const [name, setName] = useState(a.name);
  const [m, setM] = useState<Meta>({ category: a.category, collection: a.collection ?? "", propertyId: a.propertyId ?? "", tags: a.tags.join(", "), description: a.description ?? "", featured: a.featured });
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const genUrl = useMutation(api.studio.generateUploadUrl);
  const [update, saving] = useAction(api.studio.update, { success: "Details saved" });
  const [uploading, setUploading] = useState(false);
  const save = async () => {
    let coverStorageId: Id<"_storage"> | null | undefined;
    if (cover) {
      setUploading(true);
      try { coverStorageId = (await uploadFile(await genUrl(), cover)) as Id<"_storage">; } catch (e) { toast.error(errorMessage(e)); setUploading(false); return; }
      setUploading(false);
    } else if (removeCover) coverStorageId = null;
    const r = await update({ id: a._id, expectedVersion: a.version, name, ...metaArgs(m), coverStorageId });
    if (r !== undefined) onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} wide title="Edit details"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={saving || uploading} onClick={() => void save()}>Save changes</Button></>}>
      <div className="space-y-5">
        <MetaFields m={m} set={setM} collections={collections} properties={properties} showName name={name} setName={setName} />
        <Field label="Cover image">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200/70">
            <ImageIcon className="size-4 text-zinc-500" />
            <span className="flex-1 truncate">{cover ? cover.name : a.coverUrl && !removeCover ? "Current cover image" : "No cover — choose an image"}</span>
            {a.coverUrl && !cover && !removeCover && <button type="button" onClick={(e) => { e.preventDefault(); setRemoveCover(true); }} className="text-xs text-zinc-500 hover:text-zinc-900">Remove</button>}
            <input type="file" hidden accept="image/*" onChange={(e) => { setCover(e.target.files?.[0] ?? null); setRemoveCover(false); }} />
          </label>
        </Field>
      </div>
    </Sheet>
  );
}
