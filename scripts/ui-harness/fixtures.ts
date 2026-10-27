/* Sample data for visual QA only. All people and figures are fictional. */
import { PERMISSIONS } from "../../convex/lib/permissionMatrix";

const now = Date.now();
const h = 3600_000, d = 24 * h;
const id = (p: string, i: number) => `${p}_${i}`;
const role = (new URLSearchParams(location.search).get("role") ?? localStorage.getItem("harness.role") ?? "super_admin") as "super_admin" | "director" | "marketing";
localStorage.setItem("harness.role", role);
import { ROLE_PERMISSIONS } from "../../convex/lib/permissionMatrix";

const names = ["Thandi Nkosi", "Pieter van der Merwe", "Ayesha Patel", "Sipho Dlamini", "Lerato Mokoena", "Johan Botha", "Naledi Khumalo", "Michael Chen"];
const brokers = names.map((n, i) => ({ _id: id("b", i), _creationTime: now - i * d, fullName: n, company: ["JHI Properties", "Broll", "Pam Golding Commercial", "Galetti", "Spire", "Lew Geffen"][i % 6], position: "Leasing Broker", email: `${n.split(" ")[0].toLowerCase()}@example.co.za`, mobile: `082 55${i} 01${i}${i}`, region: ["Johannesburg South", "Pretoria East", "Durban North", "Cape Town CBD"][i % 4], province: ["Gauteng", "Gauteng", "KwaZulu-Natal", "Western Cape"][i % 4], contactStatus: (["active", "prospect", "active", "inactive"] as const)[i % 4], updatedAt: now - i * 5 * h, version: 1, searchText: "", createdBy: "u_1", updatedBy: "u_1" }));
const leads = ["Kagiso Molefe", "Emma Smith", "Zanele Ndlovu", "Ruan Pretorius", "Fatima Adams", "David Naidoo"].map((n, i) => ({ _id: id("l", i), _creationTime: now - i * 7 * h, name: n, email: `${n.split(" ")[0].toLowerCase()}@mail.example`, phone: "071 000 0000", source: ["Southdale leasing enquiry", "Hatfield Plaza retail space", "General enquiry"][i % 3], status: (["new", "new", "contacted", "qualified", "follow_up", "converted"] as const)[i], submittedAt: now - i * 7 * h, assignedToName: i % 2 ? "Pieter van der Merwe" : undefined, answers: [], consent: true, visibleToMarketing: true, version: 1, updatedAt: now }));

export const fixtures: Record<string, unknown> = {
  "users.me": { _id: "u_1", name: role === "director" ? "Pieter van der Merwe" : role === "marketing" ? "Naledi Khumalo" : "Elizabeth Cole", email: "you@example.co.za", role, status: "active", timezone: "Africa/Johannesburg", permissions: [...(role === "super_admin" ? PERMISSIONS : ROLE_PERMISSIONS[role])] },
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

const cover = (a: string, b: string, label: string) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/><circle cx='640' cy='120' r='170' fill='none' stroke='rgba(255,255,255,.25)' stroke-width='40'/><text x='60' y='520' font-family='Inter,Arial' font-size='54' font-weight='700' fill='white'>${label}</text></svg>`);
const studio = [
  { n: "Southdale Leasing Booklet 2026.pdf", c: "Booklets", t: "application/pdf", cv: null, f: true, col: "Leasing 2026" },
  { n: "Hatfield Plaza Brochure.pdf", c: "Brochures", t: "application/pdf", cv: null, f: true, col: "Leasing 2026" },
  { n: "Spring campaign billboard.ai", c: "Designs", t: "application/postscript", cv: null, f: true, col: "Spring 2026" },
  { n: "Investor presentation Q3.pptx", c: "Presentations", t: "application/vnd.openxmlformats-officedocument.presentationml.presentation", cv: null, f: true, col: "Investor relations" },
  { n: "Centre walk-through.mp4", c: "Videos", t: "video/mp4", cv: null, f: false, col: "Spring 2026" },
  { n: "Instagram story pack", c: "Social media", t: "application/zip", cv: null, f: false, col: "Spring 2026" },
  { n: "ONE brand guidelines.pdf", c: "Brand & logos", t: "application/pdf", cv: null, f: false },
  { n: "Food court photography", c: "Photography", t: "image/jpeg", cv: cover("#7c2d12", "#ea580c", "Food court"), f: false },
  { n: "Tenant newsletter template.docx", c: "Templates", t: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", cv: null, f: false },
  { n: "Footfall report September.xlsx", c: "Documents", t: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", cv: null, f: false },
].map((x, i) => ({
  _id: `sa_${i}`, _creationTime: now - i * 1.3 * d, name: x.n, category: x.c, contentType: x.t, size: [4.2e6, 2.8e6, 18e6, 9.1e6, 64e6, 3.3e6, 7.7e6, 2.1e6, 0.2e6, 0.4e6][i],
  coverUrl: x.cv, url: x.c === "Photography" ? x.cv : null, featured: x.f, collection: x.col, tags: ["leasing"], downloads: [42, 31, 12, 27, 9, 4, 18, 6, 3, 2][i], versionNumber: i === 0 ? 2 : 1, version: 1,
  description: "Approved for external use.", uploaderName: "Naledi Khumalo", createdBy: "u_3", storageId: "s", searchText: "", updatedAt: now - [0.5, 18, 16, 10, 8, 3, 21, 5, 30, 2][i] * d,
}));
const counts: Record<string, number> = {};
studio.forEach((s) => (counts[s.category] = (counts[s.category] ?? 0) + 1));
fixtures["studio.overview"] = {
  categories: [["Booklets", "Leasing & property booklets"], ["Brochures", "Centre & portfolio brochures"], ["Designs", "Artwork, banners & signage"], ["Social media", "Posts, stories & ads"], ["Presentations", "Pitch & investor decks"], ["Videos", "Promos, walk-throughs & reels"], ["Photography", "Centre & property photos"], ["Brand & logos", "Logos, fonts & guidelines"], ["Templates", "Editable templates"], ["Documents", "Copy, reports & other files"]].map(([key, hint]) => ({ key, hint, count: (counts[key] ?? 0) * 3 })),
  total: 30, newThisWeek: 6, totalBytes: 3e8, downloads: 154, collections: ["Investor relations", "Leasing 2026", "Spring 2026"], canUpload: role !== "director",
};
fixtures["studio.featured"] = studio.filter((s) => s.featured);
fixtures["studio.list"] = (a: { category?: string }) => studio.filter((s) => !a?.category || s.category === a.category);
fixtures["studio.get"] = (a: { id: string }) => {
  const s = studio.find((x) => x._id === a.id);
  return s ? { ...s, propertyName: "Southdale Shopping Centre", versions: s.versionNumber > 1 ? [{ _id: "old", versionNumber: 1, _creationTime: now - 40 * d }] : [] } : null;
};

fixtures["studio.collections"] = [
  { name: "Spring 2026", count: 12, updatedAt: now - 2 * d, mainCategory: "Designs", coverUrl: null },
  { name: "Leasing 2026", count: 8, updatedAt: now - 9 * d, mainCategory: "Booklets", coverUrl: null },
  { name: "Investor relations", count: 5, updatedAt: now - 16 * d, mainCategory: "Presentations", coverUrl: null },
  { name: "Festive season", count: 14, updatedAt: now - 30 * d, mainCategory: "Social media", coverUrl: null },
];
