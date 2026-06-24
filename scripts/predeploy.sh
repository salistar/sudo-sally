#!/usr/bin/env bash
#
# Pre-deploy test gate — run BEFORE every deployment.
#
#   Backend → srv3 (sudoku-api) : run this first; deploy only if it exits 0.
#   Web     → srv3 (sudoku-web) : run this first; deploy only if it exits 0.
#   Mobile  → APK/AAB           : run this first; build only if it exits 0.
#
# Same gate as the GitHub Actions CI (.github/workflows/ci.yml). Any failing
# test, a coverage regression below the floor, or a web build break → non-zero
# exit → STOP, do not deploy.
#
# Usage:  bash scripts/predeploy.sh            (full gate, incl. web compile)
#         bash scripts/predeploy.sh --fast     (skip the ~3 min web export)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAST="${1:-}"

echo "════════════════════════════════════════════════════════"
echo " SallySudo pre-deploy gate"
echo "════════════════════════════════════════════════════════"

echo "==> [1/3] Backend tests + coverage threshold"
( cd "$ROOT/backend" && NODE_ENV=test npx jest --coverage --ci )

echo "==> [2/3] Mobile unit tests"
( cd "$ROOT/mobile" && npx jest --ci )

if [ "$FAST" = "--fast" ]; then
  echo "==> [3/3] Web compile  (SKIPPED via --fast)"
else
  echo "==> [3/3] Web bundle compiles (expo export -p web)"
  ( cd "$ROOT/mobile" && npx expo export -p web >/dev/null )
fi

echo "════════════════════════════════════════════════════════"
echo " ✅ All gates passed — safe to deploy."
echo "════════════════════════════════════════════════════════"
