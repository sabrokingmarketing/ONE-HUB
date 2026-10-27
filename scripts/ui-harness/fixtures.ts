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
  "users.me": { _id: "u_1", name: role === "marketing" ? "Naledi Khumalo" : role === "director" ? "Pieter van der Merwe" : "Elizabeth Cole", email: "you@example.co.za", role, status: "active", timezone: "Africa/Johannesburg", permissions: [...(role === "super_admin" ? PERMISSIONS : ROLE_PERMISSIONS[role])] },
  "notifications.unreadCount": 3,
  "notifications.list": [
    { _id: "n1", _creationTime: now - 600_000, type: "lead", title: "New lead: Kagiso Molefe", body: "Submitted via \"Southdale leasing enquiry\"", userId: "u_1" },
    { _id: "n2", _creationTime: now - 2 * h, type: "meeting", title: "Board meeting starts in 1 hour", body: "Tue, 14:00", userId: "u_1" },
    { _id: "n3", _creationTime: now - 5 * h, type: "post_failed", title: "A scheduled social post failed to publish", body: "Live publishing is switched off", userId: "u_1", readAt: now },
  ],
  "dashboard.admin": {
    totals: { users: 12, directors: 5, marketing: 4, brokers: 148, employees: 63, newLeads: 9, leads30d: 74, activeCampaigns: 3, scheduledPosts: 14, publishedPosts: 52, failedPosts: 1, upcomingMeetings: 6, emailsSent7d: 41, emailFailures: 0 },
    leadSeries: Array.from({ length: 14 }, (_, i) => ({ day: new Date(now - (13 - i) * d).toISOString().slice(0, 10), leads: [2, 4, 3, 6, 5, 2, 1, 7, 6, 8, 5, 9, 6, 10][i] })),
    activity: [
      { _id: "a1", at: now - 300_000, actorName: "Pieter van der Merwe", summary: "Imported brokers: 48 created, 2 updated, 1 skipped", entity: "brokers", action: "import" },
      { _id: "a2", at: now - h, actorName: "Naledi Khumalo", summary: "Post created (scheduled)", entity: "socialPosts", action: "create" },
      { _id: "a3", at: now - 3 * h, actorName: "Ayesha Patel", summary: "Updated Sipho Dlamini: phone", entity: "employees", action: "update" },
      { _id: "a4", at: now - 6 * h, actorName: "Elizabeth Cole", summary: "Invited johan@example.co.za as Director", entity: "invitations", action: "invite.create" },
    ],
  },
  "dashboard.director": {
    recentBrokers: brokers.slice(0, 4), recentEmployees: names.slice(2, 6).map((n, i) => ({ _id: id("e", i), name: n, jobTitle: ["Centre Manager", "Leasing Executive", "Financial Controller", "Marketing Coordinator"][i], updatedAt: now - i * 4 * h })),
    newLeads: leads.slice(0, 4), newLeadCount: 9, followUps: 3, announcements: [{ _id: "an1", subject: "Office closed on Heritage Day", sentAt: now - 2 * d, template: "general" }], marketing: { postsThisWeek: 6 },
  },
  "dashboard.marketing": {
    accounts: [{ _id: "ma1", name: "Southdale Shopping Centre", platform: "facebook", status: "connected" }, { _id: "ma2", name: "@onepropertyholdings", platform: "instagram", status: "expired" }],
    upcoming: [{ _id: "p1", caption: "Spring specials all weekend at Southdale — 30+ stores taking part!", scheduledAt: now + 20 * h }, { _id: "p2", caption: "Meet our new leasing team at Hatfield Plaza.", scheduledAt: now + 2 * d }],
    counts: { scheduled: 14, failed: 1, published: 52, activeCampaigns: 3, newLeads7d: 11 },
    campaigns: [{ _id: "c1", name: "Spring at Southdale", endDate: "2026-11-30", progress: 60 }, { _id: "c2", name: "Festive season 2026", endDate: "2026-12-31", progress: 20 }],
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
  "assets.recent": [{ _id: "as1", name: "Southdale leasing brochure 2026.pdf", category: "Brochures", contentType: "application/pdf", _creationTime: now - d }],
  "assets.categories": ["Corporate Branding", "Property Portfolios", "Shopping Centres", "Presentations", "Brochures"],
  "brokers.list": { page: brokers, isDone: true, continueCursor: "" },
  "properties.options": [{ _id: "pr1", name: "Southdale Shopping Centre", type: "shopping_centre" }, { _id: "pr2", name: "Hatfield Plaza", type: "shopping_centre" }],
  "users.colleagues": names.slice(0, 5).map((n, i) => ({ _id: id("u", i), name: n, email: "x@example.co.za", role: i < 3 ? "director" : "marketing" })),
  "leads.list": { page: leads, isDone: true, continueCursor: "" },
  "leads.counts": { new: 9, contacted: 6, qualified: 4, follow_up: 3, converted: 12, closed: 7 },
  "socialPosts.counts": { draft: 3, pending_approval: 0, approved: 0, scheduled: 14, publishing: 0, published: 52, failed: 1, cancelled: 2 },
  "socialPosts.list": [0, 1, 3, 6, 9, 12].map((o, i) => ({ _id: id("p", i), caption: ["Spring specials all weekend at Southdale!", "Meet our leasing team", "Kids' holiday programme starts Monday", "New store opening: Clicks", "Festive trading hours", "Thank you, Hatfield!"][i], scheduledAt: now + o * d + 10 * h, status: i === 5 ? "published" : i === 4 ? "failed" : "scheduled", accounts: [{ _id: "ma1", name: "Southdale", platform: "facebook" }], authorName: "Naledi Khumalo", version: 1, hashtags: [], accountIds: [], mediaStorageIds: [], thumbUrl: null })),
  "ideas.list": [
    { _id: "i1", title: "Back-to-school competition", description: "Win a R2,000 voucher — entries via lead form.", status: "new", priority: "high", platform: "Instagram", contentType: "Competition", creatorName: "Naledi Khumalo", propertyName: "Southdale Shopping Centre", order: 1 },
    { _id: "i2", title: "Tenant spotlight series", status: "under_review", priority: "medium", platform: "Facebook", creatorName: "Michael Chen", order: 2 },
    { _id: "i3", title: "Festive trading hours carousel", status: "approved", priority: "high", platform: "Instagram", contentType: "Carousel", creatorName: "Naledi Khumalo", order: 3 },
    { _id: "i4", title: "Leasing video walk-through", status: "in_production", priority: "medium", contentType: "Video", creatorName: "Lerato Mokoena", order: 4 },
  ],
  "users.list": { users: names.slice(0, 6).map((n, i) => ({ _id: id("u", i), name: n, email: `${n.split(" ")[0].toLowerCase()}@example.co.za`, role: i === 0 ? "super_admin" : i < 4 ? "director" : "marketing", status: i === 5 ? "suspended" : "active", lastLoginAt: now - i * 9 * h, createdAt: now - 40 * d, marketingSocialAccess: false, calendarEnabled: false })), invitations: [{ _id: "inv1", name: "Johan Botha", email: "johan@example.co.za", role: "director", expiresAt: now + 5 * d, expired: false }] },
};
