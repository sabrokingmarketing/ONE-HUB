import { FileText, Film, Image as ImageIcon, Presentation, FileSpreadsheet, File, Download, ExternalLink, MoreHorizontal, Archive, Pencil, RotateCcw } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { formatBytes, timeAgo } from "@/lib/utils";

export type DocumentItem = FunctionReturnType<typeof api.documents.list>[number];

export function documentIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Film;
  if (type.includes("presentation") || type.includes("powerpoint")) return Presentation;
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return FileSpreadsheet;
  if (type.includes("pdf") || type.includes("word") || type.startsWith("text/")) return FileText;
  return File;
}

export function DocumentGrid({ documents, onEdit, onArchive }: { documents: DocumentItem[]; onEdit?: (a: DocumentItem) => void; onArchive?: (a: DocumentItem, archived: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {documents.map((a) => {
        const Icon = documentIcon(a.contentType);
        return (
          <div key={a._id} className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
            <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] bg-zinc-100">
              {a.contentType.startsWith("image/") && a.url ? (
                <img src={a.url} alt={a.name} loading="lazy" className="size-full object-cover" />
              ) : a.contentType.startsWith("video/") && a.url ? (
                <video src={a.url} muted preload="metadata" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center"><Icon className="size-10 text-zinc-300" /></div>
              )}
              <span className="absolute top-2 left-2"><Badge tone="dark" className="opacity-90">{a.contentType.split("/")[1]?.split(".").pop()?.slice(0, 6).toUpperCase()}</Badge></span>
            </a>
            <div className="flex items-start gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900" title={a.name}>{a.name}</div>
                <div className="truncate text-xs text-zinc-500">{a.category} · {formatBytes(a.size)} · {timeAgo(a._creationTime)}</div>
                {a.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{a.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-600">#{t}</span>)}</div>}
              </div>
              <Menu>
                <MenuTrigger className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100" aria-label="File actions"><MoreHorizontal className="size-4" /></MenuTrigger>
                <MenuContent>
                  {a.url && <MenuItem onSelect={() => window.open(a.url!, "_blank", "noopener")}><ExternalLink /> Open preview</MenuItem>}
                  {a.url && <MenuItem onSelect={() => { const l = document.createElement("a"); l.href = a.url!; l.download = a.name; l.click(); }}><Download /> Download</MenuItem>}
                  {onEdit && <MenuItem onSelect={() => onEdit(a)}><Pencil /> Edit details / new version</MenuItem>}
                  {onArchive && (a.archivedAt ? <MenuItem onSelect={() => onArchive(a, false)}><RotateCcw /> Restore</MenuItem> : <MenuItem danger onSelect={() => onArchive(a, true)}><Archive /> Archive</MenuItem>)}
                </MenuContent>
              </Menu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
