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
- **Staff (`/staff`) ≠ Slice 9** — `/staff` is admin Team + Phase subscribers; Slice 9 would be a per-person workload view (confirm need before building)
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

## Scheduling and hours (Slice 4 / Slice 11, Aug 14, 2026)

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

`lib/dates.ts` (`deriveSchedule`) and `lib/calendar.ts` (calendar geometry) are kept free of
React so they can be checked without a browser: `npm run check`. The calendar view imports its
geometry rather than computing inline, which is the reason that split exists — keep it.

`npm run check:gates` is the counterpart for the workflow rules that live in SQL, where there
is nothing pure to extract: it drives one throwaway project through every gate and the rework
loop against **hosted Supabase**, then deletes it. Kept out of `npm run check` because it
writes to production.

The checks cover arithmetic and database behaviour. **Nothing in this repo verifies
rendering.**

## Locale

- US / America/Chicago (showcase UK-ish copy was filler; seed is Chicago-flavored)
