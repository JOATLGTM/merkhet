# Accounts — invite, password reset, and the data wipe

**Built and verified 2026-08-21.** Three related pieces: real invite emails, a password-reset
flow, and the reset of the database to production-empty.

No migration. All of it is application code plus Supabase dashboard configuration.

## There is no public sign-up

Accounts are created by an admin on `/staff`. Name plus email sends a Supabase invite; the
recipient sets their own password. `/login` carries no link to anything but password reset.

### What was broken before

`inviteUser` called `admin.auth.admin.createUser` with `crypto.randomUUID()` as the password
and sent no email. Every account it created was **unreachable** — nobody knew the password and
there was no way to set one. The button had always appeared to work.

It now calls `inviteUserByEmail`.

## The two link flows

Both end at the same set-password screen (`components/auth/set-password-form.tsx`), shared by
`/accept-invite` and `/reset-password` with different copy.

| Route | Purpose |
|---|---|
| `/accept-invite` | Invite lands here; recipient sets a password |
| `/reset-password` | Recovery link lands here |
| `/forgot-password` | Requests a recovery email; linked from `/login` |
| `/auth/confirm` | Route handler; exchanges a `token_hash` for a session cookie |

`proxy.ts` allows all four signed out. Bouncing them to `/login` would also strip the URL
fragment before the client could read it.

### The fragment problem — read this before touching the flow

Supabase's **stock** email template returns the session in a URL *fragment*
(`#access_token=…`), which browsers never send to the server. A server route cannot see it.

The obvious fix — let supabase-js pick it up automatically — **does not work**:
`@supabase/ssr`'s `createBrowserClient` hardcodes `flowType: "pkce"` *after* its options
spread (`createBrowserClient.js:40`), so it cannot be overridden, and auth-js rejects a
fragment callback under PKCE as `"Not a valid PKCE flow url"` (`GoTrueClient.js:3252`).

So `set-password-form.tsx` reads the fragment itself and calls `setSession`, which writes
through the same cookie storage so the server sees it too, then strips the tokens out of the
address bar. That error is *returned*, not thrown, and does not consume the fragment or clear
an existing session — which is what makes reading it by hand safe.

