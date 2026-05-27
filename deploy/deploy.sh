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
  echo "▶ Writing deploy/.env.prod from environment secrets"
  {
    printf 'JWT_SECRET=%s\n'     "$JWT_SECRET"
    printf 'REDIS_PASSWORD=%s\n' "${REDIS_PASSWORD:-}"
    printf 'UI_USER=%s\n'        "${UI_USER:-sally}"
    printf 'UI_PASS=%s\n'        "${UI_PASS:-}"
  } > .env.prod
  chmod 600 .env.prod
fi
if [ ! -f .env.prod ]; then
  echo "✖ deploy/.env.prod missing and no secrets in env — aborting." >&2
  exit 1
fi

echo "▶ Building & starting containers..."
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --remove-orphans

echo "▶ Staging latest APK into the landing container..."
tmp="$(mktemp)"
if curl -fsSL "$APK_URL" -o "$tmp" && [ -s "$tmp" ]; then
  docker exec sudoku-landing mkdir -p /usr/share/nginx/html/downloads
  docker cp "$tmp" sudoku-landing:/usr/share/nginx/html/downloads/sudoku-sally.apk
  docker exec sudoku-landing chmod 644 /usr/share/nginx/html/downloads/sudoku-sally.apk
  echo "  ✓ APK staged ($(du -h "$tmp" | cut -f1))"
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
