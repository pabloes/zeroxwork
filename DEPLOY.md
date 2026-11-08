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

### Optional variables

| Variable | Purpose |
|----------|---------|
| `ADMIN_NOTIFY_EMAIL` | Mailbox that receives an admin notice on each sign-up and each new article |
| `LOGS_TOKEN` | Lets `/api/logs` be read with the `X-Logs-Token` header instead of an admin JWT |
| `LOG_BUFFER_SIZE` | Entries kept in the in-memory log buffer (default 2000, max 20000) |

`ADMIN_NOTIFY_EMAIL` is set in the **CapRover web panel** like every other env
var (never via the CapRover API, see above). It is optional: leave it empty and
no notices are sent at all. When set, the notices go out over the same SMTP
transport as the verification mail, with subjects `[ZEROxWORK] Nueva alta: ...`
and `[ZEROxWORK] Nuevo artículo: ...`. A notice that cannot be delivered is
recorded under scope `admin-notify` in `/api/logs` and never affects the
registration or the article.

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

## Running the maintenance scripts in production

The scripts live in `backend/scripts/` and ship inside the image (`COPY . .`),
with `tsx` and the production `DATABASE_URL` already in the container. So they
run **inside** the container, not from a laptop: the Postgres service is on
CapRover's internal Docker network and is not reachable from outside.

The CapRover app is `zerox3`, so the Swarm container is named
`srv-captain--zerox3.<n>.<taskid>`. The task id changes on every deploy, which
is why the commands below resolve it instead of hardcoding it.

```bash
# SSH into the server, then confirm the container is there:
docker ps --filter name=srv-captain--zerox3

# Open a shell in it. It lands in /usr/src/app/backend, where the scripts are.
docker exec -it $(docker ps -qf name=srv-captain--zerox3) sh
```

Every script is a **dry-run by default**: it writes nothing and prints what it
would do, including which database it is pointing at. `--apply` is what writes.

| Script | What it does |
|--------|--------------|
| `seed-portfolio.ts` | Creates/updates the portfolio projects from `src/constants/portfolio-seed.ts` |
| `seed-handles.ts` | Gives handles to the accounts that have an on-chain name |
| `backfill-handles.ts` | Gives every remaining account a handle (Discord -> eth name -> `member-<id>`) |
| `backfill-translations.ts` | Translates articles that have no translations yet (costs DeepL quota) |

Order matters between `seed-handles.ts` and `backfill-handles.ts`: the first
claims the real names, the second only fills the gaps, so running them the other
way round leaves people as `member-<id>` forever.

```bash
# Inside the container — all four in seco first:
npx tsx scripts/seed-portfolio.ts && npx tsx scripts/seed-handles.ts && npx tsx scripts/backfill-handles.ts && npx tsx scripts/backfill-translations.ts

# Then, if the output looks right:
npx tsx scripts/seed-portfolio.ts --apply && npx tsx scripts/seed-handles.ts --apply && npx tsx scripts/backfill-handles.ts --apply && npx tsx scripts/backfill-translations.ts --apply
```

`backfill-translations.ts` takes `--category <name>` to limit it, and `--force`
to redo articles that already have translations (it deletes the stored ones for
those articles first, because a matching `sourceHash` is otherwise skipped).

What these scripts write goes to the database, which is a separate volume: it
survives deploys, so they are one-time, not something to repeat on every push.

`/members` is empty until the handles exist: the route lists accounts with a
handle, and refuses to fall back to showing an email address.

## Publishing the portfolio projects

The projects live in `backend/src/constants/portfolio-seed.ts`. The script only
creates and updates, matching by slug, so running it again is how you publish an
edit to that file. Without `--apply` it writes nothing and prints what it would
do, including which database it is pointing at.

```bash
# SSH into server, then:
docker exec <container_id> npx tsx scripts/seed-portfolio.ts            # dry-run
docker exec <container_id> npx tsx scripts/seed-portfolio.ts --apply    # publish
```

The articles are published by the oldest ADMIN account unless you pass
`--author <email>` or set `PORTFOLIO_AUTHOR_EMAIL`. Add `--translate` to have
DeepL fill in the other languages (it costs quota, so it is off by default).

### Credits and member pages

A project credits several people, which the single `userId` on an article cannot
express, so credits are rows in `article_credits`. A credit always stores the
name; linking it to an account is what turns that name into a link to
`/member/<handle>`.

The link is made by handle. Until somebody sets theirs — on `/account`, or from
`/admin` → Users → handle — their credit shows as plain text, and the script
reports it as "name only". Re-run the script after the handle exists and it
links itself. Credits can also be edited by hand in `/admin` → ArticleCredit.

Covers are served from `frontend/public/portfolio/`, not hotlinked from anyone
else's server. Add the file there and point `thumbnail` at `/portfolio/<name>`.

## Running tests locally

```bash
cd backend
npm test
```
