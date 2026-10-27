import { v, ConvexError } from "convex/values";
import { httpAction, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission, getActiveUser } from "./lib/auth";
import { can } from "./lib/permissionMatrix";
import { audit } from "./lib/audit";
import { notify, siteUrl, usersWithRoles } from "./lib/queue";
import { randomToken } from "./lib/text";
import { GRAPH, LINKEDIN_VERSION } from "./lib/publishers";

/**
 * Official OAuth connect flows for company social accounts.
 *
 *  Meta (one login → Facebook Pages + linked Instagram professional accounts)
 *    env: META_APP_ID, META_APP_SECRET   (optional META_GRAPH_VERSION)
 *  LinkedIn Pages (organisations the user administers)
 *    env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   (optional LINKEDIN_API_VERSION)
 *
 * Redirect URIs to register with each provider:
 *    {CONVEX_SITE_URL}/oauth/meta/callback
 *    {CONVEX_SITE_URL}/oauth/linkedin/callback
 *
 * Tokens are stored server-side only and never returned to the browser.
 */

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];
const LINKEDIN_SCOPES = ["r_organization_social", "w_organization_social", "rw_organization_admin"];

type Provider = "meta" | "linkedin";

const configured = (p: Provider) =>
  p === "meta"
    ? !!(process.env.META_APP_ID && process.env.META_APP_SECRET)
    : !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);

const callbackUrl = (p: Provider) => `${(process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "")}/oauth/${p}/callback`;

export const config = query({
  args: {},
  handler: async (ctx) => {
    const user = await getActiveUser(ctx);
    if (!user || !can(user, "social.read")) return null;
    return {
      meta: configured("meta"),
      linkedin: configured("linkedin"),
      canConnect: can(user, "social.connect"),
      redirectUris: can(user, "settings.manage") ? { meta: callbackUrl("meta"), linkedin: callbackUrl("linkedin") } : null,
    };
  },
});

/** Creates a single-use state token and returns the provider's consent URL. */
export const startConnect = mutation({
  args: { provider: v.union(v.literal("meta"), v.literal("linkedin")) },
  handler: async (ctx, { provider }) => {
    const user = await requirePermission(ctx, "social.connect");
    if (!configured(provider)) {
      throw new ConvexError(
        provider === "meta"
          ? "Meta isn't configured yet. An admin must set META_APP_ID and META_APP_SECRET (see docs/INTEGRATIONS.md)."
          : "LinkedIn isn't configured yet. An admin must set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET (see docs/INTEGRATIONS.md).",
      );
    }
    const state = randomToken(24);
    await ctx.db.insert("oauthStates", { state, provider, userId: user._id, expiresAt: Date.now() + 10 * 60_000 });
    if (provider === "meta") {
      const u = new URL(`https://www.facebook.com/${GRAPH.version}/dialog/oauth`);
      u.searchParams.set("client_id", process.env.META_APP_ID!);
      u.searchParams.set("redirect_uri", callbackUrl("meta"));
      u.searchParams.set("state", state);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", META_SCOPES.join(","));
      return u.toString();
    }
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
    u.searchParams.set("redirect_uri", callbackUrl("linkedin"));
    u.searchParams.set("state", state);
    u.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
    return u.toString();
  },
});

export const consumeState = internalMutation({
  args: { state: v.string(), provider: v.union(v.literal("meta"), v.literal("linkedin")) },
  handler: async (ctx, a) => {
    const row = await ctx.db.query("oauthStates").withIndex("by_state", (q) => q.eq("state", a.state)).unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (row.provider !== a.provider || row.expiresAt < Date.now()) return null;
    const user = await ctx.db.get(row.userId);
    if (!user || user.status === "suspended" || !can(user, "social.connect")) return null;
    return row.userId;
  },
});

