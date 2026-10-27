import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen, Newspaper, PenTool, Share2, Presentation, Film, Camera, Gem, LayoutTemplate, FileText, Upload, Download,
  Eye, Star, Pencil, Archive, RotateCcw, Link2, LayoutGrid, List, Play, Loader2, X, Image as ImageIcon, Sparkles, Layers,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SearchInput, EmptyState, Skeleton, Tabs, Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, Sheet, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, Switch } from "@/components/ui/input";
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

const kindOf = (t: string): Kind => (t.startsWith("image/") ? "image" : t.startsWith("video/") ? "video" : t === "application/pdf" ? "pdf" : "other");
const extOf = (name: string, type: string) => (name.includes(".") ? name.split(".").pop()! : type.split("/").pop()!).slice(0, 5).toUpperCase();

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

export default function StudioPage() {
  const can = useCan();
  const writer = can("studio.write");
  const [params, setParams] = useSearchParams();
  const overview = useQuery(api.studio.overview);
  const featured = useQuery(api.studio.featured);
  const properties = useQuery(api.properties.options, can("properties.read") ? {} : "skip");
  const [category, setCategory] = useState("");
  const [collection, setCollection] = useState("");
  const [kind, setKind] = useState<"" | Kind>("");
  const [sort, setSort] = useState<"newest" | "name" | "popular">("newest");
  const [tab, setTab] = useState<"library" | "archived">("library");
  const [view, setView] = useState<"grid" | "list">(() => {
    try { return (localStorage.getItem("onehub.studio.view") as "grid" | "list") || "grid"; } catch { return "grid"; }
  });
  const [search, setSearch] = useState("");
  const dq = useDebounced(search);
  const assets = useQuery(api.studio.list, {
    search: dq || undefined, category: category || undefined, collection: collection || undefined,
    kind: kind || undefined, sort, archived: tab === "archived",
  });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [replacing, setReplacing] = useState<Asset | null>(null);
  const openId = params.get("asset") as Id<"studioAssets"> | null;
  const recordDownload = useMutation(api.studio.recordDownload);

  useEffect(() => {
    try { localStorage.setItem("onehub.studio.view", view); } catch { /* ignore */ }
  }, [view]);

  const open = (id: Id<"studioAssets">) => { params.set("asset", id); setParams(params); };
  const download = (a: Asset) => { void recordDownload({ id: a._id }); void downloadAsset(a); };
  const filtersOn = !!(category || collection || kind || dq);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -top-40 -right-40 size-80 rounded-full border-[40px] border-brand-500/20" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-300"><Sparkles className="size-3.5" /> Marketing Studio</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">Every booklet, brochure and design — in one place.</h1>
            <p className="mt-2 text-sm text-zinc-400">The marketing team's approved material for ONE Property Holdings. Preview anything in the browser and download the latest version in one click.</p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            {overview && (
              <dl className="grid grid-cols-3 gap-6 text-sm">
                <div><dt className="text-zinc-400">Files</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{overview.total}</dd></div>
                <div><dt className="text-zinc-400">New this week</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{overview.newThisWeek}</dd></div>
                <div><dt className="text-zinc-400">Downloads</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{overview.downloads}</dd></div>
              </dl>
            )}
            {writer && <Button size="lg" onClick={() => setUploadOpen(true)}><Upload /> Upload material</Button>}
          </div>
        </div>
      </section>

      {/* Categories — ten equal tiles */}
      <section aria-label="Categories" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(overview?.categories ?? Array.from({ length: 10 }, (_, i) => ({ key: String(i), hint: "", count: 0 }))).map((c) => {
          const Icon = CATEGORY_ICONS[c.key] ?? FileText;
          const active = category === c.key;
          if (!overview) return <Skeleton key={c.key} className="h-[104px] rounded-2xl" />;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(active ? "" : c.key)}
              aria-pressed={active}
              className={cn(
                "group flex h-[104px] flex-col justify-between rounded-2xl p-4 text-left transition-all",
                active ? "bg-brand-500 text-white shadow-soft" : "bg-white shadow-card hover:-translate-y-0.5 hover:shadow-pop",
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn("grid size-9 place-items-center rounded-xl", active ? "bg-white text-zinc-900" : "bg-brand-50 text-brand-600")}><Icon className="size-[18px]" /></span>
                <span className={cn("text-lg font-bold tabular-nums", active ? "text-white" : "text-zinc-900")}>{c.count}</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.key}</div>
                <div className={cn("truncate text-xs", active ? "text-white/80" : "text-zinc-500")}>{c.hint}</div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Featured */}
      {!filtersOn && tab === "library" && featured && featured.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900"><Star className="size-4 fill-brand-500 text-brand-500" /> Featured by marketing</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.slice(0, 4).map((a) => <AssetCard key={a._id} a={a} onOpen={() => open(a._id)} onDownload={() => download(a)} />)}
          </div>
        </section>
      )}

      {/* Library */}
      <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-zinc-900"><Layers className="size-4 text-zinc-400" /> {category || "All material"}</div>
      <section className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-card lg:flex-row lg:items-center">
        {writer && <Tabs value={tab} onChange={setTab} items={[{ value: "library", label: "Library" }, { value: "archived", label: "Archived" }]} />}
        <SearchInput className="lg:w-72" value={search} onChange={setSearch} placeholder="Search name, tag, collection…" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:justify-end">
          <Select aria-label="Collection" className="lg:w-44" value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">All collections</option>
            {overview?.collections.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select aria-label="File type" className="lg:w-36" value={kind} onChange={(e) => setKind(e.target.value as "" | Kind)}>
            <option value="">All types</option><option value="pdf">PDFs</option><option value="image">Images</option><option value="video">Videos</option><option value="other">Other files</option>
          </Select>
          <Select aria-label="Sort" className="lg:w-40" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="popular">Most downloaded</option>
          </Select>
          <div className="hidden items-center gap-1 rounded-xl bg-zinc-100 p-1 sm:flex">
            {(["grid", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn("grid size-8 place-items-center rounded-lg transition", view === v ? "bg-white text-zinc-900 shadow-soft" : "text-zinc-500 hover:text-zinc-900")}>
                {v === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtersOn && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">{assets?.length ?? "…"} result(s)</span>
          {category && <FilterChip label={category} onClear={() => setCategory("")} />}
          {collection && <FilterChip label={collection} onClear={() => setCollection("")} />}
          {kind && <FilterChip label={kind.toUpperCase()} onClear={() => setKind("")} />}
          {dq && <FilterChip label={`“${dq}”`} onClear={() => setSearch("")} />}
        </div>
      )}

      {/* Library */}
      {assets === undefined ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[300px] rounded-2xl" />)}</div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card">
          <EmptyState icon={Layers} title={filtersOn ? "Nothing matches these filters" : tab === "archived" ? "No archived files" : "The studio is empty"}
            description={filtersOn ? "Try another category or clear the search." : writer ? "Upload booklets, brochures, designs and more — directors see them instantly." : "The marketing team hasn't uploaded material yet."}
            action={!filtersOn && writer && tab === "library" ? <Button onClick={() => setUploadOpen(true)}><Upload /> Upload material</Button> : undefined} />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {assets.map((a) => <AssetCard key={a._id} a={a} onOpen={() => open(a._id)} onDownload={() => download(a)} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
              <tr><th className="px-5 py-3">File</th><th className="hidden px-5 py-3 md:table-cell">Category</th><th className="hidden px-5 py-3 lg:table-cell">Size</th><th className="hidden px-5 py-3 lg:table-cell">Added</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a._id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-5 py-3">
                    <button onClick={() => open(a._id)} className="flex items-center gap-3 text-left">
                      <Thumb a={a} className="size-11 shrink-0 rounded-lg" small />
                      <span className="min-w-0"><span className="block truncate font-semibold text-zinc-900">{a.name}</span><span className="block truncate text-xs text-zinc-500">{a.collection ?? a.description ?? "—"}</span></span>
                    </button>
                  </td>
                  <td className="hidden px-5 py-3 text-zinc-600 md:table-cell">{a.category}</td>
                  <td className="hidden px-5 py-3 text-zinc-500 lg:table-cell">{formatBytes(a.size)}</td>
                  <td className="hidden px-5 py-3 text-zinc-500 lg:table-cell">{timeAgo(a._creationTime)}</td>
                  <td className="px-5 py-3"><div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => open(a._id)} aria-label="Preview"><Eye /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => download(a)} aria-label="Download"><Download /></Button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && <PreviewDialog id={openId} writer={writer} onClose={() => { params.delete("asset"); setParams(params); }} onDownload={download}
        onEdit={(a) => setEditing(a)} onReplace={(a) => setReplacing(a)} />}
      {(uploadOpen || replacing) && <UploadSheet replaces={replacing} collections={overview?.collections ?? []} properties={properties ?? []} onClose={() => { setUploadOpen(false); setReplacing(null); }} />}
      {editing && <EditSheet a={editing} collections={overview?.collections ?? []} properties={properties ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white py-1 pr-1.5 pl-3 text-xs font-semibold text-zinc-700 shadow-soft">
      {label}
      <button onClick={onClear} className="grid size-5 place-items-center rounded-full hover:bg-zinc-100" aria-label={`Clear ${label}`}><X className="size-3" /></button>
    </span>
  );
}

// ---------------------------------------------------------------- cards & previews

function Thumb({ a, className, small }: { a: Pick<Asset, "name" | "contentType" | "url" | "coverUrl" | "category">; className?: string; small?: boolean }) {
  const kind = kindOf(a.contentType);
  const Icon = CATEGORY_ICONS[a.category] ?? FileText;
  const src = a.coverUrl ?? (kind === "image" ? a.url : null);
  return (
    <div className={cn("relative overflow-hidden bg-zinc-100", className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : kind === "video" && a.url ? (
        <video src={`${a.url}#t=0.5`} muted preload="metadata" className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-br from-zinc-50 to-zinc-200/70">
          <div className="flex flex-col items-center gap-2">
            <Icon className={cn("text-zinc-400", small ? "size-5" : "size-9")} />
            {!small && <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold tracking-wide text-zinc-600 shadow-soft">{extOf(a.name, a.contentType)}</span>}
          </div>
        </div>
      )}
      {kind === "video" && !small && (
        <span className="absolute inset-0 grid place-items-center"><span className="grid size-11 place-items-center rounded-full bg-white/90 text-zinc-900 shadow-pop"><Play className="ml-0.5 size-4 fill-current" /></span></span>
      )}
    </div>
  );
}

function AssetCard({ a, onOpen, onDownload }: { a: Asset; onOpen: () => void; onDownload: () => void }) {
  const isNew = Date.now() - a._creationTime < 7 * 86400_000;
  return (
    <article className="group flex h-[300px] flex-col overflow-hidden rounded-2xl bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop">
      <button onClick={onOpen} className="relative h-[160px] shrink-0 text-left" aria-label={`Preview ${a.name}`}>
        <Thumb a={a} className="size-full" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isNew && <Badge tone="brand" className="bg-brand-500 text-white ring-0">New</Badge>}
          {a.featured && <span className="grid size-6 place-items-center rounded-full bg-white text-brand-500 shadow-soft"><Star className="size-3.5 fill-current" /></span>}
        </div>
        <span className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition group-hover:bg-ink/35 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-pop"><Eye className="size-3.5" /> Preview</span>
        </span>
      </button>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-3.5 pb-4">
        <div className="text-[11px] font-bold tracking-wider text-brand-600 uppercase">{a.category}{a.versionNumber > 1 && <span className="ml-1.5 text-zinc-400">v{a.versionNumber}</span>}</div>
        <button onClick={onOpen} className="mt-1 line-clamp-2 text-left text-sm leading-5 font-semibold text-zinc-900 hover:text-brand-700" title={a.name}>{a.name}</button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="truncate text-xs text-zinc-500">{extOf(a.name, a.contentType)} · {formatBytes(a.size)} · {timeAgo(a._creationTime)}</span>
          <Button size="icon-sm" variant="secondary" onClick={onDownload} aria-label={`Download ${a.name}`}><Download /></Button>
        </div>
      </div>
    </article>
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
