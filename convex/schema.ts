import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * ONE HUB — single shared Convex database.
 *
 * Every shared business record carries the same collaboration metadata:
 *   createdBy / updatedBy / updatedAt / version / archivedAt
 * `version` is incremented on every write and checked on update so two
 * people editing the same record can never silently overwrite each other.
 */

// "marketing" = Marketing team: may only use the Marketing Studio (upload & manage marketing material).
export const roleValidator = v.union(v.literal("super_admin"), v.literal("director"), v.literal("marketing"));

const meta = {
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
  updatedAt: v.number(),
  version: v.number(),
  archivedAt: v.optional(v.number()),
};

export const leadStatus = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("qualified"),
  v.literal("follow_up"),
  v.literal("converted"),
  v.literal("closed"),
);

export const formFieldType = v.union(
  v.literal("first_name"),
  v.literal("last_name"),
  v.literal("email"),
  v.literal("phone"),
  v.literal("company"),
  v.literal("address"),
  v.literal("text"),
  v.literal("textarea"),
  v.literal("dropdown"),
  v.literal("multiple_choice"),
  v.literal("checkboxes"),
  v.literal("date"),
  v.literal("consent"),
);

export const formField = v.object({
  id: v.string(),
  type: formFieldType,
  label: v.string(),
  required: v.boolean(),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export default defineSchema({
  ...authTables,

  // Extends the Convex Auth users table with ONE HUB profile + role data.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleValidator),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
    jobTitle: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    timezone: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("by_role", ["role"]),

  invitations: defineTable({
    email: v.string(),
    name: v.string(),
    role: roleValidator,
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    lastSentAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  properties: defineTable({
    name: v.string(),
    nameKey: v.string(),
    type: v.union(
      v.literal("shopping_centre"),
      v.literal("office"),
      v.literal("industrial"),
      v.literal("residential"),
      v.literal("mixed_use"),
      v.literal("land"),
      v.literal("other"),
    ),
    location: v.string(),
    province: v.optional(v.string()),
    description: v.optional(v.string()),
    gla: v.optional(v.number()),
    contacts: v.optional(v.string()),
    notes: v.optional(v.string()),
    ...meta,
  })
    .index("by_nameKey", ["nameKey"])
    .searchIndex("search", { searchField: "name", filterFields: ["archivedAt"] }),

  brokers: defineTable({
    fullName: v.string(),
    company: v.optional(v.string()),
    position: v.optional(v.string()),
    email: v.optional(v.string()),
    emailKey: v.optional(v.string()),
    mobile: v.optional(v.string()),
    mobileKey: v.optional(v.string()),
    office: v.optional(v.string()),
    address: v.optional(v.string()),
    province: v.optional(v.string()),
    region: v.optional(v.string()),
    website: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    contactStatus: v.union(
      v.literal("active"),
      v.literal("prospect"),
      v.literal("inactive"),
    ),
    notes: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    searchText: v.string(),
    ...meta,
  })
    .index("by_emailKey", ["emailKey"])
    .index("by_mobileKey", ["mobileKey"])
    .index("by_property", ["propertyId"])
    .index("by_archived", ["archivedAt"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["archivedAt"] }),

  employees: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    emailKey: v.optional(v.string()),
    phone: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    office: v.optional(v.string()),
    manager: v.optional(v.string()),
    employmentStatus: v.union(
      v.literal("active"),
      v.literal("on_leave"),
      v.literal("terminated"),
    ),
    startDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    searchText: v.string(),
    ...meta,
  })
    .index("by_emailKey", ["emailKey"])
    .index("by_department", ["department"])
    .index("by_archived", ["archivedAt"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["archivedAt"] }),

  meetings: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    timezone: v.string(),
    location: v.optional(v.string()),
    videoLink: v.optional(v.string()),
    scope: v.union(v.literal("company"), v.literal("private")),
    reminderMinutes: v.array(v.number()),
    status: v.union(v.literal("scheduled"), v.literal("cancelled")),
    propertyId: v.optional(v.id("properties")),
    ...meta,
  })
    .index("by_startsAt", ["startsAt"])
    .index("by_creator_startsAt", ["createdBy", "startsAt"]),

  meetingParticipants: defineTable({
    meetingId: v.id("meetings"),
    userId: v.id("users"),
    response: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
    ),
  })
    .index("by_meeting", ["meetingId"])
    .index("by_user", ["userId"])
    .index("by_meeting_user", ["meetingId", "userId"]),

  meetingReminders: defineTable({
    meetingId: v.id("meetings"),
    sendAt: v.number(),
    minutesBefore: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_sendAt", ["sentAt", "sendAt"])
    .index("by_meeting", ["meetingId"]),

  calendarConnections: defineTable({
    userId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("microsoft")),
    accountEmail: v.string(),
    status: v.union(
      v.literal("connected"),
      v.literal("expired"),
      v.literal("error"),
      v.literal("disconnected"),
    ),
    // Tokens are only ever read by internal functions, never returned to clients.
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  leadForms: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    fields: v.array(formField),
    thankYouMessage: v.string(),
    successUrl: v.optional(v.string()),
    notifyUserIds: v.array(v.id("users")),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("inactive")),
    propertyId: v.optional(v.id("properties")),
    accentColor: v.optional(v.string()),
    submissionCount: v.number(),
    ...meta,
  })
    .index("by_slug", ["slug"])
    .index("by_archived", ["archivedAt"]),

  leads: defineTable({
    formId: v.optional(v.id("leadForms")),
    source: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    answers: v.array(v.object({ label: v.string(), value: v.string() })),
    consent: v.boolean(),
    propertyId: v.optional(v.id("properties")),
    assignedTo: v.optional(v.id("users")),
    status: leadStatus,
    notes: v.optional(v.string()),
    searchText: v.string(),
    submittedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
    version: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_submittedAt", ["submittedAt"])
    .index("by_form", ["formId"])
    .index("by_status", ["status"])
    .index("by_assignee", ["assignedTo"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["archivedAt"] }),

  // Simple fixed-window rate limit buckets for public endpoints (lead forms).
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  // Marketing Studio: booklets, brochures, designs, presentations, videos, brand assets…
  // uploaded by the marketing team for directors to browse, preview and download.
  studioAssets: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    collection: v.optional(v.string()),
    tags: v.array(v.string()),
    propertyId: v.optional(v.id("properties")),
    storageId: v.id("_storage"),
    contentType: v.string(),
    size: v.number(),
    // Optional cover image (e.g. for PDFs and videos) shown as the card preview.
    coverStorageId: v.optional(v.id("_storage")),
    featured: v.boolean(),
    downloads: v.number(),
    previousVersionId: v.optional(v.id("studioAssets")),
    versionNumber: v.number(),
    searchText: v.string(),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    version: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_archived", ["archivedAt"])
    .index("by_category", ["category"])
    .index("by_featured", ["featured", "archivedAt"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["archivedAt", "category"] }),

  documents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    storageId: v.id("_storage"),
    contentType: v.string(),
    size: v.number(),
    category: v.string(),
    folder: v.optional(v.string()),
    tags: v.array(v.string()),
    propertyId: v.optional(v.id("properties")),
    previousVersionId: v.optional(v.id("documents")),
    searchText: v.string(),
    ...meta,
  })
    .index("by_category", ["category"])
    .index("by_archived", ["archivedAt"])
    .searchIndex("search", { searchField: "searchText", filterFields: ["archivedAt"] }),

  announcements: defineTable({
    subject: v.string(),
    body: v.string(),
    template: v.union(
      v.literal("general"),
      v.literal("important"),
      v.literal("meeting"),
      v.literal("event"),
      v.literal("document"),
      v.literal("reminder"),
    ),
    audience: v.union(v.literal("all"), v.literal("department"), v.literal("selected")),
    department: v.optional(v.string()),
    recipientCount: v.number(),
    // Hash of subject+body+recipients — blocks accidental double sends.
    dedupeKey: v.string(),
    status: v.union(v.literal("queued"), v.literal("sending"), v.literal("sent"), v.literal("partial")),
    sentBy: v.id("users"),
    sentAt: v.number(),
  })
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_sentAt", ["sentAt"]),

  emailJobs: defineTable({
    kind: v.string(),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    announcementId: v.optional(v.id("announcements")),
    dedupeKey: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("logged"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    nextAttemptAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_status_next", ["status", "nextAttemptAt"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_announcement", ["announcementId"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("lead"),
      v.literal("meeting"),
      v.literal("announcement"),
      v.literal("document"),
      v.literal("employee"),
      v.literal("invitation"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
    readAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "readAt"]),

  notificationPreferences: defineTable({
    userId: v.id("users"),
    disabledTypes: v.array(v.string()),
    emailFallback: v.boolean(),
    push: v.boolean(),
  }).index("by_user", ["userId"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entity: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_entity", ["entity", "entityId"])
    .index("by_actor", ["actorId"]),

  integrationSettings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
