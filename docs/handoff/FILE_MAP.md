# File map

## App routes

| Path | File |
|---|---|
| Board `/` | `app/(app)/page.tsx` → `components/board/board-view.tsx` |
| Calendar | `app/(app)/calendar/page.tsx` → `components/calendar/calendar-view.tsx` |
| Customers | `app/(app)/customers/page.tsx` → `components/customers/customers-client.tsx` |
| Customer detail | `app/(app)/customers/[id]/page.tsx` → `components/customers/customer-detail-client.tsx` — inline field saves on blur; **Delete customer** behind a No/Yes confirm modal |
| Consultants | `app/(app)/consultants/page.tsx` → `components/consultants/consultants-client.tsx` |
| Consultant detail | `app/(app)/consultants/[id]/page.tsx` → `components/consultants/consultant-detail-client.tsx` |
| Completed projects | `app/(app)/completed/page.tsx` → `components/projects/completed-projects-client.tsx` |
| Staff (admin) | `app/(app)/staff/page.tsx` → `components/settings/settings-client.tsx` (Team) |
| Bill | `app/(app)/bill/page.tsx` → `components/billing/bill-client.tsx` — planned hours by project and person, read-only |
| Settings redirect | `app/(app)/settings/page.tsx` → redirects to `/staff` |
| Login | `app/(auth)/login/page.tsx` |
| Shell layout | `app/(app)/layout.tsx` + `components/shell/nav-rail.tsx` |

## Domain / data

| Concern | File |
|---|---|
| Types, columns, labels | `lib/types.ts` |
| Phase presentation / token classes | `lib/phases.ts` |
| Env (Merkhet-scoped Supabase keys) | `lib/env.ts` |
| Repository (Supabase) | `lib/db/repo.ts` |
| Demo seed source only | `lib/db/demo-store.ts` + `scripts/seed-demo.ts` |
| Supabase clients | `lib/supabase/{client,server,admin}.ts` |
| Server actions | `app/actions/{auth,projects,customers,consultants,settings}.ts` — bodies wrapped in `attempt()`; they return `{ ok, value \| error }` |
| Action result plumbing | `lib/action-result.ts` (`attempt`, `unwrap`), `lib/action-toast.ts` (`report`) — why: React #441 in prod |
| Session | `lib/auth/session.ts` — `requireAdmin` admits `admin` and `developer` via `isAdmin()` |
| Roles | `UserRole`, `ASSIGNABLE_ROLES`, `isAdmin` in `lib/types.ts`; `developer` is hidden by `listUsers` and locked by the `users_protect_developer` trigger |
| Notification call sites | `lib/notifications.ts` — resolves recipients, plans, enqueues. Never throws |
| Email send path + outbox | `lib/email/send.ts` — the only module that talks to a provider |
| Recipient resolution | `resolveAudiences` in `lib/db/repo.ts` |
| Email templates | `lib/email/` (`README.md` there has the routing table) |
| Email copy — every sentence | `lib/email/copy.ts` |
| Email routing (pure, no DB) | `lib/email/plan.ts` |
| Recipient resolution (DB) | `resolveAudiences` in `lib/db/repo.ts` — delegate, customer, **owner**, phase recipients, leadership |
| Phase recipients (per project) | `project_phase_recipients` table → `ProjectPhase.notify_ids`; `setPhaseRecipients` + `saveDelegation` in `lib/db/repo.ts`; UI `components/projects/phase-recipients-picker.tsx` |
| Email fixtures / harnesses | `scripts/email-fixtures.ts`, `preview-emails.ts`, `send-test-email.ts` |
| Outbox retry | `scripts/retry-emails.ts` (`npm run email:retry`) |
| Dates / urgency / `deriveSchedule` / `businessDaysBetween` / `phaseDateError` | `lib/dates.ts` (checks: `npm run check:schedule`) — the chain is a fill helper since 2026-09-02; dates are entered |
| Sheet phase-row date cells | `components/projects/phase-dates.tsx` — saves on blur via `updatePhaseDatesAction` |
| Calendar geometry (zoom, window, bars) | `lib/calendar.ts` (checks: `npm run check:calendar`) |
| Per-staff weekly load (pure) | `lib/workload.ts` (checks: `npm run check:workload`) |
| Project vs customer address/contact (pure) | `lib/contact.ts` (checks: `npm run check:contact`) |
| Change a project's customer | `changeProjectCustomer` in `lib/db/repo.ts` → `changeProjectCustomerAction`; Select in the sheet's Customer section (`PROJECT_CUSTOMER_APPLY.md`) |
| Bill roll-ups (pure) | `lib/billing.ts` (checks: `npm run check:billing`) — reads `planned_hours` off hydrated projects, no table of its own |
| Activity copy | `lib/activity.ts` |
| Approval gates / rework helpers | `lib/types.ts` (`GATE_PARTIES`, `GATE_REJECT_TARGET`, `gateSatisfied`) |
| Gate + rework live check | `scripts/check-gates.ts` (`npm run check:gates` — **writes to hosted DB**) |
| Card creator live check | `scripts/check-creator.ts` (`npm run check:creator` — read-only) |
| Client-mail redirect live check | `scripts/check-email-redirect.ts` (`npm run check:email` — read-only) |
| Phase recipients live check | `scripts/check-recipients.ts` (`npm run check:recipients` — read-only) |
| Workload arithmetic check | `scripts/check-workload.ts` |
| Contact fallback check | `scripts/check-contact.ts` |
| Migrations | `supabase/migrations/*.sql` |

