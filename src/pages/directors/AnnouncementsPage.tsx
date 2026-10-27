import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Send, Eye, FlaskConical, Users, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Tabs, EmptyState, LoadingRows } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useAction, useDebounced } from "@/lib/hooks";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const TEMPLATES = [
  { value: "general", label: "General announcement" },
  { value: "important", label: "Important update" },
  { value: "meeting", label: "Meeting notification" },
  { value: "event", label: "Event invitation" },
  { value: "document", label: "Document notification" },
  { value: "reminder", label: "Internal reminder" },
] as const;
type Template = (typeof TEMPLATES)[number]["value"];

export default function AnnouncementsPage() {
  const [tab, setTab] = useState<"compose" | "history">("compose");
  return (
    <>
      <PageHeader eyebrow="Employees" title="Send employee update" description="Branded email announcements delivered through Resend, queued and rate-limited." />
      <Tabs className="mb-5 w-fit" value={tab} onChange={setTab} items={[{ value: "compose", label: "Compose" }, { value: "history", label: "Sent updates" }]} />
      {tab === "compose" ? <Composer onSent={() => setTab("history")} /> : <History />}
    </>
  );
}

function Composer({ onSent }: { onSent: () => void }) {
  const [audience, setAudience] = useState<"all" | "department" | "selected">("all");
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState<Set<Id<"employees">>>(new Set());
  const [template, setTemplate] = useState<Template>("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const departments = useQuery(api.employees.departments);
  const allRecipients = useQuery(api.announcements.recipients, { audience: "all" });
  const recipients = useQuery(api.announcements.recipients, { audience, department: department || undefined, employeeIds: [...selected] });
  const content = { subject, body, template, linkUrl: linkUrl || undefined, linkLabel: linkLabel || undefined };
  const debounced = useDebounced(content, 400);
  const previewHtml = useQuery(api.announcements.preview, previewOpen ? debounced : "skip");
  const [sendTest, testing] = useAction(api.announcements.sendTest);
  const [send, sending] = useAction(api.announcements.send);
  const valid = subject.trim() && body.trim() && (recipients?.recipients.length ?? 0) > 0;

  const doSend = async () => {
    const r = await send({ ...content, audience, department: department || undefined, employeeIds: [...selected], confirmedCount: recipients!.recipients.length });
    if (r) {
      toast.success(`Queued for ${r.count} employees`, { description: recipients?.mode !== "live" ? `Email mode is "${recipients?.mode}" — real employees will not receive it.` : undefined });
      setConfirmOpen(false);
      setSubject(""); setBody(""); setLinkUrl(""); setLinkLabel("");
      onSent();
    }
  };

  const filteredAll = useMemo(() => allRecipients?.recipients ?? [], [allRecipients]);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Message" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template"><Select value={template} onChange={(e) => setTemplate(e.target.value as Template)}>{TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
            <Field label="Subject" required><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></Field>
          </div>
          <Field label="Message" required hint="Plain text. Blank lines create paragraphs."><Textarea className="min-h-56" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button link (optional)" hint="Approved https:// links only — e.g. a shared document."><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" /></Field>
            <Field label="Button label"><Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Open document" /></Field>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="secondary" disabled={!subject || !body} onClick={() => setPreviewOpen(true)}><Eye /> Preview</Button>
            <Button variant="secondary" disabled={!subject || !body} loading={testing} onClick={() => void sendTest(content).then((to) => to && toast.success(`Test queued to ${to}`))}><FlaskConical /> Send test to me</Button>
            <Button className="sm:ml-auto" disabled={!valid} onClick={() => { setConfirmed(false); setConfirmOpen(true); }}><Send /> Review & send</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recipients" />
        <CardBody className="space-y-4">
          <Field label="Send to">
            <Select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              <option value="all">All employees</option><option value="department">A department</option><option value="selected">Selected employees</option>
            </Select>
          </Field>
          {audience === "department" && (
            <Field label="Department"><Select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">Choose…</option>{departments?.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.count})</option>)}</Select></Field>
          )}
          {audience === "selected" && (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-2">
              {filteredAll.map((r) => (
                <Checkbox key={r._id} className="w-full rounded-lg px-2 py-1.5 hover:bg-white" checked={selected.has(r._id)} onChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(r._id); else n.delete(r._id); return n; })} label={<span><span className="font-medium">{r.name}</span> <span className="text-xs text-zinc-500">{r.department}</span></span>} />
              ))}
            </div>
          )}
          <div className="rounded-xl bg-brand-50 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-brand-800"><Users className="size-4" /> {recipients?.recipients.length ?? "…"} recipients</div>
            {!!recipients?.missingEmail && <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle className="size-3.5" /> {recipients.missingEmail} matching employees have no email address</div>}
            {recipients && recipients.mode !== "live" && <div className="mt-2 text-xs text-zinc-600">Email mode: <Badge tone="amber">{recipients.mode}</Badge> — {recipients.mode === "log" ? "emails are only logged, not delivered." : "all emails go to the test inbox."}</div>}
          </div>
        </CardBody>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen} title="Email preview" size="lg">
        {previewHtml ? <iframe title="Email preview" sandbox="" srcDoc={previewHtml} className="h-[60vh] w-full rounded-xl ring-1 ring-zinc-200" /> : <div className="h-[60vh] animate-pulse rounded-xl bg-zinc-100" />}
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Confirm announcement"
        footer={<><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button><Button disabled={!confirmed} loading={sending} onClick={() => void doSend()}><Send /> Send to {recipients?.recipients.length}</Button></>}>
        <div className="space-y-4 text-sm">
          <div className="rounded-xl bg-zinc-50 p-4"><div className="text-xs text-zinc-500">Subject</div><div className="font-medium">{subject}</div></div>
          <div>
            <div className="mb-2 text-xs text-zinc-500">Recipients ({recipients?.recipients.length})</div>
            <div className="max-h-48 overflow-y-auto rounded-xl ring-1 ring-zinc-200">
              {recipients?.recipients.map((r) => <div key={r._id} className="flex justify-between border-b border-zinc-100 px-3 py-2 last:border-0"><span>{r.name}</span><span className="text-zinc-500">{r.email}</span></div>)}
            </div>
          </div>
          <Checkbox checked={confirmed} onChange={setConfirmed} label="I've reviewed the message and the recipient list." />
        </div>
      </Dialog>
    </div>
  );
}

function History() {
  const rows = useQuery(api.announcements.history);
  return (
    <Card className="overflow-hidden">
      {!rows ? <LoadingRows /> : rows.length === 0 ? <EmptyState icon={Mail} title="No updates sent yet" /> : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <li key={r._id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><div className="font-medium text-zinc-900">{r.subject}</div><div className="text-xs text-zinc-500">{r.senderName} · {formatDateTime(r.sentAt)} · {r.recipientCount} recipients · {r.audience === "department" ? r.department : r.audience}</div></div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status={r.status} />
                {r.tally.sent > 0 && <Badge tone="green"><CheckCircle2 className="size-3" /> {r.tally.sent} delivered</Badge>}
                {r.tally.logged > 0 && <Badge>{r.tally.logged} logged only</Badge>}
                {r.tally.queued + r.tally.sending > 0 && <Badge tone="blue">{r.tally.queued + r.tally.sending} queued</Badge>}
                {r.tally.failed > 0 && <Badge tone="red">{r.tally.failed} failed</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
