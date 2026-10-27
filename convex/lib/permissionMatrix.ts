/**
 * Role → permission matrix (single source of truth, shared by backend and UI).
 * The UI uses it only to decide what to *show*; every Convex function
 * re-checks it on the server via `requirePermission`.
 *
 * To customise later, add/remove permissions here (or layer per-user overrides
 * on top in `resolvePermissions`) — no other code needs to change.
 */
export type Role = "super_admin" | "director" | "marketing";

export const PERMISSIONS = [
  "users.manage",
  "brokers.read",
  "brokers.write",
  "employees.read",
  "employees.write",
  "announcements.send",
  "properties.read",
  "properties.write",
  "forms.read",
  "forms.write",
  "leads.read",
  "leads.write",
  "leads.erase",
  "meetings.manage",
  "calendar.personal",
  "documents.read",
  "documents.write",
  "studio.read",
  "studio.write",
  "settings.manage",
  "audit.read",
  "dashboard.admin",
  "dashboard.director",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: ALL,
  director: new Set<Permission>([
    "brokers.read",
    "brokers.write",
    "employees.read",
    "employees.write",
    "announcements.send",
    "properties.read",
    "properties.write",
    "forms.read",
    "forms.write",
    "leads.read",
    "leads.write",
    "meetings.manage",
    "calendar.personal",
    "documents.read",
    "documents.write",
    "studio.read",
    "dashboard.director",
  ]),
  // Marketing team: Marketing Studio only — no access to people, leads or admin data.
  marketing: new Set<Permission>(["studio.read", "studio.write"]),
};

export interface PermissionSubject {
  role?: Role;
}

export function resolvePermissions(user: PermissionSubject): Set<Permission> {
  if (!user.role || !(user.role in ROLE_PERMISSIONS)) return new Set();
  return new Set(ROLE_PERMISSIONS[user.role]);
}

export function can(user: PermissionSubject | null | undefined, p: Permission) {
  return !!user && resolvePermissions(user).has(p);
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  director: "Director",
  marketing: "Marketing team",
};
