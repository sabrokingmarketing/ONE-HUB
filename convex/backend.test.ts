import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { modules } from "./test.setup";

type Role = "super_admin" | "director";

async function setup() {
  const t = convexTest(schema, modules);
  const mk = async (name: string, role: Role, extra: Record<string, unknown> = {}) => {
    const id = await t.run((ctx) => ctx.db.insert("users", { name, email: `${name.toLowerCase()}@one.test`, role, status: "active", ...extra }));
    return { id, as: t.withIdentity({ subject: `${id}|session`, name }) };
  };
  const admin = await mk("Admin", "super_admin");
  const dirA = await mk("DirectorA", "director");
  const dirB = await mk("DirectorB", "director");
  return { t, admin, dirA, dirB };
}

describe("shared directory + permissions", () => {
  test("broker created by Director A is visible to Director B and Admin", async () => {
    const { dirA, dirB, admin } = await setup();
    await dirA.as.mutation(api.brokers.create, { data: { fullName: "Thandi Nkosi", email: "Thandi@Broker.co.za", mobile: "082 123 4567" } });
    const opts = { paginationOpts: { numItems: 20, cursor: null } };
    expect((await dirB.as.query(api.brokers.list, opts)).page.map((b) => b.fullName)).toEqual(["Thandi Nkosi"]);
    expect((await admin.as.query(api.brokers.list, opts)).page).toHaveLength(1);
  });

  test("directors cannot manage users or settings (enforced on the backend)", async () => {
    const { dirA } = await setup();
    await expect(dirA.as.mutation(api.users.invite, { email: "x@y.co.za", name: "X", role: "director" })).rejects.toThrow(/permission/);
    await expect(dirA.as.query(api.users.list, {})).rejects.toThrow(/permission/);
    await expect(dirA.as.mutation(api.system.setSetting, { key: "leads.retentionDays", value: "1" })).rejects.toThrow(/permission/);
  });

  test("unauthenticated callers are rejected", async () => {
    const { t } = await setup();
    await expect(t.query(api.brokers.list, { paginationOpts: { numItems: 5, cursor: null } })).rejects.toThrow(/sign in/i);
  });

  test("suspended users lose access immediately", async () => {
    const { t, admin, dirB } = await setup();
    await admin.as.mutation(api.users.setStatus, { userId: dirB.id, status: "suspended" });
    await expect(dirB.as.query(api.brokers.list, { paginationOpts: { numItems: 5, cursor: null } })).rejects.toThrow(/sign in/i);
    const sessions = await t.run((ctx) => ctx.db.query("authSessions").collect());
    expect(sessions).toHaveLength(0);
  });

  test("duplicate brokers are detected by normalised email and SA mobile", async () => {
    const { dirA, dirB } = await setup();
    await dirA.as.mutation(api.brokers.create, { data: { fullName: "A", mobile: "+27 82 123 4567" } });
    await expect(dirB.as.mutation(api.brokers.create, { data: { fullName: "B", mobile: "082-123-4567" } })).rejects.toThrow(/already exists/);
  });

  test("concurrent edits never silently overwrite (version conflict)", async () => {
    const { dirA, dirB } = await setup();
    const id = await dirA.as.mutation(api.employees.create, { data: { firstName: "Sipho", lastName: "Dlamini", phone: "011 000 0000" } });
    const v1 = (await dirA.as.query(api.employees.get, { id }))!.version;
    await dirB.as.mutation(api.employees.update, { id, expectedVersion: v1, data: { firstName: "Sipho", lastName: "Dlamini", phone: "011 999 9999" } });
    await expect(
      dirA.as.mutation(api.employees.update, { id, expectedVersion: v1, data: { firstName: "Sipho", lastName: "Dlamini", phone: "011 111 1111" } }),
    ).rejects.toThrow(/changed by someone else/);
    expect((await dirA.as.query(api.employees.get, { id }))!.phone).toBe("011 999 9999");
  });

  test("import analysis flags invalid, in-file duplicate and existing rows", async () => {
    const { dirA } = await setup();
    await dirA.as.mutation(api.brokers.create, { data: { fullName: "Existing", email: "e@x.co.za" } });
    const res = await dirA.as.query(api.brokers.analyseImport, {
      rows: [{ fullName: "New One", email: "n@x.co.za" }, { fullName: "Dup", email: "N@x.co.za" }, { fullName: "Old", email: "e@x.co.za" }, { fullName: "", email: "bad" }],
    });
    expect(res.map((r) => r.status)).toEqual(["new", "duplicate_in_file", "existing", "invalid"]);
  });
});

