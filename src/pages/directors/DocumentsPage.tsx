import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { FileText, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, SearchInput, EmptyState, Skeleton, Tabs } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { DocumentGrid, type DocumentItem } from "@/components/DocumentGrid";
import { useAction, useDebounced, uploadFile } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { errorMessage, formatBytes } from "@/lib/utils";

export default function DocumentsPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [archived, setArchived] = useState<"active" | "archived">("active");
  const dq = useDebounced(search);
  const categories = useQuery(api.documents.categories);
  const properties = useQuery(api.properties.options);
  const docs = useQuery(api.documents.list, { search: dq || undefined, category: category || undefined, archived: archived === "archived" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [setArchivedM] = useAction(api.documents.setArchived);
  const editable = can("documents.write");
  useEffect(() => {
    if (params.get("upload") === "1") { setUploadOpen(true); params.delete("upload"); setParams(params, { replace: true }); }
  }, [params, setParams]);

  return (
    <>
      <PageHeader title="Shared documents" description="Company documents for every director. Files are served through private, unguessable links."
        actions={editable && <Button onClick={() => setUploadOpen(true)}><Upload /> Upload</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={archived} onChange={setArchived} items={[{ value: "active", label: "Documents" }, { value: "archived", label: "Archived" }]} />
        <Select className="sm:w-60" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories?.map((c) => <option key={c}>{c}</option>)}</Select>
        <SearchInput className="sm:ml-auto sm:w-80" value={search} onChange={setSearch} placeholder="Search name, tag, folder…" />
      </div>
      {docs === undefined ? <Skeleton className="h-64 rounded-2xl" /> : docs.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-card"><EmptyState icon={FileText} title="No documents yet" description="Upload brochures, presentations, leases and templates to share them with every director." action={editable ? <Button onClick={() => setUploadOpen(true)}><Upload /> Upload files</Button> : undefined} /></div>
      ) : <DocumentGrid documents={docs} onEdit={editable ? setEditing : undefined} onArchive={editable ? (a, v) => void setArchivedM({ id: a._id, archived: v }) : undefined} />}
      {(uploadOpen || editing) && <DocumentSheet key={editing?._id ?? "new"} doc={editing} categories={categories ?? []} properties={properties ?? []} onClose={() => { setUploadOpen(false); setEditing(null); }} />}
    </>
  );
}

function DocumentSheet({ doc, categories, properties, onClose }: { doc: DocumentItem | null; categories: string[]; properties: { _id: Id<"properties">; name: string }[]; onClose: () => void }) {
  const genUrl = useMutation(api.documents.generateUploadUrl);
  const create = useMutation(api.documents.create);
  const [update, updating] = useAction(api.documents.update, { success: "Details saved" });
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [f, setF] = useState({
    name: doc?.name ?? "", description: doc?.description ?? "", category: doc?.category ?? categories[0] ?? "Internal Documents", folder: doc?.folder ?? "",
    tags: doc?.tags.join(", ") ?? "", propertyId: doc?.propertyId ?? "",
  });
  const meta = () => ({ description: f.description || undefined, category: f.category, folder: f.folder || undefined, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), propertyId: (f.propertyId || undefined) as Id<"properties"> | undefined });

  const doUpload = async () => {
    if (!files.length) return toast.error("Choose at least one file.");
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
        const sid = (await uploadFile(await genUrl(), file)) as Id<"_storage">;
        await create({ storageId: sid, name: files.length === 1 && f.name ? f.name : file.name, replacesId: doc?._id, ...meta() });
      }
      toast.success(doc ? "New version uploaded" : `${files.length} file(s) uploaded`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={doc ? `Edit “${doc.name}”` : "Upload documents"}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        {doc && <Button variant="secondary" loading={updating} onClick={() => void update({ id: doc._id, name: f.name, ...meta() }).then((r) => r !== undefined && onClose())}>Save details</Button>}
        <Button disabled={!files.length || !!progress} onClick={() => void doUpload()}>{progress ? <Loader2 className="animate-spin" /> : <Upload />}{doc ? "Upload new version" : "Upload"}</Button>
      </>}>
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center transition hover:border-brand-300 hover:bg-brand-50/30">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-500 text-white shadow-soft"><Upload className="size-5" /></span>
          <span className="text-sm font-semibold">{files.length ? `${files.length} file(s) selected` : doc ? "Choose a replacement file (optional)" : "Choose files"}</span>
          <span className="text-xs text-zinc-500">PDF, Office, images, video, ZIP · max 200 MB each</span>
          <input type="file" hidden multiple={!doc} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        {files.length > 0 && <ul className="space-y-1 text-xs text-zinc-600">{files.map((x) => <li key={x.name}>{x.name} · {formatBytes(x.size)}</li>)}</ul>}
        {progress && <p className="text-xs text-brand-700">{progress}</p>}
        {(doc || files.length <= 1) && <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Defaults to file name" /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Folder"><Input value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} placeholder="e.g. 2026 / Q4" /></Field>
          <Field label="Property"><Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}><option value="">—</option>{properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          <Field label="Tags" hint="Comma separated"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        </div>
        <Field label="Description"><Textarea className="min-h-16" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}
