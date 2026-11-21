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
- Takes a role back only when the website says so: somebody unlinked, or a
  grant was edited in `/admin`. A role given by hand in Discord is left alone.
- Applies roles the moment a linked user joins the server.
- Keeps the multilingual welcome message in the rules channel (see below).

Four passes, because each catches something the others cannot:

| Pass | When | Catches |
|---|---|---|
| queue | every 5 seconds | what the website just did: link, unlink, grant change. The only pass that removes a role |
| `guildMemberAdd` | on join | someone who linked before joining |
| fast pass | every 5 minutes | new links the queue missed. Adds only |
| full reconcile | every 15 minutes, and at boot | a link made while the bot was down. Adds only |

The queue is the `discord_sync_jobs` table: the website writes a row, the bot
drains it. It is what makes linking feel immediate; the other passes are the
backstop for a row that never got written.

### When a role is taken away

Only when the website queued it, for the account the row names: reason
`unlinked` or `grant_changed`. The periodic passes add what is missing and
never remove.

It was not always so. The full reconcile used to strip the member role from
anybody without a link, to catch unlinks the queue had missed, and that also
undid every role the owner gave by hand to somebody who had not linked. A bot
that takes away what the owner just gave is working against its own server.

The price is that an unlink nobody queued leaves the role in place. So the
website does not rely on each route remembering to queue it: the database
client is watched (`backend/src/services/discord-unlink-watch.ts`, wired in
`backend/src/db/index.ts`), and a row is written whenever a link goes away, by
whatever road: the unlink button, a link or a user deleted in `/admin`, a
script, or the same user linking a different Discord account, which leaves the
old one without.

To take the role from somebody who never linked, remove it by hand in Discord.

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
| `DISCORD_QUEUE_MS` | no | Default 5000 |
| `DISCORD_FAST_PASS_MS` | no | Default 300000 |
| `DISCORD_RECONCILE_MS` | no | Default 900000 |

A role whose variable is missing is left alone entirely. That is deliberate: the
alternative, treating it as "nobody should have this role", would strip it from
everyone on a typo.

## Welcome message

One message in the server's rules channel (`#welcome`), with a button per
site language, in the site's order: en, es, pt-br, zh, fr. English comes
first and is the fallback for anything unknown. Pressing one answers in that language,
visible only to whoever pressed, so the channel stays a single message no
matter how many people read it. It works for members who have not linked yet,
which is who it is written for.

- Texts and buttons: `bot/src/welcome.ts`. Each language must fit in one
  Discord message (2000 characters); a test fails if one does not.
- The bot publishes it when it starts and edits it in place if the text
  changed, so changing the welcome is a deploy, not a manual edit. It looks for
  its own message among the last 50 in the channel.
- It needs View Channel, Send Messages and Read Message History in that
  channel. `#welcome` denies Send Messages to everyone, so the bot has its
  own overwrite there. Without it the bot logs why and carries on.
- No new intent and no slash command: buttons arrive as interactions.

The text ends by saying where to ask, and that depends on who pressed: the bot
looks at which channels that person can write in. A linked member is sent to
the general channel of their language; someone who has not linked yet cannot
write there, and is sent to `#help`.

To add a language, add it to `WELCOME_LANGS`, `WELCOME` and `LANG_FLAGS`, plus
its topic in `bot/scripts/harden-server.ts`, and run that script to create its
channel. Discord allows five buttons per row, and the row is full.

## Channels

Laid out by `bot/scripts/harden-server.ts` (dry run by default, `--apply` to
change anything). Names are in English: a channel has a single name for
everybody.

| Channels | Who reads | Who writes |
|---|---|---|
| `#welcome`, `#announcements` | everyone | admins |
| | | `#announcements` is an announcement channel: other servers can follow it |
| `#help` | everyone | everyone, 30 s slowmode |
| General (`#🇬🇧-general`, `#🇪🇸-general`, `#🇧🇷-general`, `#🇨🇳-general`, `#🇫🇷-general`), ZEROxWORK (`#tools`, `#projects`, `#feedback`), ZEROxPLAY, voice | ZEROxMEMBER | ZEROxMEMBER |
| `#mod-log` | staff and the bot | staff and the bot |

`#help` is the only place someone without the role can write, so that a person
who cannot get in has somewhere to say so. AutoMod blocks links there for
anyone without ZEROxMEMBER. The flags are the ones of the website's language
selector.