## UI pieces

| Concern | File |
|---|---|
| Tokens / light+dark | `app/globals.css` (`.dark`) |
| Theme provider / toggle | `components/providers/theme-provider.tsx`, `components/shell/theme-toggle.tsx` |
| Project card | `components/projects/project-card.tsx` — avatar is the current-phase assignee, falling back to `projects.created_by` (muted) when no phase is running |
| Detail sheet | `components/projects/project-detail-sheet.tsx` |
| Phase rule (6-seg) | `components/projects/phase-rule.tsx` |
| New project dialog | `components/projects/new-project-dialog.tsx` |
| Project address & contact block | `components/projects/project-contact-fields.tsx` (in the sheet's Details section) |
| Delegation / Plan schedule dialog | `components/projects/delegation-dialog.tsx` |
| Workload column + drill-down (Slice 9) | `components/settings/staff-workload.tsx` — rendered into the Team table |
| Phase "also notify" picker | `components/projects/phase-recipients-picker.tsx` — in the delegation dialog and on each sheet phase row |
| shadcn/Base UI primitives | `components/ui/*` — **Base UI**, not Radix |
| Command palette | `components/command/command-palette.tsx` |
| Motion provider | `components/providers/motion-provider.tsx` |
| Login background paths | `components/kokonutui/background-paths.tsx` |
| Auth gate / redirects | `proxy.ts` — invite/reset routes are reachable signed out |
| Sign-in / invite / reset screens | `app/(auth)/` — `login`, `accept-invite`, `reset-password`, `forgot-password` |
| Emailed-link exchange | `app/auth/confirm/route.ts` |
| Shared set-password form | `components/auth/set-password-form.tsx` (invite **and** reset) |
| Invite + reset actions | `inviteUser` in `lib/db/repo.ts`; `requestPasswordReset` in `app/actions/auth.ts` |
| Invite + reset **email** HTML | `lib/email/templates/auth-link.ts` → `npm run email:supabase` |
| Pushing those into Supabase | `scripts/push-supabase-templates.ts` (`npm run email:supabase:push`) — needs a personal access token |
| ⚠️ Destructive data wipe | `scripts/reset-data.ts` — not in `npm run` on purpose |

## Config

- `next.config.ts` — Cache Components
- `components.json` — shadcn + KokonutUI
- `.env.example` — Supabase (`NEXT_PUBLIC_SUPABASE_MERKET_*`, `SUPABASE_SERVICE_MERKET_ROLE_KEY`, optional `SUPABASE_ACCESS_TOKEN`), site (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`), mail (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_CUSTOMER_ENABLED`), and the four `GMAIL_TEST_*` harness vars
