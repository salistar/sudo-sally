#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# Deploy the Sudoku Sally production stack on server 1 (91.99.70.43).
# Idempotent: clone-or-update the repo, then (re)build & restart the stack.
# Usage (on the server):  REPO_DIR=/opt/sudo-sally bash deploy/deploy.sh
# Or via CI (deploy.yml) which calls it over SSH.
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/salistar/sudo-sally.git}"
REPO_DIR="${REPO_DIR:-/opt/sudo-sally}"
BRANCH="${BRANCH:-main}"

echo "▶ Deploying $REPO_URL ($BRANCH) → $REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "▶ Cloning repo..."
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"

cd deploy

# First run: create .env.prod from the example (then edit it with real secrets).
if [ ! -f .env.prod ]; then
  echo "⚠  deploy/.env.prod not found — creating from example. EDIT IT with a real JWT_SECRET!"
  cp .env.prod.example .env.prod
fi

echo "▶ Building & starting containers..."
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --remove-orphans

echo "▶ Pruning dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo "▶ Status:"
docker compose -f docker-compose.prod.yml ps

echo "✅ Done. Site should be reachable via the Cloudflare Tunnel at https://sudoku.gowithsally.com"
echo "   (ensure the ingress rule from deploy/cloudflared-ingress.example.yml is in place)"
