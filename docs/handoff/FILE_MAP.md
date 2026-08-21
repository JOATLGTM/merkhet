# File map

## App routes

| Path | File |
|---|---|
| Board `/` | `app/(app)/page.tsx` → `components/board/board-view.tsx` |
| Calendar | `app/(app)/calendar/page.tsx` → `components/calendar/calendar-view.tsx` |
| Customers | `app/(app)/customers/page.tsx` → `components/customers/customers-client.tsx` |
| Customer detail | `app/(app)/customers/[id]/page.tsx` → `components/customers/customer-detail-client.tsx` |
| Consultants | `app/(app)/consultants/page.tsx` → `components/consultants/consultants-client.tsx` |
| Consultant detail | `app/(app)/consultants/[id]/page.tsx` → `components/consultants/consultant-detail-client.tsx` |
| Completed projects | `app/(app)/completed/page.tsx` → `components/projects/completed-projects-client.tsx` |
| Staff (admin) | `app/(app)/staff/page.tsx` → `components/settings/settings-client.tsx` (Team + Phase subscribers) |
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
| Server actions | `app/actions/{auth,projects,customers,consultants,settings}.ts` |
| Session | `lib/auth/session.ts` |
| Notification stubs | `lib/notifications.ts` — **still stubs**, nothing renders a template yet |
| Email templates | `lib/email/` (`README.md` there has the routing table) |
| Email copy — every sentence | `lib/email/copy.ts` |
| Email routing (pure, no DB) | `lib/email/plan.ts` |
| Email fixtures / harnesses | `scripts/email-fixtures.ts`, `preview-emails.ts`, `send-test-email.ts` |
| Dates / urgency / `deriveSchedule` | `lib/dates.ts` (checks: `npm run check:schedule`) |
| Calendar geometry (zoom, window, bars) | `lib/calendar.ts` (checks: `npm run check:calendar`) |
| Per-staff weekly load (pure) | `lib/workload.ts` (checks: `npm run check:workload`) |
| Project vs customer address/contact (pure) | `lib/contact.ts` (checks: `npm run check:contact`) |
| Activity copy | `lib/activity.ts` |
| Approval gates / rework helpers | `lib/types.ts` (`GATE_PARTIES`, `GATE_REJECT_TARGET`, `gateSatisfied`) |
| Gate + rework live check | `scripts/check-gates.ts` (`npm run check:gates` — **writes to hosted DB**) |
| Workload arithmetic check | `scripts/check-workload.ts` |
| Contact fallback check | `scripts/check-contact.ts` |
| Migrations | `supabase/migrations/*.sql` |

## UI pieces

| Concern | File |
|---|---|
| Tokens / light+dark | `app/globals.css` (`.dark`) |
| Theme provider / toggle | `components/providers/theme-provider.tsx`, `components/shell/theme-toggle.tsx` |
| Project card | `components/projects/project-card.tsx` |
| Detail sheet | `components/projects/project-detail-sheet.tsx` |
| Phase rule (6-seg) | `components/projects/phase-rule.tsx` |
| New project dialog | `components/projects/new-project-dialog.tsx` |
| Project address & contact block | `components/projects/project-contact-fields.tsx` (in the sheet's Details section) |
| Delegation / Plan schedule dialog | `components/projects/delegation-dialog.tsx` |
| Workload column + drill-down (Slice 9) | `components/settings/staff-workload.tsx` — rendered into the Team table |
| Phase subscribers popover | `components/board/subscriber-popover.tsx` |
| shadcn/Base UI primitives | `components/ui/*` — **Base UI**, not Radix |
| Command palette | `components/command/command-palette.tsx` |
| Motion provider | `components/providers/motion-provider.tsx` |
| Login background paths | `components/kokonutui/background-paths.tsx` |
| Auth gate / redirects | `proxy.ts` |

## Config

- `next.config.ts` — Cache Components
- `components.json` — shadcn + KokonutUI
- `.env.example` — `NEXT_PUBLIC_SUPABASE_MERKET_*`, `SUPABASE_SERVICE_MERKET_ROLE_KEY`
