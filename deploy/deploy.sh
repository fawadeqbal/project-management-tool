#!/usr/bin/env bash
# Builds and (re)starts Hearth on the server. Run from the checkout, e.g. /opt/hearth:
#
#   deploy/deploy.sh            update: pull, build, migrate, restart
#   deploy/deploy.sh --seed     also load the demo data, only if the database is empty
#   deploy/deploy.sh --rollback switch back to the images from the previous deploy
#
# Scoped to the `hearth` compose project: it never stops, prunes or rebuilds anything else.
set -euo pipefail

main() {
  cd "$(dirname "$0")/.."
  local mode="${1:-}"
  local compose=(docker compose -f deploy/docker-compose.prod.yml --env-file .env)
  [[ -f .env ]] || { echo "Missing .env (copy deploy/.env.example and fill it in)." >&2; exit 1; }

  if [[ "$mode" == "--rollback" ]]; then
    for img in api web; do docker tag "hearth/$img:previous" "hearth/$img:latest"; done
    "${compose[@]}" up -d hearth-api hearth-web
    wait_healthy
    exit 0
  fi

  if [[ -d .git ]]; then
    git fetch --quiet origin "${REF:-main}"
    git checkout --quiet -B "${REF:-main}" "origin/${REF:-main}"
  fi
  echo "Deploying $(git rev-parse --short HEAD 2>/dev/null || echo 'working tree')"

  for img in api web; do
    if docker image inspect "hearth/$img:latest" >/dev/null 2>&1; then
      docker tag "hearth/$img:latest" "hearth/$img:previous"
    fi
  done
  docker build -f deploy/Dockerfile --target api -t hearth/api:latest .
  docker build -f deploy/Dockerfile --target web -t hearth/web:latest .

  "${compose[@]}" up -d --remove-orphans
  wait_healthy

  if [[ "$mode" == "--seed" ]]; then
    local users
    users=$(docker exec hearth-postgres psql -U hearth -d hearth -tAc 'SELECT count(*) FROM "User"')
    if [[ "$users" == "0" ]]; then
      "${compose[@]}" run --rm --no-deps hearth-api node_modules/.bin/tsx prisma/seed.ts
    else
      echo "Database already has $users users; skipping the seed (it would wipe them)."
    fi
  fi

  # Only dangling layers from earlier Hearth builds; other stacks' images are untouched.
  docker image prune -f --filter label=app=hearth >/dev/null
  echo "Hearth is up."
}

wait_healthy() {
  for _ in $(seq 1 40); do
    status=$(docker inspect -f '{{.State.Health.Status}}' hearth-api 2>/dev/null || echo starting)
    [[ "$status" == "healthy" ]] && return 0
    sleep 3
  done
  echo "hearth-api did not become healthy; last logs:" >&2
  docker logs --tail 60 hearth-api >&2
  exit 1
}

main "$@"
exit
