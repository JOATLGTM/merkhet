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

There are no demo logins — the database holds real data and accounts are invite-only. Sign in
with an existing admin account; see [Inviting people](#inviting-people) to add others. To
start over from demo data instead, `npm run seed`.

⌘K opens the command palette.

## Inviting people

There is no public sign-up — accounts are only created by an admin on `/staff`. Name plus
email sends a Supabase invite email; the recipient sets their own password at
`/accept-invite`. `handle_new_user` (in the init migration) copies `name` and `role` out of
the invite metadata into `public.users`, so the row exists before they ever sign in.

### Supabase configuration

**Auth → URL Configuration** is the only required step:

- **Site URL** — same origin as `NEXT_PUBLIC_SITE_URL`.
- **Redirect URLs** — add `<NEXT_PUBLIC_SITE_URL>/accept-invite` and
  `<NEXT_PUBLIC_SITE_URL>/reset-password`. An unlisted target does not raise an error;
  Supabase quietly falls back to Site URL, so the symptom is a link that lands on the wrong
  page rather than anything that looks like a failure.

**Auth → SMTP Settings** is required before inviting anyone who is not you. Supabase's
built-in sender refuses addresses outside the project's team and is capped at ~2 messages
an hour; custom SMTP lifts both (30/hour by default) and is what unlocks the email template
editor. Until then you can only invite your own address, as a test.

### Setting up SMTP (Resend)

Supabase's built-in sender is capped at ~2 messages an hour and refuses any address outside
the Supabase organisation's own team, so real invites need custom SMTP. Any transactional
provider works; these are the steps for Resend.

1. **Add the domain.** Resend dashboard → Domains → Add Domain → `merkhetdrafting.com`.
   Resend generates the DNS records for you — a DKIM `TXT`, an SPF `TXT` (usually on a
   `send.` subdomain), and an optional `MX` for bounce handling. Values are per-domain, so
   copy them from that screen rather than from any guide.
2. **Add the records** wherever the domain's DNS lives — the registrar, or Cloudflare/Vercel
   if the nameservers were moved — then hit Verify. Minutes usually, up to a few hours.
3. **Create an API key.** Resend → API Keys → Create. Shown once.
4. **Enable SMTP in Supabase** — Authentication → SMTP
   (`/dashboard/project/<ref>/auth/smtp`), toggle Enable Custom SMTP:

   | Field | Value |
   |---|---|
   | Sender email | `noreply@merkhetdrafting.com` |
   | Sender name | `Merkhet` |
   | Host | `smtp.resend.com` |
   | Port | `587` |
   | Username | `resend` |
   | Password | the API key |

   Sending as an address does not require being able to receive at it. Replies bounce unless
   the mailbox exists, so use a monitored address if that matters.
5. **Raise the rate limit** — Authentication → Rate Limits. The email field is locked at 2/hour
   until custom SMTP is on, then defaults to 30/hour and becomes editable.
6. **Test** from `/staff`: invite yourself, confirm the mail arrives and the link opens
   `/accept-invite` with a set-password form.

Before verification completes you can send from `onboarding@resend.dev` to check the wiring.
Resend's docs do not say whether that shared sender reaches recipients other than your own
account address — treat it as a smoke test, not as a way to onboard staff.

Invite links are built from Supabase's **Site URL**, so they point wherever that is set. While
it is `http://localhost:3000` the emails only work on that machine — deploy and update Site
URL, `NEXT_PUBLIC_SITE_URL`, and the Redirect URLs allowlist before inviting anyone else.

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

### Forgotten passwords

`/forgot-password` (linked from the sign-in form) emails a recovery link that lands on
`/reset-password`, which shares its screen with `/accept-invite` — both consume a one-time
link and set a password on the resulting session.

The request is sent with a plain `@supabase/supabase-js` client rather than the SSR one.
`createServerClient` pins `flowType: "pkce"`, which stores a code verifier in the requesting
browser's cookies and produces a link only that browser can complete — asking for a reset on
a laptop and opening the mail on a phone would fail. The default implicit flow puts the
tokens in the link itself.

The form always reports success, whether or not the address has an account; saying otherwise
would make it a way to test which addresses are registered. Rate-limit errors (429) are
surfaced, since those are actionable. Like invites, delivery needs custom SMTP for anyone
outside the Supabase project's team.

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
