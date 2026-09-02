# Decisions & authority

## Authority order

1. **`docs/handoff/WORKFLOW-2.md`** wins on phase sequence, board columns, transition
   rules, gates, approvals, delegation, and notification routing.
2. **`docs/PRD.md`** wins on everything else (screens, auth, activity, on-hold, components).
3. **Lovable showcase** is the visual reference only.
4. Early Datum mockup was inspirational only.

## Board model (post–Slice 1B)

- **8 live columns:** Pending, Active, SD, DD, Review, CD, Final Review, Permitting
- **Backlog dropped**; creation → Pending
- **Complete is archive** (`archived_at` + `status=completed`), off-board
- **Active holding:** `status=active` and `current_phase=null`
- Phase order: SD → DD → Review → CD → Final Review → Permitting
- On-hold remains a flag on any column
- **Task = phase** — no `tasks` table

## Data / backend

- Hosted Supabase (Slice 1A). Reads/writes via `lib/db/repo.ts` + Supabase clients.
- `lib/db/demo-store.ts` remains only as the seed source for `npm run seed`.
- Env: `NEXT_PUBLIC_SUPABASE_MERKET_URL`, `NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY`,
  `SUPABASE_SERVICE_MERKET_ROLE_KEY` (see `lib/env.ts`; legacy names still fall back).

## Stack (from PRD)

- Next.js App Router + **Cache Components** (`cacheComponents: true`)
- Read Next docs under `node_modules/next/dist/docs/` before assuming old APIs (see `AGENTS.md`)
- Auth layouts that read cookies: `export const instant = false`
- Proxy (not middleware): `proxy.ts`
- Tailwind v4, shadcn + KokonutUI registry
- Motion (`LazyMotion`, `reducedMotion="user"`), dnd-kit, Lucide
- Design: Archivo + JetBrains Mono; paper/ink; teal phase ramp `--phase-1`…`--phase-6`; redline `#C8382A`; sharp corners
- **Theme:** `next-themes`; default **dark**; toggle in nav footer; `.dark` tokens in `globals.css`

## UI conventions (post-Lovable pass)

- `.label-caps`, `.page-title` utilities in `app/globals.css`
- Nav: 208px → 56px collapsed; teal “M”; active = white + 2px inset left `--phase-5`
- Nav items: Board, Calendar, Customers, Consultants, Completed projects, Staff (admin)
- **Staff (`/staff`)** is the Team table (the Phase subscribers tab was removed 2026-09-01 — see *Phase recipients* below). Slice 9's workload is a **This week** column on the Team table (built 2026-08-21), expanding per person on click — a column on the roster rather than a surface of its own, so it inherits the admin gate for free and asks its question where the person is already named
- Board columns ~264px; phase columns get 2px top accent in phase color
- Calendar: week columns with `border-r` grid lines per row; bars overlaid; today = `--redline`
- Customer detail (the one scrolling page, rather than a flex-fill view): sections sit at a common `5` inset and close with `mb-8` so the last row doesn't run into the bottom of the scroll area. The Projects list is a **bordered** box, so it uses `mx-5`, not `px-5` — padding would move the content inward and leave the border flush to the edge
- Detail sheet `--container-xl` (36rem / 576px); status badge + Put on hold; CUSTOMER “FULL RECORD” in phase-5 teal
  - Set as `data-[side=right]:sm:max-w-xl`. **The variant prefix must match** `components/ui/sheet.tsx`'s own `data-[side=right]:sm:max-w-sm` — tailwind-merge keys on the full prefix, so a plain `sm:max-w-*` override does **not** replace it. Both classes survive and the more specific base rule wins. That is how the sheet rendered at 384px for months while the source said `sm:max-w-[520px]`. Same trap applies to any `SheetContent` override.

## Board drag-and-drop

**Collision detection is custom — do not revert it to a single dnd-kit strategy.**

