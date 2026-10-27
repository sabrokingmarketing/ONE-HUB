import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Lightbulb, MoreHorizontal, Trash2, Target, Share2, ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuSeparator, MenuLabel } from "@/components/ui/menu";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { cn } from "@/lib/utils";

type Status = Doc<"marketingIdeas">["status"];
const COLUMNS: { status: Status; label: string; tone: string }[] = [
  { status: "new", label: "New ideas", tone: "bg-brand-500" }, { status: "under_review", label: "Under review", tone: "bg-amber-500" }, { status: "approved", label: "Approved", tone: "bg-emerald-500" },
  { status: "in_production", label: "In production", tone: "bg-violet-500" }, { status: "scheduled", label: "Scheduled", tone: "bg-sky-500" }, { status: "completed", label: "Completed", tone: "bg-stone-400" },
];

export default function IdeasPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ideas = useQuery(api.ideas.list);
  const properties = useQuery(api.properties.options);
  const [move] = useAction(api.ideas.move);
  const [remove] = useAction(api.ideas.remove, { success: "Idea deleted" });
  const [convert] = useAction(api.ideas.convert);
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  useEffect(() => { if (params.get("new") === "1") { setOpen(true); params.delete("new"); setParams(params, { replace: true }); } }, [params, setParams]);
  const editable = can("ideas.write");

  return (
    <>
      <PageHeader eyebrow="Ideas" title="Ideas board" description="Capture ideas, review them together, and turn approved ones into campaigns or posts." actions={editable && <Button onClick={() => setOpen(true)}><Plus /> Add idea</Button>} />
      {ideas === undefined ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {COLUMNS.map((col) => {
            const items = ideas.filter((i) => i.status === col.status);
            return (
              <div key={col.status} className={cn("flex w-72 shrink-0 snap-start flex-col rounded-2xl bg-stone-100/80 p-3 transition", dragOver === col.status && "bg-brand-50 ring-2 ring-brand-300")}
                onDragOver={(e) => { if (editable) { e.preventDefault(); setDragOver(col.status); } }} onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/plain") as Id<"marketingIdeas">; if (id) void move({ id, status: col.status }); }}>
                <div className="mb-3 flex items-center gap-2 px-1"><span className={cn("size-2 rounded-full", col.tone)} /><span className="text-sm font-semibold">{col.label}</span><span className="ml-auto text-xs text-stone-500">{items.length}</span></div>
                <div className="min-h-24 space-y-2">
                  {items.map((i) => (
                    <div key={i._id} draggable={editable} onDragStart={(e) => e.dataTransfer.setData("text/plain", i._id)} className="cursor-grab rounded-xl bg-white p-3 shadow-card ring-1 ring-stone-200/70 active:cursor-grabbing">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 text-sm font-medium text-stone-900">{i.title}</div>
                        {editable && (
                          <Menu>
                            <MenuTrigger className="-mt-1 -mr-1 rounded-lg p-1 text-stone-400 hover:bg-stone-100" aria-label="Idea actions"><MoreHorizontal className="size-4" /></MenuTrigger>
                            <MenuContent>
                              <MenuLabel>Move to</MenuLabel>
                              {COLUMNS.filter((c) => c.status !== i.status).map((c) => <MenuItem key={c.status} onSelect={() => void move({ id: i._id, status: c.status })}><ArrowRight /> {c.label}</MenuItem>)}
                              {i.status === "approved" && <><MenuSeparator /><MenuItem onSelect={() => void convert({ id: i._id, to: "campaign" }).then((r) => r && navigate(`/marketing/campaigns/${r.id}`))}><Target /> Convert to campaign</MenuItem><MenuItem onSelect={() => void convert({ id: i._id, to: "post" }).then((r) => r && navigate(`/marketing/social/posts/${r.id}`))}><Share2 /> Convert to draft post</MenuItem></>}
                              <MenuSeparator />
                              <MenuItem danger onSelect={() => void remove({ id: i._id })}><Trash2 /> Delete</MenuItem>
                            </MenuContent>
                          </Menu>
                        )}
                      </div>
                      {i.description && <p className="mt-1 line-clamp-3 text-xs text-stone-500">{i.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge tone={i.priority === "high" ? "red" : i.priority === "medium" ? "amber" : "neutral"}>{i.priority}</Badge>
                        {i.platform && <Badge tone="blue">{i.platform}</Badge>}
                        {i.contentType && <Badge>{i.contentType}</Badge>}
                        {i.propertyName && <Badge>{i.propertyName}</Badge>}
                      </div>
                      <div className="mt-2 text-[11px] text-stone-400">by {i.creatorName}</div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="grid h-20 place-items-center rounded-xl border-2 border-dashed border-stone-200 text-xs text-stone-400"><Lightbulb className="size-4" /></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <NewIdeaDialog open={open} onOpenChange={setOpen} properties={properties ?? []} />
    </>
  );
}

function NewIdeaDialog({ open, onOpenChange, properties }: { open: boolean; onOpenChange: (o: boolean) => void; properties: { _id: Id<"properties">; name: string }[] }) {
  const [f, setF] = useState({ title: "", description: "", propertyId: "", platform: "", contentType: "", priority: "medium" as "low" | "medium" | "high" });
  const [create, pending] = useAction(api.ideas.create, { success: "Idea added" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New idea" footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="idea-form" loading={pending}>Add idea</Button></>}>
      <form id="idea-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create({ data: { title: f.title, description: f.description || undefined, propertyId: (f.propertyId || undefined) as Id<"properties"> | undefined, platform: f.platform || undefined, contentType: f.contentType || undefined, priority: f.priority } }).then((id) => { if (id) { onOpenChange(false); setF({ ...f, title: "", description: "" }); } }); }}>
        <Field label="Title" required><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property"><Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}><option value="">—</option>{properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as typeof f.priority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
          <Field label="Suggested platform"><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}><option value="">—</option>{["Facebook", "Instagram", "LinkedIn", "Email", "Print", "On-site"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Content type"><Select value={f.contentType} onChange={(e) => setF({ ...f, contentType: e.target.value })}><option value="">—</option>{["Image post", "Carousel", "Video", "Reel", "Article", "Event", "Competition"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
        </div>
      </form>
    </Dialog>
  );
}
