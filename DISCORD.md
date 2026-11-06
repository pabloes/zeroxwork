# Discord integration

Two pieces:

- **Linking** (in the web app): a ZEROxWORK user links their Discord identity
  from `/account` through OAuth2.
- **The bot** (`bot/`, its own CapRover app): turns that link into roles on the
  community server, and takes them back when the link goes away.

## How the flow works

1. `POST /api/discord/oauth/start` (JWT required) returns the Discord authorize URL.
   The user id travels inside `state`, signed with HMAC-SHA256 and valid for 10 minutes.
2. The browser goes to Discord and comes back to
   `GET /api/discord/oauth/callback`, which is unauthenticated by nature: the
   redirect carries no `Authorization` header. The identity is taken from the
   verified `state`, never from the query string.
3. The code is exchanged for an access token, the profile is read from
   `/users/@me`, and **the token is revoked right away**. No Discord token is
   ever stored.
4. The link is written to `discord_links`. Both `userId` and `discordId` are
   unique, so a Discord account cannot be claimed by two ZEROxWORK users.
5. The user always lands back on `/account?discord=<outcome>`.

PKCE is not used on purpose. The exchange happens server-side with the client
secret, which makes this a confidential client; PKCE exists for public clients
(SPA, mobile) and Discord does not support it for this flow. `state` is what
protects against CSRF here, and it is mandatory.

## Creating the application

1. https://discord.com/developers/applications → **New Application**, name it
   `ZEROxWORK`.
2. **OAuth2** → copy the **Client ID** and **Client Secret**.
3. **OAuth2 → Redirects**: add exactly the URL you will use.
   - Production: `https://zeroxwork.com/api/discord/oauth/callback`
   - Local: `http://localhost:3000/api/discord/oauth/callback`
   Discord requires an exact match, including the scheme and any trailing path.
4. Scopes used by the site: `identify` only. Nothing else is requested.
5. For phase 2 (the bot), under **Bot**: enable the **Server Members Intent**,
   and invite it with `Manage Roles`, `View Channels` and `Send Messages`.
   Never with Administrator, and its role must sit **above** the roles it hands
   out, or the API answers 403.

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `DISCORD_CLIENT_ID` | linking | Public, from the Developer Portal |
| `DISCORD_CLIENT_SECRET` | linking | Secret. CapRover panel only |
| `DISCORD_REDIRECT_URI` | linking | Must match the Developer Portal entry exactly |
| `DISCORD_OAUTH_STATE_SECRET` | linking | Random string, e.g. `openssl rand -base64 32`. Not shared with any other system |
| `DISCORD_BOT_TOKEN` | phase 2 | Secret. Lives in the bot app, not in the web app |
| `DISCORD_GUILD_ID` | phase 2 | Community server id |
| `DISCORD_ROLE_ZEROXWORK` | phase 2 | Role id granted to linked members |

The four linking variables are read at call time, not at boot. If any is
missing, the integration reports itself as not configured: the endpoints answer
503, the UI block does not render, and **the site keeps working normally**. This
is deliberate: `src/config/env.ts` throws on missing secrets at startup, and the
Discord integration must never be able to take the site down.

## Testing locally

```bash
cd backend && npm test
```

Covers the state signature (round trip, tampering, wrong secret, expiry), the
authorize URL, and the code exchange with the Discord API mocked.

To exercise the HTTP layer without credentials:

```bash
curl -i "http://localhost:3000/api/discord/oauth/callback?code=x&state=forged.signature"
```

Expected: `302` to `/account?discord=invalid_state`.

## Database

Migration `20261104171500_add_discord_link` creates `discord_links`. It is
additive: a new table plus a foreign key, nothing existing is touched. It
applies in production with the `prisma migrate deploy` that already runs on
container start.

