import {
  LayoutDashboard, Users, UserCog, Contact, CalendarDays, Inbox, FileText, Building2,
  Mail, Bell, ShieldCheck, Activity, Plug, Settings, Send, ClipboardList, Gauge,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "../../convex/lib/permissionMatrix";

export type Portal = "admin" | "directors";
export interface NavItem { label: string; to: string; icon: LucideIcon; perm?: Permission[]; end?: boolean }
export interface NavSection { title?: string; items: NavItem[] }

export const PORTAL_LABEL: Record<Portal, string> = { admin: "Admin", directors: "Directors" };
export const PORTAL_HOME: Record<Portal, string> = { admin: "/admin", directors: "/directors" };

export const NAV: Record<Portal, NavSection[]> = {
  admin: [
    { title: "Overview", items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
      { label: "Company activity", to: "/admin/audit", icon: Activity, perm: ["audit.read"] },
      { label: "Notifications", to: "/notifications", icon: Bell },
    ] },
    { title: "People", items: [
      { label: "Users & roles", to: "/admin/users", icon: UserCog, perm: ["users.manage"] },
      { label: "Employees", to: "/directors/employees", icon: Users, perm: ["employees.read"], end: true },
      { label: "Brokers", to: "/directors/brokers", icon: Contact, perm: ["brokers.read"] },
    ] },
    { title: "Business", items: [
      { label: "Calendar & meetings", to: "/calendar", icon: CalendarDays },
      { label: "Leads", to: "/leads", icon: Inbox },
      { label: "Lead forms", to: "/forms", icon: ClipboardList },
      { label: "Documents", to: "/directors/documents", icon: FileText, perm: ["documents.read"] },
      { label: "Properties", to: "/properties", icon: Building2, perm: ["properties.read"] },
    ] },
    { title: "Communication", items: [
      { label: "Employee announcements", to: "/directors/employees/announcements", icon: Send },
      { label: "Email log", to: "/admin/email", icon: Mail },
    ] },
    { title: "System", items: [
      { label: "Integrations", to: "/admin/integrations", icon: Plug },
      { label: "Permissions", to: "/admin/permissions", icon: ShieldCheck },
      { label: "Usage & limits", to: "/admin/usage", icon: Gauge },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ] },
  ],
  directors: [
    { items: [{ label: "Dashboard", to: "/directors", icon: LayoutDashboard, end: true }] },
    { title: "People", items: [
      { label: "Brokers", to: "/directors/brokers", icon: Contact, perm: ["brokers.read"] },
      { label: "Employees", to: "/directors/employees", icon: Users, perm: ["employees.read"], end: true },
      { label: "Send employee update", to: "/directors/employees/announcements", icon: Send, perm: ["announcements.send"] },
    ] },
    { title: "Business", items: [
      { label: "Leads", to: "/leads", icon: Inbox, perm: ["leads.read"] },
      { label: "Lead forms", to: "/forms", icon: ClipboardList, perm: ["forms.read"] },
      { label: "Calendar", to: "/calendar", icon: CalendarDays },
      { label: "Documents", to: "/directors/documents", icon: FileText, perm: ["documents.read"] },
      { label: "Properties", to: "/properties", icon: Building2, perm: ["properties.read"] },
    ] },
  ],
};

export function portalsFor(role: string): Portal[] {
  return role === "super_admin" ? ["admin", "directors"] : ["directors"];
}

export function portalFromPath(path: string): Portal | null {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/directors")) return "directors";
  return null;
}
