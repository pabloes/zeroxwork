# ZEROxWORK public API

A read-only API over the portfolio. Everything it answers is already published
on the site, so it needs no key and any page on any domain may call it from a
browser.

Base address: `https://zeroxwork.com/api/public/v1`

```bash
curl https://zeroxwork.com/api/public/v1/projects
```

The API describes itself at the base address, so the endpoints and their query
parameters can be read without this file:

```bash
curl https://zeroxwork.com/api/public/v1
```

## What it promises

- **Read only.** No key, no sign-in, nothing that writes.
- **Only published projects.** A draft answers `404`, the same as something
  that was never there: whether it exists is not a stranger's business.
- **Whole addresses.** Covers, screenshots, avatars and member pages come back
  as `https://…`, ready to drop into an `<img src>` or follow.
- **`v1` does not break.** Fields may be added; none will be removed or
  renamed. The day that stops being possible there will be a `v2`, and `v1`
  will keep answering, because something out there will still be asking.

Rate limit: 120 requests per minute per IP. A page showing our projects makes
one or two; a loop that hits it harder gets a `429` with a JSON body.

## `GET /projects`

The portfolio. Featured projects first, then newest first.

| Query | Meaning |
| --- | --- |
| `lang` | Language for the prose: `es`, `en`, `fr`, `pt-br`, `zh`. Falls back to how the project was written. |
| `tag` | Only projects carrying this tag. Case does not matter. |
| `author` | Only projects this member handle worked on (`pablo`, not the display name). |
| `limit` | How many. Default 20, maximum 100. |
| `offset` | How many to skip. |

```json
{
  "total": 12,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": 7,
      "slug": "money-grass",
      "url": "https://zeroxwork.com/portfolio/money-grass",
      "title": "Money Grass",
      "summary": "Un cómic interactivo hecho en tres meses.",
      "lang": "es",
      "readingLang": "es",
      "availableLangs": ["es", "en"],
      "status": "live",
      "featured": true,
      "startedAt": "2025-03-01T00:00:00.000Z",
      "endedAt": "2025-06-15T00:00:00.000Z",
      "createdAt": "2025-06-20T09:12:00.000Z",
      "updatedAt": "2025-10-02T18:40:00.000Z",
      "cover": "https://zeroxwork.com/api/images/user-uploaded-images/9f2c….jpg",
      "screenshots": [
        "https://zeroxwork.com/api/images/user-uploaded-images/a1….jpg",
        "https://zeroxwork.com/api/images/user-uploaded-images/b2….jpg"
      ],
      "video": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      "siteUrl": "https://moneygrass.example",
      "repoUrl": null,
      "tags": ["comic", "3d"],
      "authors": [
        {
          "name": "Pablo Estornut",
          "role": "código",
          "handle": "pablo",
          "url": "https://zeroxwork.com/member/pablo",
          "avatar": "https://zeroxwork.com/api/images/user-uploaded-images/c3….jpg"
        },
        {
          "name": "Llacer",
          "role": "dibujo",
          "handle": null,
          "url": null,
          "avatar": null
        }
      ]
    }
  ]
}
```

The listing has no `content`: a page of thirty projects would be mostly prose
nobody asked for. Ask for the project itself to get it.

## `GET /projects/{idOrSlug}`

One project, the same object plus `content`: the body text as Markdown, in the
language `lang` asked for. Both `money-grass` and `7` work, and the id never
stops working even if the project is renamed.

```bash
curl "https://zeroxwork.com/api/public/v1/projects/money-grass?lang=en"
```

## Fields worth a word

- **`authors`** — who made the project, in the order the entry arranges them.
  `role` is free text (`código`, `3D`, `música`). Someone with an account here
  has a `handle`, a `url` to their member page and an `avatar`; someone
  credited by name alone has all three as `null`, which is allowed on purpose:
  not everybody who makes something signs up for a site.
- **`cover` / `screenshots` / `video`** — the cover, the gallery in display
  order, and at most one video (YouTube or Vimeo, as its watch URL, not an
  embed). A project has between three and eight screenshots.
- **`lang`, `readingLang`, `availableLangs`** — `lang` is what it was written
  in, `readingLang` is what actually came back, and `availableLangs` lists what
  could be asked for. Titles are never translated: a project is called what it
  is called.
- **`status`** — free text, in practice `live`, `wip` or `archived`.
- **`url`** — the project's page on the site, for linking back.

## Errors

JSON, always, with an `error` field.

| Status | When |
| --- | --- |
| `404` | No such project, or no such endpoint. A draft looks exactly like this. |
| `429` | Over the rate limit. |
| `500` | Something broke on our side. |

## Notes for whoever maintains this

- The routes live in `backend/src/routes/public-api.ts`; the shape handed out
  is built in `backend/src/services/public-projects.ts` and nowhere else.
- The shape is deliberately **not** the one `/api/projects` answers with. That
  one is for our own pages and changes with them.
- Mounted before the site's own CORS in `server.ts`, on purpose: the site's
  CORS sends `Allow-Credentials`, which a browser refuses next to a wildcard
  origin.
- `SITE_URL` (`backend/src/config/site.ts`) is what makes the addresses whole.
  Set the env var of the same name on a staging copy so it does not hand out
  links to the live site.
