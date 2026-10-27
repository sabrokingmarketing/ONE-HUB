import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { formField } from "./schema";
import { requirePermission, conflictError, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { enqueueEmail, notify, siteUrl, usersWithRoles } from "./lib/queue";
import { renderEmail } from "./lib/email";
import { clean, escapeHtml, isEmail, randomToken, searchText } from "./lib/text";

const input = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  fields: v.array(formField),
  thankYouMessage: v.string(),
  successUrl: v.optional(v.string()),
  notifyUserIds: v.array(v.id("users")),
  status: v.union(v.literal("draft"), v.literal("active"), v.literal("inactive")),
  propertyId: v.optional(v.id("properties")),
  accentColor: v.optional(v.string()),
  shareWithMarketing: v.boolean(),
});

function validate(i: typeof input.type) {
  const title = i.title.trim();
  if (!title) throw new ConvexError("Form title is required.");
  if (i.fields.length === 0) throw new ConvexError("Add at least one field.");
  if (i.fields.length > 40) throw new ConvexError("Forms are limited to 40 fields.");
  const ids = new Set<string>();
  for (const f of i.fields) {
    if (!f.label.trim()) throw new ConvexError("Every field needs a label.");
    if (ids.has(f.id)) throw new ConvexError("Duplicate field id.");
    ids.add(f.id);
    if (["dropdown", "multiple_choice", "checkboxes"].includes(f.type) && !(f.options?.filter((o) => o.trim()).length)) {
      throw new ConvexError(`"${f.label}" needs at least one option.`);
    }
  }
  if (!i.fields.some((f) => f.type === "email" || f.type === "phone")) {
    throw new ConvexError("Include an Email or Phone field so you can contact the lead.");
  }
  if (i.successUrl && !/^https:\/\//.test(i.successUrl)) throw new ConvexError("Success page must be an https:// URL.");
  if (i.accentColor && !/^#[0-9a-fA-F]{6}$/.test(i.accentColor)) throw new ConvexError("Accent colour must be a hex colour.");
  return { ...i, title, description: clean(i.description), thankYouMessage: i.thankYouMessage.trim() || "Thank you — we'll be in touch shortly." };
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form";
}

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "forms.read");
    const rows = await ctx.db.query("leadForms").order("desc").collect();
    return await Promise.all(
      rows
        .filter((f) => a.includeArchived || !f.archivedAt)
        .map(async (f) => {
          const creator = await ctx.db.get(f.createdBy);
          const property = f.propertyId ? await ctx.db.get(f.propertyId) : null;
          return { ...f, createdByName: creator?.name ?? "Unknown", propertyName: property?.name };
        }),
    );
  },
});

export const get = query({
  args: { id: v.id("leadForms") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "forms.read");
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: { data: input },
  handler: async (ctx, { data }) => {
    const user = await requirePermission(ctx, "forms.write");
    const d = validate(data);
    const slug = `${slugify(d.title)}-${randomToken(3)}`;
    const id = await ctx.db.insert("leadForms", {
      ...d,
      slug,
      // Marketing-created forms always share their leads with Marketing.
      shareWithMarketing: user.role === "marketing" ? true : d.shareWithMarketing,
      submissionCount: 0,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
      version: 1,
    });
    await audit(ctx, user._id, "create", "leadForms", id, `Created lead form "${d.title}"`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("leadForms"), expectedVersion: v.number(), data: input },
  handler: async (ctx, { id, expectedVersion, data }) => {
    const user = await requirePermission(ctx, "forms.write");
    const f = await ctx.db.get(id);
    if (!f) throw notFound("Form");
    if (f.version !== expectedVersion) throw conflictError("form");
    const d = validate(data);
    await ctx.db.patch(id, {
      ...d,
      shareWithMarketing: user.role === "marketing" ? f.shareWithMarketing || d.shareWithMarketing : d.shareWithMarketing,
      updatedBy: user._id,
      updatedAt: Date.now(),
      version: f.version + 1,
    });
    await audit(ctx, user._id, "update", "leadForms", id, `Updated lead form "${d.title}"`);
  },
});

export const setArchived = mutation({
  args: { id: v.id("leadForms"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requirePermission(ctx, "forms.write");
    const f = await ctx.db.get(id);
    if (!f) throw notFound("Form");
    await ctx.db.patch(id, {
      archivedAt: archived ? Date.now() : undefined,
      status: archived ? "inactive" : f.status,
      updatedBy: user._id, updatedAt: Date.now(), version: f.version + 1,
    });
    await audit(ctx, user._id, archived ? "archive" : "restore", "leadForms", id, `${archived ? "Archived" : "Restored"} form "${f.title}"`);
  },
});

// ---------- Public endpoints (no auth) ----------

export const publicGet = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const f = await ctx.db.query("leadForms").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!f || f.archivedAt) return null;
    // Only expose what the public form needs — never notification recipients, creator, etc.
    return {
      title: f.title,
      description: f.description,
      fields: f.fields,
      accentColor: f.accentColor,
      active: f.status === "active",
    };
  },
});

