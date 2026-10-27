#!/usr/bin/env node
/**
 * Offline fallback for `npx convex codegen`.
 *
 * Produces the same convex/_generated/{api,server,dataModel} files the Convex
 * CLI emits for a project without components, so the app can be typechecked
 * and unit-tested (convex-test) in environments that cannot reach Convex.
 * Running `npx convex dev` against a real deployment overwrites these files.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../convex/", import.meta.url).pathname;
const out = join(root, "_generated");
mkdirSync(out, { recursive: true });

const SKIP = new Set(["schema.ts", "auth.config.ts", "convex.config.ts", "tsconfig.json"]);
const modules = [];
(function walk(dir) {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    const rel = relative(root, p).replace(/\\/g, "/");
    if (statSync(p).isDirectory()) {
      if (f === "_generated" || f.startsWith(".")) continue;
      walk(p);
    } else if (/\.(ts|js)$/.test(f) && f.split(".").length === 2 && !SKIP.has(rel)) {
      modules.push(rel);
    }
  }
})(root);

const header = (d) => `/* eslint-disable */
/**
 * ${d}
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\` (or \`node scripts/offline-codegen.mjs\` offline).
 * @module
 */
`;
const imp = (m) => m.replace(/\.(ts|js)$/, "");
const ident = (m) => imp(m).replace(/\//g, "_").replace(/-/g, "_");

writeFileSync(
  join(out, "api.d.ts"),
  `${header("Generated `api` utility.")}
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
${modules.map((m) => `import type * as ${ident(m)} from "../${imp(m)}.js";`).join("\n")}

declare const fullApi: ApiFromModules<{
${modules.map((m) => `  "${imp(m)}": typeof ${ident(m)};`).join("\n")}
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
`,
);
writeFileSync(
  join(out, "api.js"),
  `${header("Generated `api` utility.")}
import { anyApi } from "convex/server";

export const api = anyApi;
export const internal = anyApi;
`,
);
writeFileSync(
  join(out, "dataModel.d.ts"),
  `${header("Generated data model types.")}
import type { DataModelFromSchemaDefinition, DocumentByName, TableNamesInDataModel, SystemTableNames } from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";

export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
`,
);
writeFileSync(
  join(out, "server.d.ts"),
  `${header("Generated utilities for implementing server-side Convex query and mutation functions.")}
import {
  ActionBuilder,
  HttpActionBuilder,
  MutationBuilder,
  QueryBuilder,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { DataModel } from "./dataModel.js";

export declare const query: QueryBuilder<DataModel, "public">;
export declare const internalQuery: QueryBuilder<DataModel, "internal">;
export declare const mutation: MutationBuilder<DataModel, "public">;
export declare const internalMutation: MutationBuilder<DataModel, "internal">;
export declare const action: ActionBuilder<DataModel, "public">;
export declare const internalAction: ActionBuilder<DataModel, "internal">;
export declare const httpAction: HttpActionBuilder;

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
export type DatabaseReader = GenericDatabaseReader<DataModel>;
export type DatabaseWriter = GenericDatabaseWriter<DataModel>;
`,
);
writeFileSync(
  join(out, "server.js"),
  `${header("Generated utilities for implementing server-side Convex query and mutation functions.")}
import {
  actionGeneric,
  httpActionGeneric,
  queryGeneric,
  mutationGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "convex/server";

export const query = queryGeneric;
export const internalQuery = internalQueryGeneric;
export const mutation = mutationGeneric;
export const internalMutation = internalMutationGeneric;
export const action = actionGeneric;
export const internalAction = internalActionGeneric;
export const httpAction = httpActionGeneric;
`,
);
console.log(`Generated convex/_generated for ${modules.length} modules.`);