Somebody who has not linked sees three channels: `#welcome`, `#announcements`
and `#help`. The language channels were readable by everyone at first, and a
newcomer took five chats they could not write in for the server itself.

The channels of the General and ZEROxWORK categories carry no permissions of
their own: they stay in sync with their category, which is where who gets in
is set.
The category lets the bot in by name. That matters: Manage Channels is not
enough to move or rename a channel the bot cannot see, so a members-only
channel made by hand outside a category is out of the script's reach until the
bot is added to it.

## Invites

There is one invite, to `#welcome`, it does not expire, and only the owner can
create more. That is on purpose: Discord drops whoever joins in the channel the
invite was made from and has no setting for a default channel, so an invite
made from any other channel lands a newcomer past the welcome that explains how
to get in.

- The website links to it (`frontend/src/constants/links.ts`), and so does the
  topic of `#welcome`, which is where a member finds the link to pass on now
  that they have no Invite button. The script holds the same link in
  `OFFICIAL_INVITE`. Replace the invite and all three change.
- Create Invite is off for `@everyone` and for ZEROxMEMBER. The script removes
  it from `@everyone`; it cannot remove it from ZEROxMEMBER, because a bot may
  not change a permission it does not hold itself, so that one is unticked by
  hand in Server Settings → Roles.

Join messages go to `#mod-log`: they are for the team, not a line in the
members' chat every time somebody walks in.

## AutoMod

Five rules, created by the same script and all reporting to `#mod-log`:

| Rule | Stops |
|---|---|
| menciones masivas | more than five mentions in a message |
| spam | what Discord itself classes as spam |
| patrones de estafa | free nitro, "connect your wallet to", asking for a seed phrase |
| enlaces sin vincular | links from anybody without ZEROxMEMBER |
| nombres que suplantan al equipo | a profile such as "ZEROxWORK Support" |

The last one looks at the name, not at messages: whoever carries the brand next
to a word for staff cannot write, react or talk until they change it. The
patterns are in `bot/src/automod-patterns.ts`, with a test of names that must
and must not match. When there are real moderators, exempt their role.

AutoMod never acts on the owner or on bots, so none of this can be tried with
the two accounts the server has today.

The bot finds `#help` and the general channels by name
(`HELP_CHANNEL_NAME`, `generalChannelName` in `bot/src/welcome.ts`). Rename one
by hand and the welcome falls back: to the English channel, then to `#help`.

## Running it

```bash
cd bot && npm install && npm test   # pure logic, no network
npm run dev                          # needs the variables above
```

## Deploying

Second CapRover app from the same repository (`zerox-discord-bot` in production):

1. Create the app and tick **Do not expose as web app**: it has no HTTP port.
2. Set its captain definition path to `./captain-definition-bot`. That file sits
   at the repository root on purpose: CapRover uses the directory of the
   captain-definition as the Docker build context, and the bot's image needs
   `backend/prisma` next to `bot/`.
3. Add the variables from the table above in the panel, never through the API.
4. Enable the app's **App Token** and store it as the `CAPROVER_BOT_TOKEN`
   secret in GitHub (`gh secret set CAPROVER_BOT_TOKEN`). The deploy workflow
   then updates the bot on every push to `main`, right after the website passes
   its health check. Without the secret that step is skipped with a warning.

Never run a second copy of the bot against the same Discord server with a
different database, such as a laptop pointing at a local one. Each copy
reconciles the server against its own database, so each takes away the roles
the other granted.

Adding roles later needs no migration: add the entry to
`backend/src/constants/discord-roles.ts` and set its environment variable.

---

# Weekly devlogs

Once a week the bot looks at what landed in a game's repository and, if any of
it is worth a player's attention, posts a devlog in that game's channel.

## Where the repository comes from

Nowhere in the bot. It is the portfolio item's own `repoUrl`
(`/admin` → Projects), so a project's repository is written down in exactly one
place and it is the same one the website shows. A `repo_watches` row adds only
what the portfolio has no business knowing: which channel the game's players
read, and how far the bot has already reported.

Only GitHub is watched. The portfolio also accepts GitLab, and such a project
simply never gets a devlog.

## Setting one up

1. The project must be **published** and carry its GitHub URL in `repoUrl`.
2. `/admin` → **Repo watches** → new: pick the project id, paste the channel id
   (right click the channel in Discord → Copy ID), leave `branch` empty for the
   repository's default branch.
