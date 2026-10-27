import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, MapPin, Video, Users, Lock, CalendarDays, Link2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Tabs, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Dialog, Sheet, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { useAction } from "@/lib/hooks";
import { useCan, useMe } from "@/lib/session";
import { cn, formatDateTime, formatTime, msToSastInput, sastInputToMs } from "@/lib/utils";

type View = "month" | "week" | "day" | "list";
type MeetingRow = Doc<"meetings"> & { participantCount: number; isMine: boolean };

/** Calendar math runs in the browser's local time; ONE HUB users are in SAST. */
export default function CalendarPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (window.innerWidth < 640 ? "list" : "month"));
  const [cursor, setCursor] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [createAt, setCreateAt] = useState<Date | null>(null);
  const openId = params.get("meeting") as Id<"meetings"> | null;

  useEffect(() => {
    if (params.get("new") === "1") { setCreateOpen(true); params.delete("new"); setParams(params, { replace: true }); }
  }, [params, setParams]);

  const range = useMemo(() => {
    if (view === "month") return { from: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
    if (view === "week") return { from: startOfWeek(cursor, { weekStartsOn: 1 }), to: endOfWeek(cursor, { weekStartsOn: 1 }) };
    if (view === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
    return { from: startOfDay(new Date()), to: addDays(startOfDay(new Date()), 45) };
  }, [view, cursor]);
  const meetings = useQuery(api.meetings.range, { from: range.from.getTime(), to: range.to.getTime() });
  const byDay = (d: Date) => (meetings ?? []).filter((m) => isSameDay(new Date(m.startsAt), d)).sort((a, b) => a.startsAt - b.startsAt);

  const step = (dir: 1 | -1) => setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));
  const title = view === "month" ? format(cursor, "MMMM yyyy") : view === "week" ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}` : view === "day" ? format(cursor, "EEEE, d MMMM yyyy") : "Next 45 days";
  const canCreate = can("meetings.manage") || can("calendar.personal");

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Calendar & meetings" description="Company meetings are visible to participants. Private events stay private."
        actions={canCreate && <Button onClick={() => { setCreateAt(null); setCreateOpen(true); }}><Plus /> Create meeting</Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 p-4">
            {view !== "list" && (
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
                <Button size="sm" variant="secondary" onClick={() => setCursor(new Date())}>Today</Button>
                <Button size="icon-sm" variant="ghost" onClick={() => step(1)} aria-label="Next"><ChevronRight /></Button>
              </div>
            )}
            <h2 className="text-base font-semibold">{title}</h2>
            <Tabs className="ml-auto" value={view} onChange={setView} items={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }, { value: "list", label: "List" }]} />
          </div>

          {view === "month" && (
            <div className="grid grid-cols-7 text-xs">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="border-b border-stone-100 py-2 text-center font-medium text-stone-400">{d}</div>)}
              {Array.from({ length: Math.round((range.to.getTime() - range.from.getTime()) / 86400000) }).map((_, i) => {
                const d = addDays(range.from, i);
                const items = byDay(d);
                const today = isSameDay(d, new Date());
                return (
                  <button key={i} onClick={() => { setCursor(d); setView("day"); }} onDoubleClick={() => { if (canCreate) { setCreateAt(d); setCreateOpen(true); } }}
                    className={cn("flex min-h-24 flex-col items-stretch justify-start border-r border-b border-stone-100 p-1.5 text-left transition hover:bg-stone-50 sm:min-h-28", !isSameMonth(d, cursor) && "bg-stone-50/50")}>
                    <span className={cn("inline-grid size-6 place-items-center rounded-full text-xs", today ? "bg-brand-500 font-semibold text-white" : isSameMonth(d, cursor) ? "text-stone-600" : "text-stone-300")}>{format(d, "d")}</span>
                    <div className="mt-1 w-full min-w-0 space-y-0.5">
                      {items.slice(0, 3).map((m) => (
                        <div key={m._id} onClick={(e) => { e.stopPropagation(); params.set("meeting", m._id); setParams(params); }}
                          className={cn("truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium", m.status === "cancelled" ? "bg-stone-100 text-stone-400 line-through" : m.scope === "private" ? "bg-stone-200/70 text-stone-700" : "bg-brand-50 text-brand-800")}>
                          <span className="hidden sm:inline">{formatTime(m.startsAt)} </span>{m.title}
                        </div>
                      ))}
                      {items.length > 3 && <div className="px-1.5 text-[11px] text-stone-400">+{items.length - 3} more</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {(view === "week" || view === "day") && (
            <div className={cn("grid divide-stone-100", view === "week" ? "grid-cols-1 divide-y sm:grid-cols-7 sm:divide-x sm:divide-y-0" : "grid-cols-1")}>
              {Array.from({ length: view === "week" ? 7 : 1 }).map((_, i) => {
                const d = addDays(range.from, i);
                const items = byDay(d);
                return (
                  <div key={i} className="min-h-40 p-3 sm:min-h-[28rem]">
                    <div className={cn("mb-3 text-xs font-medium", isSameDay(d, new Date()) ? "text-brand-600" : "text-stone-500")}>{format(d, view === "week" ? "EEE d" : "EEEE")}</div>
                    <div className="space-y-2">
                      {items.length === 0 && view === "day" && <p className="text-sm text-stone-400">No meetings.</p>}
                      {items.map((m) => <MeetingChip key={m._id} m={m} onOpen={() => { params.set("meeting", m._id); setParams(params); }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "list" && (
            <div className="p-4">
              {meetings === undefined ? <div className="h-40 animate-pulse rounded-xl bg-stone-100" /> : meetings.length === 0 ? <EmptyState icon={CalendarDays} title="No upcoming meetings" /> : (
                <ul className="space-y-2">{[...meetings].sort((a, b) => a.startsAt - b.startsAt).map((m) => <li key={m._id}><MeetingChip m={m} long onOpen={() => { params.set("meeting", m._id); setParams(params); }} /></li>)}</ul>
              )}
            </div>
          )}
        </Card>
        <CalendarConnections />
      </div>

      {createOpen && <MeetingSheet onClose={() => setCreateOpen(false)} initialDate={createAt} />}
      {openId && <MeetingDialog id={openId} onClose={() => { params.delete("meeting"); setParams(params); }} />}
    </>
  );
}

function MeetingChip({ m, onOpen, long }: { m: MeetingRow; onOpen: () => void; long?: boolean }) {
  return (
    <button onClick={onOpen} className={cn("w-full rounded-xl p-2.5 text-left ring-1 transition hover:shadow-card", m.status === "cancelled" ? "bg-stone-50 ring-stone-200 opacity-60" : m.scope === "private" ? "bg-stone-50 ring-stone-200" : "bg-brand-50/60 ring-brand-200/60")}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">{long && `${format(new Date(m.startsAt), "EEE d MMM")} · `}{formatTime(m.startsAt)}–{formatTime(m.endsAt)}{m.scope === "private" && <Lock className="size-3" />}</div>
      <div className={cn("mt-0.5 text-sm font-medium", m.status === "cancelled" && "line-through")}>{m.title}</div>
      {long && <div className="mt-1 flex gap-3 text-xs text-stone-500">{m.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{m.location}</span>}{m.videoLink && <span className="flex items-center gap-1"><Video className="size-3" />Video</span>}<span className="flex items-center gap-1"><Users className="size-3" />{m.participantCount}</span></div>}
    </button>
  );
}

const REMINDER_OPTIONS = [{ v: 1440, l: "24 hours before" }, { v: 60, l: "1 hour before" }, { v: 15, l: "15 minutes before" }];

function MeetingSheet({ onClose, initialDate, existing }: { onClose: () => void; initialDate?: Date | null; existing?: Doc<"meetings"> & { participants: { userId: Id<"users"> }[] } }) {
  const me = useMe();
  const can = useCan();
  const colleagues = useQuery(api.users.colleagues);
  const properties = useQuery(api.properties.options);
  const base = initialDate ? new Date(initialDate.setHours(9, 0, 0, 0)).getTime() : Math.ceil(Date.now() / 3600_000) * 3600_000;
  const [f, setF] = useState(() => ({
    title: existing?.title ?? "", description: existing?.description ?? "", start: msToSastInput(existing?.startsAt ?? base), end: msToSastInput(existing?.endsAt ?? base + 3600_000),
    location: existing?.location ?? "", videoLink: existing?.videoLink ?? "", scope: existing?.scope ?? (can("meetings.manage") ? "company" : "private") as "company" | "private",
    reminders: existing?.reminderMinutes ?? [1440, 60], custom: "", participants: new Set<Id<"users">>(existing?.participants.map((p) => p.userId).filter((u) => u !== me._id) ?? []),
    propertyId: existing?.propertyId ?? "", emailInvites: false,
  }));
  const [create, creating] = useAction(api.meetings.create, { success: "Meeting scheduled" });
  const [update, updating] = useAction(api.meetings.update, { success: "Meeting updated" });
  const submit = async () => {
    const reminderMinutes = [...f.reminders, ...(f.custom ? [Number(f.custom)] : [])].filter((n) => Number.isFinite(n) && n > 0);
    const data = {
      title: f.title, description: f.description || undefined, startsAt: sastInputToMs(f.start), endsAt: sastInputToMs(f.end), timezone: "Africa/Johannesburg",
      location: f.location || undefined, videoLink: f.videoLink || undefined, scope: f.scope, reminderMinutes, participantIds: [...f.participants],
      propertyId: (f.propertyId || undefined) as Id<"properties"> | undefined, emailInvites: f.emailInvites,
    };
    const r = existing ? await update({ id: existing._id, expectedVersion: existing.version, data }) : await create({ data });
    if (r !== undefined) onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={existing ? "Edit meeting" : "Create meeting"} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="meeting-form" loading={creating || updating}>{existing ? "Save changes" : "Schedule meeting"}</Button></>}>
      <form id="meeting-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Title" required><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (SAST)" required><Input type="datetime-local" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Ends (SAST)" required><Input type="datetime-local" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Boardroom, address…" /></Field>
          <Field label="Video meeting link"><Input value={f.videoLink} onChange={(e) => setF({ ...f, videoLink: e.target.value })} placeholder="https://teams.microsoft.com/…" /></Field>
          <Field label="Visibility"><Select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as "company" | "private" })}>{can("meetings.manage") && <option value="company">Company meeting (all directors)</option>}<option value="private">Private (only participants)</option></Select></Field>
          <Field label="Property"><Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}><option value="">—</option>{properties?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</Select></Field>
        </div>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-stone-700">Participants</div>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl bg-stone-50 p-2">
            {colleagues?.filter((c) => c._id !== me._id).map((c) => (
              <Checkbox key={c._id} className="w-full rounded-lg px-2 py-1.5" checked={f.participants.has(c._id)} label={<span>{c.name} <span className="text-xs text-stone-400">{c.role.replace("_", " ")}</span></span>}
                onChange={(v) => { const s = new Set(f.participants); if (v) s.add(c._id); else s.delete(c._id); setF({ ...f, participants: s }); }} />
            ))}
          </div>
          <Checkbox className="mt-2" checked={f.emailInvites} onChange={(v) => setF({ ...f, emailInvites: v })} label="Also email invitations to new participants" />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-stone-700">Reminders</div>
          <div className="flex flex-wrap gap-4">
            {REMINDER_OPTIONS.map((r) => <Checkbox key={r.v} checked={f.reminders.includes(r.v)} onChange={(v) => setF({ ...f, reminders: v ? [...f.reminders, r.v] : f.reminders.filter((x) => x !== r.v) })} label={r.l} />)}
            <div className="flex items-center gap-2 text-sm"><Input type="number" min={1} className="h-8 w-20" value={f.custom} onChange={(e) => setF({ ...f, custom: e.target.value })} aria-label="Custom reminder minutes" /> min before</div>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function MeetingDialog({ id, onClose }: { id: Id<"meetings">; onClose: () => void }) {
  const me = useMe();
  const m = useQuery(api.meetings.get, { id });
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancel, cancelling] = useAction(api.meetings.cancel, { success: "Meeting cancelled" });
  const [respond] = useAction(api.meetings.respond, { success: "Response saved" });
  if (m === undefined) return null;
  if (m === null) return <Dialog open onOpenChange={onClose} title="Meeting not available"><p className="text-sm text-stone-500">It may have been removed or you're not a participant.</p></Dialog>;
  const myP = m.participants.find((p) => p.userId === me._id);
  if (editing) return <MeetingSheet existing={m} onClose={() => { setEditing(false); }} />;
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()} title={m.title} description={`${formatDateTime(m.startsAt)} – ${formatTime(m.endsAt)} SAST`}
        footer={<>
          {myP && m.createdBy !== me._id && m.status === "scheduled" && <><Button variant="secondary" onClick={() => void respond({ id, response: "declined" })}>Decline</Button><Button variant="secondary" onClick={() => void respond({ id, response: "accepted" })}>Accept</Button></>}
          {m.canEdit && m.status === "scheduled" && <><Button variant="danger-ghost" onClick={() => setCancelOpen(true)}>Cancel meeting</Button><Button onClick={() => setEditing(true)}>Edit</Button></>}
        </>}>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><StatusBadge status={m.status} />{m.scope === "private" ? <Badge><Lock className="size-3" /> Private</Badge> : <Badge tone="brand">Company meeting</Badge>}</div>
          {m.location && <div className="flex items-center gap-2"><MapPin className="size-4 text-stone-400" />{m.location}</div>}
          {m.videoLink && <a className="flex items-center gap-2 text-brand-600 hover:underline" href={m.videoLink} target="_blank" rel="noopener noreferrer"><Video className="size-4" /> Join video meeting</a>}
          {m.description && <p className="whitespace-pre-wrap text-stone-700">{m.description}</p>}
          <div>
            <div className="mb-2 text-xs font-medium text-stone-500">Participants · organised by {m.createdByName}</div>
            <ul className="space-y-1.5">{m.participants.map((p) => <li key={p._id} className="flex justify-between"><span>{p.name}</span><StatusBadge status={p.response} /></li>)}</ul>
          </div>
          {m.reminderMinutes.length > 0 && <div className="text-xs text-stone-500">Reminders: {m.reminderMinutes.map((r) => (r >= 60 ? `${r / 60}h` : `${r}m`)).join(", ")} before</div>}
        </div>
      </Dialog>
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} danger title="Cancel this meeting?" description="Participants will be notified." confirmLabel="Cancel meeting" loading={cancelling} onConfirm={() => void cancel({ id }).then(() => { setCancelOpen(false); onClose(); })} />
    </>
  );
}

function CalendarConnections() {
  const conns = useQuery(api.meetings.myConnections);
  return (
    <Card className="self-start">
      <CardHeader title="Calendar connections" description="Your personal calendars. Never shared with colleagues." />
      <CardBody className="space-y-3">
        {(["google", "microsoft"] as const).map((p) => {
          const c = conns?.find((x) => x.provider === p);
          return (
            <div key={p} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
              <span className="grid size-9 place-items-center rounded-xl bg-white ring-1 ring-stone-200"><Link2 className="size-4 text-stone-500" /></span>
              <div className="min-w-0 flex-1"><div className="text-sm font-medium">{p === "google" ? "Google Calendar" : "Outlook Calendar"}</div><div className="truncate text-xs text-stone-500">{c ? c.accountEmail : "Not connected"}</div></div>
              {c ? <StatusBadge status={c.status} /> : <Button size="sm" variant="secondary" disabled title="Available once the OAuth app is configured (Phase 5)">Connect</Button>}
            </div>
          );
        })}
        <p className="text-xs text-stone-500">Calendar sync uses official OAuth — ONE HUB never asks for your calendar password. Connection becomes available once an administrator registers the Google and Microsoft apps (Phase 5).</p>
      </CardBody>
    </Card>
  );
}

export type { MeetingRow };
