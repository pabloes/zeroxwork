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