`closestCorners` ranks droppables by corner-to-corner distance. An empty column's only droppable is its full-height container, so its corners sit at the very top and bottom; a pointer aimed at the middle is far from both, and a neighbouring column's *card* — a small rect with corners right there — wins instead. A populated column has cards scattered down it, which is why dropping got easy the moment one card landed. Reproduced directly against dnd-kit with real column geometry:

```
aiming at middle of EMPTY column B:
  closestCorners -> cardA1   (a card in the WRONG column)
  pointerWithin  -> colB     (correct)
```

`boardCollisionDetection` therefore tries, in order:

1. `pointerWithin` — any point inside a column is a valid target, so column height stops mattering
2. `rectIntersection` — **required**: `pointerWithin` returns nothing when there is no pointer, i.e. keyboard dragging
3. `closestCorners` — last resort

**Collapsed columns must keep `ref={setNodeRef}`.** Without it they are not drop targets at all.

Dropping onto a card resolves to that card's column in `onDragEnd`, so `pointerWithin` returning both the card and its column is harmless.

## Calendar bar labels

Bar text is contrast-switched, not one colour. The phase ramp spans `#d7e4e2` → `#1b5450`, so no single text colour clears WCAG AA across it (§12.6 calls this out for the two darkest segments specifically). Computed, not estimated:

| Segment | ink | paper | uses |
|---|---|---|---|
| phase-1 | 13.63 | 1.26 | ink |
| phase-2 | 9.77 | 1.76 | ink |
| phase-3 | 6.21 | 2.77 | ink |
| phase-4 | **3.59** | 4.79 | paper |
| phase-5 | **2.06** | 8.34 | paper |

Two consequences worth preserving:

- **The fill is its own layer.** A completed phase dims to `opacity: 0.4`; if that opacity sat on the element it would drag the label down with it. Dimming only the fill keeps the label at full strength — and a dimmed fill reads as a pale tint, so completed segments use ink regardless of phase.
- **Labels are width-fitted** (`fitLabel`): full label → AIA shorthand (`SD`/`DD`/`CD`/`REV`/`PERM`) → nothing. Bar widths are already known in px, so this is arithmetic, not DOM measurement. Row labels in the sticky left column repeat the status, because narrow bars and the undated grey bar can't hold text at any zoom.

## SSR determinism (hydration)

Cache Components prerenders these routes, so anything non-deterministic between Node and the browser surfaces as a hydration mismatch. Three were fixed on Aug 10; the patterns generalise:

| Cause | Fix |
|---|---|
| `Math.sin`/`Math.cos` in SVG path `d` — ECMAScript does **not** require them to be correctly rounded, so Node and the browser engine differ in the last few ulp | Quantise coordinates (`toFixed(2)`) before they reach the attribute |
| `Math.random()` for React keys | Deterministic ids (`primary-0`, …) |
| dnd-kit derives a11y ids from a module-level counter that drifts across server/client (`DndDescribedBy-0` vs `-1`) | Pass an explicit `id` to `DndContext` |

**Where to look:** hydration errors are reported by the *browser*, so `curl` will never reproduce one. They land in `.next/dev/logs/next-development.log` (`"source":"Browser"`) and the dev overlay.

## shadcn here is Base UI, not Radix

`components.json` uses style `base-nova`, so `components/ui/*` wrap **`@base-ui/react`**. APIs differ from the Radix-based shadcn most examples assume.

**The one that has already bitten us — `<SelectValue />`:**

Radix clones the selected `<SelectItem>`'s children into the trigger. Base UI does not — `SelectValue` calls `resolveSelectedLabel(value, items, …)` and **renders the raw value** when the Root has no `items` map. Result: triggers showed `cust-0001-…` / `user-0002-…` / `admin` while the open dropdown showed correct names.

Fix is on the **Root**, not the Value:

```tsx
<Select items={users.map((u) => ({ label: u.name, value: u.id }))} value={id}>
```

`items` also accepts a plain record: `items={{ admin: "Admin", staff: "Staff" }}`.

Rule: **any `<Select>` whose value differs from its label needs `items` on the Root.** All four current call sites (new-project dialog, board assignee filter, detail-sheet assignee, settings role) now pass it.