const RATE_WINDOW = 60_000;
const RATE_MAX = 20;

export const submit = mutation({
  args: {
    slug: v.string(),
    answers: v.record(v.string(), v.union(v.string(), v.array(v.string()), v.boolean())),
    honeypot: v.optional(v.string()),
    elapsedMs: v.number(),
  },
  handler: async (ctx, a) => {
    const form = await ctx.db.query("leadForms").withIndex("by_slug", (q) => q.eq("slug", a.slug)).unique();
    if (!form || form.archivedAt || form.status !== "active") throw new ConvexError("This form is not accepting submissions.");

    // Spam protection: hidden honeypot + minimum fill time → silently accept & drop.
    if (a.honeypot || a.elapsedMs < 2500) {
      return { thankYouMessage: form.thankYouMessage, successUrl: form.successUrl };
    }
    // Per-form fixed-window rate limit.
    const key = `form:${form._id}`;
    const bucket = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", key)).unique();
    const now = Date.now();
    if (bucket && now - bucket.windowStart < RATE_WINDOW) {
      if (bucket.count >= RATE_MAX) throw new ConvexError("Too many submissions right now. Please try again in a minute.");
      await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
    } else if (bucket) {
      await ctx.db.patch(bucket._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    }

    const answers: { label: string; value: string }[] = [];
    const by: Partial<Record<Doc<"leadForms">["fields"][number]["type"], string>> = {};
    let consent = false;
    for (const f of form.fields) {
      const raw = a.answers[f.id];
      let value = Array.isArray(raw) ? raw.filter((x) => f.options?.includes(x)).join(", ") : typeof raw === "boolean" ? (raw ? "Yes" : "") : (raw ?? "").toString().trim();
      if (value.length > 2000) value = value.slice(0, 2000);
      if (f.required && !value) throw new ConvexError(`"${f.label}" is required.`);
      if (f.type === "email" && value && !isEmail(value)) throw new ConvexError("Please enter a valid email address.");
      if (f.type === "phone" && value && value.replace(/\D/g, "").length < 9) throw new ConvexError("Please enter a valid phone number.");
      if ((f.type === "dropdown" || f.type === "multiple_choice") && value && !f.options?.includes(value)) throw new ConvexError(`Invalid choice for "${f.label}".`);
      if (f.type === "consent") consent = raw === true;
      if (!by[f.type] && value) by[f.type] = value;
      if (value) answers.push({ label: f.label, value });
    }
    const name = [by.first_name, by.last_name].filter(Boolean).join(" ") || by.email || by.phone || "Unknown";
    const leadId = await ctx.db.insert("leads", {
      formId: form._id,
      source: form.title,
      name,
      email: by.email?.toLowerCase(),
      phone: by.phone,
      company: by.company,
      answers,
      consent,
      propertyId: form.propertyId,
      status: "new",
      visibleToMarketing: form.shareWithMarketing,
      searchText: searchText(name, by.email, by.phone, by.company, form.title),
      submittedAt: now,
      updatedAt: now,
      version: 1,
    });
    await ctx.db.patch(form._id, { submissionCount: form.submissionCount + 1 });

    const recipients = form.notifyUserIds.length ? form.notifyUserIds : await usersWithRoles(ctx, ["director", "super_admin"]);
    await notify(ctx, recipients, { type: "lead", title: `New lead: ${name}`, body: `Submitted via "${form.title}"`, link: `/leads/${leadId}` });
    for (const uid of form.notifyUserIds) {
      const u = await ctx.db.get(uid);
      if (!u?.email || u.status === "suspended") continue;
      await enqueueEmail(ctx, {
        kind: "lead_alert",
        to: u.email,
        subject: `New lead from ${form.title}`,
        dedupeKey: `lead:${leadId}:${uid}`,
        html: renderEmail({
          badge: "New lead",
          heading: name,
          intro: `A new submission arrived via "${form.title}".`,
          bodyHtml: `<table style="width:100%;border-collapse:collapse">${answers
            .map((x) => `<tr><td style="padding:6px 0;color:#78716C;width:40%">${escapeHtml(x.label)}</td><td style="padding:6px 0">${escapeHtml(x.value)}</td></tr>`)
            .join("")}</table>`,
          ctaLabel: "Open lead in ONE HUB",
          ctaUrl: siteUrl(`/leads/${leadId}`),
        }),
      });
    }
    return { thankYouMessage: form.thankYouMessage, successUrl: form.successUrl };
  },
});
