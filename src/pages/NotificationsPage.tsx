import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader, Tabs, EmptyState, LoadingRows } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { NotificationRow } from "@/components/layout/NotificationsPopover";

const TYPES = ["", "lead", "meeting", "announcement", "document", "employee", "invitation", "system"];

export default function NotificationsPage() {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [type, setType] = useState("");
  const list = useQuery(api.notifications.list, { unreadOnly: tab === "unread", type: type || undefined });
  const markRead = useMutation(api.notifications.markRead);
  const markAll = useMutation(api.notifications.markAllRead);
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Notifications" actions={<Button variant="secondary" onClick={() => void markAll()}><CheckCheck /> Mark all as read</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={tab} onChange={setTab} items={[{ value: "all", label: "All" }, { value: "unread", label: "Unread" }]} />
        <Select className="sm:ml-auto sm:w-56" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{t ? t.replace("_", " ") : "All types"}</option>)}</Select>
      </div>
      <Card className="p-2">
        {list === undefined ? <LoadingRows /> : list.length === 0 ? <EmptyState icon={Bell} title="Nothing here" description="You're all caught up." /> : list.map((n) => <NotificationRow key={n._id} n={n} onOpen={(x) => { void markRead({ id: x._id }); if (x.link) navigate(x.link); }} />)}
      </Card>
    </>
  );
}