describe("lead forms", () => {
  const fields = [
    { id: "f1", type: "first_name" as const, label: "First name", required: true },
    { id: "f2", type: "email" as const, label: "Email", required: true },
    { id: "f3", type: "consent" as const, label: "I agree", required: true },
  ];
  test("public submission creates a shared lead and notifies directors", async () => {
    const { t, dirA, dirB } = await setup();
    const formId = await dirA.as.mutation(api.leadForms.create, {
      data: { title: "Southdale enquiries", fields, thankYouMessage: "Thanks!", notifyUserIds: [], status: "active" },
    });
    const form = await dirA.as.query(api.leadForms.get, { id: formId });
    const pub = await t.query(api.leadForms.publicGet, { slug: form!.slug });
    expect(pub).not.toHaveProperty("notifyUserIds");
    await t.mutation(api.leadForms.submit, { slug: form!.slug, answers: { f1: "Lerato", f2: "lerato@mail.co.za", f3: true }, elapsedMs: 8000 });
    const leads = await dirB.as.query(api.leads.list, { paginationOpts: { numItems: 10, cursor: null } });
    expect(leads.page[0].name).toBe("Lerato");
    expect(leads.page[0].consent).toBe(true);
    expect(await dirB.as.query(api.notifications.unreadCount, {})).toBe(1);
  });

  test("honeypot / too-fast submissions are dropped silently", async () => {
    const { t, dirB, dirA } = await setup();
    const formId = await dirB.as.mutation(api.leadForms.create, {
      data: { title: "Bot test", fields, thankYouMessage: "Thanks", notifyUserIds: [], status: "active" },
    });
    const form = await dirB.as.query(api.leadForms.get, { id: formId });
    await t.mutation(api.leadForms.submit, { slug: form!.slug, answers: { f1: "Bot", f2: "bot@x.co.za", f3: true }, elapsedMs: 200 });
    await t.mutation(api.leadForms.submit, { slug: form!.slug, answers: { f1: "Bot", f2: "bot@x.co.za", f3: true }, honeypot: "x", elapsedMs: 9000 });
    expect((await dirA.as.query(api.leads.list, { paginationOpts: { numItems: 10, cursor: null } })).page).toHaveLength(0);
  });

  test("directors can assign a lead to a colleague, who gets notified", async () => {
    const { t, dirA, dirB } = await setup();
    const formId = await dirA.as.mutation(api.leadForms.create, {
      data: { title: "Shared", fields, thankYouMessage: "Thanks", notifyUserIds: [], status: "active" },
    });
    const form = await dirA.as.query(api.leadForms.get, { id: formId });
    await t.mutation(api.leadForms.submit, { slug: form!.slug, answers: { f1: "Ann", f2: "ann@x.co.za", f3: true }, elapsedMs: 9000 });
    const lead = (await dirA.as.query(api.leads.list, { paginationOpts: { numItems: 10, cursor: null } })).page[0];
    await dirA.as.mutation(api.leads.update, { id: lead._id, expectedVersion: lead.version, assignedTo: dirB.id });
    const updated = await dirB.as.query(api.leads.get, { id: lead._id });
    expect(updated!.assignedTo).toBe(dirB.id);
    const notes = await dirB.as.query(api.notifications.list, {});
    expect(notes.some((n) => n.title.includes("assigned you a lead"))).toBe(true);
  });
});

describe("email + announcements", () => {
  test("announcement queues one email per recipient and blocks exact duplicates", async () => {
    const { t, dirA } = await setup();
    await dirA.as.mutation(api.employees.create, { data: { firstName: "A", lastName: "One", email: "a@one.test", department: "Finance" } });
    await dirA.as.mutation(api.employees.create, { data: { firstName: "B", lastName: "Two", email: "b@one.test", department: "Leasing" } });
    const args = { audience: "all" as const, subject: "Office closed Friday", body: "Hi all", template: "general" as const, confirmedCount: 2 };
    const r = await dirA.as.mutation(api.announcements.send, args);
    expect(r.count).toBe(2);
    const jobs = await t.run((ctx) => ctx.db.query("emailJobs").collect());
    expect(jobs).toHaveLength(2);
    await expect(dirA.as.mutation(api.announcements.send, args)).rejects.toThrow(/already sent/);
    await expect(dirA.as.mutation(api.announcements.send, { ...args, subject: "Other", confirmedCount: 5 })).rejects.toThrow(/recipient list changed/);
  });
});

