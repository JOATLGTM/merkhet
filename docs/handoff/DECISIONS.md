# Decisions & authority

## Authority order

1. **`docs/PRD.md` wins** on product behavior, data model, columns, phases, RLS intent.
2. **Lovable showcase** is the current **visual** target (layout, density, tokens usage).
3. Early Datum mockup (`Merkat.dc.html`) was only inspirational — do **not** override the PRD with it.

User correction (explicit): *“Follow the PRD. The mockup is just a design.”*

## Stack (from PRD)

- Next.js App Router + **Cache Components** (`cacheComponents: true`)
- Read Next docs under `node_modules/next/dist/docs/` before assuming old APIs (see `AGENTS.md`)
- Auth layouts that read cookies: `export const instant = false`
- Proxy (not middleware): `proxy.ts`
- Tailwind v4, shadcn + KokonutUI registry
- Motion (`LazyMotion`, `reducedMotion="user"`), dnd-kit, Lucide
- Design: Archivo + JetBrains Mono; paper/ink; teal phase ramp `--phase-1`…`--phase-5`; redline `#C8382A`; sharp corners

## Data / backend

- **No Docker locally** → no local Supabase yet
- All CRUD goes through `lib/db/repo.ts` → `lib/db/demo-store.ts`
- Supabase client stubs exist (`lib/supabase/*`, `lib/env.ts`); wire when env + Docker available
- Schema SQL is written; app does not apply it automatically

## Board model

- Flat **8 columns**: Backlog, Pending, five design phases, Completed
- Active projects have `current_phase`; backlog/pending/completed have `current_phase = null`
- On-hold is a flag on the project, not a column

## UI conventions (post-Lovable pass)

- `.label-caps`, `.page-title` utilities in `app/globals.css`
- Nav: 208px → 56px collapsed; teal “M”; active = white + 2px inset left `--phase-5`
- Board columns ~264px; phase columns get 2px top accent in phase color
- Calendar: week columns with `border-r` grid lines per row; bars overlaid; today = `--redline`
- Detail sheet `--container-xl` (36rem / 576px); BACKLOG badge + Put on hold; CUSTOMER “FULL RECORD” in phase-5 teal
  - Set as `data-[side=right]:sm:max-w-xl`. **The variant prefix must match** `components/ui/sheet.tsx`'s own `data-[side=right]:sm:max-w-sm` — tailwind-merge keys on the full prefix, so a plain `sm:max-w-*` override does **not** replace it. Both classes survive and the more specific base rule wins. That is how the sheet rendered at 384px for months while the source said `sm:max-w-[520px]`. Same trap applies to any `SheetContent` override.

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

**Cost:** 32 infinitely-looping SVG paths while the login screen is open. Acceptable for an unauthenticated 4-second screen; revisit if the login route ever gains real work.

## Locale

- US / America/Chicago (showcase UK-ish copy was filler; seed is Chicago-flavored)
