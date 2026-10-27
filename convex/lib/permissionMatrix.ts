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
  "leads.read_all",
  "leads.read_authorized",
  "leads.write",
  "meetings.manage",
  "meetings.view_invited",
  "calendar.personal",
  "library.read",
  "library.write",
  "campaigns.read",
  "campaigns.write",
  "social.read",
  "social.write",
  "social.approve",
  "social.connect",
  "ideas.read",
  "ideas.write",
  "settings.manage",
  "audit.read",
  "dashboard.admin",
  "dashboard.director",
  "dashboard.marketing",
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
    "leads.read_all",
    "leads.read_authorized",
    "leads.write",
    "meetings.manage",
    "meetings.view_invited",
    "calendar.personal",
    "library.read",
    "campaigns.read",
    "social.read",
    "ideas.read",
    "dashboard.director",
  ]),
  marketing: new Set<Permission>([
    "properties.read",
    "forms.read",
    "forms.write",
    "leads.read_authorized",
    "meetings.view_invited",
    "library.read",
    "library.write",
    "campaigns.read",
    "campaigns.write",
    "social.read",
    "social.write",
    "ideas.read",
    "ideas.write",
    "dashboard.marketing",
  ]),
};

export interface PermissionSubject {
  role?: Role;
  marketingSocialAccess?: boolean;
  calendarEnabled?: boolean;
}

export function resolvePermissions(user: PermissionSubject): Set<Permission> {
  if (!user.role) return new Set();
  const perms = new Set(ROLE_PERMISSIONS[user.role]);
  // Per-user grants defined by the access matrix ("Authorized" / "Own if enabled").
  if (user.role === "marketing" && user.marketingSocialAccess) perms.add("social.connect");
  if (user.role === "marketing" && user.calendarEnabled) perms.add("calendar.personal");
  return perms;
}

export function can(user: PermissionSubject | null | undefined, p: Permission) {
  return !!user && resolvePermissions(user).has(p);
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  director: "Director",
  marketing: "Marketing",
};
