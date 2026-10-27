import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Share2, Image as ImageIcon, Copy, XCircle, CheckCircle2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Tabs, EmptyState, LoadingRows } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { cn, formatDateTime, formatTime, msToSastInput, sastInputToMs } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "calendar" | "scheduled" | "pending_approval" | "draft" | "published" | "failed";

export default function SocialPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "calendar";
  const counts = useQuery(api.socialPosts.counts);
  return (
    <>
      <PageHeader eyebrow="Social media" title="Content calendar" description="Scheduled posts publish automatically from the server — no browser needs to stay open."
        actions={can("social.write") && <Button asChild><Link to="/marketing/social/new"><Plus /> Create post</Link></Button>} />
      <Tabs className="mb-5" value={tab} onChange={(t) => setParams({ tab: t })} items={[
        { value: "calendar", label: "Calendar" }, { value: "scheduled", label: "Scheduled", count: counts?.scheduled }, { value: "pending_approval", label: "Pending approval", count: counts?.pending_approval },
        { value: "draft", label: "Drafts", count: counts?.draft }, { value: "published", label: "Published", count: counts?.published }, { value: "failed", label: "Failed", count: counts?.failed },
      ]} />
      {tab === "calendar" ? <MonthCalendar /> : <PostList status={tab} />}
    </>
  );
}

function MonthCalendar() {
  const navigate = useNavigate();
  const can = useCan();
  const [cursor, setCursor] = useState(new Date());
  const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const posts = useQuery(api.socialPosts.list, { from: from.getTime(), to: to.getTime() });
  const [reschedule] = useAction(api.socialPosts.reschedule, { success: "Post rescheduled" });
  const days = useMemo(() => Array.from({ length: Math.round((to.getTime() - from.getTime()) / 86400000) }, (_, i) => addDays(from, i)), [from, to]);

  const onDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const { id, version, scheduledAt } = JSON.parse(data) as { id: Id<"socialPosts">; version: number; scheduledAt: number };
    // Keep the original time of day (SAST), change the date.
    const time = msToSastInput(scheduledAt).slice(11);
    const next = sastInputToMs(`${format(day, "yyyy-MM-dd")}T${time}`);
    if (next < Date.now() + 2 * 60_000) return toast.error("Can't move a post into the past.");
    void reschedule({ id, expectedVersion: version, scheduledAt: next });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-100 p-4">
        <Button size="icon-sm" variant="ghost" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month"><ChevronLeft /></Button>
        <Button size="sm" variant="secondary" onClick={() => setCursor(new Date())}>Today</Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month"><ChevronRight /></Button>
        <h2 className="ml-2 font-semibold">{format(cursor, "MMMM yyyy")}</h2>
        {can("social.write") && <span className="ml-auto hidden text-xs text-stone-400 sm:inline">Drag a scheduled post to another day to reschedule</span>}
      </div>
      <div className="grid grid-cols-7 text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-stone-100 py-2 text-center font-medium text-stone-400">{d}</div>)}
        {days.map((d) => {
          const items = (posts ?? []).filter((p) => p.scheduledAt && isSameDay(new Date(p.scheduledAt), d)).sort((a, b) => a.scheduledAt! - b.scheduledAt!);
          return (
            <div key={d.toISOString()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, d)}
              className={cn("min-h-24 border-r border-b border-stone-100 p-1.5 sm:min-h-32", !isSameMonth(d, cursor) && "bg-stone-50/50")}>
              <span className={cn("inline-grid size-6 place-items-center rounded-full", isSameDay(d, new Date()) ? "bg-brand-500 font-semibold text-white" : isSameMonth(d, cursor) ? "text-stone-600" : "text-stone-300")}>{format(d, "d")}</span>
              <div className="mt-1 space-y-1">
                {items.map((p) => (
                  <div key={p._id} draggable={can("social.write") && ["scheduled", "draft", "pending_approval", "approved"].includes(p.status)}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ id: p._id, version: p.version, scheduledAt: p.scheduledAt }))}
                    onClick={() => navigate(`/marketing/social/posts/${p._id}`)}
                    className={cn("cursor-pointer truncate rounded-md px-1.5 py-1 text-[11px] font-medium",
                      p.status === "published" ? "bg-emerald-50 text-emerald-800" : p.status === "failed" ? "bg-red-50 text-red-700" : p.status === "scheduled" ? "bg-sky-50 text-sky-800" : "bg-stone-100 text-stone-600")}>
                    {formatTime(p.scheduledAt)} {p.caption.slice(0, 40) || "Media post"}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PostList({ status }: { status: Exclude<Tab, "calendar"> }) {
  const can = useCan();
  const navigate = useNavigate();
  const posts = useQuery(api.socialPosts.list, { status });
  const [duplicate] = useAction(api.socialPosts.duplicate, { success: "Duplicated as draft" });
  const [cancel] = useAction(api.socialPosts.cancel, { success: "Post cancelled" });
  const [approve] = useAction(api.socialPosts.approve, { success: "Approved & scheduled" });
  return (
    <Card className="overflow-hidden">
      {posts === undefined ? <LoadingRows /> : posts.length === 0 ? <EmptyState icon={Share2} title={`No ${status.replace("_", " ")} posts`} /> : (
        <ul className="divide-y divide-stone-100">
          {posts.map((p) => (
            <li key={p._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <Link to={`/marketing/social/posts/${p._id}`} className="flex min-w-0 flex-1 gap-4">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-stone-100">{p.thumbUrl ? <img src={p.thumbUrl} alt="" className="size-full object-cover" /> : <ImageIcon className="size-5 text-stone-300" />}</div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-stone-800">{p.caption || "(media only)"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <StatusBadge status={p.status} />
                    {p.scheduledAt && <span>{formatDateTime(p.scheduledAt)}</span>}
                    {p.accounts.map((a) => <Badge key={a._id}>{a.name}</Badge>)}
                    <span>by {p.authorName}</span>
                  </div>
                  {p.lastError && <p className="mt-1 line-clamp-2 text-xs text-red-600">{p.lastError}</p>}
                </div>
              </Link>
              {can("social.write") && (
                <div className="flex shrink-0 gap-2">
                  {status === "pending_approval" && can("social.approve") && <Button size="sm" onClick={() => void approve({ id: p._id, expectedVersion: p.version })}><CheckCircle2 /> Approve</Button>}
                  <Button size="sm" variant="secondary" onClick={() => void duplicate({ id: p._id }).then((id) => id && navigate(`/marketing/social/posts/${id}`))}><Copy /> Duplicate</Button>
                  {["scheduled", "draft", "pending_approval"].includes(p.status) && <Button size="sm" variant="danger-ghost" onClick={() => void cancel({ id: p._id })}><XCircle /> Cancel</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
