# Merkhet

Internal project tracking for Merkhet Architecture.

## Stack

- Next.js 16.3 (App Router, Cache Components)
- Tailwind CSS v4 + shadcn/ui (KokonutUI registry) — note `components/ui/*` are **Base UI**, not Radix
- Motion + dnd-kit
- **Hosted Supabase** (Auth + Postgres + Storage). `lib/db/demo-store.ts` is the seed source
  for `npm run seed`, not a runtime adapter — the app has no offline mode.

Product requirements: [`docs/PRD.md`](docs/PRD.md).  
Workflow authority: [`docs/handoff/WORKFLOW-2.md`](docs/handoff/WORKFLOW-2.md).  
Session handoff (resume context): [`docs/handoff/`](docs/handoff/) — start at `NEXT.md`.

## Run locally

Requires a Supabase project. Fill `.env` from `.env.example`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_MERKET_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY` | Anon / publishable key |
| `SUPABASE_SERVICE_MERKET_ROLE_KEY` | Service role — seed and admin invite only |
| `NEXT_PUBLIC_SITE_URL` | Origin invite emails link back to. Defaults to `http://localhost:3000` |

```bash
npm install
npm run seed   # first time / reset demo data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Restart the dev server after any `.env`
change — it is not hot-reloaded.

| Email | Password | Role |
|---|---|---|
| `chris@merkhet.studio` | `password` | Admin |
| `dana@merkhet.studio` | `password` | Staff |

⌘K opens the command palette.

## Inviting people

There is no public sign-up — accounts are only created by an admin on `/staff`. Name plus
email sends a Supabase invite email; the recipient sets their own password at
`/accept-invite`. `handle_new_user` (in the init migration) copies `name` and `role` out of
the invite metadata into `public.users`, so the row exists before they ever sign in.

### Supabase configuration

**Auth → URL Configuration** is the only required step:

- **Site URL** — same origin as `NEXT_PUBLIC_SITE_URL`.
- **Redirect URLs** — add `<NEXT_PUBLIC_SITE_URL>/accept-invite`. Supabase refuses to
  redirect anywhere unlisted, so the invite call fails without it.

**Auth → SMTP Settings** is required before inviting anyone who is not you. Supabase's
built-in sender refuses addresses outside the project's team and is capped at ~2 messages
an hour; custom SMTP lifts both (30/hour by default) and is what unlocks the email template
editor. Until then you can only invite your own address, as a test.

### How the link gets exchanged

Supabase's stock invite template returns the session in a URL *fragment*
(`#access_token=…`), which browsers never send to the server. `/accept-invite` is therefore
a client page: it reads the fragment, installs the session with `setSession` (which writes
through cookie storage, so the server sees it too), and strips the tokens from the address
bar. It cannot rely on supabase-js doing this automatically — `createBrowserClient` pins
`flowType: "pkce"` after its options spread, and auth-js rejects a fragment callback under
PKCE.

`/auth/confirm` handles the better variant, where the token arrives as a query string and
never touches the browser's history. It needs a customised template, so it only becomes
available once custom SMTP is on:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite
```

Point **Redirect URLs** at `/auth/confirm` as well if you switch. Both paths end at the same
set-password screen.

Invites expire (24h by default). A used or stale link shows an explanation and asks the
recipient to request a new one; re-invite from `/staff`.

## Migrations

Applied by hand through the Supabase SQL editor, in filename order, from
`supabase/migrations/`. Each `SLICE_*_APPLY.md` in `docs/handoff/` records what its migration
does and how it was verified. Functions are replaced wholesale rather than patched, so the
newest migration touching `move_project` is the one that defines it.

## Scripts

- `npm run dev` / `build` / `start` — Next.js
- `npm run lint` — ESLint
- `npm run seed` — reset demo data in hosted Supabase
- `npm run check` — schedule + calendar arithmetic (73 assertions, no database)
- `npm run check:gates` — workflow gates + rework loop (50 assertions) — **writes to hosted
  Supabase**; creates one throwaway project and deletes it. Deliberately outside `check`.
- `npm run email:preview` — render all 16 notification emails to `out/emails/`. No network.
- `npm run email:send` — list the cases; `-- --case <n>` sends one through Gmail SMTP. A test
  harness, **not** the app's send path. Needs the `GMAIL_TEST_*` vars in `.env`.

There is no test runner; these are plain scripts that exit non-zero. **Nothing verifies
rendering.**

## Email

Templates for phase-change notifications live in [`lib/email/`](lib/email/) — internal mail on
every column, client mail on the phases flagged `customerVisible` in `lib/phases.ts`. Rendering
only: there is no provider, no outbox, and `lib/notifications.ts` is still a stub. Routing
table and deliverability notes in [`lib/email/README.md`](lib/email/README.md); build history in
[`docs/handoff/SLICE_6_TEMPLATES.md`](docs/handoff/SLICE_6_TEMPLATES.md).

## Status

The MVP (board, customers, detail sheet, drag-to-advance, command palette, calendar, settings)
is complete. Workflow build-out is tracked as a separate slice sequence — see
[`docs/handoff/CHANGES-2.md`](docs/handoff/CHANGES-2.md) for the status table and
[`docs/handoff/CURRENT_STATE.md`](docs/handoff/CURRENT_STATE.md) for what works today.

> The old "MVP slices" numbering that used to live here is **not** the workflow slice
> numbering in `CHANGES-2.md`. Two unrelated sequences; do not cross-reference them.