## Deliberate exceptions to PRD §12

### Login background paths (Aug 10, 2026)

`components/kokonutui/background-paths.tsx` — the KokonutUI **Background Paths** component, on `/login` only.

This is knowingly against two PRD rules, approved by the user:

- **§12.5** — "Skip: every Backgrounds component (animated gradients on a data-dense tool are noise)"
- **§12.2 rule 5** — "No ambient animation... anything that moves without being asked becomes an irritant by week two"

**Why it's allowed here:** both rules are aimed at screens staff sit in front of for eight hours. The login screen is seen for ~4 seconds, once a session, and carries no data. It is the only screen in the product where this holds — **do not extend this to any authenticated route.**

**Constraints it still respects:**

- Palette is the §12.1 phase ramp (`--phase-5` → `--phase-3` → `--phase-1`), not the registry's purple/pink/blue. No ad-hoc hex — §12.6 holds.
- Hairline stroke weights (~0.5–1.5px effective), not the registry's 4–7px rounded strokes.
- `useReducedMotion` **removes** the float loop entirely rather than softening it (§12.2 rule 4).
- `aria-hidden`, no `<title>` — decorative, not announced.

**Porting notes for anyone pulling other KokonutUI components:**

- Root `MotionProvider` uses `<LazyMotion strict>`, so `motion.*` **throws at render**. Always rewrite to `m.*`.
- CSS vars don't resolve in SVG presentation attributes — use `style={{ stopColor: "var(--phase-3)" }}`, not `stopColor="var(...)"`.
- The registry source had two upstream bugs, fixed in our copy: per-path `opacity` was set inline *and* animated to `1` (flattening the layered depth), and path ids came from `Math.random()` on every render.
- **Never animate `transform`/`y` on an SVG child.** See below.

**Cost:** 32 SVG paths, drawn once. Acceptable for an unauthenticated 4-second screen; revisit if the login route ever gains real work.

#### Full-page flash at wide viewports — fixed Aug 11, 2026

The login card and background visibly flashed on Chrome at full-window width, but not at half width.

Not a remount — a full-document repaint. The float loop animated `y` on all 32 `m.path` elements; motion renders that as a CSS `transform` on each path (`motion-dom` `buildSVGAttrs`), and **Blink cannot promote SVG children to their own compositor layers**. Every frame invalidated the whole SVG raster on the main thread. The `viewBox` is 3:1 under `preserveAspectRatio="slice"`, so on any normal window the scale is height-driven and *identical* at both widths — full-width simply paints ~2x the pixels, enough to miss the frame budget. Chrome then drops the tiles, taking the login card with it (`relative z-10` is a stacking context, not a layer).

Fix: each depth is now its own absolutely-positioned `m.div` wrapping a **static** SVG. Divs are HTML, so `y`/`opacity` run on the compositor and each SVG rasters exactly once.

Rules this leaves behind:

- The float belongs on the wrapping div. Moving it back onto the paths reintroduces the flash.
- Per-path `opacity` is a plain attribute; the *layer* fades in. Product of layer x path opacity is unchanged, so layered depth is preserved — do not re-animate per-path opacity.
- `FLOAT_DISTANCE` is now **CSS pixels**, not SVG user units (the `slice` scale shrank those ~0.55x). Values were pre-scaled to keep the same on-screen travel.
- Three SVGs means three gradient ids — `merkhet-path-ramp-${kind}`. Duplicate ids would cross-wire the `url(#…)` strokes.
- Layers are `-inset-6` so the float never exposes a bare strip at the clipped edge.

## Phase dates are entered, not derived (Sep 2, 2026) — supersedes the chain below and WORKFLOW-2 §3

**Each phase has its own start and end, typed in.** The firm's phases are not back to back:
the person holding Schematic design is on other work between it and Design development, so
a project starting 9/10 must be able to carry SD on 9/20–9/26. The chain (`deriveSchedule`)
survives as the **Fill back to back** button and as the rejection reflow; it is no longer the
write path.

