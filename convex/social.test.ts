import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { modules } from "./test.setup";
import { escapeLinkedIn, publishToPlatform, validateForPlatform } from "./lib/publishers";

async function setup() {
  const t = convexTest(schema, modules);
  const mk = async (name: string, role: "super_admin" | "director" | "marketing", extra = {}) => {
    const id = await t.run((ctx) => ctx.db.insert("users", { name, email: `${name}@one.test`, role, status: "active", ...extra }));
    return { id, as: t.withIdentity({ subject: `${id}|s` }) };
  };
  return { t, admin: await mk("admin", "super_admin"), dir: await mk("dir", "director"), mkt: await mk("mkt", "marketing"), mktSocial: await mk("mkt2", "marketing", { marketingSocialAccess: true }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("social OAuth connect", () => {
  test("only users with social.connect can start, and only when configured", async () => {
    const { dir, mkt, mktSocial, admin } = await setup();
    await expect(dir.as.mutation(api.socialAuth.startConnect, { provider: "meta" })).rejects.toThrow(/permission/);
    await expect(mkt.as.mutation(api.socialAuth.startConnect, { provider: "meta" })).rejects.toThrow(/permission/);
    await expect(admin.as.mutation(api.socialAuth.startConnect, { provider: "meta" })).rejects.toThrow(/isn't configured/);
    vi.stubEnv("LINKEDIN_CLIENT_ID", "cid");
    vi.stubEnv("LINKEDIN_CLIENT_SECRET", "sec");
    vi.stubEnv("CONVEX_SITE_URL", "https://x.convex.site");
    const url = new URL(await mktSocial.as.mutation(api.socialAuth.startConnect, { provider: "linkedin" }));
    expect(url.hostname).toBe("www.linkedin.com");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.convex.site/oauth/linkedin/callback");
    expect(url.searchParams.get("state")).toHaveLength(48);
  });

  test("OAuth state is single-use and provider-bound", async () => {
    const { t, admin } = await setup();
    vi.stubEnv("META_APP_ID", "app");
    vi.stubEnv("META_APP_SECRET", "secret");
    const url = new URL(await admin.as.mutation(api.socialAuth.startConnect, { provider: "meta" }));
    const state = url.searchParams.get("state")!;
    expect(await t.mutation(internal.socialAuth.consumeState, { state, provider: "linkedin" })).toBeNull();
    const url2 = new URL(await admin.as.mutation(api.socialAuth.startConnect, { provider: "meta" }));
    const s2 = url2.searchParams.get("state")!;
    expect(await t.mutation(internal.socialAuth.consumeState, { state: s2, provider: "meta" })).toBe(admin.id);
    expect(await t.mutation(internal.socialAuth.consumeState, { state: s2, provider: "meta" })).toBeNull();
  });

  test("connected accounts are upserted and tokens never reach the client", async () => {
    const { t, admin, mkt } = await setup();
    const acc = { platform: "facebook" as const, externalId: "123", name: "Southdale", accessToken: "SECRET" };
    await t.mutation(internal.socialAuth.upsertAccounts, { userId: admin.id, accounts: [acc] });
    await t.mutation(internal.socialAuth.upsertAccounts, { userId: admin.id, accounts: [{ ...acc, name: "Southdale SC" }] });
    const list = await mkt.as.query(api.socialPosts.accounts, {});
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Southdale SC");
    expect(JSON.stringify(list)).not.toContain("SECRET");
  });
});

describe("platform rules", () => {
  test("validation blocks unsupported media combinations", () => {
    expect(validateForPlatform("instagram", [])).toMatch(/at least one/);
    expect(validateForPlatform("instagram", [{ contentType: "image/png" }])).toMatch(/JPEG/);
    expect(validateForPlatform("linkedin", [{ contentType: "video/mp4" }])).toMatch(/video/);
    expect(validateForPlatform("facebook", [{ contentType: "video/mp4" }, { contentType: "image/jpeg" }])).toMatch(/one video/);
    expect(validateForPlatform("facebook", [{ contentType: "image/jpeg" }, { contentType: "image/jpeg" }])).toBeNull();
  });

  test("scheduling an Instagram post with a PNG is rejected up front", async () => {
    const { t, mkt } = await setup();
    const sid = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })));
    const accountId = await t.run((ctx) => ctx.db.insert("marketingAccounts", { platform: "instagram", externalId: "ig1", name: "@one", status: "connected", accessToken: "t", connectedBy: mkt.id }));
    await expect(
      mkt.as.mutation(api.socialPosts.save, { intent: "schedule", data: { caption: "Hi", hashtags: [], accountIds: [accountId], mediaStorageIds: [sid], scheduledAt: Date.now() + 10 * 60_000 } }),
    ).rejects.toThrow(/JPEG/);
  });

  test("LinkedIn commentary escapes reserved characters", () => {
    expect(escapeLinkedIn("Sale (today) #ONE @team")).toBe("Sale \\(today\\) \\#ONE \\@team");
  });

  test("Instagram single image: container then publish, using the page token", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "")} ${init?.body ? String(init.body) : ""}`);
      if (url.endsWith("/media")) return new Response(JSON.stringify({ id: "container1" }));
      if (url.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "post99" }));
      return new Response("{}", { status: 404 });
    }));
    const id = await publishToPlatform({ platform: "instagram", externalId: "ig1", accessToken: "PAGE", message: "Hello", media: [{ url: "https://c/x.jpg", contentType: "image/jpeg" }] });
    expect(id).toBe("post99");
    expect(calls[0]).toContain("POST ig1/media");
    expect(calls[0]).toContain("image_url=https%3A%2F%2Fc%2Fx.jpg");
    expect(calls[1]).toContain("creation_id=container1");
  });

  test("an expired Meta token is reported as non-retryable and token-invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Session expired", code: 190 } }), { status: 400 })));
    await expect(publishToPlatform({ platform: "facebook", externalId: "p", accessToken: "x", message: "m", media: [] })).rejects.toMatchObject({ tokenInvalid: true, retryable: false });
  });
});

describe("publishing pipeline", () => {
  test("a due Facebook post publishes once and records the platform post id", async () => {
    const { t, mkt } = await setup();
    const accountId = await t.run((ctx) => ctx.db.insert("marketingAccounts", { platform: "facebook", externalId: "page1", name: "Southdale", status: "connected", accessToken: "PAGE", connectedBy: mkt.id }));
    await t.run((ctx) => ctx.db.insert("integrationSettings", { key: "social.publishingEnabled", value: "true", updatedAt: Date.now() }));
    const postId = await mkt.as.mutation(api.socialPosts.save, { intent: "schedule", data: { caption: "Spring sale", hashtags: ["ONE"], accountIds: [accountId], mediaStorageIds: [], scheduledAt: Date.now() + 5 * 60_000 } });
    await t.run((ctx) => ctx.db.patch(postId, { scheduledAt: Date.now() - 1000 }));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "page1_777" })));
    vi.stubGlobal("fetch", fetchMock);
    await t.mutation(internal.socialPosts.enqueueDue, {});
    await t.action(internal.socialPosts.runJobs, {});
    await t.action(internal.socialPosts.runJobs, {}); // nothing left to do — must not post twice
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain("message=Spring+sale%0A%0A%23ONE");
    const post = await mkt.as.query(api.socialPosts.get, { id: postId });
    expect(post!.status).toBe("published");
    expect(post!.jobs[0].externalPostId).toBe("page1_777");
  });
});
