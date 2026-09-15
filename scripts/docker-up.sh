#!/usr/bin/env bash
# Build and start the full Jobs stack (MySQL, Redis, ES, API, Next.js).
# Usage: bash scripts/docker-up.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.compose ]]; then
  echo "Creating .env.compose from .env.compose.example"
  cp .env.compose.example .env.compose
  echo "Edit FRONTEND_PATH and passwords in .env.compose, then re-run."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed." >&2
  exit 1
fi

docker compose --env-file .env.compose up --build -d
docker compose --env-file .env.compose ps

echo
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:4001/health"
echo "Guide:    docs/docker.md"
