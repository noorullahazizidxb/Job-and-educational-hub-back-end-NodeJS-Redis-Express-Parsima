#!/usr/bin/env bash
# Deploy backend then customer Next.js to Vercel (if the sibling frontend exists).
# Usage: bash scripts/deploy-vercel-all.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/deploy-vercel.sh"

FRONTEND="${FRONTEND_PATH:-}"
if [[ -z "$FRONTEND" ]]; then
  for candidate in \
    "$ROOT/../jobAndEducation-Hub-Next-JS" \
    "$ROOT/../jobAndEducation-Hub-Next-JS-Final_Branch"
  do
    if [[ -f "$candidate/scripts/deploy-vercel.sh" ]]; then
      FRONTEND="$candidate"
      break
    fi
  done
fi

if [[ -n "${FRONTEND}" && -f "$FRONTEND/scripts/deploy-vercel.sh" ]]; then
  echo
  echo "Deploying customer Next.js from $FRONTEND"
  bash "$FRONTEND/scripts/deploy-vercel.sh"
else
  echo "Frontend repo not found. Set FRONTEND_PATH or deploy it separately."
fi