- **`duration_days` stays, derived.** It is the working-day count of the span
  (`businessDaysBetween`), written on every save, so the `move_project` gate,
  `isDelegationComplete` and `weeklyRate` did not change. Typing a number into Days moves
  the end date; moving a date recounts Days.
- **Half-dated is refused, undated is fine.** Every consumer treats one date as none, so the
  form and `phaseDateError` reject a lone date rather than let the other vanish. Two check
  constraints (`20260902110000_phase_dates.sql`) say the same in SQL.
- **Review is still not typed in.** It is the milestone on the end of Design development
  and follows DD on every save and every sheet edit. A Review already reached keeps its date.
- **Rejection does not re-date by default.** The reject dialog offers *Re-plan the remaining
  dates from today*, off. `check:gates` exercises the on path.
- **Worked phases are editable.** Locking was a property of the chain; with explicit dates,
  moving an in-progress end date is an ordinary correction. The fill still skips them.

## Scheduling and hours (Slice 4 / Slice 11, Aug 14, 2026)

> **Dates: superseded 2026-09-02** — see the section above. Durations remain working days
> and remain the unit the SQL gate reads.


Settled in `SLICE_4_SCOPE.md`. Reversing any of these is a product decision, not a
refactor — check before changing.

**Planned hours are optional. Assignee and duration are not.** Duration is structural: no
duration, no derived dates, no calendar row. Hours are a budget annotation that degrades
gracefully — absent, the calendar still draws and the total reads "No hours planned". Forcing
a number nobody has produces a guess that reads as authoritative later. Null is more truthful.

**Never default hours from `duration_days`.** A phase can span three weeks at four hours a
week. Conflating effort with elapsed time re-creates the exact gap WORKFLOW-2 §8 flagged and
the client asked to close.

**"No hours planned" ≠ "0 h planned".** Both the detail sheet and the delegation dialog
distinguish them. Do not collapse to `?? 0`.

**Durations are working days**, uniform across phases, inclusive: a 1-day phase starts and
ends the same day; 10 days from Monday ends the Friday of the following week. No phase starts
or ends on a weekend. Permitting's "2–4 weeks" is entered as 10–20 working days rather than
introducing a per-phase unit.

**Review is a zero-duration milestone**, dated to the preceding phase's end. It consumes no
schedule time, so CD picks up after DD, not after Review.

**Delegation completeness is derived, never stored** — all five delegated phases have both an
assignee and a duration. No `delegated_at` column. This is why a partial write fails closed:
the gate reads the rows, so it cannot disagree with them.

**Re-planning only re-dates unworked phases.** Worked phases keep their dates. "Plan schedule"
locks anything not `not_started`; rejection locks `completed` and `skipped` but deliberately
*not* the phase being returned to — see the Slice 5 section below.

**Phase dates are read-only in the UI.** Durations are the source (WORKFLOW-2 §3).
`updatePhaseDates` still exists in the repo and actions layer but is off the UI path.

## Gate sign-off parties (Aug 21, 2026) — supersedes WORKFLOW-2 §3

Full write-up in [`GATE_PARTIES_APPLY.md`](./GATE_PARTIES_APPLY.md).

**Both gates take Austin, Ryan, and a chosen third.** User decision. Review was client
contact + Austin + client; Final review was client contact + Austin. They are now identical,
and WORKFLOW-2's deliberate distinction — "the client is **not** an approver at Final
review" — is gone on purpose. The firm wanted one rule.

**The client did not lose their sign-off, it became discretionary.** Previously mandatory at
Review and forbidden at Final review; now available at both and required at neither, as one
of the things the chosen slot resolves to. Making it mandatory again means editing
`GATE_PARTIES` *and* the two `unnest(array[…])` lists in `move_project` — the rule lives in
both places by design, so the UI cannot talk the database past it.

**`approver_user_id` names the chosen third; null there means the client.** Not "unset" —
approval rows exist only once approved, so a `chosen` row always records a decision. A check
constraint keeps the column off the fixed parties, whose identity *is* the party.

