# Deploying Hearth

Hearth runs as one Docker Compose project (`hearth`) on a server that already has a shared
edge Caddy (`global-caddy`, on the external `global-proxy` network) terminating TLS for
several apps. Hearth adds no host ports and shares nothing with the other stacks.

| Container         | Image                | Networks                          | Purpose                             |
| ----------------- | -------------------- | --------------------------------- | ----------------------------------- |
| `hearth-postgres` | `postgres:16-alpine` | `hearth-internal`                 | Database (volume `hearth-pgdata`)   |
| `hearth-migrate`  | `hearth/api`         | `hearth-internal`                 | `prisma migrate deploy`, then exits |
| `hearth-api`      | `hearth/api`         | `hearth-internal`, `global-proxy` | NestJS API + socket.io on :3000     |
| `hearth-web`      | `hearth/web`         | `global-proxy`                    | Built SPA served by Caddy on :80    |

The edge routes `hearth.fawadiqbal.dev`: `/api/*` and `/socket.io/*` to `hearth-api:3000`,
everything else to `hearth-web:80` (block in `deploy/edge.Caddyfile`).

## First install

```bash
sudo mkdir /opt/hearth && sudo chown "$USER" /opt/hearth
git clone https://github.com/fawadeqbal/project-management-tool /opt/hearth
cd /opt/hearth
cp deploy/.env.example .env && chmod 600 .env   # fill in secrets: openssl rand -hex 32
deploy/deploy.sh --seed                          # seed runs only if the database is empty
```

Then append `deploy/edge.Caddyfile` to `/opt/global-proxy/Caddyfile` and reload the edge:
back up the file, validate the candidate inside the container
(`caddy validate --config /tmp/Caddyfile.new --adapter caddyfile`), write it **in place**
(`cat new > Caddyfile`; the file is a single-file bind mount, so `sed -i`/`mv` would detach it)
and run `docker exec global-caddy caddy reload --config /etc/caddy/Caddyfile`.

## Updating and rolling back

```bash
cd /opt/hearth && deploy/deploy.sh             # pull main, build, migrate, restart, wait for health
cd /opt/hearth && deploy/deploy.sh --rollback  # previous images (tagged hearth/*:previous)
```

Images are built on the server (it is ARM64, aarch64). The build takes a few minutes of CPU;
running containers keep serving because `up -d` only recreates Hearth's containers after the
images are ready. Memory limits: API 512 MB, Postgres 384 MB, web 64 MB.

Demo login after `--seed`: `fawad@acme.com` / `hearth123`.