const accountInput = v.object({
  platform: v.union(v.literal("facebook"), v.literal("instagram"), v.literal("linkedin")),
  externalId: v.string(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  accessToken: v.string(),
  refreshToken: v.optional(v.string()),
  tokenExpiresAt: v.optional(v.number()),
  parentName: v.optional(v.string()),
});

export const upsertAccounts = internalMutation({
  args: { userId: v.id("users"), accounts: v.array(accountInput) },
  handler: async (ctx, { userId, accounts }) => {
    const now = Date.now();
    for (const a of accounts) {
      const existing = await ctx.db
        .query("marketingAccounts")
        .withIndex("by_platform_external", (q) => q.eq("platform", a.platform).eq("externalId", a.externalId))
        .unique();
      const doc = { ...a, status: "connected" as const, connectedBy: userId, connectedAt: now, lastError: undefined };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("marketingAccounts", doc);
    }
    await audit(ctx, userId, "connect", "marketingAccounts", undefined, `Connected ${accounts.length} social account(s): ${accounts.map((a) => `${a.name} (${a.platform})`).join(", ")}`);
  },
});

// ---------------- HTTP callbacks ----------------

function back(params: Record<string, string>) {
  const u = new URL(siteUrl("/marketing/social/accounts"));
  for (const [k, val] of Object.entries(params)) u.searchParams.set(k, val);
  return new Response(null, { status: 302, headers: { Location: u.toString(), "Cache-Control": "no-store" } });
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } | string; error_description?: string; message?: string };
  if (!res.ok || (typeof data.error === "object" && data.error)) {
    const msg = typeof data.error === "object" ? data.error?.message : data.error_description ?? data.message ?? data.error;
    throw new Error(String(msg ?? `HTTP ${res.status}`));
  }
  return data;
}

export const metaCallback = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back({ oauth_error: "Meta connection was cancelled." });
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back({ oauth_error: "Missing authorisation code." });
  const userId = await ctx.runMutation(internal.socialAuth.consumeState, { state, provider: "meta" });
  if (!userId) return back({ oauth_error: "This connection link expired. Please try again." });
  try {
    const id = process.env.META_APP_ID!, secret = process.env.META_APP_SECRET!;
    const short = await getJson<{ access_token: string }>(
      `${GRAPH.base}/oauth/access_token?${new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: callbackUrl("meta"), code })}`,
    );
    // Exchange for a long-lived user token so the derived Page tokens don't expire.
    const long = await getJson<{ access_token: string }>(
      `${GRAPH.base}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: short.access_token })}`,
    );
    const pages = await getJson<{
      data: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }[];
    }>(
      `${GRAPH.base}/me/accounts?${new URLSearchParams({
        fields: "id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}",
        limit: "100",
        access_token: long.access_token,
      })}`,
    );
    const accounts = pages.data.flatMap((p) => [
      { platform: "facebook" as const, externalId: p.id, name: p.name, imageUrl: p.picture?.data?.url, accessToken: p.access_token },
      ...(p.instagram_business_account
        ? [{
            platform: "instagram" as const,
            externalId: p.instagram_business_account.id,
            name: p.instagram_business_account.username ? `@${p.instagram_business_account.username}` : `${p.name} (Instagram)`,
            imageUrl: p.instagram_business_account.profile_picture_url,
            accessToken: p.access_token, // Instagram publishing uses the linked Page token.
            parentName: p.name,
          }]
        : []),
    ]);
    if (!accounts.length) return back({ oauth_error: "No Facebook Pages were shared. Select at least one Page during login." });
    await ctx.runMutation(internal.socialAuth.upsertAccounts, { userId, accounts });
    return back({ connected: "meta", count: String(accounts.length) });
  } catch (e) {
    console.error("Meta OAuth failed", (e as Error).message);
    return back({ oauth_error: `Meta: ${(e as Error).message}`.slice(0, 200) });
  }
});