`/auth/confirm` handles the better variant, where the token arrives as a query string and
never touches browser history. It needs a customised template, which Supabase only unlocks
once the project has custom SMTP:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/accept-invite
```

Optional. Both paths work.

### Password reset uses a plain client on purpose

`createServerClient` also pins `flowType: "pkce"`, which stores a code verifier in the
*requesting browser's* cookies and mints a link only that browser can complete — request a
reset on a laptop, open the mail on a phone, and it fails. `requestPasswordReset` therefore
uses a plain `@supabase/supabase-js` client, whose default implicit flow puts the tokens in
the link itself.

The form always reports success, whether or not the address has an account: saying otherwise
would make it a way to test which addresses are registered. Rate-limit errors (429) *are*
surfaced, since those are actionable.

## Supabase configuration

**Auth → URL Configuration**

- **Site URL** — must match `NEXT_PUBLIC_SITE_URL`.
- **Redirect URLs** — `<site>/accept-invite` and `<site>/reset-password`.

An unlisted redirect **does not raise an error** — Supabase quietly falls back to Site URL.
The symptom is a link landing on the wrong page, not a failure. Verified by probe, 2026-08-21.

**Auth → SMTP** — required. The built-in sender is capped at ~2 messages/hour and refuses any
address outside the Supabase organisation's own team; the symptom of the first is
`email rate limit exceeded`, of the second `Email address not authorized`. Both are surfaced
with actionable wording by `inviteUser` rather than passed through raw.

Custom SMTP is also what unlocks the **email template editor** and makes the email rate limit
field editable — both are locked while on the built-in sender. That is not obvious from the
dashboard, and cost time here.

Dashboard navigation moved at some point: SMTP is **Authentication → SMTP**
(`/auth/smtp`), rate limits **Authentication → Rate Limits** (`/auth/rate-limits`) — not
under Project Settings.

## ⚠️ The database was wiped

**2026-08-21.** All demo data removed; the firm is entering real records.

Deleted: 23 projects, 12 customers, 138 phase rows, 59 activity entries, 17 phase transitions,
6 approvals, 1 consultant, 5 contract PDFs, and 6 accounts (`whoskawaii@gmail.com` plus the
five `@merkhet.studio` seed users).

**Exactly one account survives** — `christopher.vo.h@gmail.com`, **promoted from staff to
admin** as part of the wipe. It was `staff`, which would have failed `requireAdmin` on
`/staff`, locking the only remaining user out of inviting anyone.

Consequences for anything that reads as stale in the older handoff docs:

- The `chris@merkhet.studio` / `password` demo logins **no longer exist**.
- `npm run check:gates` signs in as `chris@merkhet.studio` and will **fail** until it is
  pointed at a live account.
- "Backfill delegation on the 18 live projects" is moot — there are no such projects.
- `project_number_seq` was reset to 400, so the first real project is MK-0400.

### Deleting one account — the `users` table is the wrong place

**2026-08-21.** Hit while re-testing with `whoskawaii@gmail.com`: the row was deleted from the
`users` table, and the next invite still failed with *"already has an account"* while the
table editor showed the address as gone.

`public.users.id` is `references auth.users(id) on delete cascade` (init migration, line 15).
The cascade runs **auth → profile only**. Deleting the profile leaves the login registered,
so `inviteUserByEmail` keeps refusing an address that looks absent everywhere an admin would
think to look. `inviteUser` now detects exactly this — login present, profile missing — and
says so instead of repeating the generic message.

`/staff` now carries a per-row delete (trash icon → confirm dialog), which is the path an
admin should use — `deleteUserAction` gates on `requireAdmin`, refuses self-deletion, and
`deleteUser` in `lib/db/repo.ts` goes through the service-role admin API so the login goes
with the profile. The dialog names the cost before it happens: how many in-progress phases
lose their assignee (read off the workload data the page already has, so no extra query),
that activity history stays but goes unattributed, and that subscriptions are dropped. It
also points at Active as the reversible alternative.

Self-deletion is refused because it would revoke the session mid-request; since the caller is
an admin and cannot be the target, at least one admin always survives, which is why there is
no separate last-admin check.

`scripts/delete-user.ts` remains for anything the UI cannot see — an orphaned login has no
row on `/staff`, so only the script can reach it:

```bash
npx tsx scripts/delete-user.ts someone@example.com        # report only
npx tsx scripts/delete-user.ts someone@example.com --yes  # delete
```

Reports before deleting, and counts the references it will disturb: `assignee_id` and
`actor_id` go null (history kept, attribution lost), `phase_subscribers` rows are deleted.
Not wired into `npm run`, for the same reason `reset-data.ts` isn't.

### The script

`scripts/reset-data.ts`. Deliberately **not** wired into `npm run` — it should be awkward
enough to reach for that nobody runs it by muscle memory.

```bash
npx tsx scripts/reset-data.ts --keep you@example.com --yes
```

Refuses without `--yes`. Aborts before deleting anything if `--keep` names an account that
does not exist, rather than leaving no way back in. Both guards were exercised against the
live project before the real run.

Sequences are not reachable through the REST API, so the project-number reset is the one step
it cannot do; it prints the SQL.

## Verified

- Guard paths tested live before the destructive run.
- Post-wipe inventory: all nine tables at 0, contracts bucket empty, one admin account.
- `/accept-invite`, `/reset-password`, `/forgot-password` all 200 signed out;
  `/staff` still redirects.
- `/auth/confirm` maps a missing token to `?error=invalid_link` and a bad one to
  `?error=expired_link`; both render on `/login`.
- Login form no longer prefills anything — verified in served HTML.

## Not verified

- **The hydrated states on `/accept-invite` and `/reset-password`** — set-password vs expired.
  No browser tooling was available; the initial HTML is the "checking" state either way.
- **No real invite or reset email has been opened end to end.**

## Still open

- `NEXT_PUBLIC_SITE_URL`, Supabase **Site URL**, and the Redirect URLs allowlist all still
  point at `http://localhost:3000`. Invite and reset links therefore work only on the
  developer's machine. **This blocks onboarding any staff member.**
- No re-invite path: an address that already has an auth row fails with "already has an
  account". Recovery is deleting the auth user in the dashboard, or a password reset.
