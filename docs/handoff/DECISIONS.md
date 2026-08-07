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
- Detail sheet ~520px; BACKLOG badge + Put on hold; CUSTOMER “FULL RECORD” in phase-5 teal

## Locale

- US / America/Chicago (showcase UK-ish copy was filler; seed is Chicago-flavored)
