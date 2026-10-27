/* Sample data for visual QA only. All people and figures are fictional. */
import { PERMISSIONS } from "../../convex/lib/permissionMatrix";

const now = Date.now();
const h = 3600_000, d = 24 * h;
const id = (p: string, i: number) => `${p}_${i}`;
const role = (new URLSearchParams(location.search).get("role") ?? localStorage.getItem("harness.role") ?? "super_admin") as "super_admin" | "director";
localStorage.setItem("harness.role", role);
import { ROLE_PERMISSIONS } from "../../convex/lib/permissionMatrix";

const names = ["Thandi Nkosi", "Pieter van der Merwe", "Ayesha Patel", "Sipho Dlamini", "Lerato Mokoena", "Johan Botha", "Naledi Khumalo", "Michael Chen"];
const brokers = names.map((n, i) => ({ _id: id("b", i), _creationTime: now - i * d, fullName: n, company: ["JHI Properties", "Broll", "Pam Golding Commercial", "Galetti", "Spire", "Lew Geffen"][i % 6], position: "Leasing Broker", email: `${n.split(" ")[0].toLowerCase()}@example.co.za`, mobile: `082 55${i} 01${i}${i}`, region: ["Johannesburg South", "Pretoria East", "Durban North", "Cape Town CBD"][i % 4], province: ["Gauteng", "Gauteng", "KwaZulu-Natal", "Western Cape"][i % 4], contactStatus: (["active", "prospect", "active", "inactive"] as const)[i % 4], updatedAt: now - i * 5 * h, version: 1, searchText: "", createdBy: "u_1", updatedBy: "u_1" }));
const leads = ["Kagiso Molefe", "Emma Smith", "Zanele Ndlovu", "Ruan Pretorius", "Fatima Adams", "David Naidoo"].map((n, i) => ({ _id: id("l", i), _creationTime: now - i * 7 * h, name: n, email: `${n.split(" ")[0].toLowerCase()}@mail.example`, phone: "071 000 0000", source: ["Southdale leasing enquiry", "Hatfield Plaza retail space", "General enquiry"][i % 3], status: (["new", "new", "contacted", "qualified", "follow_up", "converted"] as const)[i], submittedAt: now - i * 7 * h, assignedToName: i % 2 ? "Pieter van der Merwe" : undefined, answers: [], consent: true, visibleToMarketing: true, version: 1, updatedAt: now }));

