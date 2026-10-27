/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev` (or `node scripts/offline-codegen.mjs` offline).
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as announcements from "../announcements.js";
import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as brokers from "../brokers.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as emails from "../emails.js";
import type * as employees from "../employees.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as leadForms from "../leadForms.js";
import type * as leads from "../leads.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_permissionMatrix from "../lib/permissionMatrix.js";
import type * as lib_publishers from "../lib/publishers.js";
import type * as lib_queue from "../lib/queue.js";
import type * as lib_text from "../lib/text.js";
import type * as meetings from "../meetings.js";
import type * as notifications from "../notifications.js";
import type * as properties from "../properties.js";
import type * as search from "../search.js";
import type * as socialAuth from "../socialAuth.js";
import type * as socialPosts from "../socialPosts.js";
import type * as system from "../system.js";
import type * as users from "../users.js";

declare const fullApi: ApiFromModules<{
  "announcements": typeof announcements;
  "assets": typeof assets;
  "auth": typeof auth;
  "brokers": typeof brokers;
  "campaigns": typeof campaigns;
  "crons": typeof crons;
  "dashboard": typeof dashboard;
  "emails": typeof emails;
  "employees": typeof employees;
  "http": typeof http;
  "ideas": typeof ideas;
  "leadForms": typeof leadForms;
  "leads": typeof leads;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/email": typeof lib_email;
  "lib/permissionMatrix": typeof lib_permissionMatrix;
  "lib/publishers": typeof lib_publishers;
  "lib/queue": typeof lib_queue;
  "lib/text": typeof lib_text;
  "meetings": typeof meetings;
  "notifications": typeof notifications;
  "properties": typeof properties;
  "search": typeof search;
  "socialAuth": typeof socialAuth;
  "socialPosts": typeof socialPosts;
  "system": typeof system;
  "users": typeof users;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
