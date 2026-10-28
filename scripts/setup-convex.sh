#!/usr/bin/env bash
# One-time Convex setup for ONE HUB: links/creates the Convex project, pushes the functions,
# generates the Convex Auth keys, sets SITE_URL and creates the first Super Admin's invitation.
#
#   npm run setup:convex                                        # dev deployment, SITE_URL=http://localhost:5173
#   npm run setup:convex -- --prod --site-url https://hub.<domain>
#
# Override the first admin with ADMIN_EMAIL=... ADMIN_NAME=... (defaults below).
# Safe to re-run: bootstrapAdmin refuses once an active Super Admin exists.
set -euo pipefail

ADMIN_EMAIL="${ADMIN_EMAIL:-kelvin@sabroking.co.za}"
ADMIN_NAME="${ADMIN_NAME:-Kelvin}"
PROD=""
SITE_URL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --prod) PROD="--prod" ;;
    --site-url) SITE_URL="${2:?--site-url needs a value}"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

if [ -n "$PROD" ]; then
  [ -n "$SITE_URL" ] || { echo "Production needs --site-url https://hub.<domain>" >&2; exit 1; }
  echo "==> Deploying functions to the production deployment"
  npx convex deploy
else
  SITE_URL="${SITE_URL:-http://localhost:5173}"
  echo "==> Linking the Convex project (choose \"create a new project\", name it one-hub) and pushing functions"
  npx convex dev --once
fi

echo "==> Setting SITE_URL=$SITE_URL"
npx convex env set $PROD SITE_URL "$SITE_URL"

echo "==> Generating Convex Auth keys (JWT_PRIVATE_KEY, JWKS)"
npx @convex-dev/auth $PROD

echo "==> Creating the first Super Admin invitation for $ADMIN_EMAIL"
npx convex run $PROD system:bootstrapAdmin "{\"email\":\"$ADMIN_EMAIL\",\"name\":\"$ADMIN_NAME\"}"

echo
echo "Done. Open the url above (valid 24 hours) as $ADMIN_EMAIL and set a password."
echo "Email stays in safe 'log' mode until Resend is configured (docs/RESEND_SETUP.md)."