export const fixtures: Record<string, unknown> = {
  "users.me": { _id: "u_1", name: role === "director" ? "Pieter van der Merwe" : "Elizabeth Cole", email: "you@example.co.za", role, status: "active", timezone: "Africa/Johannesburg", permissions: [...(role === "super_admin" ? PERMISSIONS : ROLE_PERMISSIONS[role])] },
  "notifications.unreadCount": 3,
  "notifications.list": [
    { _id: "n1", _creationTime: now - 600_000, type: "lead", title: "New lead: Kagiso Molefe", body: "Submitted via \"Southdale leasing enquiry\"", userId: "u_1" },
    { _id: "n2", _creationTime: now - 2 * h, type: "meeting", title: "Board meeting starts in 1 hour", body: "Tue, 14:00", userId: "u_1" },
    { _id: "n3", _creationTime: now - 5 * h, type: "document", title: "New document: Southdale leasing brochure", body: "Brochures", userId: "u_1", readAt: now },
  ],
  "dashboard.admin": {
    totals: { users: 8, admins: 2, directors: 6, brokers: 148, employees: 63, newLeads: 9, leads30d: 74, properties: 7, documents: 36, upcomingMeetings: 6, emailsSent7d: 41, emailFailures: 0 },
    leadSeries: Array.from({ length: 14 }, (_, i) => ({ day: new Date(now - (13 - i) * d).toISOString().slice(0, 10), leads: [2, 4, 3, 6, 5, 2, 1, 7, 6, 8, 5, 9, 6, 10][i] })),
    activity: [
      { _id: "a1", at: now - 300_000, actorName: "Pieter van der Merwe", summary: "Imported brokers: 48 created, 2 updated, 1 skipped", entity: "brokers", action: "import" },
      { _id: "a2", at: now - h, actorName: "Johan Botha", summary: "Uploaded \"Hatfield Plaza tenant mix.pdf\"", entity: "documents", action: "upload" },
      { _id: "a3", at: now - 3 * h, actorName: "Ayesha Patel", summary: "Updated Sipho Dlamini: phone", entity: "employees", action: "update" },
      { _id: "a4", at: now - 6 * h, actorName: "Elizabeth Cole", summary: "Invited johan@example.co.za as Director", entity: "invitations", action: "invite.create" },
    ],
  },
  "dashboard.director": {
    brokerCount: 148, employeeCount: 63,
    recentBrokers: brokers.slice(0, 5), recentEmployees: names.slice(2, 6).map((n, i) => ({ _id: id("e", i), name: n, jobTitle: ["Centre Manager", "Leasing Executive", "Financial Controller", "Marketing Coordinator"][i], updatedAt: now - i * 4 * h })),
    newLeads: leads.slice(0, 6), newLeadCount: 9, followUps: 3, announcements: [{ _id: "an1", subject: "Office closed on Heritage Day", sentAt: now - 2 * d, template: "general" }, { _id: "an2", subject: "Q4 board pack available", sentAt: now - 4 * d, template: "document" }],
  },
  "meetings.upcoming": [
    { _id: "m1", title: "Monthly directors' meeting", startsAt: now + 26 * h, endsAt: now + 28 * h, location: "Boardroom, Rosebank", timezone: "Africa/Johannesburg" },
    { _id: "m2", title: "Southdale tenant review", startsAt: now + 3 * d, endsAt: now + 3 * d + h, videoLink: "https://teams.example", timezone: "Africa/Johannesburg" },
  ],
  "meetings.range": [
    { _id: "m1", title: "Monthly directors' meeting", startsAt: now + 26 * h, endsAt: now + 28 * h, location: "Boardroom", scope: "company", status: "scheduled", participantCount: 6, isMine: true, timezone: "Africa/Johannesburg" },
    { _id: "m3", title: "Broker breakfast", startsAt: now - 2 * d, endsAt: now - 2 * d + h, scope: "company", status: "scheduled", participantCount: 12, isMine: false, timezone: "Africa/Johannesburg" },
    { _id: "m4", title: "Dentist", startsAt: now + 5 * d, endsAt: now + 5 * d + h, scope: "private", status: "scheduled", participantCount: 1, isMine: true, timezone: "Africa/Johannesburg" },
  ],
  "meetings.myConnections": [],
  "documents.recent": [{ _id: "as1", name: "Southdale leasing brochure 2026.pdf", category: "Brochures", contentType: "application/pdf", _creationTime: now - d }],
  "documents.categories": ["Corporate Branding", "Property Portfolios", "Shopping Centres", "Presentations", "Brochures"],
  "brokers.list": { page: brokers, isDone: true, continueCursor: "" },
  "properties.options": [{ _id: "pr1", name: "Southdale Shopping Centre", type: "shopping_centre" }, { _id: "pr2", name: "Hatfield Plaza", type: "shopping_centre" }],
  "users.colleagues": names.slice(0, 5).map((n, i) => ({ _id: id("u", i), name: n, email: "x@example.co.za", role: "director" })),
  "leads.list": { page: leads, isDone: true, continueCursor: "" },
  "leads.counts": { new: 9, contacted: 6, qualified: 4, follow_up: 3, converted: 12, closed: 7 },
  "users.list": { users: names.slice(0, 6).map((n, i) => ({ _id: id("u", i), name: n, email: `${n.split(" ")[0].toLowerCase()}@example.co.za`, role: i < 2 ? "super_admin" : "director", status: i === 5 ? "suspended" : "active", lastLoginAt: now - i * 9 * h, createdAt: now - 40 * d })), invitations: [{ _id: "inv1", name: "Johan Botha", email: "johan@example.co.za", role: "director", expiresAt: now + 5 * d, expired: false }] },
};

fixtures["documents.list"] = [
  { _id: "doc1", _creationTime: now - d, name: "Southdale leasing brochure 2026.pdf", category: "Brochures", contentType: "application/pdf", size: 2_400_000, tags: ["leasing"], url: null, uploaderName: "Johan Botha" },
  { _id: "doc2", _creationTime: now - 2 * d, name: "Hatfield Plaza tenant mix.xlsx", category: "Leasing", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 180_000, tags: [], url: null, uploaderName: "Ayesha Patel" },
  { _id: "doc3", _creationTime: now - 3 * d, name: "Board presentation Q3.pptx", category: "Presentations", contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: 8_100_000, tags: ["board"], url: null, uploaderName: "Elizabeth Cole" },
  { _id: "doc4", _creationTime: now - 5 * d, name: "Corporate logo pack.zip", category: "Corporate Branding", contentType: "application/zip", size: 12_000_000, tags: ["brand"], url: null, uploaderName: "Elizabeth Cole" },
];
