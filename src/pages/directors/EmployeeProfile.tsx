import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Archive, RotateCcw, Camera, Users, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Avatar, DefinitionList, Skeleton, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Sheet, ConfirmDialog } from "@/components/ui/dialog";
import { ChangedBanner } from "@/components/ChangedBanner";
import { HistoryList } from "@/components/HistoryList";
import { useAction, uploadFile } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { errorMessage, formatDate, formatDateTime } from "@/lib/utils";
import { EmployeeForm, employeeToDraft, employeeDraftToInput, type EmployeeDraft } from "./EmployeeForm";

export default function EmployeeProfile() {
  const { id } = useParams();
  const can = useCan();
  const e = useQuery(api.employees.get, { id: id as Id<"employees"> });
  const [editing, setEditing] = useState<{ draft: EmployeeDraft; version: number } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [update, saving] = useAction(api.employees.update, { success: "Employee updated for all directors" });
  const [setArchived, archiving] = useAction(api.employees.setArchived);
  const genUrl = useMutation(api.employees.generateUploadUrl);
  const setImage = useMutation(api.employees.setImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (e === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (e === null) return <EmptyState icon={Users} title="Employee not found" />;
  const name = `${e.firstName} ${e.lastName}`;

  const onImage = async (f?: File) => {
    if (!f) return;
    setUploading(true);
    try {
      const sid = await uploadFile(await genUrl(), f);
      await setImage({ id: e._id, storageId: sid as Id<"_storage"> });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader back="/directors/employees"
        title={<span className="flex items-center gap-4">
          <button className="group relative" disabled={!can("employees.write") || uploading} onClick={() => fileRef.current?.click()} aria-label="Change photo">
            <Avatar name={name} src={e.imageUrl} size="lg" />
            {can("employees.write") && <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/50 text-white opacity-0 transition group-hover:opacity-100"><Camera className="size-4" /></span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => void onImage(ev.target.files?.[0])} />
          {name}
        </span>}
        description={[e.jobTitle, e.department].filter(Boolean).join(" · ")}
        actions={<>
          {e.email && <Button variant="secondary" asChild><a href={`mailto:${e.email}`}><Mail /> Email</a></Button>}
          {e.phone && <Button variant="secondary" asChild><a href={`tel:${e.phone}`}><Phone /> Call</a></Button>}
          {can("employees.write") && <Button onClick={() => setEditing({ draft: employeeToDraft(e), version: e.version })}><Pencil /> Edit</Button>}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Profile" />
          <CardBody>
            <DefinitionList items={[
              { label: "Email", value: e.email }, { label: "Telephone", value: e.phone }, { label: "Department", value: e.department }, { label: "Job title", value: e.jobTitle },
              { label: "Office", value: e.office }, { label: "Manager", value: e.manager }, { label: "Status", value: <StatusBadge status={e.employmentStatus} /> },
              { label: "Start date", value: e.startDate && formatDate(new Date(e.startDate).getTime()) }, { label: "Notes", value: e.notes && <span className="whitespace-pre-wrap">{e.notes}</span> },
            ]} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card><CardHeader title="Record" /><CardBody className="space-y-1 text-sm text-stone-600">
            <div>Added by <span className="font-medium text-stone-800">{e.createdByName}</span> · {formatDateTime(e._creationTime)}</div>
            <div>Last updated by <span className="font-medium text-stone-800">{e.updatedByName}</span> · {formatDateTime(e.updatedAt)}</div>
            {can("employees.write") && <div className="pt-3">{e.archivedAt
              ? <Button variant="secondary" size="sm" loading={archiving} onClick={() => void setArchived({ id: e._id, archived: false })}><RotateCcw /> Restore</Button>
              : <Button variant="danger-ghost" size="sm" onClick={() => setArchiveOpen(true)}><Archive /> Archive</Button>}</div>}
          </CardBody></Card>
          <Card><CardHeader title="History" /><CardBody><HistoryList items={e.history} /></CardBody></Card>
        </div>
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Edit ${name}`} wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="employee-edit" loading={saving}>Save changes</Button></>}>
        {editing && e.version !== editing.version && <ChangedBanner by={e.updatedByName} onReload={() => setEditing({ draft: employeeToDraft(e), version: e.version })} />}
        {editing && <EmployeeForm id="employee-edit" value={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} onSubmit={() => void update({ id: e._id, expectedVersion: editing.version, data: employeeDraftToInput(editing.draft) }).then((r) => r !== undefined && setEditing(null))} />}
      </Sheet>
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title="Archive this employee?" description="They'll be removed from the directory and announcement lists. You can restore them later." confirmLabel="Archive" danger loading={archiving}
        onConfirm={() => void setArchived({ id: e._id, archived: true }).then(() => setArchiveOpen(false))} />
    </>
  );
}