**One party value for the slot, not two.** Modelling the client as `party = 'client'` and a
colleague as `party = 'chosen'` would let `unique (project_id, phase, party)` hold both at
once and half-satisfy the gate twice over. One value keeps the check a plain existence test
and clearing a single delete.

**The third is picked at record time, not at delegation.** Who reviews a set of drawings is
not knowable when the project is planned. That is why it is a dropdown and not a column on
`projects`.

**`client_contact` and `client` stay in the enum.** Historical rows and the activity log
reference them by name. No gate requires either any more.

## Approval gates and rework (Slice 5, Aug 14, 2026)

Full write-up in [`SLICE_5_APPLY.md`](./SLICE_5_APPLY.md). The non-negotiables:

**Approval rows exist only when approved.** Absence *is* pending; clearing a sign-off is a
`DELETE`. Nothing seeds pending rows, and `ProjectWithRelations.approvals` only ever holds
approved ones. The `status` column survives from 1B but is always `'approved'` in practice.

**The client signs off but never logs in.** Staff record the client's approval on their behalf
(WORKFLOW-2 §3), and the UI says so. `recorded_by` is therefore the staff member, not the
approver — do not read it as "who approved".

**Gate crossing is `from <= gate < to`.** That deliberately blocks *skipping* a gate
(DD → CD, CD → Permitting, Active → CD) as well as leaving one. Enforced in `move_project`, so
board drag and ⌘K inherit it. Backward moves are never gated.

**Rejection is its own SQL function, not `move_project`.** `move_project` marks the phase being
left as `completed`, which is exactly wrong for a rejection — a rejected gate returns to
`not_started` because it will be entered again.

**`reject_gate` is atomic in SQL; dates are recomputed in TypeScript afterwards**, because
`deriveSchedule` lives there. A failure in the date step leaves the project correctly rejected
with stale dates, which "Re-plan schedule" fixes. Do not move the date math into SQL to close
that window — duplicating the derivation is the worse trade.

**On rejection, only `completed` and `skipped` phases are locked.** The phase being returned to
is `in_progress` precisely because it is being reworked, so it must re-date from today. A
skipped phase is locked because it will never be worked; re-dating it would hand it a fresh
future window *and* push the rework out behind it.

**`anchor` in `deriveSchedule` is a floor, not a fallback.** A computed start earlier than the
anchor is pulled forward to it, so rework is never scheduled into the past. This applies to the
zero-width Review milestone too.

## Headless-checkable arithmetic (Aug 14, 2026)

`lib/dates.ts` (`deriveSchedule`), `lib/calendar.ts` (calendar geometry), `lib/workload.ts`
(week bounds + weekly load) and `lib/contact.ts` (the project/customer contact fallback) are
kept free of React so they can be checked without a browser: `npm run check`. The calendar view imports its
geometry rather than computing inline, which is the reason that split exists — keep it.

`npm run check:gates` is the counterpart for the workflow rules that live in SQL, where there
is nothing pure to extract: it drives one throwaway project through every gate and the rework
loop against **hosted Supabase**, then deletes it. Kept out of `npm run check` because it
writes to production.

The checks cover arithmetic and database behaviour. **Nothing in this repo verifies
rendering.**

## Email routing (Aug 18, 2026)

**`customerVisible` in `lib/phases.ts` is the routing switch for client mail** — not a second
list, and not the WORKFLOW-2 §4 table. Client mail fires on SD, DD, CD, Permitting and
completion; both approval gates are silent because that flag is already false on them.

This is a **deliberate widening** of WORKFLOW-2 §4, which scoped client mail to DD/CD/Permitting
and deferred it entirely. The client asked for it now and for every stage they can see.
Narrowing back is an edit to `lib/phases.ts`, not to any template.

Three rules the code enforces rather than documents. Do not "fix" any of them:

- **No client copy exists for the gates.** `CUSTOMER_COPY` has no `review` / `final_review`
  key, so there is no string to send by accident; `assertCustomerVisible` throws if a caller
  tries. The absence *is* the safeguard.
