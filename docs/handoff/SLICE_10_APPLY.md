# Slice 10 — Calendar: day resolution + staff grouping

Unblocked 2026-08-14 (client confirmed both halves of `WORKFLOW-2.md` §8, not day zoom
alone). **No SQL** — this slice is presentation only, reading `project_phases`.

## What shipped

**Three zoom levels.** `days` · `weeks` · `months`. Everything derives from one constant,
`DAY_WIDTH` — column widths, bar geometry, and the grid gradient all read the same px-per-day
number, so a zoom level is one value rather than a branch in five places.

**Two modes.** *By project* (one row per project, as before) and *By staff* (rows grouped by
assignee, collapsible, with an Unassigned group). Each staff group header shows the project
count and total planned hours — the workload signal Ryan asked for.

**Bounded window with paging.** ← / Today / → and a visible date range. The old view spanned
min-to-max across every project; at day resolution that is a scroll bar measured in tens of
thousands of pixels. Windows are 12 weeks (days), 1 year (weeks), 3 years (months), and
paging moves half a window so consecutive pages overlap rather than jumping.

**Grid as one painted background.** The per-column-per-row divs are gone — at day resolution
they were roughly 11k nodes. Grid lines and weekend shading are now a `repeating-linear-gradient`
on the timeline container.

**Two-tier header.** Month bands on top, per-day cells (`M 17`) or per-week date numbers
below, with weekends dimmed.

**Bars are inclusive.** A phase ending on the 28th now occupies the 28th. Previously width
was `end − start`, which dropped the final day — invisible at week resolution, wrong at day
resolution. This also makes Review's zero-length milestone render as exactly one day.

Bar tooltips now include planned hours where set.

## Geometry is tested, rendering is not

The arithmetic lives in `lib/calendar.ts`, deliberately separate from the view so it can be
checked without a browser. `npm run check:calendar` — 45 assertions covering window
construction, Monday origin, inclusive bar spans, clipping at both edges, month-band tiling,
tick alignment, weekend-band placement cross-checked against real dates, and page overlap.

`npm run check` runs this and `check:schedule` together.

**What that does not cover:** anything visual. Column widths at 34px/day, label legibility,
the two-tier header at each zoom, group collapse behavior, dark mode, and scroll position on
load were **not** verified — no browser tooling was available this session. Those need a
look before this goes to the client.

## Verify by hand

1. `/calendar` → Weeks zoom looks as before (bars now one day longer — correct).
2. Days zoom → weekends shaded, header reads `M 17`, `T 18`…
3. ← / → page by half a window; Today returns. No gap between pages.
4. Months zoom → three-year span, month abbreviations in the top band.
5. By staff → one group per person plus Unassigned; headers show count and hours.
6. Collapse a group → its rows disappear from both the rail and the timeline, and they stay
   aligned.
7. A project with no phase in the window shows `· outside range` in the left rail.
8. Both themes.

## Known limits

- **Staff mode is sparse.** It reads `assignee_id`, and coverage is 22% until projects are
  run through Plan schedule (Slice 4). Unassigned will hold most of the work until then.
- **Rows outside the window render empty** rather than being hidden — the rail marks them
  `· outside range`. Hiding them entirely would make the row count jump while paging.
- **No capacity/load treatment.** Planned hours appear as group totals and in tooltips, but
  nothing yet divides hours by duration to show weekly load. That depends on the open
  question in `NEXT.md` about what the hours number is *for*; if the answer is capacity
  planning, the staff rows want a density/heatmap treatment and that is a follow-on.

---

**Status (2026-08-14):** Code complete. Typecheck, lint, build, `check:calendar`, and
`check:schedule` all clean. **Visual verification outstanding.**
