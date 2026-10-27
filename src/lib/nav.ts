import {
  LayoutDashboard, Users, UserCog, Contact, CalendarDays, Inbox, FileText, Building2, Megaphone,
  Share2, Target, FolderOpen, Lightbulb, Mail, Bell, ShieldCheck, Activity, Plug, Settings, Send, ClipboardList, Gauge,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "../../convex/lib/permissionMatrix";

export type Portal = "admin" | "directors" | "marketing";
export interface NavItem { label: string; to: string; icon: LucideIcon; perm?: Permission[]; end?: boolean }
export interface NavSection { title?: string; items: NavItem[] }

export const PORTAL_LABEL: Record<Portal, string> = { admin: "Admin", directors: "Directors", marketing: "Marketing" };
export const PORTAL_HOME: Record<Portal, string> = { admin: "/admin", directors: "/directors", marketing: "/marketing" };

export const NAV: Record<Portal, NavSection[]> = {
  admin: [
    { title: "Overview", items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
      { label: "Company activity", to: "/admin/audit", icon: Activity, perm: ["audit.read"] },
      { label: "Notifications", to: "/notifications", icon: Bell },
    ] },
    { title: "People", items: [
      { label: "Users & roles", to: "/admin/users", icon: UserCog, perm: ["users.manage"] },
      { label: "Employees", to: "/directors/employees", icon: Users, perm: ["employees.read"] },
      { label: "Brokers", to: "/directors/brokers", icon: Contact, perm: ["brokers.read"] },
    ] },
    { title: "Business operations", items: [
      { label: "Calendar & meetings", to: "/calendar", icon: CalendarDays },
      { label: "Leads", to: "/leads", icon: Inbox },
      { label: "Lead forms", to: "/forms", icon: ClipboardList },
      { label: "Documents", to: "/directors/documents", icon: FileText, perm: ["library.read"] },
      { label: "Properties", to: "/properties", icon: Building2, perm: ["properties.read"] },
    ] },
    { title: "Marketing", items: [
      { label: "Marketing overview", to: "/marketing", icon: Megaphone, end: true },
      { label: "Social media", to: "/marketing/social", icon: Share2 },
      { label: "Campaigns", to: "/marketing/campaigns", icon: Target },
      { label: "Marketing library", to: "/marketing/library", icon: FolderOpen },
      { label: "Ideas", to: "/marketing/ideas", icon: Lightbulb },
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
      { label: "Leads", to: "/leads", icon: Inbox, perm: ["leads.read_all"] },
      { label: "Lead forms", to: "/forms", icon: ClipboardList, perm: ["forms.read"] },
      { label: "Calendar", to: "/calendar", icon: CalendarDays },
      { label: "Documents", to: "/directors/documents", icon: FileText, perm: ["library.read"] },
      { label: "Properties", to: "/properties", icon: Building2, perm: ["properties.read"] },
    ] },
    { title: "Marketing", items: [{ label: "Marketing overview", to: "/directors/marketing", icon: Megaphone, perm: ["campaigns.read"] }] },
  ],
  marketing: [
    { items: [{ label: "Dashboard", to: "/marketing", icon: LayoutDashboard, end: true }] },
    { title: "Social media", items: [
      { label: "Content calendar", to: "/marketing/social", icon: CalendarDays, end: true },
      { label: "Create post", to: "/marketing/social/new", icon: Share2, perm: ["social.write"] },
      { label: "Connected accounts", to: "/marketing/social/accounts", icon: Plug },
    ] },
    { title: "Plan", items: [
      { label: "Campaigns", to: "/marketing/campaigns", icon: Target },
      { label: "Ideas board", to: "/marketing/ideas", icon: Lightbulb },
      { label: "Marketing library", to: "/marketing/library", icon: FolderOpen },
    ] },
    { title: "Leads", items: [
      { label: "Lead forms", to: "/forms", icon: ClipboardList, perm: ["forms.read"] },
      { label: "Authorized leads", to: "/leads", icon: Inbox, perm: ["leads.read_authorized"] },
    ] },
    { title: "Reference", items: [
      { label: "Properties", to: "/properties", icon: Building2, perm: ["properties.read"] },
      { label: "Calendar", to: "/calendar", icon: CalendarDays, perm: ["meetings.view_invited"] },
    ] },
  ],
};

export function portalsFor(role: string): Portal[] {
  if (role === "super_admin") return ["admin", "directors", "marketing"];
  if (role === "director") return ["directors"];
  return ["marketing"];
}

export function portalFromPath(path: string): Portal | null {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/directors")) return "directors";
  if (path.startsWith("/marketing")) return "marketing";
  return null;
}

