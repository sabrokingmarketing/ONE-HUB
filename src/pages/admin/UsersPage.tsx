import { useState } from "react";
import { useQuery } from "convex/react";
import { MoreHorizontal, UserPlus, Mail, Ban, RotateCcw, Shield, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader, Avatar, EmptyState, LoadingRows, Tabs } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuSeparator } from "@/components/ui/menu";
import { useAction } from "@/lib/hooks";
import { formatDate, timeAgo } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "../../../convex/lib/permissionMatrix";
import { useMe } from "@/lib/session";

export default function UsersPage() {
  const me = useMe();
  const data = useQuery(api.users.list);
  const [tab, setTab] = useState<"users" | "invites">("users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<null | { _id: Id<"users">; name: string; role: Role }>(null);
  const [suspendTarget, setSuspendTarget] = useState<null | { _id: Id<"users">; name: string }>(null);
  const [setStatus, statusPending] = useAction(api.users.setStatus);
  const [resend] = useAction(api.users.resendInvite, { success: "Invitation resent" });
  const [revoke] = useAction(api.users.revokeInvite, { success: "Invitation revoked" });

  return (
    <>
      <PageHeader eyebrow="People" title="Users & roles" description="Every person has an individual login. Permissions are enforced on the server." actions={<Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite user</Button>} />
      <Tabs className="mb-4 w-fit" value={tab} onChange={setTab} items={[{ value: "users", label: "Users", count: data?.users.length }, { value: "invites", label: "Pending invitations", count: data?.invitations.length }]} />
      <Card className="overflow-hidden">
        {!data ? <LoadingRows /> : tab === "users" ? (
          data.users.length === 0 ? <EmptyState icon={Users} title="No users yet" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-zinc-100 text-left text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  <tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last login</th><th className="px-5 py-3">Joined</th><th className="w-12" /></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.users.map((u) => (
                    <tr key={u._id} className="hover:bg-zinc-50/50">
                      <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={u.name} size="sm" /><div><div className="font-medium text-zinc-900">{u.name}{u._id === me._id && <span className="ml-1.5 text-xs text-zinc-400">(you)</span>}</div><div className="text-xs text-zinc-500">{u.email}</div></div></div></td>
                      <td className="px-5 py-3"><Badge tone={u.role === "super_admin" ? "dark" : "brand"}>{ROLE_LABELS[u.role]}</Badge></td>
                      <td className="px-5 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-5 py-3 text-zinc-600">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                      <td className="px-5 py-3 text-zinc-600">{formatDate(u.createdAt)}</td>
                      <td className="px-3 py-3">
                        <Menu>
                          <MenuTrigger className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100" aria-label="Actions"><MoreHorizontal className="size-4" /></MenuTrigger>
                          <MenuContent>
                            <MenuItem onSelect={() => setEditing(u)}><Shield /> Change role & access</MenuItem>
                            <MenuSeparator />
                            {u.status === "active" ? (
                              <MenuItem danger disabled={u._id === me._id} onSelect={() => setSuspendTarget(u)}><Ban /> Suspend account</MenuItem>
                            ) : (
                              <MenuItem onSelect={() => void setStatus({ userId: u._id, status: "active" })}><RotateCcw /> Reactivate</MenuItem>
                            )}
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : data.invitations.length === 0 ? (
          <EmptyState icon={Mail} title="No pending invitations" action={<Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite user</Button>} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.invitations.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Avatar name={i.name} size="sm" />
                <div className="min-w-0 flex-1"><div className="font-medium text-zinc-900">{i.name}</div><div className="text-xs text-zinc-500">{i.email} · {ROLE_LABELS[i.role]} · {i.expired ? <span className="text-red-600">expired</span> : `expires ${formatDate(i.expiresAt)}`}</div></div>
                <Button size="sm" variant="secondary" onClick={() => void resend({ id: i._id })}>Resend</Button>
                <Button size="sm" variant="danger-ghost" onClick={() => void revoke({ id: i._id })}>Revoke</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      {editing && <AccessDialog user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)} danger confirmLabel="Suspend" loading={statusPending}
        title={`Suspend ${suspendTarget?.name}?`} description="They will be signed out everywhere immediately and won't be able to sign in until reactivated. Their records are kept."
        onConfirm={() => void setStatus({ userId: suspendTarget!._id, status: "suspended" }).then(() => setSuspendTarget(null))}
      />
    </>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("director");
  const [invite, pending] = useAction(api.users.invite, { success: "Invitation created" });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await invite({ name, email, role })) { setName(""); setEmail(""); onOpenChange(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Invite a user" description="They'll receive a personal activation link valid for 7 days."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="invite-form" loading={pending}>Send invitation</Button></>}>
      <form id="invite-form" onSubmit={submit} className="space-y-4">
        <Field label="Full name" required><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Work email" required><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Role" required hint={role === "super_admin" ? "Full control over every portal, user and setting." : "Brokers, employees, leads, forms, meetings, documents and properties."}>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="director">Director</option><option value="super_admin">Super Admin</option>
          </Select>
        </Field>
      </form>
    </Dialog>
  );
}

function AccessDialog({ user, onClose }: { user: { _id: Id<"users">; name: string; role: Role }; onClose: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [save, pending] = useAction(api.users.updateAccess, { success: "Access updated" });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Access for ${user.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={() => void save({ userId: user._id, role }).then((r) => r !== undefined && onClose())}>Save</Button></>}>
      <div className="space-y-5">
        <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="director">Director</option><option value="super_admin">Super Admin</option></Select></Field>
      </div>
    </Dialog>
  );
}
