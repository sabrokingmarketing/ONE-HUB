import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { FolderOpen, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, SearchInput, EmptyState, Skeleton, Tabs } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, Switch } from "@/components/ui/input";
import { AssetGrid, type Asset } from "@/components/AssetGrid";
import { useAction, useDebounced, uploadFile } from "@/lib/hooks";
import { errorMessage, formatBytes } from "@/lib/utils";

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [archived, setArchived] = useState<"active" | "archived">("active");
  const dq = useDebounced(search);
  const categories = useQuery(api.assets.categories);
  const properties = useQuery(api.properties.options);
  const assets = useQuery(api.assets.list, { search: dq || undefined, category: category || undefined, archived: archived === "archived" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [setArchivedM] = useAction(api.assets.setArchived);
  useEffect(() => { if (params.get("upload") === "1") { setUploadOpen(true); params.delete("upload"); setParams(params, { replace: true }); } }, [params, setParams]);

  return (
    <>
      <PageHeader eyebrow="Marketing" title="Marketing library" description="Brochures, presentations, videos, logos and templates — in one secure place." actions={<Button onClick={() => setUploadOpen(true)}><Upload /> Upload</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={archived} onChange={setArchived} items={[{ value: "active", label: "Library" }, { value: "archived", label: "Archived" }]} />
        <Select className="sm:w-60" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories?.map((c) => <option key={c}>{c}</option>)}</Select>
        <SearchInput className="sm:ml-auto sm:w-80" value={search} onChange={setSearch} placeholder="Search name, tag, folder…" />
      </div>
      {assets === undefined ? <Skeleton className="h-64 rounded-2xl" /> : assets.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-stone-200/70"><EmptyState icon={FolderOpen} title="Nothing here yet" action={<Button onClick={() => setUploadOpen(true)}><Upload /> Upload files</Button>} /></div>
      ) : <AssetGrid assets={assets} onEdit={setEditing} onArchive={(a, v) => void setArchivedM({ id: a._id, archived: v })} />}
      {(uploadOpen || editing) && <AssetSheet key={editing?._id ?? "new"} asset={editing} categories={categories ?? []} properties={properties ?? []} onClose={() => { setUploadOpen(false); setEditing(null); }} />}
    </>
  );
}

function AssetSheet({ asset, categories, properties, onClose }: { asset: Asset | null; categories: string[]; properties: { _id: Id<"properties">; name: string }[]; onClose: () => void }) {
  const genUrl = useMutation(api.assets.generateUploadUrl);
  const create = useMutation(api.assets.create);
  const [update, updating] = useAction(api.assets.update, { success: "Details saved" });
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [f, setF] = useState({
    name: asset?.name ?? "", description: asset?.description ?? "", category: asset?.category ?? categories[0] ?? "Campaign Assets", folder: asset?.folder ?? "",
    tags: asset?.tags.join(", ") ?? "", propertyId: asset?.propertyId ?? "", shared: asset?.audience === "company",
  });
  const meta = () => ({ description: f.description || undefined, category: f.category, folder: f.folder || undefined, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), propertyId: (f.propertyId || undefined) as Id<"properties"> | undefined, audience: (f.shared ? "company" : "marketing") as "company" | "marketing" });

  const doUpload = async () => {
    if (!files.length) return toast.error("Choose at least one file.");
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const sid = (await uploadFile(await genUrl(), file)) as Id<"_storage">;
        await create({ storageId: sid, name: files.length === 1 && f.name ? f.name : file.name, replacesId: asset?._id, ...meta() });
      }
      toast.success(asset ? "New version uploaded" : `${files.length} file(s) uploaded`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={asset ? `Edit “${asset.name}”` : "Upload to library"}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {asset && <Button variant="secondary" loading={updating} onClick={() => void update({ id: asset._id, name: f.name, ...meta() }).then((r) => r !== undefined && onClose())}>Save details</Button>}
        <Button disabled={!files.length || !!progress} onClick={() => void doUpload()}>{progress ? <Loader2 className="animate-spin" /> : <Upload />}{asset ? "Upload new version" : "Upload"}</Button>
      </>}>
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 p-6 text-center hover:border-brand-300">
          <Upload className="size-5 text-stone-400" />
          <span className="text-sm font-medium">{files.length ? `${files.length} file(s) selected` : asset ? "Choose a replacement file (optional)" : "Choose files"}</span>
          <span className="text-xs text-stone-500">PDF, Office, images, video, ZIP · max 200 MB each</span>
          <input type="file" hidden multiple={!asset} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        {files.length > 0 && <ul className="space-y-1 text-xs text-stone-600">{files.map((x) => <li key={x.name}>{x.name} · {formatBytes(x.size)}</li>)}</ul>}
        {progress && <p className="text-xs text-brand-700">{progress}</p>}
        {(asset || files.length <= 1) && <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Defaults to file name" /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Folder"><Input value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} placeholder="e.g. 2026 / Q4" /></Field>
          <Field label="Property"><Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}><option value="">—</option>{properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          <Field label="Tags" hint="Comma separated"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        </div>
        <Field label="Description"><Textarea className="min-h-16" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 p-3">
          <div className="text-sm"><div className="font-medium">Share with directors</div><div className="text-xs text-stone-500">Appears under Directors → Documents.</div></div>
          <Switch checked={f.shared} onChange={(v) => setF({ ...f, shared: v })} label="Share with directors" />
        </div>
      </div>
    </Sheet>
  );
}
