# File map

## App routes

| Path | File |
|---|---|
| Board `/` | `app/(app)/page.tsx` → `components/board/board-view.tsx` |
| Calendar | `app/(app)/calendar/page.tsx` → `components/calendar/calendar-view.tsx` |
| Customers | `app/(app)/customers/page.tsx` → `components/customers/customers-client.tsx` |
| Customer detail | `app/(app)/customers/[id]/page.tsx` → `components/customers/customer-detail-client.tsx` |
| Settings | `app/(app)/settings/page.tsx` → `components/settings/settings-client.tsx` |
| Login | `app/(auth)/login/page.tsx` |
| Shell layout | `app/(app)/layout.tsx` + `components/shell/nav-rail.tsx` |

## Domain / data

| Concern | File |
|---|---|
| Types, columns, labels | `lib/types.ts` |
| Phase presentation / token classes | `lib/phases.ts` |
| Demo seed + phase move | `lib/db/demo-store.ts` |
| Repository (all persistence today) | `lib/db/repo.ts` |
| Server actions | `app/actions/{auth,projects,customers,settings}.ts` |
| Session / demo password | `lib/auth/session.ts`, `lib/auth/constants.ts` |
| Dates / urgency | `lib/dates.ts` |
| Activity copy | `lib/activity.ts` |
| SQL schema | `supabase/migrations/20260807100000_init.sql` |
| Seed SQL (reference) | `supabase/seed.sql` |

## UI pieces

| Concern | File |
|---|---|
| Tokens / utilities | `app/globals.css` |
| Project card | `components/projects/project-card.tsx` |
| Detail sheet | `components/projects/project-detail-sheet.tsx` |
| Phase rule (5-seg) | `components/projects/phase-rule.tsx` |
| New project dialog | `components/projects/new-project-dialog.tsx` |
| Phase subscribers popover | `components/board/subscriber-popover.tsx` |
| Command palette | `components/command/command-palette.tsx` |
| Motion provider | `components/providers/motion-provider.tsx` |
| Login background paths | `components/kokonutui/background-paths.tsx` |
| Auth gate / redirects | `proxy.ts` |

## Config

- `next.config.ts` — Cache Components
- `components.json` — shadcn + KokonutUI
- `.env.example` — Supabase env placeholders
