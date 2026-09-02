import { format, parseISO, isWeekend } from "date-fns";

import {
  businessDaysBetween,
  deriveSchedule,
  endOfSpan,
  phaseDateError,
  reviewMilestone,
} from "../lib/dates";

let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  ${g}\n  want ${w}`);
  } else {
    console.log(`ok   ${label}`);
  }
};

// 2026-08-17 is a Monday.
const durations = {
  schematic_design: 10,
  design_development: 5,
  construction_documents: 10,
  final_review: 3,
  permitting: 15,
};

const s = deriveSchedule({ anchor: "2026-08-17", durations });

// 10 working days from Mon 17 Aug = Fri 28 Aug (inclusive).
check("SD start", s.schematic_design?.planned_start, "2026-08-17");
check("SD end (10 working days, inclusive)", s.schematic_design?.planned_end, "2026-08-28");
// Next phase resumes the following business day: Mon 31 Aug.
check("DD start", s.design_development?.planned_start, "2026-08-31");
check("DD end (5 working days)", s.design_development?.planned_end, "2026-09-04");
// Review is a zero-width milestone on DD's end.
check("Review start", s.review?.planned_start, "2026-09-04");
check("Review end == start", s.review?.planned_end, s.review?.planned_start);
// CD picks up after DD, not after Review.
check("CD start", s.construction_documents?.planned_start, "2026-09-07");

// No weekend boundaries anywhere.
const weekendHits = Object.entries(s).filter(
  ([, v]) => isWeekend(parseISO(v.planned_start)) || isWeekend(parseISO(v.planned_end)),
);
check("no weekend starts or ends", weekendHits.map(([k]) => k), []);

// Anchor falling on a Saturday pushes to Monday.
const weekend = deriveSchedule({
  anchor: "2026-08-15", // Saturday
  durations: { schematic_design: 1 },
});
check("weekend anchor → Monday", weekend.schematic_design?.planned_start, "2026-08-17");
check("1-day phase starts and ends same day", weekend.schematic_design?.planned_end, "2026-08-17");

// Locked phases keep their dates and the chain resumes after them.
const relocked = deriveSchedule({
  anchor: "2026-08-17",
  durations,
  locked: { schematic_design: "2026-09-11" }, // a Friday, already worked
});
check("locked SD not re-dated", relocked.schematic_design, undefined);
check("DD resumes after locked SD", relocked.design_development?.planned_start, "2026-09-14");

// A locked phase with no end date must not derail the chain.
const nullLock = deriveSchedule({
  anchor: "2026-08-17",
  durations,
  locked: { schematic_design: null },
});
check("null-dated lock → DD starts at anchor", nullLock.design_development?.planned_start, "2026-08-17");

// Missing duration → no dates emitted for that phase, chain continues.
const partial = deriveSchedule({
  anchor: "2026-08-17",
  durations: { schematic_design: 5, design_development: null, construction_documents: 5 },
});
check("no duration → no dates", partial.design_development, undefined);
check("chain continues past it", partial.construction_documents?.planned_start, "2026-08-24");

// ---------------------------------------------------------------------------
// Rework after a rejected gate. The anchor is a FLOOR, not just a fallback:
// phases completed months ago must not drag re-planned work into the past.
// ---------------------------------------------------------------------------

// Review rejected → back to DD. Only *completed* phases are locked; DD is
// in_progress precisely because it is being reworked, so it re-dates from today.
const reworkDD = deriveSchedule({
  anchor: "2026-08-17",
  durations,
  locked: { schematic_design: "2026-05-15" }, // finished three months ago
});
check("stale lock → DD starts at the anchor, not in the past", reworkDD.design_development?.planned_start, "2026-08-17");
check("reworked DD ends 5 working days later", reworkDD.design_development?.planned_end, "2026-08-21");
check("Review milestone follows the reworked DD", reworkDD.review?.planned_start, "2026-08-21");
check("CD resumes after the reworked DD", reworkDD.construction_documents?.planned_start, "2026-08-24");

// Final review rejected → back to CD. SD, DD and Review are all completed by
// now, so all three are locked and all three sit in the past.
const reworkCD = deriveSchedule({
  anchor: "2026-08-17",
  durations,
  locked: {
    schematic_design: "2026-05-15",
    design_development: "2026-05-22",
    review: "2026-05-22",
  },
});
check("stale locks → CD starts at the anchor", reworkCD.construction_documents?.planned_start, "2026-08-17");
check("reworked CD ends 10 working days later", reworkCD.construction_documents?.planned_end, "2026-08-28");
check("Final review follows the reworked CD", reworkCD.final_review?.planned_start, "2026-08-31");
check("Final review ends 3 working days later", reworkCD.final_review?.planned_end, "2026-09-02");

// The invariant behind all of the above, stated once directly.
for (const [label, plan] of [
  ["DD rework", reworkDD],
  ["CD rework", reworkCD],
] as const) {
  const stale = Object.entries(plan)
    .filter(([, v]) => v.planned_start < "2026-08-17")
    .map(([k]) => k);
  check(`${label}: nothing is scheduled before the anchor`, stale, []);
}

// A lock that ends AFTER the anchor still wins — the floor raises, never lowers.
const futureLock = deriveSchedule({
  anchor: "2026-08-17",
  durations,
  locked: { schematic_design: "2026-12-11" }, // a Friday, well past the anchor
});
check("floor does not pull a future lock backwards", futureLock.design_development?.planned_start, "2026-12-14");

// Running the loop a second time must behave identically — the only thing that
// changes between passes is the anchor moving forward with today.
const secondPass = deriveSchedule({
  anchor: "2026-09-14", // a Monday, two rejections later
  durations,
  locked: { schematic_design: "2026-05-15", design_development: "2026-08-21" },
});
check("second rejection re-floors to the new anchor", secondPass.construction_documents?.planned_start, "2026-09-14");
check("second rejection leaves the earlier lock alone", secondPass.design_development, undefined);

// --- explicit dates (2026-09-02) -----------------------------------------
// businessDaysBetween is the inverse of the chain: the working-day count of
// an inclusive span, so hand-entered dates still carry a duration.
check("same weekday is one day", businessDaysBetween("2026-09-14", "2026-09-14"), 1);
check("Mon–Fri is five", businessDaysBetween("2026-09-14", "2026-09-18"), 5);
check("Mon–next Mon skips the weekend", businessDaysBetween("2026-09-14", "2026-09-21"), 6);
check("Sat–Sun is nothing", businessDaysBetween("2026-09-12", "2026-09-13"), 0);
check("Sat start counts from Monday", businessDaysBetween("2026-09-12", "2026-09-15"), 2);
check("Fri–Mon is two", businessDaysBetween("2026-09-11", "2026-09-14"), 2);
check("end before start is zero", businessDaysBetween("2026-09-18", "2026-09-14"), 0);

// The two directions round-trip: chain a span, count it back.
const chained = deriveSchedule({ anchor: "2026-09-14", durations: { schematic_design: 10 } });
check(
  "chain → count round-trips",
  businessDaysBetween(chained.schematic_design!.planned_start, chained.schematic_design!.planned_end),
  10,
);
check("endOfSpan matches the chain", endOfSpan("2026-09-14", 10), chained.schematic_design!.planned_end);
check("endOfSpan from a Saturday starts Monday", endOfSpan("2026-09-12", 1), "2026-09-14");
check("endOfSpan of one day is the day", endOfSpan("2026-09-14", 1), "2026-09-14");

check("undated is fine", phaseDateError(null, null), null);
check("half-dated is refused", phaseDateError("2026-09-14", null), "Set both dates, or neither.");
check("reversed is refused", phaseDateError("2026-09-18", "2026-09-14"), "The end date is before the start.");
check("weekend-only is refused", phaseDateError("2026-09-12", "2026-09-13"), "The span has no working day in it.");
check("a real span is fine", phaseDateError("2026-09-20", "2026-09-26"), null);

check("review follows DD's end", reviewMilestone("2026-10-02"), { planned_start: "2026-10-02", planned_end: "2026-10-02" });
check("no DD end, no milestone", reviewMilestone(null), null);

console.log(
  failures === 0 ? "\nAll schedule checks passed" : `\n${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