Note for whoever runs migrations next: `prisma migrate dev` currently fails on
this repo while validating history in the shadow database, because
`20241124000000_add_redirect_url_to_translations` cannot be replayed from
scratch. That is pre-existing and unrelated to Discord. This migration was
written from `prisma migrate diff` and applied with `migrate deploy`.

## Security notes

- No Discord token is stored, and the access token is revoked after reading the profile.
- `state` is signed and time-limited; a tampered or expired one is rejected before any API call.
- Rate limits: 20 starts and 40 callbacks per 15 minutes per IP.
- Unlinking only ever deletes the caller's own row; no endpoint accepts a user id from the client.
- Errors are logged by code, never with the authorization code or the token.


---

# The bot

Separate process on purpose: it holds a permanent gateway connection, and a
crash there must not take the website down with it.

## What it does

- Grants the base `ZEROxWORK` role to any linked member.
- Grants the CRASH CITY roles listed for that user in `discord_role_grants`,
  which an admin fills in by hand from `/admin`.
- Takes roles back when the link or the grant disappears.
- Applies roles the moment a linked user joins the server.

Three passes, because each catches something the others cannot:

| Pass | When | Catches |
|---|---|---|
| `guildMemberAdd` | on join | someone who linked before joining |
| fast pass | every minute | new links and changed grants |
| full reconcile | hourly, and at boot | unlinks, manual role edits, anything missed |

The unlink case is why the full reconcile exists: a deleted row leaves nothing
to poll for, so roles are reconciled against the member list instead.

## The safety rule

The bot only ever touches role ids listed in its environment variables. A
moderator role, or anything another bot handed out, is invisible to it: not
added, and above all never removed. That logic lives in `bot/src/roles.ts` as
pure functions, covered by tests that assert exactly this.

Roles above the bot in the hierarchy are reported in the log and skipped,
because Discord answers 403 for those no matter how many times you retry.

## Setting it up

1. **Developer Portal → Bot**: add a bot, enable **Server Members Intent**
   (privileged; without it the member list comes back empty and nothing syncs),
   and copy the token.
2. **Invite it** with the minimum permissions, Manage Roles + View Channels +
   Send Messages, and no Administrator:
   `https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=bot&permissions=268438528`
3. **Create the roles** in the server, then enable Developer Mode in Discord
   (Settings → Advanced) and copy each role id with right click → Copy ID.
4. **Drag the bot's own role above them** in Server Settings → Roles. This is
   the step everyone forgets, and the symptom is a 403 on every assignment.

## Bot environment variables

| Variable | Required | Notes |
|---|---|---|
| `DISCORD_BOT_TOKEN` | yes | Secret, lives only in the bot app |
| `DISCORD_GUILD_ID` | yes | `1567562204243562648` for ZEROxWORK.com |
| `DATABASE_URL` | yes | Same database as the web app |
| `DISCORD_ROLE_ZEROXWORK` | yes | Base role id |
| `DISCORD_ROLE_CRASH_CITY_PARTICIPANT` | no | Unset means the role is simply not managed |
| `DISCORD_ROLE_CRASH_CITY_CREATOR` | no | Same |
| `DISCORD_LOG_CHANNEL_ID` | no | Private channel for moderation logs |
| `DISCORD_FAST_PASS_MS` | no | Default 60000 |
| `DISCORD_RECONCILE_MS` | no | Default 3600000 |

A role whose variable is missing is left alone entirely. That is deliberate: the
alternative, treating it as "nobody should have this role", would strip it from
everyone on a typo.

## Running it

```bash
cd bot && npm install && npm test   # pure role logic, no network
npm run dev                          # needs the variables above
```

## Deploying

Second CapRover app from the same repository:

1. Create an app, for example `zerox3-bot`, with **no** HTTP port exposed.
2. In its settings set the captain definition path to `./bot/captain-definition`.
3. Add the variables from the table above in the panel, never through the API.

Adding roles later needs no migration: add the entry to
`backend/src/constants/discord-roles.ts` and set its environment variable.