3. Leave `lastSha` empty. The first run then looks at the **seven days before
   the newest commit**, not the whole history: a repository that has been quiet
   for a month still gets its last active week, which is what a first devlog
   should cover.

The ZEROxPLAY channels as they stand:

| Channel | Id |
|---|---|
| `#elon-race` | `1570144963843596394` |
| `#golfcraft` | `1570144958034485288` |
| `#portal-lake` | `1570144959514808340` |
| `#claim-bite` | `1570144960928423959` |
| `#cryocene` | `1572255664942612520` |
| `#flagtag` | `1572256479384174785` |
| `#flappy-roadster` | `1570144965919768656` |

## What counts as worth posting

The pass asks GitHub for one comparison between the last reported commit and
the newest one, which carries the commits and the changed files together, and
then decides (`bot/src/repo-watch.ts`, pure, covered by tests):

- merge commits are dropped: whatever they brought in is already in the range;
- `design/`, `docs/`, `.github/`, `.claude/`, any `.md`, `.pdf`, `.txt` or
  lockfile is noise;
- a week with no file left outside the noise is not announced, however many
  commits it holds;
- what is left must reach either 60 changed lines or 3 changed files.

**A quiet week does not move `lastSha`.** Next week's post therefore carries
what piled up, instead of the quiet week swallowing it.

This gate is the whole point. The real week of 29 Oct – 5 Nov in
`pabloes/x-race` is three commits that add a GDD and its concept art: a naive
watcher announces an update for three commits of markdown, and this one says
nothing. That week is the fixture in `bot/tests/repo-watch.test.ts`.

## Who writes the post

Claude, through the Messages API (`bot/src/devlog.ts`), from the commit
subjects and the changed file paths. The prompt asks for bullets that say what
changed **for the person playing**, and forbids commits, SHAs, branches and
invented features. Commit subjects are treated as data, never as instructions.

Roughly one call per repository per week, so the cost is cents. Server-side
fallback is on, so a policy decline does not lose the week.

Without `ANTHROPIC_API_KEY`, or when the call fails, the post is the plain list
of commit subjects instead. That reads like a changelog, which is the point: a
list of real changes beats silence or an invention.

A post never mentions anybody: `allowedMentions` is empty, so an `@everyone`
in generated text cannot go out.

## Dry run

**On by default.** The draft goes to `DISCORD_LOG_CHANNEL_ID` (and to the
console when there is none), marked as a dry run and naming the channel it was
meant for. Nothing is marked as reported, so the same week can be read,
corrected and run again. Set `REPO_WATCH_DRY_RUN=false` when the posts have
been worth reading for a few weeks.

## Cadence

Every hour the bot looks for a repository whose week is up; the week is counted
from `lastCheckedAt` in the database, not from a timer. That is deliberate: the
bot restarts on every deploy, and an interval started at boot would either skip
a week or fire on every restart.

A failure (a bad token, a channel the bot cannot write in) leaves
`lastCheckedAt` alone, so the next hourly pass retries instead of waiting a
week. The log says so once, when the error changes, and then stays quiet.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GITHUB_TOKEN` | for private repositories | Fine-grained PAT, read-only **Contents** + **Metadata**, limited to the repositories being watched. A public repository works without one, at 60 requests an hour |
| `ANTHROPIC_API_KEY` | no | Without it the posts are the plain list of commit subjects |
| `DEVLOG_MODEL` | no | Default `claude-opus-5-5` |
| `REPO_WATCH_DRY_RUN` | no | Default `true`. `false` posts to the game channel |
| `REPO_WATCH_EVERY_MS` | no | Default 7 days |
| `REPO_WATCH_PASS_MS` | no | Default 3600000 |

A fine-grained PAT expires. Set it for a year and put the renewal in the
calendar; a GitHub App would not expire but is more to set up.

## Database

Migration `20261121203500_add_repo_watch` creates `repo_watches`: a new table
and a foreign key to `projects`, nothing existing is touched. It applies in
production with the `prisma migrate deploy` that already runs on container
start.

It was written with `prisma migrate diff --from-schema-datasource`, for the
reason recorded above: `prisma migrate dev` cannot replay this repository's
history in a shadow database. The diff also reported two pre-existing drifts
between the local database and the schema — `articles.lang` is nullable in the
database and `NOT NULL` in the schema, and `article_slugs_createdat_idx` is
spelled differently — which are **not** part of this migration and are still
there to look at.
