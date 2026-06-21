#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Deploy the Sudoku Sally production stack on server 2 (gowithsally-prod,
# 88.198.205.229) as user `deploy`. Idempotent: clone-or-update, (re)build &
# restart, then self-host the latest APK into the landing container.
#
# Secrets are read from the environment (CI passes them; see deploy.yml):
#   JWT_SECRET, REDIS_PASSWORD, UI_USER, UI_PASS
# If they are set, deploy/.env.prod is (re)written from them; otherwise the
# existing deploy/.env.prod is reused (for manual re-runs).
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/salistar/sudo-sally.git}"
REPO_DIR="${REPO_DIR:-$HOME/apps/sudo-sally}"
BRANCH="${BRANCH:-main}"
APK_URL="${APK_URL:-https://github.com/salistar/sudo-sally/releases/latest/download/sudoku-sally.apk}"

echo "▶ Deploying $REPO_URL ($BRANCH) → $REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "▶ Cloning repo..."
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd deploy

# Build .env.prod from the environment when secrets are provided.
if [ -n "${JWT_SECRET:-}" ]; then
  echo "▶ Writing deploy/.env.prod (preferring values already live on this host)"
  # Resolve each value preferring what the LIVE stack already uses, so a redeploy —
  # even into a fresh checkout dir, or after the CI server target changed — never
  # rotates secrets (which would log everyone out) or drops config set out-of-band
  # on the server (e.g. the YouTube OAuth keys). Resolution order:
  #   running sudoku-api container env  ->  existing .env.prod  ->  CI env var  ->  default
  # Every helper must return 0 — a non-zero status inside the `{ } > .env.prod`
  # block (or its substitutions) would abort the whole deploy under `set -e`.
  running_env() { docker inspect sudoku-api --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n "s/^$1=//p" | head -1 || true; }
  resolve() {
    local k="$1" def="${2:-}" v
    v="$(running_env "$k")"
    if [ -z "$v" ] && [ -f .env.prod ]; then v="$(sed -n "s/^$k=//p" .env.prod | head -1)"; fi
    if [ -z "$v" ]; then v="${!k:-}"; fi
    if [ -z "$v" ]; then v="$def"; fi
    printf '%s=%s\n' "$k" "$v"
    return 0
  }
  {
    resolve JWT_SECRET
    resolve REDIS_PASSWORD
    resolve UI_USER sally
    resolve UI_PASS
    resolve TURN_SHARED_SECRET
    resolve TURN_HOST turn.salistar.com
    resolve GOOGLE_CLIENT_ID
    resolve GOOGLE_CLIENT_SECRET
    resolve GOOGLE_REDIRECT_URI https://api.sallysudo.com/api/youtube/callback
    resolve TOKEN_ENC_KEY
  } > .env.prod
  chmod 600 .env.prod
fi
if [ ! -f .env.prod ]; then
  echo "✖ deploy/.env.prod missing and no secrets in env — aborting." >&2
  exit 1
fi

echo "▶ Building & starting containers..."

# Migration aid: the web container used to be deployed by hand (a
# `sudoku-web` container that compose didn't know about). The new compose
# now manages it; if a pre-compose container is still hanging around it
# will block the new one with "name already in use". Remove the legacy one
# only if it isn't already labelled as part of THIS compose project.
if docker ps -a --format '{{.Names}}' | grep -qx sudoku-web; then
  if ! docker inspect sudoku-web --format '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null | grep -qx sudoku-sally; then
    echo "▶ Removing legacy sudoku-web container (pre-compose hand-deploy)..."
    docker rm -f sudoku-web >/dev/null 2>&1 || true
  fi
fi

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --remove-orphans

echo "▶ Staging latest APK into the landing container..."
tmp="$(mktemp)"
if curl -fsSL "$APK_URL" -o "$tmp" && [ -s "$tmp" ]; then
  docker exec sudoku-landing mkdir -p /usr/share/nginx/html/downloads
  docker cp "$tmp" sudoku-landing:/usr/share/nginx/html/downloads/sudoku-sally.apk
  docker exec sudoku-landing chmod 644 /usr/share/nginx/html/downloads/sudoku-sally.apk
  echo "  ✓ APK staged ($(du -h "$tmp" | cut -f1))"

  # Purge the Cloudflare cache for this URL so the new APK is visible
  # immediately to anyone who clicks the download button. Without this,
  # CF would serve the previously-cached file for hours.
  if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ]; then
    echo "▶ Purging Cloudflare cache for /downloads/sudoku-sally.apk..."
    curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"files":["https://sudoku.gowithsally.com/downloads/sudoku-sally.apk"]}' \
      | grep -o '"success":[a-z]*' || true
  else
    echo "  ℹ CF_API_TOKEN / CF_ZONE_ID not set — skipping CF purge."
    echo "    (Visitors may see the cached APK for up to ~4h until TTL expires."
    echo "     Set CF_API_TOKEN + CF_ZONE_ID GitHub Secrets to enable instant purge.)"
  fi
else
  echo "  ⚠ APK download failed — skipping (download page will fall back to GitHub Releases)"
fi
rm -f "$tmp"

echo "▶ Pruning dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo "▶ Status:"
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

echo "✅ Done. Caddy (gws-caddy) serves these (see deploy/Caddyfile.snippet):"
echo "     https://sudoku.gowithsally.com        → sudoku-landing:80"
echo "     https://api.sudoku.gowithsally.com    → sudoku-api:3001"
echo "     https://db.sudoku.gowithsally.com     → sudoku-mongo-ui:8081 (basic auth)"
echo "     https://cache.sudoku.gowithsally.com  → sudoku-redis-ui:8081 (basic auth)"
