import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Share2, Copy, Mail, Phone, MapPin, Download, Pencil, Archive, RotateCcw, Globe, Smartphone, Contact } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Avatar, DefinitionList, Skeleton, EmptyState } from "@/components/ui/misc";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Sheet, ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { ChangedBanner } from "@/components/ChangedBanner";
import { HistoryList } from "@/components/HistoryList";
import { useAction } from "@/lib/hooks";
import { useCan } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { contactText, copy, downloadVCard, mapsUrl, nativeShare } from "@/lib/share";
import { BrokerForm, brokerToDraft, draftToInput, type BrokerDraft } from "./BrokerForm";

export default function BrokerProfile() {
  const { id } = useParams();
  const can = useCan();
  const b = useQuery(api.brokers.get, { id: id as Id<"brokers"> });
  const card = useQuery(api.brokers.shareCard, { id: id as Id<"brokers"> });
  const [editing, setEditing] = useState<{ draft: BrokerDraft; version: number } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [update, saving] = useAction(api.brokers.update, { success: "Broker updated for everyone" });
  const [setArchived, archiving] = useAction(api.brokers.setArchived);

  if (b === undefined) return <Skeleton className="h-96 rounded-2xl" />;
  if (b === null) return <EmptyState icon={Contact} title="Broker not found" description="It may have been removed." />;

  const save = async () => {
    if (!editing) return;
    const r = await update({ id: b._id, expectedVersion: editing.version, data: draftToInput(editing.draft) });
    if (r !== undefined) setEditing(null);
  };

  return (
    <>
      <PageHeader
        back="/directors/brokers"
        title={<span className="flex items-center gap-4"><Avatar name={b.fullName} size="lg" /><span>{b.fullName}{b.archivedAt && <span className="ml-3 align-middle"><StatusBadge status="archived" /></span>}</span></span>}
        description={[b.position, b.company].filter(Boolean).join(" · ")}
        actions={<>
          {card && (
            <Menu>
              <MenuTrigger asChild><Button variant="secondary"><Share2 /> Share</Button></MenuTrigger>
              <MenuContent className="w-60">
                <MenuLabel>Share contact (no internal notes)</MenuLabel>
                <MenuItem onSelect={() => void nativeShare(card)}><Smartphone /> Share via device…</MenuItem>
                <MenuItem onSelect={() => void copy(contactText(card), "Contact details copied")}><Copy /> Copy contact details</MenuItem>
                {card.email && <MenuItem onSelect={() => void copy(card.email!, "Email copied")}><Mail /> Copy email</MenuItem>}
                {card.mobile && <MenuItem onSelect={() => void copy(card.mobile!, "Number copied")}><Phone /> Copy telephone</MenuItem>}
                {card.address && <MenuItem onSelect={() => void copy(card.address!, "Address copied")}><MapPin /> Copy address</MenuItem>}
                {card.address && <MenuItem onSelect={() => window.open(mapsUrl(card.address!), "_blank", "noopener")}><Globe /> Open in Google Maps</MenuItem>}
                <MenuSeparator />
                <MenuItem onSelect={() => downloadVCard(card)}><Download /> Download vCard</MenuItem>
              </MenuContent>
            </Menu>
          )}
          {can("brokers.write") && <Button onClick={() => setEditing({ draft: brokerToDraft(b), version: b.version })}><Pencil /> Edit</Button>}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Contact information" />
          <CardBody>
            <DefinitionList items={[
              { label: "Email", value: b.email && <a className="text-brand-600 hover:underline" href={`mailto:${b.email}`}>{b.email}</a> },
              { label: "Mobile", value: b.mobile && <a className="text-brand-600 hover:underline" href={`tel:${b.mobile}`}>{b.mobile}</a> },
              { label: "Office", value: b.office && <a href={`tel:${b.office}`}>{b.office}</a> },
              { label: "Address", value: b.address && <a className="hover:underline" href={mapsUrl(b.address)} target="_blank" rel="noopener">{b.address}</a> },
              { label: "Region", value: [b.region, b.province].filter(Boolean).join(", ") },
              { label: "Website", value: b.website && <a className="text-brand-600 hover:underline" href={b.website.startsWith("http") ? b.website : `https://${b.website}`} target="_blank" rel="noopener noreferrer">{b.website}</a> },
              { label: "Property", value: b.propertyName },
              { label: "Status", value: <StatusBadge status={b.contactStatus} /> },
              { label: "Internal contact", value: b.assignedToName },
            ]} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Internal notes" description="Confidential — never shared." />
            <CardBody><p className="text-sm whitespace-pre-wrap text-zinc-700">{b.notes || <span className="text-zinc-400">No notes.</span>}</p></CardBody>
          </Card>
          <Card>
            <CardHeader title="Record" />
            <CardBody className="space-y-1 text-sm text-zinc-600">
              <div>Created by <span className="font-medium text-zinc-800">{b.createdByName}</span> · {formatDateTime(b._creationTime)}</div>
              <div>Last updated by <span className="font-medium text-zinc-800">{b.updatedByName}</span> · {formatDateTime(b.updatedAt)}</div>
              {can("brokers.write") && (
                <div className="pt-3">{b.archivedAt
                  ? <Button variant="secondary" size="sm" loading={archiving} onClick={() => void setArchived({ id: b._id, archived: false })}><RotateCcw /> Restore</Button>
                  : <Button variant="danger-ghost" size="sm" onClick={() => setArchiveOpen(true)}><Archive /> Archive</Button>}</div>
              )}
            </CardBody>
          </Card>
          <Card><CardHeader title="History" /><CardBody><HistoryList items={b.history} /></CardBody></Card>
        </div>
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Edit ${b.fullName}`} wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="broker-edit" loading={saving}>Save changes</Button></>}>
        {editing && b.version !== editing.version && <ChangedBanner by={b.updatedByName} onReload={() => setEditing({ draft: brokerToDraft(b), version: b.version })} />}
        {editing && <BrokerForm id="broker-edit" value={editing.draft} excludeId={b._id} onChange={(draft) => setEditing({ ...editing, draft })} onSubmit={() => void save()} />}
      </Sheet>
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title="Archive this broker?" description="Archived brokers are hidden from the directory but can be restored at any time." confirmLabel="Archive" danger loading={archiving}
        onConfirm={() => void setArchived({ id: b._id, archived: true }).then(() => setArchiveOpen(false))} />
    </>
  );
}
