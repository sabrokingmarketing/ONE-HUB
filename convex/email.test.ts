import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { modules } from "./test.setup";
import { signWebhook, verifyWebhook } from "./lib/webhook";
import { deliverEmail, renderEmail } from "./lib/email";
import { nextUtcMidnight } from "./lib/quota";

const SECRET = `whsec_${btoa("one-hub-test-signing-secret-32b!")}`;
const ENV_KEYS = ["ONEHUB_EMAIL_MODE", "ONEHUB_EMAIL_DAILY_LIMIT", "ONEHUB_EMAIL_MONTHLY_LIMIT", "RESEND_WEBHOOK_SECRET", "RESEND_API_KEY", "ONEHUB_EMAIL_FROM"];
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

async function setup() {
  const t = convexTest(schema, modules);
  const dirId = await t.run((ctx) => ctx.db.insert("users", { name: "Director", email: "director@one.test", role: "director", status: "active" }));
  const dir = t.withIdentity({ subject: `${dirId}|session`, name: "Director" });
  return { t, dir, dirId };
}

async function signed(body: unknown, ts = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body);
  const id = `msg_${Math.random().toString(36).slice(2)}`;
  const sig = await signWebhook(SECRET, id, String(ts), raw);
  return { method: "POST", body: raw, headers: { "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` } };
}

describe("webhook signature", () => {
  test("accepts a valid signature and rejects tampering, replays and wrong secrets", async () => {
    const body = '{"type":"email.delivered"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await signWebhook(SECRET, "msg_1", ts, body);
    const h = { id: "msg_1", timestamp: ts, signature: `v1,bogus v1,${sig}` };
    expect(await verifyWebhook(SECRET, h, body)).toBe(true);
    expect(await verifyWebhook(SECRET, h, body.replace("delivered", "bounced"))).toBe(false);
    expect(await verifyWebhook(SECRET, h, body, Date.now() + 10 * 60_000)).toBe(false);
    expect(await verifyWebhook(`whsec_${btoa("another-secret-entirely-000000000")}`, h, body)).toBe(false);
    expect(await verifyWebhook(SECRET, { ...h, signature: null }, body)).toBe(false);
  });
});

describe("delivery webhooks", () => {
  test("webhook events move jobs forward only and mark bounced announcements partial", async () => {
    const { t, dirId } = await setup();
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const annId = await t.run((ctx) =>
      ctx.db.insert("announcements", {
        subject: "Hi", body: "Hi", template: "general", audience: "all", recipientCount: 2, dedupeKey: "k", status: "sent", sentBy: dirId, sentAt: Date.now(),
      }),
    );
    const job = (to: string, providerId: string) =>
      t.run((ctx) => ctx.db.insert("emailJobs", { kind: "announcement", to, subject: "Hi", dedupeKey: to, announcementId: annId, status: "sent", attempts: 1, nextAttemptAt: 0, providerId }));
    const a = await job("a@one.test", "em_a");
    const b = await job("b@one.test", "em_b");

    expect((await t.fetch("/resend/webhook", await signed({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "em_a" } }))).status).toBe(204);
    // A late, out-of-order "sent" event must not downgrade a delivered email.
    await t.fetch("/resend/webhook", await signed({ type: "email.sent", data: { email_id: "em_a" } }));
    await t.fetch("/resend/webhook", await signed({ type: "email.bounced", data: { email_id: "em_b", bounce: { message: "Mailbox does not exist" } } }));

    const [ja, jb, ann] = await t.run(async (ctx) => [await ctx.db.get(a), await ctx.db.get(b), await ctx.db.get(annId)] as const);
    expect(ja?.status).toBe("delivered");
    expect(ja?.deliveredAt).toBeTypeOf("number");
    expect(jb?.status).toBe("bounced");
    expect(jb?.error).toBe("Mailbox does not exist");
    expect(ann?.status).toBe("partial");
  });

  test("rejects unsigned requests and refuses when no secret is configured", async () => {
    const { t } = await setup();
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await t.fetch("/resend/webhook", await signed({ type: "email.delivered" }))).status).toBe(503);
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    const req = await signed({ type: "email.delivered", data: { email_id: "x" } });
    expect((await t.fetch("/resend/webhook", { ...req, headers: { ...req.headers, "svix-signature": "v1,AAAA" } })).status).toBe(401);
  });
});

