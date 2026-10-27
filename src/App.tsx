import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { SessionContext, useMe } from "@/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { Logo } from "@/components/layout/Logo";
import { PORTAL_HOME, portalsFor } from "@/lib/nav";
import type { Permission } from "../convex/lib/permissionMatrix";
import { EmptyState } from "@/components/ui/misc";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const Login = lazy(() => import("./pages/auth/Login"));
const AcceptInvite = lazy(() => import("./pages/auth/AcceptInvite"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const PublicForm = lazy(() => import("./pages/forms/PublicForm"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const AuditPage = lazy(() => import("./pages/admin/AuditPage"));
const IntegrationsPage = lazy(() => import("./pages/admin/IntegrationsPage"));
const PermissionsPage = lazy(() => import("./pages/admin/PermissionsPage"));
const UsagePage = lazy(() => import("./pages/admin/UsagePage"));
const SettingsAdminPage = lazy(() => import("./pages/admin/SettingsAdminPage"));
const EmailLogPage = lazy(() => import("./pages/admin/EmailLogPage"));

const DirectorDashboard = lazy(() => import("./pages/directors/DirectorDashboard"));
const BrokersPage = lazy(() => import("./pages/directors/BrokersPage"));
const BrokerProfile = lazy(() => import("./pages/directors/BrokerProfile"));
const EmployeesPage = lazy(() => import("./pages/directors/EmployeesPage"));
const EmployeeProfile = lazy(() => import("./pages/directors/EmployeeProfile"));
const AnnouncementsPage = lazy(() => import("./pages/directors/AnnouncementsPage"));
const DocumentsPage = lazy(() => import("./pages/directors/DocumentsPage"));
const ImportPage = lazy(() => import("./pages/directors/ImportPage"));

const LeadsPage = lazy(() => import("./pages/leads/LeadsPage"));
const LeadDetail = lazy(() => import("./pages/leads/LeadDetail"));
const FormsPage = lazy(() => import("./pages/forms/FormsPage"));
const FormBuilder = lazy(() => import("./pages/forms/FormBuilder"));
const CalendarPage = lazy(() => import("./pages/calendar/CalendarPage"));
const PropertiesPage = lazy(() => import("./pages/properties/PropertiesPage"));
const PropertyProfile = lazy(() => import("./pages/properties/PropertyProfile"));

const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink">
      <div className="animate-pulse"><Logo /></div>
    </div>
  );
}

function PageFallback() {
  return <div className="h-40 animate-pulse rounded-2xl bg-zinc-200/50" />;
}

function Guard({ perm, children }: { perm?: Permission[]; children: React.ReactNode }) {
  const me = useMe();
  if (perm && !perm.some((p) => me.permissions.includes(p))) {
    return <EmptyState icon={ShieldOff} title="You don't have access to this page" description="Ask a ONE HUB administrator if you believe you should." />;
  }
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function Home() {
  const me = useMe();
  return <Navigate to={PORTAL_HOME[portalsFor(me.role!)[0]]} replace />;
}

function Authenticated() {
  const me = useQuery(api.users.me);
  const touch = useMutation(api.users.touchLogin);
  const { signOut } = useAuthActions();
  useEffect(() => {
    if (me?.role && me.status === "active") void touch().catch(() => undefined);
  }, [me?.role, me?.status, touch]);

  if (me === undefined) return <Splash />;
  if (me === null) return <Navigate to="/login" replace />;
  if (!me.role || me.status === "suspended") {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6">
        <div className="max-w-md rounded-2xl bg-white p-6 shadow-card ring-1 ring-zinc-200">
          <EmptyState icon={ShieldOff} title={me.status === "suspended" ? "Your account is suspended" : "Your account is not active"} description="Please contact a ONE HUB administrator." action={<Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>} />
        </div>
      </div>
    );
  }
  return (
    <SessionContext.Provider value={me}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          {/* Admin */}
          <Route path="admin" element={<Guard perm={["dashboard.admin"]}><AdminDashboard /></Guard>} />
          <Route path="admin/users" element={<Guard perm={["users.manage"]}><UsersPage /></Guard>} />
          <Route path="admin/audit" element={<Guard perm={["audit.read"]}><AuditPage /></Guard>} />
          <Route path="admin/integrations" element={<Guard perm={["settings.manage"]}><IntegrationsPage /></Guard>} />
          <Route path="admin/permissions" element={<Guard perm={["settings.manage"]}><PermissionsPage /></Guard>} />
          <Route path="admin/usage" element={<Guard perm={["settings.manage"]}><UsagePage /></Guard>} />
          <Route path="admin/settings" element={<Guard perm={["settings.manage"]}><SettingsAdminPage /></Guard>} />
          <Route path="admin/email" element={<Guard perm={["settings.manage"]}><EmailLogPage /></Guard>} />
          {/* Directors */}
          <Route path="directors" element={<Guard perm={["dashboard.director", "dashboard.admin"]}><DirectorDashboard /></Guard>} />
          <Route path="directors/brokers" element={<Guard perm={["brokers.read"]}><BrokersPage /></Guard>} />
          <Route path="directors/brokers/import" element={<Guard perm={["brokers.write"]}><ImportPage entity="brokers" /></Guard>} />
          <Route path="directors/brokers/:id" element={<Guard perm={["brokers.read"]}><BrokerProfile /></Guard>} />
          <Route path="directors/employees" element={<Guard perm={["employees.read"]}><EmployeesPage /></Guard>} />
          <Route path="directors/employees/import" element={<Guard perm={["employees.write"]}><ImportPage entity="employees" /></Guard>} />
          <Route path="directors/employees/announcements" element={<Guard perm={["announcements.send"]}><AnnouncementsPage /></Guard>} />
          <Route path="directors/employees/:id" element={<Guard perm={["employees.read"]}><EmployeeProfile /></Guard>} />
          <Route path="directors/documents" element={<Guard perm={["documents.read"]}><DocumentsPage /></Guard>} />
          {/* Shared business */}
          <Route path="leads" element={<Guard perm={["leads.read"]}><LeadsPage /></Guard>} />
          <Route path="leads/:id" element={<Guard perm={["leads.read"]}><LeadDetail /></Guard>} />
          <Route path="forms" element={<Guard perm={["forms.read"]}><FormsPage /></Guard>} />
          <Route path="forms/new" element={<Guard perm={["forms.write"]}><FormBuilder /></Guard>} />
          <Route path="forms/:id" element={<Guard perm={["forms.read"]}><FormBuilder /></Guard>} />
          <Route path="calendar" element={<Guard perm={["meetings.manage", "calendar.personal"]}><CalendarPage /></Guard>} />
          <Route path="properties" element={<Guard perm={["properties.read"]}><PropertiesPage /></Guard>} />
          <Route path="properties/:id" element={<Guard perm={["properties.read"]}><PropertyProfile /></Guard>} />
          {/* Personal */}
          <Route path="notifications" element={<Guard><NotificationsPage /></Guard>} />
          <Route path="settings" element={<Guard><AccountSettings /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SessionContext.Provider>
  );
}

export function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { pathname } = useLocation();
  const isPublic = pathname.startsWith("/f/");
  if (isLoading && !isPublic) return <Splash />;
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/f/:slug" element={<PublicForm />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/accept-invite" element={isAuthenticated ? <Navigate to="/" replace /> : <AcceptInvite />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={isAuthenticated ? <Authenticated /> : <Navigate to="/login" replace state={{ from: pathname }} />} />
      </Routes>
    </Suspense>
  );
}