- **Rejection is internal, permanently.** There is no customer variant of `gate-rejected` and
  none should be added — a client reads "rejected" as failure where the firm means an ordinary
  correction.
- **Client mail links nowhere.** Clients have no login (WORKFLOW-2 §1), so any link dead-ends
  at `/login`. The reply address is the only CTA, and the **firm** signs it, not the phase
  delegate (the client-contact signature went with `client_contact_id`, 2026-09-01).

**`EmailProject` is a narrow whitelist, not `ProjectWithRelations`.** Budgets and internal
notes are unreachable from a template on purpose. Do not widen it to "make it easier".

**`lib/email/` renders and nothing else.** No transport lives there — the Gmail harness is in
`scripts/send-test-email.ts` so the library cannot quietly become the send path.

**Copy lives in `lib/email/copy.ts`, all of it.** Templates hold no sentences. That is what
lets the client copy conversation happen without a code change.

## Phase recipients, per project (Sep 1, 2026) — supersedes WORKFLOW-2 §4 and PRD §6.2 on subscribers

**Who is copied when a phase starts is chosen per project, where the phase is delegated.**
`phase_subscribers` (firm-wide, one list per phase, zero rows in production) was dropped for
`project_phase_recipients (project_id, phase, user_id)`, edited in Plan schedule and on the
sheet's phase rows. The board column popover and the Staff tab are gone with it.

Settled at the same time, and not to be re-opened by accident:

- **Pending and Active take no per-project list.** No phase row, nothing to hang it on.
  Active still copies leadership; Pending still reaches nobody.
- **Leadership (active admins) stays auto-copied** on Active, Permitting, both gates and
  completion. Unchanged from Slice 6.
- **`projects.client_contact_id` is gone**, not built. It was named on Review, Final review
  and Marked complete and never written. Client mail is signed by the firm.
- **The assignee is always notified and is hidden from the picker.** The list is *in
  addition to* the delegate, never a substitute.
- **Inline, not a popover.** The picker expands in place because it also renders inside the
  modal delegation dialog, where a portalled popup is the interaction most likely to misbehave
  unverified. Nobody has clicked it yet (`PHASE_RECIPIENTS_APPLY.md`).

## Developer role (Sep 1, 2026)

**One account is admin-with-no-presence.** `developer` passes every admin gate through
`isAdmin()` and is excluded from `listUsers`, which is the only roster the UI draws from —
so the board, calendar, `/staff`, and every delegate and notify list never show it. It is not
leadership for mail. A `before update or delete` trigger on `users` refuses to delete,
deactivate or demote it, and the app's actions refuse first with a sentence.

- **Assigned by migration only.** `ASSIGNABLE_ROLES` is `admin | staff`; the invite and role
  actions reject `developer` as an input. Do not add it to the role select.
- **Role checks go through `isAdmin(user)`**, never `role === "admin"`. The three that existed
  were converted; a new literal comparison silently locks the developer out.
- **Invisibility has a cost that is accepted:** the developer's own actions render as
  "Someone" in activity, and a project they file shows `—` on its card. `DEVELOPER_ROLE_APPLY.md`.

## Bill reads planned hours; it does not keep a timesheet (Sep 1, 2026)

**The hours the firm bills from are the ones already on the project** —
`project_phases.planned_hours`, per assignee. The Bill page regroups them by project and
person and exports CSV. It has no table, no form and no write path. A first cut with a
`time_entries` timesheet was built and removed the same day: the ask was easier *access* to
the hours on a project, not another place to enter them. Do not reintroduce a log.

- **Read-only, one editor.** Hours change in Plan schedule or on the sheet's phase row. A
  second editor for the same column is a second place for it to be wrong.
- **"Not planned" is never `0h`** here either (rule below). Totals count only budgeted phases,
  carry an `unplanned` count, and the headline reads **At least** when any is missing. The CSV
  exports an empty cell, not `0`.
- **Arithmetic is headless** (`lib/billing.ts`, `check:billing`). Sums round once to one
  decimal; ties sort by id so nothing reorders between renders.

## What planned hours are for (Slice 9, Aug 21, 2026)