describe("go-live security", () => {
  const fields = [
    { id: "f1", type: "first_name" as const, label: "First name", required: true },
    { id: "f2", type: "email" as const, label: "Email", required: true },
    { id: "f3", type: "consent" as const, label: "I agree", required: true },
  ];
  test("no open signup: the first Super Admin comes only from the internal bootstrap invite", async () => {
    const t = convexTest(schema, modules);
    const r = await t.mutation(internal.system.bootstrapAdmin, { email: "Boss@One.test", name: "Boss" });
    expect(r.url).toMatch(/^https:\/\/hub\.test\/accept-invite\?token=[0-9a-f]{64}$/);
    const token = r.url.split("token=")[1];
    const invite = await t.query(api.users.getInvitation, { token });
    expect(invite).toMatchObject({ email: "boss@one.test", role: "super_admin", valid: true });

    // Once an active Super Admin exists the command refuses.
    await t.run((ctx) => ctx.db.insert("users", { name: "Boss", email: "boss@one.test", role: "super_admin", status: "active" }));
    await expect(t.mutation(internal.system.bootstrapAdmin, { email: "x@one.test", name: "X" })).rejects.toThrow(/already exists/);
  });

  test("erasing a lead removes its notifications, alert email body and audit details", async () => {
    const { t, dirA, admin } = await setup();
    const formId = await dirA.as.mutation(api.leadForms.create, {
      data: { title: "Erase", fields, thankYouMessage: "Thanks", notifyUserIds: [dirA.id], status: "active" },
    });
    const form = await dirA.as.query(api.leadForms.get, { id: formId });
    await t.mutation(api.leadForms.submit, { slug: form!.slug, answers: { f1: "Naledi", f2: "naledi@x.co.za", f3: true }, elapsedMs: 9000 });
    const lead = (await dirA.as.query(api.leads.list, { paginationOpts: { numItems: 10, cursor: null } })).page[0];
    await admin.as.mutation(api.leads.erase, { id: lead._id, confirmName: "Naledi" });

    const leftovers = await t.run(async (ctx) => {
      const jobs = await ctx.db.query("emailJobs").collect();
      const notes = await ctx.db.query("notifications").collect();
      const logs = await ctx.db.query("auditLogs").collect();
      return JSON.stringify({ jobs, notes, logs });
    });
    expect(leftovers).not.toMatch(/Naledi|naledi@x\.co\.za/);
  });

  test("lead alert emails stop during a submission flood, but leads are still saved", async () => {
    const { t, dirA } = await setup();
    const formId = await dirA.as.mutation(api.leadForms.create, {
      data: { title: "Flood", fields, thankYouMessage: "Thanks", notifyUserIds: [dirA.id], status: "active" },
    });
    const form = await dirA.as.query(api.leadForms.get, { id: formId });
    for (let i = 0; i < 18; i++) {
      await t.mutation(api.leadForms.submit, { slug: form!.slug, answers: { f1: `L${i}`, f2: `l${i}@x.co.za`, f3: true }, elapsedMs: 9000 });
    }
    const counts = await t.run(async (ctx) => ({
      leads: (await ctx.db.query("leads").collect()).length,
      emails: (await ctx.db.query("emailJobs").collect()).filter((j) => j.kind === "lead_alert").length,
    }));
    expect(counts).toEqual({ leads: 18, emails: 15 });
    await expect(
      t.mutation(api.leadForms.submit, { slug: form!.slug, answers: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`x${i}`, "y"])), elapsedMs: 9000 }),
    ).rejects.toThrow(/doesn't match/);
  });

  test("Marketing-team accounts don't get the colleague directory", async () => {
    const { t } = await setup();
    const id = await t.run((ctx) => ctx.db.insert("users", { name: "Mia", email: "mia@one.test", role: "marketing", status: "active" }));
    const mia = t.withIdentity({ subject: `${id}|session`, name: "Mia" });
    expect(await mia.query(api.users.colleagues, {})).toEqual([]);
  });
});

describe("property cover image", () => {
  test("accepts an image, replaces the old one, rejects non-images and can be removed", async () => {
    const { t, dirA, dirB } = await setup();
    const store = (type: string) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3, 4])], { type })));
    const id = await dirA.as.mutation(api.properties.create, { data: { name: "Southdale", type: "shopping_centre", location: "Johannesburg" } });

    const first = await store("image/jpeg");
    await dirA.as.mutation(api.properties.setCover, { id, storageId: first });
    expect((await dirB.as.query(api.properties.get, { id }))?.coverUrl).toBeTruthy();
    expect((await dirB.as.query(api.properties.list, {}))[0].coverUrl).toBeTruthy();

    const second = await store("image/png");
    await dirA.as.mutation(api.properties.setCover, { id, storageId: second });
    expect(await t.run((ctx) => ctx.db.system.get(first))).toBeNull();

    const pdf = await store("application/pdf");
    expect(await dirA.as.mutation(api.properties.setCover, { id, storageId: pdf })).toEqual({ error: expect.stringMatching(/Cover images/) });
    expect(await t.run((ctx) => ctx.db.system.get(pdf))).toBeNull();

    await dirA.as.mutation(api.properties.removeCover, { id });
    expect((await dirB.as.query(api.properties.get, { id }))?.coverUrl).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(second))).toBeNull();
  });
});
