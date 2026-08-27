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

**Auth → link expiry** — Authentication → Sign In / Providers → Email → **Email OTP
Expiration**, in seconds. GoTrue calls the field `mailer_otp_exp`; it governs the invite and
the recovery link alike, and **86400 (24 hours) is the ceiling**, not just a suggested value.
Supabase's security advisor lints anything above 3600 — that warning is expected at 24 hours,
not a misconfiguration.

There is no `config.toml` in this repo (see [The script](#the-script) and
`scripts/push-supabase-templates.ts`), so this value exists **only** in the hosted project.
Nothing in the tree reads it, and no check script reports it. To see it without the dashboard,
GET the same endpoint the template push PATCHes:

```
GET https://api.supabase.com/v1/projects/{ref}/config/auth
Authorization: Bearer $SUPABASE_ACCESS_TOKEN
```

That is a personal access token (`sbp_…`), not the service role key — same credential, same
reasoning as the template push. It is in `.env.example` and **not** in `.env`, so as of
2026-08-24 the live value cannot be read from this machine at all.

Changing it makes one line of app copy false: `app/(auth)/forgot-password/page.tsx` tells the
recipient the reset link "expires in an hour". Update it with the setting.


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

**Auth → Emails** — the invite and reset templates are the firm's, not GoTrue's.

Both were stock markup (`<h2>You've been invited</h2>` and two paragraphs) while every other
message the firm sends carried the wordmark, the rule and the palette — and the invite is the
first thing a new employee ever sees from this system. They now render through the same shell
as the project mail:

```
npm run email:supabase        # writes out/emails/supabase-{invite,recovery}.html
```

| Dashboard template | File | API field | Pairs with redirect |
|---|---|---|---|
| Invite user | `supabase-invite.html` | `mailer_templates_invite_content` | `<site>/accept-invite` |
| Reset password | `supabase-recovery.html` | `mailer_templates_recovery_content` | `<site>/reset-password` |

Two ways to land it in the project:

```
npm run email:supabase:push            # what would change, writes nothing
npm run email:supabase:push -- --yes   # writes it
```

The push needs `SUPABASE_ACCESS_TOKEN` in `.env` — a **personal access token** (`sbp_…`) from
[account/tokens](https://supabase.com/dashboard/account/tokens), not the service role key.
Templates are project *configuration*, and the Management API is account-scoped: the service
key 401s here, and the failure reads like a permissions bug rather than a wrong credential.
That token reaches every project the account owns, which is why nothing in the app uses it and
why leaving it unset is a reasonable choice. It PATCHes four fields and touches nothing else;
whatever is live is written to `out/emails/*.backup.html` first.

`supabase config push` is the wrong tool here and the script says so: it applies the whole
`[auth]` block from `config.toml`, and with no `config.toml` in this repo that means Site URL,
redirect URLs, SMTP and rate limits all reset to CLI defaults on the first push.

Otherwise paste each file into the matching template's **Body** in the dashboard, replacing
everything there, and set the **Subject** the render script prints.

Source is `lib/email/templates/auth-link.ts`; copy is `AUTH_COPY` in `lib/email/copy.ts`.
**Edits made in the dashboard are lost on the next paste** — edit the copy, re-render, re-paste.

Only `{{ .ConfirmationURL }}` and `{{ .Email }}` are interpolated, and the link target is
unchanged, so the fragment flow above still applies exactly as described. The one thing to
check after pasting: send yourself an invite and confirm the link still lands on
`/accept-invite`, because a template paste is also an opportunity to lose a placeholder.

## "Link expired" is three failures wearing one heading

**2026-08-24.** Ryan Kolb reported repeatedly that his invite link "expires" before he can use
it. Raising the expiry is the obvious response and is probably the wrong one — recorded here
because the next person will reach for the same lever.

`components/auth/set-password-form.tsx` renders the `expiredTitle` screen whenever
`resolveStatus()` cannot produce a session. That is one heading over three distinct causes:

| Cause | What the recipient did | Fixed by a longer expiry |
|---|---|---|
| The window really did lapse | Opened it late | **Yes** |
| The token was already spent | Clicked twice, or something else fetched it first | No |
| The fragment never arrived | Landed somewhere the tokens were stripped | No |

**Not** on that list, and worth not re-adding: a PKCE verifier mismatch between the device
that requested a reset and the device that opened it. `requestPasswordReset` uses a plain
`@supabase/supabase-js` client specifically to avoid it — see
[Password reset uses a plain client on purpose](#password-reset-uses-a-plain-client-on-purpose).

The copy underneath hedges accordingly — *"This link has already been used or has run out"* —
and `/login` says *"expired or was already used"*. So a report of "it expired" is the reader
quoting the heading, not a diagnosis. **Do not treat it as one.**

### The likeliest cause is a scanner burning the token

Auth links are **single-use**, and `{{ .ConfirmationURL }}` is a plain GET on Supabase's
`/auth/v1/verify`. Anything that fetches that URL consumes it. Microsoft 365 Defender
SafeLinks prefetches links in inbound mail; Mimecast and Proofpoint do the same. The token is
spent in transit and the human's first click lands on the expired screen — at any expiry
setting.

The template already prints the raw link as text under the button — the `fallback` block in
`lib/email/templates/auth-link.ts` — precisely because gateways rewrite buttons. Telling the
recipient to **copy that link rather than click the button** sidesteps link *rewriting*. It
does not undo a prefetch that already happened.

### Triage before changing anything

Supabase → **Authentication → Users** → the person's row.

- `confirmed_at` set, never signed in, no password ever chosen → **something consumed the
  invite that was not them.** A scanner. Expiry is irrelevant.
- No `confirmed_at`, invite sent hours ago → plausibly a real lapse. Raise the expiry.
- Row absent entirely → the invite never sent. Check SMTP and the rate limit, not the link.

Also confirm both `<site>/accept-invite` and `<site>/reset-password` are still in **Auth → URL
Configuration → Redirect URLs**. An unlisted redirect fails silently to Site URL, as recorded
above; `AuthFragmentRelay` (mounted globally in `app/layout.tsx`) is the belt for that, but it
only fires while the fragment still carries `access_token`.

### What was actually done for Ryan

**2026-08-24 — a password reset was sent** rather than another invite. His auth row already
exists, so `inviteUserByEmail` would have refused the address anyway (*"already has an
account"*, see below); recovery is the working door into an account that exists but has never
had a password set. The reset link carries the same single-use, same-prefetch exposure as the
invite, so if this one also comes back as "expired", the cause is transit and not time —
go to the triage above rather than sending a third link.

Two options remain untaken, both named so they are not rediscovered:

- **Set a password with the service role and hand it over out of band**, for him to change on
  first sign-in. Ugly, immediate, no link involved.
- **Move the invite to a typed `{{ .Token }}` code.** A scanner cannot consume six digits the
  recipient types. This is the only structural answer to prefetch — and it is a build, not a
  setting: there is no OTP-entry screen in the app.


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
- **The branded auth templates have not been sent** — rendered and read as files only,
  never through Supabase into a real client.

## Still open

- ~~`NEXT_PUBLIC_SITE_URL` points at localhost~~ — **resolved 2026-08-24.** `.env` now reads
  `https://merkhetdrafting.com`. The Supabase side is **not verified from this repo**: Site
  URL and the Redirect URLs allowlist live in the dashboard, and a mismatch there fails
  silently rather than erroring. Confirm `<site>/accept-invite` and `<site>/reset-password`
  are both listed before blaming a link.
- No re-invite path: an address that already has an auth row fails with "already has an
  account". Recovery is deleting the auth user in the dashboard, or a password reset.
- **Link expiry is invisible from here.** `mailer_otp_exp` is dashboard-only and no check
  script reports it — see [Supabase configuration](#supabase-configuration). Worth a
  read-only `npm run check:auth` alongside `check:email`, which would also print Site URL and
  the redirect allowlist. Needs `SUPABASE_ACCESS_TOKEN` in `.env`; not yet built.