**Answered: capacity planning.** `NEXT.md` carried this as an open question for months, with
three candidate answers — fee validation, retrospective benchmarking, capacity planning. It is
the third. Hours ÷ duration = the weekly load a phase puts on the person holding it.

The two rejected readings still matter, because they bound what the number is *not*:

- **Not fee validation.** A rough guess up front would have been enough for that, and would
  not have justified per-phase granularity.
- **Not retrospective benchmarking.** That needs *logged* hours against the planned ones, and
  logged time is Phase 2 and explicitly not built (`CHANGES-2.md`, "Do not build"). Planned
  hours are never compared to actuals because there are no actuals.

**The unit is hours per week per person.** `planned_hours / (duration_days / 5)` — five
working days to the week, because durations are working days (`SLICE_4_SCOPE.md` decision 2).
Both halves of that division come from delegation, which is why Slice 9 needed no migration
and no schema change.

**The week is Monday–Sunday**, matching the calendar's window origin (`lib/calendar.ts` pins
`weekStartsOn: 1`), so "this week" means the same span in both views.

### Honesty rules the workload view enforces

The view exists to be *trusted*, and its inputs are thin — delegation is backfilled on ~22% of
phase rows and 29% are dated (`SLICE_11_APPLY.md`), and hours are optional by design. So:

- **A missing budget is never `0h`.** It reads "Not planned". This is the same rule the detail
  sheet and the delegation dialog already follow — do not collapse it to `?? 0` here either.
- **A person with no derivable hours has `null`, not `0`.** And the column distinguishes
  *three* absences, because they mean opposite things to someone reading for capacity:

  | Cell | Means |
  |---|---|
  | `—` | nothing in progress at all |
  | "Nothing this week" | every phase is dated outside this week — they are genuinely clear |
  | "No hours planned" | phases are in progress and we cannot say how much |

  Collapsing any of those into `0 h/wk` reads as free capacity in all three.
- **Every gap is counted next to the total it is missing from** — per person and for the
  section. A total that cannot be complete has to say so, or it gets read as capacity.
- **"Not this week" is not a gap.** A dated phase that falls outside the week is knowledge,
  not absence, and is excluded from the total without being counted against it. Only missing
  hours and missing dates are gaps.
- **Undated work still shows its rate** where one is derivable, but never counts — without
  dates there is no way to know the week it lands in.

**Still do not make `planned_hours` required, and still do not default it from
`duration_days`.** Capacity planning being the answer is an argument for *filling the number
in*, not for fabricating it. See "Scheduling and hours" above — the reasoning is unchanged.

**It is a column on the roster, not a surface of its own.** Built first as a third tab and
reshaped the same day: "how loaded is this person" is a fact *about a staff member*, so it
belongs on the Team row that already names them rather than on a parallel roster beside it.
The projects behind the number expand under the row on click. Practical consequences — Role
and Active stay inline-editable, the expand affordance lives on the name cell rather than the
whole row (a row-level click target would nest the Select and Checkbox inside a button), and
`/staff` still has exactly two tabs.

**In-progress only.** The view lists `project_phases` rows with `status = 'in_progress'`, not
everything assigned. "What is this person working on" is a present-tense question; the
calendar is where the future lives. On-hold projects stay in the list and in the total, marked
"Paused" — the work is still assigned to them, and hiding it would understate the commitment.

**Archived work is not current work**, whatever a stale phase row says. `listInProgressAssignments`
drops completed and archived projects.

**`lib/workload.ts` is React-free** for the same reason `lib/dates.ts` and `lib/calendar.ts`
are — see "Headless-checkable arithmetic". The week bounds, the rate and the grouping are all
covered by `npm run check:workload`.

## Project address and contact (Aug 21, 2026)

Full write-up in [`PROJECT_CONTACT_APPLY.md`](./PROJECT_CONTACT_APPLY.md). The
non-negotiables:

