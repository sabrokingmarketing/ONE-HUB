import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { Inbox, Mail, Phone, Archive, Trash2, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Avatar, DefinitionList, Skeleton, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea, Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { HistoryList } from "@/components/HistoryList";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

const STATUSES: Doc<"leads">["status"][] = ["new", "contacted", "qualified", "follow_up", "converted", "closed"];

export default function LeadDetail() {
  const { id } = useParams();
  const can = useCan();
  const navigate = useNavigate();
  const lead = useQuery(api.leads.get, { id: id as Id<"leads"> });
  const colleagues = useQuery(api.users.colleagues);
  const [update, saving] = useAction(api.leads.update);
  const [archive] = useAction(api.leads.archive, { success: "Lead archived" });
  const [erase, erasing] = useAction(api.leads.erase, { success: "Lead permanently deleted" });
  const [notes, setNotes] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  useEffect(() => { if (lead) setNotes(lead.notes ?? ""); }, [lead?._id, lead?.notes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (lead === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (lead === null) return <EmptyState icon={Inbox} title="Lead not found" description="It may have been archived or you may not have access." />;
  const v = lead.version;

  return (
    <>
      <PageHeader back="/leads" title={<span className="flex items-center gap-4"><Avatar name={lead.name} size="lg" />{lead.name}</span>} description={`Submitted ${formatDateTime(lead.submittedAt)} via ${lead.formTitle ?? lead.source}`}
        actions={<>
          {lead.email && <Button variant="secondary" asChild><a href={`mailto:${lead.email}`}><Mail /> Email</a></Button>}
          {lead.phone && <Button variant="secondary" asChild><a href={`tel:${lead.phone}`}><Phone /> Call</a></Button>}
          {lead.phone && <Button variant="secondary" asChild><a href={`https://wa.me/${lead.phone.replace(/\D/g, "").replace(/^0/, "27")}`} target="_blank" rel="noopener">WhatsApp</a></Button>}
        </>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Submission" />
            <CardBody>
              <DefinitionList items={[
                { label: "Email", value: lead.email }, { label: "Phone", value: lead.phone }, { label: "Company", value: lead.company }, { label: "Property", value: lead.propertyName },
                ...lead.answers.filter((a) => ![lead.email, lead.phone, lead.company].includes(a.value)).map((a) => ({ label: a.label, value: a.value })),
                { label: "Consent", value: lead.consent ? <Badge tone="green"><ShieldCheck className="size-3" /> Consent given</Badge> : <Badge>No consent recorded</Badge> },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" description="Shared with everyone who can see this lead." />
            <CardBody className="space-y-3">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call outcomes, next steps…" />
              <Button size="sm" disabled={notes === (lead.notes ?? "")} loading={saving} onClick={() => void update({ id: lead._id, expectedVersion: v, notes })}>Save notes</Button>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Pipeline" />
            <CardBody className="space-y-4">
              <Field label="Status">
                <Select value={lead.status} onChange={(e) => void update({ id: lead._id, expectedVersion: v, status: e.target.value as Doc<"leads">["status"] })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", "-").replace(/^\w/, (c) => c.toUpperCase())}</option>)}
                </Select>
              </Field>
              {can("leads.write") && (
                <Field label="Assigned director" hint="Assigning never hides the lead from other directors.">
                  <Select value={lead.assignedTo ?? ""} onChange={(e) => void update({ id: lead._id, expectedVersion: v, assignedTo: (e.target.value || null) as Id<"users"> | null })}>
                    <option value="">Unassigned</option>
                    {colleagues?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </Select>
                </Field>
              )}
            </CardBody>
          </Card>
          <Card><CardHeader title="History" /><CardBody><HistoryList items={lead.history} /></CardBody></Card>
          {can("leads.write") && (
            <Card><CardHeader title="Data management" description="POPIA: archive on request, or permanently delete (Super Admin)." /><CardBody className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setArchiveOpen(true)}><Archive /> Archive</Button>
              {can("leads.erase") && <Button variant="danger-ghost" size="sm" onClick={() => setEraseOpen(true)}><Trash2 /> Permanently delete</Button>}
            </CardBody></Card>
          )}
        </div>
      </div>
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title="Archive this lead?" description="It will be hidden from lead lists." confirmLabel="Archive" onConfirm={() => void archive({ id: lead._id }).then(() => navigate("/leads"))} />
      <ConfirmDialog open={eraseOpen} onOpenChange={setEraseOpen} danger title="Permanently delete this lead?" confirmLabel="Delete forever" loading={erasing}
        description="This cannot be undone. Use for verified POPIA deletion requests only. The deletion is recorded in the audit log without personal details."
        onConfirm={() => void erase({ id: lead._id, confirmName }).then((r) => r !== undefined && navigate("/leads"))}>
        <Field className="mt-4" label={`Type "${lead.name}" to confirm`}><Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} /></Field>
      </ConfirmDialog>
    </>
  );
}