describe("sending limits", () => {
  test("the queue never exceeds the daily cap and parks the rest until the reset", async () => {
    const { t } = await setup();
    process.env.ONEHUB_EMAIL_MODE = "live";
    process.env.ONEHUB_EMAIL_DAILY_LIMIT = "2";
    await t.run(async (ctx) => {
      for (const to of ["a", "b", "c"]) await ctx.db.insert("emailJobs", { kind: "test", to: `${to}@one.test`, subject: "s", html: "<p>x</p>", dedupeKey: to, status: "queued", attempts: 0, nextAttemptAt: 0 });
    });
    const first = await t.mutation(internal.emails.claimBatch, {});
    expect(first).toHaveLength(2);
    for (const j of first) await t.mutation(internal.emails.markResult, { id: j._id, ok: true, providerId: `em_${j.to}` });
    expect(await t.mutation(internal.emails.claimBatch, {})).toHaveLength(0);
    const left = await t.run((ctx) => ctx.db.query("emailJobs").filter((q) => q.eq(q.field("status"), "queued")).collect());
    expect(left).toHaveLength(1);
    expect(left[0].deferredReason).toMatch(/daily/);
    expect(left[0].nextAttemptAt).toBeGreaterThanOrEqual(nextUtcMidnight(Date.now()));
  });

  test("a provider quota error defers the job without spending a retry", async () => {
    const { t } = await setup();
    const id = await t.run((ctx) => ctx.db.insert("emailJobs", { kind: "test", to: "a@one.test", subject: "s", html: "x", dedupeKey: "a", status: "sending", attempts: 1, nextAttemptAt: 0 }));
    const until = Date.now() + 3_600_000;
    await t.mutation(internal.emails.markResult, { id, ok: false, error: "Resend 429 daily_quota_exceeded", retryable: true, deferUntil: until });
    const job = await t.run((ctx) => ctx.db.get(id));
    expect(job).toMatchObject({ status: "queued", attempts: 0, nextAttemptAt: until });
  });

  test("announcements larger than today's allowance need explicit confirmation", async () => {
    const { t, dir } = await setup();
    process.env.ONEHUB_EMAIL_MODE = "live";
    process.env.ONEHUB_EMAIL_DAILY_LIMIT = "1";
    for (const n of ["a", "b"]) await dir.mutation(api.employees.create, { data: { firstName: n, lastName: "X", email: `${n}@one.test`, department: "Ops" } });
    const args = { audience: "all" as const, subject: "Update", body: "Hello", template: "general" as const, confirmedCount: 2 };
    const preview = await dir.query(api.announcements.recipients, { audience: "all" });
    expect(preview.remainingToday).toBe(1);
    await expect(dir.mutation(api.announcements.send, args)).rejects.toThrow(/daily limit resets/);
    const r = await dir.mutation(api.announcements.send, { ...args, acceptDeferral: true });
    expect(r).toMatchObject({ count: 2, deferred: 1 });
    // The rendered email is stored once on the announcement, not copied into every job.
    const jobs = await t.run((ctx) => ctx.db.query("emailJobs").collect());
    expect(jobs.every((j) => j.html === undefined)).toBe(true);
    const claimed = await t.mutation(internal.emails.claimBatch, {});
    expect(claimed).toHaveLength(1);
    expect(claimed[0].html).toContain("Update");
  });
});

describe("transport", () => {
  test("sends an idempotency key and recognises quota errors", async () => {
    process.env.ONEHUB_EMAIL_MODE = "live";
    process.env.RESEND_API_KEY = "re_test";
    process.env.ONEHUB_EMAIL_FROM = "ONE <n@hub.one.test>";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await deliverEmail("a@one.test", "s", "<p/>", "onehub-job1")).toEqual({ status: "sent", providerId: "em_1" });
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("onehub-job1");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "daily_quota_exceeded", message: "quota" }), { status: 429 })));
    await expect(deliverEmail("a@one.test", "s", "<p/>")).rejects.toMatchObject({ quota: "daily", retryable: true });
  });

  test("credential emails are never redirected in test mode or swallowed in log mode", async () => {
    process.env.ONEHUB_EMAIL_MODE = "test";
    process.env.RESEND_API_KEY = "re_test";
    process.env.ONEHUB_EMAIL_FROM = "ONE <n@hub.one.test>";
    process.env.ONEHUB_EMAIL_TEST_RECIPIENT = "qa@one.test";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "em_2" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await deliverEmail("a@one.test", "Reset", "<p/>", undefined, { credential: true });
    await deliverEmail("b@one.test", "News", "<p/>");
    const to = (i: number) => JSON.parse((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].body as string).to;
    expect(to(0)).toEqual(["a@one.test"]);
    expect(to(1)).toEqual(["qa@one.test"]);

    delete process.env.ONEHUB_EMAIL_MODE;
    await expect(deliverEmail("a@one.test", "Reset", "<p/>", undefined, { credential: true })).rejects.toMatchObject({ retryable: false });
  });

  test("log mode never calls the provider", async () => {
    delete process.env.ONEHUB_EMAIL_MODE;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await deliverEmail("a@one.test", "s", "<p/>")).toEqual({ status: "logged" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("template escapes content and includes Outlook-safe button and preheader", () => {
    const html = renderEmail({ heading: "<b>Hi</b>", bodyText: "Line one\n\nLine two", ctaLabel: "Open", ctaUrl: "https://hub.one.test/x" });
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
    expect(html).toContain("v:roundrect");
    expect(html).toContain("Line one");
    expect(html).toMatch(/background:#FFFFFF/);
  });
});