**Null means "same as the customer", per field.** The four `projects.project_*` columns each
fall back to the matching `customers` column on their own. There is no
`uses_customer_contact` boolean and adding one would be a regression: a stored flag can
disagree with the rows it describes, and it would have to be all-or-nothing when the real
world is not — a project routinely has its own address and site manager while the email still
goes to the customer. Derived, the same call `SLICE_4_SCOPE.md` decision 4 makes for
delegation completeness.

**Clearing all four *is* the "same as customer" write.** One state, one representation. That
is why re-ticking the box is a delete, and why it asks first.

**A blank string is an empty form field, not an override.** `lib/contact.ts` trims and treats
empty as absent, so tabbing through the form does not pin a project to nothing.

**`projects.client_contact_id` is not this.** It is the *internal* staff member who owns the
relationship (WORKFLOW-2 §3) and is still unsurfaced. "Client contact" is a colleague;
"project contact" is someone to phone about a building. Do not merge them, and do not reuse
one label for both.

**`customers.address` was missing, not new.** WORKFLOW-2 §3 has listed it among the client
fields since the start. Same for the project address among the project fields.

**This is not Slice 3.** Intake expansion stays on hold pending the client's field list. Two
of its eventual fields now exist, which is a head start, not the slice.

## Board card avatar (Aug 22, 2026)

**The circle is the current-phase assignee, falling back to the creator.** PRD §6.2 specified
only the assignee, and that was reported as a bug from production: five colleagues had filed
projects and every card read `—`.

It was not a data bug. `createProject` forces `current_phase = null` for anything not already
active, and `boardColumnOf` puts `status = 'active'` with no phase in the **Active** holding
column. Neither has a phase row to carry an assignee, so *by construction* the whole Pending
column and the whole Active column were anonymous until somebody ran Plan schedule. With one
person filing projects that reads as "not planned yet"; with six it reads as "nobody owns
this".

**The creator went on `projects`, not derived from the activity log.** The creator already
existed as an `activity_log` row with `event_type = 'project.created'`. That is an
append-only audit stream — not indexed for this, a second query and a scan per board render,
and nothing guarantees exactly one such row per project. A fact about the project belongs on
the project. `20260822100000_project_created_by.sql` adds it and backfills from the earliest
create event per project.

**Assignee always wins, and the two never share a style.** Assignee is solid `bg-phase-5`;
creator is outlined `border-rule-strong`. A creator is not the person the work is sitting
with, and a card that let those read as the same fact would be worse than the `—` it
replaced.

**`on delete set null`, matching `project_phases.assignee_id`.** Deleting a person must not
delete their projects. A null creator renders `—`, exactly as before.

Verified live by `npm run check:creator` (read-only). Known gap, recorded there and not yet
fixed: the board builds `usersById` from `listUsers()`, which defaults to active staff only,
so a **deactivated** assignee or creator still renders `—`. The fix separates "directory for
name lookups" from "people you can assign" — it is not flipping the flag, because the same
`users` prop feeds the assignee filter and the sheet's assignee selects.

## Destructive actions (Aug 22, 2026)

Confirmation is graded by what is actually at stake, not applied uniformly:

| Action | Guard |
|---|---|
| Mark project complete | No/Yes modal — reversible, it is an archive |
| Delete customer | No/Yes modal, plus a server-side refusal if they have projects |
| Delete project | Type `DELETE` (capitals; was the project number until 2026-09-02) — takes phases, sign-offs, activity and contract with it |
| Delete staff user | Trash icon → confirm dialog (`ACCOUNTS_APPLY.md`) |

**Type-to-confirm is reserved for deletes that destroy history.** A project carries its
phases, schedule, sign-offs, activity log and uploaded contract; a customer with no projects
carries a name and a phone number. Making both equally awkward would train people to type
through the one that matters.

**A dialog that knows the action will fail says so instead of asking.** `deleteCustomer`
refuses when the customer has projects. The detail page already has those projects in scope,
so the modal names the count, says to delete or reassign them first, and disables **Yes** —
rather than accepting the click and returning an error toast.

## Locale

- US / America/Chicago (showcase UK-ish copy was filler; seed is Chicago-flavored)
