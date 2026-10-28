#!/usr/bin/env bash
# Cloudflare Workers Builds entry point (wrangler.toml [build]).
# - Production branch with CONVEX_DEPLOY_KEY: push Convex functions, then build with VITE_CONVEX_URL injected.
# - Any other branch with CONVEX_DEPLOY_KEY: build against the same deployment without pushing functions,
#   so a PR preview never changes the live backend.
# - No key: plain build (the app shows its "setup required" page).
set -euo pipefail

if [ -f dist/index.html ]; then
  echo "dist already built; skipping"
  exit 0
fi

PROD_BRANCH="${ONEHUB_PRODUCTION_BRANCH:-main}"
BRANCH="${WORKERS_CI_BRANCH:-}"

if [ -n "${CONVEX_DEPLOY_KEY:-}" ]; then
  if [ "$BRANCH" = "$PROD_BRANCH" ]; then
    echo "==> $BRANCH: deploying Convex functions and building"
    exec npx convex deploy --cmd 'npm run build'
  fi
  # Deploy keys look like "prod:<deployment-name>|<secret>".
  name="${CONVEX_DEPLOY_KEY%%|*}"
  name="${name#*:}"
  export VITE_CONVEX_URL="${VITE_CONVEX_URL:-https://$name.convex.cloud}"
  echo "==> ${BRANCH:-unknown branch}: preview build against $VITE_CONVEX_URL (functions not deployed)"
fi

exec npm run build