export const linkedinCallback = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back({ oauth_error: "LinkedIn connection was cancelled." });
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return back({ oauth_error: "Missing authorisation code." });
  const userId = await ctx.runMutation(internal.socialAuth.consumeState, { state, provider: "linkedin" });
  if (!userId) return back({ oauth_error: "This connection link expired. Please try again." });
  try {
    const token = await getJson<{ access_token: string; expires_in: number; refresh_token?: string }>("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl("linkedin"),
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    const headers = { Authorization: `Bearer ${token.access_token}`, "LinkedIn-Version": LINKEDIN_VERSION(), "X-Restli-Protocol-Version": "2.0.0" };
    const acls = await getJson<{ elements: { organization: string }[] }>(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
      { headers },
    );
    const orgUrns = [...new Set(acls.elements.map((e) => e.organization))];
    const accounts = [];
    for (const urn of orgUrns) {
      const orgId = urn.split(":").pop()!;
      const org = await getJson<{ localizedName?: string }>(`https://api.linkedin.com/rest/organizations/${orgId}`, { headers }).catch(() => ({ localizedName: undefined }));
      accounts.push({
        platform: "linkedin" as const,
        externalId: urn,
        name: org.localizedName ?? `LinkedIn Page ${orgId}`,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenExpiresAt: Date.now() + token.expires_in * 1000,
      });
    }
    if (!accounts.length) return back({ oauth_error: "Your LinkedIn profile isn't an admin of any LinkedIn Page." });
    await ctx.runMutation(internal.socialAuth.upsertAccounts, { userId, accounts });
    return back({ connected: "linkedin", count: String(accounts.length) });
  } catch (e) {
    console.error("LinkedIn OAuth failed", (e as Error).message);
    return back({ oauth_error: `LinkedIn: ${(e as Error).message}`.slice(0, 200) });
  }
});

// ---------------- Token health ----------------

export const markAccountExpired = internalMutation({
  args: { id: v.id("marketingAccounts"), error: v.string() },
  handler: async (ctx, a) => {
    const acc = await ctx.db.get(a.id);
    if (!acc || acc.status === "expired") return;
    await ctx.db.patch(a.id, { status: "expired", lastError: a.error });
    const admins = await usersWithRoles(ctx, ["super_admin"]);
    await notify(ctx, [acc.connectedBy, ...admins], {
      type: "system",
      title: `Reconnect ${acc.name} (${acc.platform})`,
      body: "Its access has expired or was revoked, so scheduled posts to it can't publish.",
      link: "/marketing/social/accounts",
    });
  },
});

export const expiringLinkedIn = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("marketingAccounts").withIndex("by_platform", (q) => q.eq("platform", "linkedin")).collect();
    return rows
      .filter((r) => r.status === "connected" && r.tokenExpiresAt && r.tokenExpiresAt < Date.now() + 7 * 86400_000)
      .map((r) => ({ _id: r._id, refreshToken: r.refreshToken, tokenExpiresAt: r.tokenExpiresAt! }));
  },
});

export const saveRefreshedToken = internalMutation({
  args: { id: v.id("marketingAccounts"), accessToken: v.string(), refreshToken: v.optional(v.string()), tokenExpiresAt: v.number() },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { accessToken: a.accessToken, refreshToken: a.refreshToken, tokenExpiresAt: a.tokenExpiresAt, lastError: undefined });
  },
});

/** Daily: refresh LinkedIn tokens close to expiry (when LinkedIn issued a refresh token), else flag them. */
export const refreshTokens = internalAction({
  args: {},
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.socialAuth.expiringLinkedIn, {});
    for (const acc of due) {
      if (acc.refreshToken && process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
        try {
          const t = await getJson<{ access_token: string; expires_in: number; refresh_token?: string }>("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: acc.refreshToken, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }),
          });
          await ctx.runMutation(internal.socialAuth.saveRefreshedToken, { id: acc._id, accessToken: t.access_token, refreshToken: t.refresh_token ?? acc.refreshToken, tokenExpiresAt: Date.now() + t.expires_in * 1000 });
          continue;
        } catch (e) {
          console.error("LinkedIn refresh failed", (e as Error).message);
        }
      }
      if (acc.tokenExpiresAt < Date.now()) {
        await ctx.runMutation(internal.socialAuth.markAccountExpired, { id: acc._id, error: "LinkedIn access expired — reconnect the account." });
      }
    }
  },
});

