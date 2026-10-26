# ZEROxWORK Deploy Guide

## How deploys work

Pushing to `main` triggers a GitHub Actions workflow that:
1. Sends the code to CapRover
2. CapRover builds the Docker image (Dockerfile)
3. Container starts: `prisma generate` -> `prisma migrate deploy` -> `npm run prod`
4. Workflow runs a health check against the API

Manual deploys via `caprover deploy` CLI also work but should be avoided
when the GH Actions workflow is active to prevent race conditions.

## Environment variables

All runtime env vars are configured in the **CapRover web panel**:
`https://captain.zeroxwork.com` -> Apps -> zerox3 -> App Configs -> Environmental Variables

### CRITICAL: Never modify env vars via the CapRover API

The `appDefinitions/update` endpoint does a **full replace** of the envVars array.
A partial update or missing field will **delete all variables**, causing total downtime.

Always use the CapRover web panel to add, edit, or remove env vars.

### Required secrets (app won't start without these)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (used by Prisma) |
| `JWT_SECRET` | Signs/verifies auth tokens |
| `SESSION_SECRET` | Express session encryption |
| `ADMIN_COOKIE_PASSWORD` | AdminJS session cookie |

The app validates `JWT_SECRET`, `SESSION_SECRET`, and `ADMIN_COOKIE_PASSWORD`
at startup via `src/config/env.ts`. Missing any of these crashes the process
with a clear error message.

`DATABASE_URL` is consumed by Prisma directly (before the app code runs).

## Verifying production after deploy

```bash
# Check the site loads
curl -s -o /dev/null -w "HTTP %{http_code}" https://zerox3.zeroxwork.com/

# Check the API responds
curl -s -o /dev/null -w "HTTP %{http_code}" https://zerox3.zeroxwork.com/api/blog/articles

# Both should return 200.
```

If you get 502:
1. SSH into the server
2. Find the container: `docker ps -a --filter name=zerox3`
3. Check logs: `docker logs <container_id> --tail 100`
4. Common causes:
   - Missing env var (check CapRover panel)
   - Prisma migration failure (check DB connectivity)
   - Port mismatch (PORT env var must match containerHttpPort in CapRover)

## Auditing site logs (`/api/logs`)

The app keeps the last ~2000 log entries in memory (console output + one entry
per HTTP request) and serves them over HTTP. The buffer is **lost on restart**
and is per-replica, so it only covers the running process.

Access requires either an admin JWT (`Authorization: Bearer <token>`) or the
`X-Logs-Token` header matching the optional `LOGS_TOKEN` env var set in the
CapRover panel.

```bash
TOKEN=<LOGS_TOKEN>
BASE=https://zeroxwork.com

# Health of env vars, SMTP (connects + authenticates, sends nothing) and DB
curl -s -H "X-Logs-Token: $TOKEN" $BASE/api/logs/diagnostics

# Plain-text tail, filterable by level / scope / substring / timestamp
curl -s -H "X-Logs-Token: $TOKEN" "$BASE/api/logs/text?limit=100"
curl -s -H "X-Logs-Token: $TOKEN" "$BASE/api/logs/text?scope=mail&level=error"
curl -s -H "X-Logs-Token: $TOKEN" "$BASE/api/logs?q=register&limit=50"

# Last accounts created (is the user missing, or just unverified?)
curl -s -H "X-Logs-Token: $TOKEN" "$BASE/api/logs/registrations?limit=10"

curl -s -H "X-Logs-Token: $TOKEN" $BASE/api/logs/stats      # buffer counters
curl -s -X DELETE -H "X-Logs-Token: $TOKEN" $BASE/api/logs  # empty the buffer
```

Scopes: `http` (requests), `mail` (SMTP attempts/results), `console`
(everything the app logs). JWTs, passwords and `Authorization` values are
redacted before being stored.

For anything older than the current process, use `docker logs` (see above).

## Running the backfill script (one-time migration tasks)

```bash
# SSH into server, then:
docker exec <container_id> npx tsx scripts/backfill-embed-from-script.ts        # dry-run
docker exec <container_id> npx tsx scripts/backfill-embed-from-script.ts --apply # apply
```

## Running tests locally

```bash
cd backend
npm test
```
