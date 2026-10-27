# ONE HUB

**One platform. Every connection. Complete control.**

The internal operating platform for ONE Property Holdings: an Admin portal, a Directors portal and a Marketing portal in one app, all reading and writing **one shared, real-time Convex database**.

| | |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 · Radix primitives (shadcn-style) · Lucide |
| Backend | Convex (database, reactive queries, mutations, file storage, crons, actions) · Convex Auth |
| Email | Resend (queued, rate-limited, de-duplicated; safe `log` mode by default) |
| Hosting | Cloudflare Pages (static SPA + `_headers` security policy) |
| Mobile | Installable PWA (manifest, service worker, push handler) |

## Quick start

```bash
npm install
npx convex dev            # creates/links a NEW, dedicated Convex project and writes .env.local
npx @convex-dev/auth      # one-time: generates JWT keys for Convex Auth
npx convex env set SITE_URL http://localhost:5173
npx convex env set ONEHUB_BOOTSTRAP_ADMIN_EMAIL you@company.co.za
npm run dev               # Vite + Convex together
```

Then open `http://localhost:5173/accept-invite?bootstrap=1` and create the first Super Admin with the bootstrap email. Everyone else joins by invitation (Admin → Users & roles). Full instructions: [`docs/SETUP.md`](docs/SETUP.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Frontend + Convex dev deployment |
| `npm run typecheck` | App, Convex functions and service worker |
| `npm test` | Backend tests (convex-test): permissions, sync, conflicts, imports, forms, email, publishing safety |
| `npm run build` | Production build into `dist/` |
| `npm run codegen:offline` | Regenerate `convex/_generated` without network access |
| `npm run ui-harness` | **Dev-only** visual QA with fictional sample data (never deployed) |

## Documentation

- [`docs/STATUS.md`](docs/STATUS.md): what's built, what's next, blockers
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): architecture, data model, sitemap, permissions, background jobs
- [`docs/SETUP.md`](docs/SETUP.md): environments, deployment, onboarding
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md): Google, Microsoft, Meta, LinkedIn, Resend, Web Push. What needs external approval.
- [`docs/FREE_TIER.md`](docs/FREE_TIER.md): provider limits and how ONE HUB stays within them
- [`docs/SECURITY_POPIA.md`](docs/SECURITY_POPIA.md): security model and POPIA obligations
