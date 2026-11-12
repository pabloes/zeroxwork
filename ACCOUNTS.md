# Accounts: sign-in, recovery and the links we mail

How an account is opened, recovered and changed. The Discord role hangs from
the account (see `DISCORD.md`), so losing the password must not mean losing
the account.

## The pieces

| What | Where |
|---|---|
| Routes | `backend/src/routes/auth.ts`, mounted at `/api/auth` |
| Tokens (pure, tested) | `backend/src/services/auth-tokens.ts` |
| Mails and their links | `backend/src/services/auth-mails.ts` |
| Finding an account by address | `backend/src/services/user-lookup.ts` |
| Who is behind a Bearer token | `backend/src/middleware/session.ts` |
| Pages | `/login`, `/forgot-password`, `/reset-password`, `/confirm-email`, `/verify`, and the Security panel in `/account` |

## Tokens: one job each

Everything is signed from `JWT_SECRET`, and nothing else needs configuring.

- **Session**: signed with the secret itself, says `purpose: 'session'`, lasts
  10 000 seconds. It carries `pv`, a fingerprint of the password it was opened
  with. Change or reset the password and every session opened before it stops
  working. The middleware reads the role and the email from the database on
  every request, never from the token.
- **Mailed links** (verification 6 h, password reset 30 min, email change 1 h):
  each signed with its own key, derived from the secret. They cannot pass as a
  session, or as each other, because the signature does not verify.

The reset link works once without a table to remember it in: it carries a
fingerprint of the password it is meant to replace, and stops matching once
that password is gone. The email-change link does the same with the address
and the password.

Two allowances for tokens issued before 2026-11-12 live in `auth-tokens.ts`
(old sessions, old verification mails). Both are dated in their comments and
can be deleted a day after that deploy.

## Links

`https://zeroxwork.com/<page>#token=…`. The token is in the fragment, so it
never reaches our request log. An inline script at the top of
`frontend/index.html` takes it out of the address before anything else runs,
analytics included; the page reads it with `takeLinkToken()`.

`SITE_URL` (optional) changes the host in the links, for a staging copy or a
local run.

## What the answers give away

- `POST /login`: the same answer for a wrong password and for an address we do
  not know. An unverified account is only told so once the password is right.
- `POST /forgot-password`: always `{ ok: true }`, sent before anything is
  looked up. One mail per account every two minutes.
- `POST /register` still says when an address is taken. Closing that means
  changing how sign-up answers, and it has not been done.

## Addresses

Stored trimmed and lower case from now on (`normalizeEmail`). Accounts created
before keep whatever capitals they were typed with, so the lookup tries the
address as typed, then normalised, then ignoring case. No existing row was
rewritten.

## Not here yet

- 2FA, and a limit on `/admin` login attempts.
- A captcha on sign-up.
- Sign-in with Discord, Google or a wallet.
- Mails in the reader's language: they are in English.

## Testing

```bash
cd backend && npx vitest run tests/auth-tokens.test.ts tests/auth-http.test.ts tests/auth-mails.test.ts
```

`auth-http.test.ts` runs the real routes and middleware over HTTP with the
database and the mail server stood in for.
