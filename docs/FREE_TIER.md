# Free-tier plan

Figures gathered on 27 Oct 2026 from provider pages and secondary sources. **Verify on each provider's
live pricing page before relying on them**: they change, and several were only available via
third-party summaries.

| Provider | Free allowance (as researched) | ONE HUB usage design |
|---|---|---|
| Convex (Starter/free) | ~1M function calls/mo, ~0.5 GB database, ~1 GB file storage, ~1 GB DB bandwidth (unconfirmed), action compute allowance | Indexed queries and pagination everywhere; crons do one indexed lookup when idle; dashboards use bounded scans (fine below ~10k rows per table). The 1-minute publishing cron is about 43k calls/month. |
| Resend (free) | 3,000 emails/mo, **100/day** | Queue paces sends (~1.6/s); per-job idempotency keys and dedupe keys; email fallback is opt-in. ONE HUB counts sends per UTC day and never exceeds `ONEHUB_EMAIL_DAILY_LIMIT` (default 100) or `ONEHUB_EMAIL_MONTHLY_LIMIT` (default 3,000). An announcement larger than the remaining allowance needs the director's confirmation; the rest is sent automatically after the daily reset. Provider quota errors also wait for the reset instead of failing. |
| Cloudflare Pages | Static requests unlimited; ~500 builds/mo; Workers/Functions ~100k req/day | ONE HUB is a static SPA (no Pages Functions), so request limits don't apply. |
| Google / Microsoft calendar APIs (planned) | Free, rate-limited | Sync on demand; no tight polling. |

## Media storage

Convex file storage (~1 GB free) is used now for shared documents and the Marketing Studio. Studio
videos and print-ready design files are large, so this is the first free-tier limit ONE HUB is likely to reach. If the document library grows
past ~700 MB, move large videos to **Cloudflare R2** (10 GB free storage, zero egress). This is a
paid-capable product, so **R2 will not be enabled without approval**.

## Possible future costs

- Convex Professional (about $25/developer/month) if function calls or storage exceed the free tier.
- Resend Pro (about $20/month for 50k emails) for large or frequent announcements.
- Cloudflare R2 beyond 10 GB.
