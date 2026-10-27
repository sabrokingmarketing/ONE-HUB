import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { modules } from "./test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const mk = async (name: string, role: "super_admin" | "director" | "marketing") => {
    const id = await t.run((ctx) => ctx.db.insert("users", { name, email: `${name}@one.test`, role, status: "active" }));
    return { id, as: t.withIdentity({ subject: `${id}|s` }) };
  };
  const store = (type: string) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3, 4])], { type })));
  return { t, store, admin: await mk("admin", "super_admin"), dir: await mk("dir", "director"), mkt: await mk("mkt", "marketing") };
}

const base = { description: "Spring leasing booklet", category: "Booklets", tags: ["#Leasing", "spring"], featured: true, notifyDirectors: true };

describe("Marketing Studio", () => {
  test("marketing uploads, directors see it instantly and are notified", async () => {
    const { mkt, dir, store } = await setup();
    const storageId = await store("application/pdf");
    await mkt.as.mutation(api.studio.create, { ...base, name: "Southdale booklet 2026", storageId });
    const list = await dir.as.query(api.studio.list, {});
    expect(list.map((a) => a.name)).toEqual(["Southdale booklet 2026"]);
    expect(list[0].tags).toEqual(["leasing", "spring"]);
    expect((await dir.as.query(api.studio.featured, {}))).toHaveLength(1);
    const ov = await dir.as.query(api.studio.overview, {});
    expect(ov.categories.find((c) => c.key === "Booklets")!.count).toBe(1);
    expect(ov.canUpload).toBe(false);
    expect(await dir.as.query(api.notifications.unreadCount, {})).toBe(1);
  });

  test("directors can view but not upload; marketing cannot see company data", async () => {
    const { mkt, dir, store } = await setup();
    const storageId = await store("application/pdf");
    await expect(dir.as.mutation(api.studio.create, { ...base, name: "X", storageId })).rejects.toThrow(/permission/);
    await expect(mkt.as.query(api.brokers.list, { paginationOpts: { numItems: 5, cursor: null } })).rejects.toThrow(/permission/);
    await expect(mkt.as.query(api.leads.list, { paginationOpts: { numItems: 5, cursor: null } })).rejects.toThrow(/permission/);
    await expect(mkt.as.query(api.users.colleagues, {})).resolves.toEqual(expect.any(Array));
  });

  test("new version archives the old one and bumps the version number", async () => {
    const { mkt, dir, store } = await setup();
    const v1 = await mkt.as.mutation(api.studio.create, { ...base, name: "Brochure", storageId: await store("application/pdf") });
    const v2 = await mkt.as.mutation(api.studio.create, { ...base, name: "Brochure", storageId: await store("application/pdf"), replacesId: v1 });
    const list = await dir.as.query(api.studio.list, {});
    expect(list.map((a) => a._id)).toEqual([v2]);
    const got = await dir.as.query(api.studio.get, { id: v2 });
    expect(got!.versionNumber).toBe(2);
    expect(got!.versions.map((x) => x.versionNumber)).toEqual([1]);
  });

  test("rejects unsupported files and invalid categories; counts downloads", async () => {
    const { mkt, dir, store } = await setup();
    await expect(mkt.as.mutation(api.studio.create, { ...base, name: "bad", storageId: await store("application/x-msdownload") })).rejects.toThrow(/Unsupported/);
    await expect(mkt.as.mutation(api.studio.create, { ...base, category: "Nope", name: "bad", storageId: await store("image/png") })).rejects.toThrow(/category/);
    const id = await mkt.as.mutation(api.studio.create, { ...base, name: "Logo", category: "Brand & logos", storageId: await store("image/png") });
    await dir.as.mutation(api.studio.recordDownload, { id });
    await dir.as.mutation(api.studio.recordDownload, { id });
    expect((await dir.as.query(api.studio.get, { id }))!.downloads).toBe(2);
    expect((await dir.as.query(api.studio.list, { kind: "image" })).length).toBe(1);
    expect((await dir.as.query(api.studio.list, { kind: "pdf" })).length).toBe(0);
  });

  test("marketing accounts are not offered as colleagues for assignment", async () => {
    const { dir } = await setup();
    const names = (await dir.as.query(api.users.colleagues, {})).map((c) => c.name);
    expect(names).not.toContain("mkt");
    expect(names).toContain("dir");
  });
});
