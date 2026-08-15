import {
  DESIGN_PHASES,
  type ActivityLog,
  type Customer,
  type DesignPhase,
  type PhaseStatus,
  type PhaseSubscriber,
  type Project,
  type ProjectPhase,
  type ProjectStatus,
  type User,
} from "@/lib/types";

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}-0000-0000-000000000000`;
}

function now() {
  return new Date().toISOString();
}

function seedPhases(
  projectId: string,
  current: DesignPhase | null,
  assignees: Partial<Record<DesignPhase, string>>,
  dates: Partial<Record<DesignPhase, { start: string; end: string }>> = {},
): ProjectPhase[] {
  const currentIdx = current ? DESIGN_PHASES.indexOf(current) : -1;
  return DESIGN_PHASES.map((phase, index) => {
    let status: PhaseStatus = "not_started";
    let entered_at: string | null = null;
    let completed_at: string | null = null;
    if (currentIdx >= 0) {
      if (index < currentIdx) {
        status = "completed";
        completed_at = dates[phase]?.end ?? "2026-04-01T12:00:00.000Z";
        entered_at = dates[phase]?.start ?? "2026-02-01T12:00:00.000Z";
      } else if (index === currentIdx) {
        status = "in_progress";
        entered_at = dates[phase]?.start ?? "2026-05-01T12:00:00.000Z";
      }
    }
    return {
      // Project ids look like `proj-0001-0000-...`, so the numeric block
      // starts at index 5. slice(3, 7) read "j-00" → NaN, which collapsed
      // every phase row in the seed onto the id `ph-0NaN-...`.
      id: id("ph", Number(projectId.slice(5, 9)) * 10 + index + 1),
      project_id: projectId,
      phase,
      assignee_id: assignees[phase] ?? null,
      status,
      planned_start: dates[phase]?.start?.slice(0, 10) ?? null,
      planned_end: dates[phase]?.end?.slice(0, 10) ?? null,
      duration_days: null,
      planned_hours: null,
      entered_at,
      completed_at,
      sort_order: index + 1,
    };
  });
}

const chrisId = id("user", 1);
const danaId = id("user", 2);
const inesId = id("user", 3);
const marcusId = id("user", 4);
const priyaId = id("user", 5);

/** @deprecated use chrisId — kept for callers expecting adminId */
const adminId = chrisId;
/** @deprecated use danaId */
const staffId = danaId;

const users: User[] = [
  {
    id: chrisId,
    name: "Chris Alvarado",
    email: "chris@merkhet.studio",
    role: "admin",
    is_active: true,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    id: danaId,
    name: "Dana Whitfield",
    email: "dana@merkhet.studio",
    role: "staff",
    is_active: true,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    id: inesId,
    name: "Ines Okafor",
    email: "ines@merkhet.studio",
    role: "staff",
    is_active: true,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    id: marcusId,
    name: "Marcus Reed",
    email: "marcus@merkhet.studio",
    role: "staff",
    is_active: true,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    id: priyaId,
    name: "Priya Raman",
    email: "priya@merkhet.studio",
    role: "staff",
    is_active: true,
    created_at: "2026-01-01T12:00:00.000Z",
  },
];

const customers: Customer[] = [
  {
    id: id("cust", 1),
    name: "Halcyon Development",
    contact_name: "Jane Mercer",
    contact_email: "jane@halcyondev.com",
    contact_phone: "(312) 555-0144",
    notes: null,
    spouse_name: null,
    created_at: "2026-01-10T12:00:00.000Z",
    updated_at: "2026-01-10T12:00:00.000Z",
  },
  {
    id: id("cust", 2),
    name: "Northbank Coffee",
    contact_name: "Elias Vandt",
    contact_email: "elias@northbank.coffee",
    contact_phone: "(773) 555-0190",
    notes: null,
    spouse_name: null,
    created_at: "2026-01-12T12:00:00.000Z",
    updated_at: "2026-01-12T12:00:00.000Z",
  },
  {
    id: id("cust", 3),
    name: "Waverly School District",
    contact_name: "Dr. Anita Cole",
    contact_email: "acole@waverlysd.org",
    contact_phone: "(847) 555-0112",
    notes: null,
    spouse_name: null,
    created_at: "2026-01-15T12:00:00.000Z",
    updated_at: "2026-01-15T12:00:00.000Z",
  },
  {
    id: id("cust", 4),
    name: "Ortega Residence",
    contact_name: "Luis Ortega",
    contact_email: "luis.ortega@example.com",
    contact_phone: "(773) 555-0166",
    notes: null,
    spouse_name: "Maria Ortega",
    created_at: "2026-01-18T12:00:00.000Z",
    updated_at: "2026-01-18T12:00:00.000Z",
  },
  {
    id: id("cust", 5),
    name: "Cardinal & Vine",
    contact_name: "Rosa Delgado",
    contact_email: "rosa@cardinalvine.com",
    contact_phone: "(312) 555-0177",
    notes: "Restaurant group; three sites in progress.",
    spouse_name: null,
    created_at: "2026-02-02T12:00:00.000Z",
    updated_at: "2026-02-02T12:00:00.000Z",
  },
  {
    id: id("cust", 6),
    name: "Bellweather Housing Trust",
    contact_name: "Théo Marchand",
    contact_email: "tmarchand@bellweathertrust.org",
    contact_phone: "(773) 555-0121",
    notes: null,
    spouse_name: null,
    created_at: "2026-02-09T12:00:00.000Z",
    updated_at: "2026-02-09T12:00:00.000Z",
  },
  {
    id: id("cust", 7),
    name: "Pilsen Arts Collective",
    contact_name: "Nadia Okonkwo",
    contact_email: "nadia@pilsenarts.org",
    contact_phone: "(312) 555-0198",
    notes: null,
    spouse_name: null,
    created_at: "2026-02-20T12:00:00.000Z",
    updated_at: "2026-02-20T12:00:00.000Z",
  },
  {
    id: id("cust", 8),
    name: "Sable & Roe Dental",
    contact_name: "Dr. Priya Venkataraman",
    contact_email: "office@sableroe.com",
    contact_phone: "(847) 555-0155",
    notes: null,
    spouse_name: null,
    created_at: "2026-03-04T12:00:00.000Z",
    updated_at: "2026-03-04T12:00:00.000Z",
  },
];

const [
  halcyon,
  northbank,
  waverly,
  ortega,
  cardinal,
  bellweather,
  pilsen,
  sableroe,
] = customers;

function makeProject(
  n: number,
  partial: Omit<
    Project,
    | "id"
    | "project_number"
    | "created_at"
    | "updated_at"
    | "client_desired_completion"
    | "project_budget"
    | "design_budget"
    | "client_contact_id"
        | "archived_at"
    | "contract_path"
    | "contract_filename"
    | "contract_uploaded_at"
  > &
    Partial<
      Pick<
        Project,
        | "client_desired_completion"
        | "project_budget"
        | "design_budget"
        | "client_contact_id"
                | "archived_at"
        | "contract_path"
        | "contract_filename"
        | "contract_uploaded_at"
      >
    >,
): Project {
  const stamp = now();
  return {
    id: id("proj", n),
    project_number: `MK-${String(n).padStart(4, "0")}`,
    created_at: stamp,
    updated_at: stamp,
    client_desired_completion: null,
    project_budget: null,
    design_budget: null,
    client_contact_id: null,
    archived_at: null,
    contract_path: null,
    contract_filename: null,
    contract_uploaded_at: null,
    ...partial,
  };
}

const projects: Project[] = [
  makeProject(400, {
    customer_id: ortega.id,
    name: "Ortega — garage studio",
    description: "Detached 380 sf studio above a new two-car garage.",
    status: "pending",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: null,
    target_completion: "2027-03-01",
    hours_per_week: null,
  }),
  makeProject(401, {
    customer_id: waverly.id,
    name: "Waverly ES — roof replacement",
    description: null,
    status: "pending",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: null,
    target_completion: null,
    hours_per_week: null,
  }),
  makeProject(402, {
    customer_id: northbank.id,
    name: "Northbank — Logan Square storefront",
    description: null,
    status: "pending",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: null,
    target_completion: "2026-12-18",
    hours_per_week: null,
  }),
  makeProject(403, {
    customer_id: northbank.id,
    name: "Northbank — Fulton Market fit-out",
    description: "Café fit-out; new MEP and storefront glazing.",
    status: "active",
    current_phase: "schematic_design",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-06-01",
    target_completion: "2026-08-12",
    hours_per_week: 8,
  }),
  makeProject(404, {
    customer_id: ortega.id,
    name: "Ortega Residence — rear addition",
    description: "Single-storey rear addition with kitchen remodel.",
    status: "active",
    current_phase: "design_development",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-04-01",
    target_completion: "2026-07-31",
    hours_per_week: 6,
  }),
  makeProject(405, {
    customer_id: halcyon.id,
    name: "Halcyon Mews — 14 townhomes",
    description: "Fourteen-unit townhome block; CD package in progress.",
    status: "active",
    current_phase: "construction_documents",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2025-11-01",
    target_completion: "2026-08-14",
    hours_per_week: 18,
  }),
  makeProject(406, {
    customer_id: halcyon.id,
    name: "Halcyon — Ravenswood feasibility",
    description: "Site feasibility and massing study.",
    status: "active",
    current_phase: "review",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-05-01",
    target_completion: "2026-08-21",
    hours_per_week: 4,
  }),
  makeProject(407, {
    customer_id: waverly.id,
    name: "Waverly HS — science wing addition",
    description: "Two-storey science wing; in permitting.",
    status: "active",
    current_phase: "permitting",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2025-09-01",
    target_completion: "2026-09-30",
    hours_per_week: 24,
  }),
  makeProject(408, {
    customer_id: halcyon.id,
    name: "Halcyon — Armitage loft conversion",
    description: "Delivered.",
    status: "completed",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2025-01-01",
    target_completion: "2026-03-15",
    hours_per_week: 0,
    archived_at: "2026-03-15T12:00:00.000Z",
  }),
  makeProject(409, {
    customer_id: northbank.id,
    name: "Northbank — Wicker Park kiosk",
    description: "Delivered.",
    status: "completed",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2025-03-01",
    target_completion: "2025-11-20",
    hours_per_week: 0,
    archived_at: "2025-11-20T12:00:00.000Z",
  }),

  // 410–419 broaden the seed to 20 projects. Beyond filling the columns out,
  // these deliberately cover states the original ten never produced: on hold
  // (both freshly paused and long-stalled), an overdue target, targets inside
  // the 14-day amber window, an unassigned current phase, skipped phases, and
  // partial/absent phase dates so the calendar's degradation paths are visible.
  makeProject(410, {
    customer_id: cardinal.id,
    name: "Cardinal & Vine — West Loop taproom",
    description: "Won; kickoff pending lease execution.",
    status: "pending",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: null,
    target_completion: "2027-01-15",
    hours_per_week: null,
  }),
  makeProject(411, {
    customer_id: bellweather.id,
    name: "Bellweather — Humboldt Park 24-unit",
    description: "Awaiting site survey before kickoff.",
    status: "pending",
    current_phase: null,
    // Stalled since early April — the "quietly stuck for four months" case
    // PRD §4.3 wants distinguishable from something paused yesterday.
    on_hold: true,
    on_hold_since: "2026-04-02T15:20:00.000Z",
    on_hold_reason: "Survey not returned by the city",
    start_date: null,
    target_completion: "2026-11-30",
    hours_per_week: null,
  }),
  makeProject(412, {
    customer_id: pilsen.id,
    name: "Pilsen Arts — gallery conversion",
    description: "Warehouse to gallery; occupancy change.",
    status: "active",
    current_phase: "schematic_design",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-07-06",
    target_completion: "2026-08-18", // inside the 14-day amber window
    hours_per_week: 10,
  }),
  makeProject(413, {
    customer_id: sableroe.id,
    name: "Sable & Roe — Lincoln Park clinic",
    description: "Four-operatory clinic fit-out.",
    status: "active",
    current_phase: "schematic_design",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-08-03",
    target_completion: "2026-12-11",
    hours_per_week: 5,
  }),
  makeProject(414, {
    customer_id: cardinal.id,
    name: "Cardinal & Vine — Fulton pop-up",
    description: "Short-run pop-up; target date already blown.",
    status: "active",
    current_phase: "design_development",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-06-15",
    target_completion: "2026-07-24", // past — renders redline
    hours_per_week: 12,
  }),
  makeProject(415, {
    customer_id: halcyon.id,
    name: "Halcyon — Bucktown infill duplex",
    description: null,
    status: "active",
    current_phase: "design_development",
    // Paused days ago, not months — the other end of the §4.3 comparison.
    on_hold: true,
    on_hold_since: "2026-08-05T11:00:00.000Z",
    on_hold_reason: "Client reviewing budget",
    start_date: "2026-05-04",
    target_completion: "2026-10-30",
    hours_per_week: 9,
  }),
  makeProject(416, {
    customer_id: bellweather.id,
    name: "Bellweather — Garfield Park rehab",
    description: "Gut rehab of a 1920s courtyard building.",
    status: "active",
    current_phase: "construction_documents",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2025-06-02", // long runway; widest bar on the calendar
    target_completion: "2026-10-16",
    hours_per_week: 20,
  }),
  makeProject(417, {
    customer_id: waverly.id,
    name: "Waverly MS — cafeteria remodel",
    description: "Jumped straight from schematic to review.",
    status: "active",
    current_phase: "review",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-03-02",
    target_completion: "2026-08-21", // amber
    hours_per_week: 7,
  }),
  makeProject(418, {
    customer_id: pilsen.id,
    name: "Pilsen Arts — mural pavilion",
    description: "Small outdoor pavilion; permit set submitted.",
    status: "active",
    current_phase: "permitting",
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2026-02-02",
    target_completion: "2026-09-18",
    hours_per_week: 3,
  }),
  makeProject(419, {
    customer_id: sableroe.id,
    name: "Sable & Roe — Andersonville build-out",
    description: "Delivered.",
    status: "completed",
    current_phase: null,
    on_hold: false,
    on_hold_since: null,
    on_hold_reason: null,
    start_date: "2025-02-03",
    target_completion: "2026-01-30",
    hours_per_week: 0,
    archived_at: "2026-01-30T12:00:00.000Z",
  }),
];

let projectSeq = 419;

const phases: ProjectPhase[] = [
  ...seedPhases(projects[0].id, null, {}),
  ...seedPhases(projects[1].id, null, {}),
  ...seedPhases(projects[2].id, null, {}),
  ...seedPhases(
    projects[3].id,
    "schematic_design",
    { schematic_design: marcusId },
    {
      schematic_design: { start: "2026-06-01", end: "2026-08-12" },
      design_development: { start: "2026-08-13", end: "2026-10-15" },
    },
  ),
  ...seedPhases(
    projects[4].id,
    "design_development",
    {
      schematic_design: danaId,
      design_development: danaId,
    },
    {
      schematic_design: { start: "2026-04-01", end: "2026-05-20" },
      design_development: { start: "2026-05-21", end: "2026-07-31" },
    },
  ),
  ...seedPhases(
    projects[5].id,
    "construction_documents",
    {
      schematic_design: inesId,
      design_development: inesId,
      construction_documents: inesId,
    },
    {
      schematic_design: { start: "2025-11-01", end: "2026-01-15" },
      design_development: { start: "2026-01-16", end: "2026-04-30" },
      construction_documents: { start: "2026-05-01", end: "2026-08-14" },
      review: { start: "2026-08-15", end: "2026-09-15" },
      permitting: { start: "2026-09-16", end: "2026-11-30" },
    },
  ),
  ...seedPhases(
    projects[6].id,
    "review",
    {
      schematic_design: chrisId,
      review: chrisId,
    },
    {
      schematic_design: { start: "2026-05-01", end: "2026-06-30" },
      review: { start: "2026-07-01", end: "2026-08-21" },
    },
  ),
  ...seedPhases(
    projects[7].id,
    "permitting",
    {
      schematic_design: marcusId,
      design_development: marcusId,
      construction_documents: marcusId,
      review: marcusId,
      permitting: marcusId,
    },
    {
      schematic_design: { start: "2025-09-01", end: "2025-11-30" },
      design_development: { start: "2025-12-01", end: "2026-03-15" },
      construction_documents: { start: "2026-03-16", end: "2026-06-30" },
      review: { start: "2026-07-01", end: "2026-07-31" },
      permitting: { start: "2026-08-01", end: "2026-09-30" },
    },
  ),
  ...seedPhases(projects[8].id, null, {}).map((p) => ({
    ...p,
    status: "completed" as const,
    completed_at: "2026-03-15T12:00:00.000Z",
  })),
  ...seedPhases(projects[9].id, null, {}).map((p) => ({
    ...p,
    status: "completed" as const,
    completed_at: "2025-11-20T12:00:00.000Z",
  })),

  // --- 410–419 ---

  // Backlog / pending: no phase has started, so no dates either.
  ...seedPhases(projects[10].id, null, {}),
  ...seedPhases(projects[11].id, null, {}),

  ...seedPhases(
    projects[12].id,
    "schematic_design",
    { schematic_design: priyaId },
    {
      schematic_design: { start: "2026-07-06", end: "2026-08-18" },
      design_development: { start: "2026-08-19", end: "2026-10-02" },
    },
  ),
  // Deliberately no assignee anywhere: an active phase nobody owns is the
  // gap PRD §8.8 asks about, and it should be visible on the board.
  ...seedPhases(
    projects[13].id,
    "schematic_design",
    {},
    { schematic_design: { start: "2026-08-03", end: "2026-10-09" } },
  ),
  ...seedPhases(
    projects[14].id,
    "design_development",
    { schematic_design: marcusId, design_development: marcusId },
    {
      schematic_design: { start: "2026-06-15", end: "2026-07-03" },
      design_development: { start: "2026-07-06", end: "2026-07-24" },
    },
  ),
  ...seedPhases(
    projects[15].id,
    "design_development",
    { schematic_design: danaId, design_development: priyaId },
    {
      schematic_design: { start: "2026-05-04", end: "2026-06-26" },
      design_development: { start: "2026-06-29", end: "2026-09-04" },
      construction_documents: { start: "2026-09-07", end: "2026-10-30" },
    },
  ),
  ...seedPhases(
    projects[16].id,
    "construction_documents",
    {
      schematic_design: inesId,
      design_development: inesId,
      construction_documents: chrisId,
      review: chrisId,
    },
    {
      schematic_design: { start: "2025-06-02", end: "2025-09-12" },
      design_development: { start: "2025-09-15", end: "2026-01-30" },
      construction_documents: { start: "2026-02-02", end: "2026-07-31" },
      review: { start: "2026-08-03", end: "2026-08-28" },
      permitting: { start: "2026-08-31", end: "2026-10-16" },
    },
  ),
  // Dragged schematic -> review directly. PRD §4.3 allows the skip and §6.2
  // requires the phases in between to be marked `skipped`, not left open.
  ...seedPhases(
    projects[17].id,
    "review",
    { schematic_design: danaId, review: chrisId },
    {
      schematic_design: { start: "2026-03-02", end: "2026-06-19" },
      review: { start: "2026-06-22", end: "2026-08-21" },
    },
  ).map((p) =>
    p.phase === "design_development"
      ? { ...p, status: "skipped" as const }
      : p,
  ),
  // Only two phases carry dates — the calendar has to cope with the rest
  // being blank rather than assuming a full set (PRD §6.5).
  ...seedPhases(
    projects[18].id,
    "permitting",
    { schematic_design: priyaId, permitting: marcusId },
    {
      schematic_design: { start: "2026-02-02", end: "2026-04-10" },
      permitting: { start: "2026-06-01", end: "2026-09-18" },
    },
  ),
  ...seedPhases(projects[19].id, null, {}).map((p) => ({
    ...p,
    status: "completed" as const,
    completed_at: "2026-01-30T12:00:00.000Z",
  })),
];

const activity: ActivityLog[] = [
  {
    id: id("act", 1),
    project_id: projects[4].id,
    actor_id: chrisId,
    event_type: "phase.changed",
    payload: {
      from: "schematic_design",
      to: "design_development",
      from_status: "active",
      to_status: "active",
    },
    created_at: "2026-05-21T09:14:00.000Z",
  },
  {
    id: id("act", 2),
    project_id: projects[5].id,
    actor_id: inesId,
    event_type: "project.updated",
    payload: { changed: { hours_per_week: [14, 18] } },
    created_at: "2026-08-04T16:40:00.000Z",
  },
  {
    id: id("act", 3),
    project_id: projects[17].id,
    actor_id: danaId,
    event_type: "phase.changed",
    payload: {
      from: "schematic_design",
      to: "review",
      from_status: "active",
      to_status: "active",
    },
    created_at: "2026-06-22T10:05:00.000Z",
  },
  {
    id: id("act", 4),
    project_id: projects[11].id,
    actor_id: chrisId,
    event_type: "project.hold_toggled",
    payload: { on_hold: true, reason: "Survey not returned by the city" },
    created_at: "2026-04-02T15:20:00.000Z",
  },
  {
    id: id("act", 5),
    project_id: projects[15].id,
    actor_id: priyaId,
    event_type: "project.hold_toggled",
    payload: { on_hold: true, reason: "Client reviewing budget" },
    created_at: "2026-08-05T11:00:00.000Z",
  },
  {
    id: id("act", 6),
    project_id: projects[16].id,
    actor_id: chrisId,
    event_type: "phase.assignee_changed",
    payload: {
      phase: "construction_documents",
      from_user_id: inesId,
      to_user_id: chrisId,
    },
    created_at: "2026-02-02T09:30:00.000Z",
  },
];

const subscribers: PhaseSubscriber[] = [
  {
    phase: "schematic_design",
    user_id: danaId,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    phase: "schematic_design",
    user_id: marcusId,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    phase: "design_development",
    user_id: danaId,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    phase: "construction_documents",
    user_id: inesId,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    phase: "review",
    user_id: chrisId,
    created_at: "2026-01-01T12:00:00.000Z",
  },
  {
    phase: "permitting",
    user_id: marcusId,
    created_at: "2026-01-01T12:00:00.000Z",
  },
];

export type DemoStore = {
  users: User[];
  customers: Customer[];
  projects: Project[];
  phases: ProjectPhase[];
  activity: ActivityLog[];
  subscribers: PhaseSubscriber[];
  projectSeq: number;
};

const globalForDemo = globalThis as unknown as {
  __merkhetDemoV2?: DemoStore;
};

function createStore(): DemoStore {
  return {
    users: structuredClone(users),
    customers: structuredClone(customers),
    projects: structuredClone(projects),
    phases: structuredClone(phases),
    activity: structuredClone(activity),
    subscribers: structuredClone(subscribers),
    projectSeq,
  };
}

export function getDemoSeedData(): DemoStore {
  return createStore();
}

export function getDemoStore(): DemoStore {
  if (!globalForDemo.__merkhetDemoV2) {
    globalForDemo.__merkhetDemoV2 = createStore();
  }
  return globalForDemo.__merkhetDemoV2;
}

export function resetDemoStore() {
  globalForDemo.__merkhetDemoV2 = createStore();
}

export function nextProjectNumber(store: DemoStore) {
  store.projectSeq += 1;
  return `MK-${String(store.projectSeq).padStart(4, "0")}`;
}

export function seedPhasesForProject(projectId: string): ProjectPhase[] {
  return DESIGN_PHASES.map((phase, index) => ({
    id: crypto.randomUUID(),
    project_id: projectId,
    phase,
    assignee_id: null,
    status: "not_started" as const,
    planned_start: null,
    planned_end: null,
    duration_days: null,
    planned_hours: null,
    entered_at: null,
    completed_at: null,
    sort_order: index + 1,
  }));
}

export { adminId, staffId, chrisId, danaId };

export function applyPhaseMove(
  store: DemoStore,
  projectId: string,
  toColumn: ProjectStatus | DesignPhase | "active",
  actorId: string,
) {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");

  const fromStatus = project.status;
  const fromPhase = project.current_phase;
  const designPhases = DESIGN_PHASES;
  const isPhase = designPhases.includes(toColumn as DesignPhase);

  const nowIso = now();
  project.updated_at = nowIso;

  if (toColumn === "active") {
    for (const row of store.phases.filter((p) => p.project_id === projectId)) {
      if (row.status === "in_progress") {
        row.status = "not_started";
        row.entered_at = null;
        row.completed_at = null;
      }
    }
    project.status = "active";
    project.current_phase = null;
  } else if (isPhase) {
    const toPhase = toColumn as DesignPhase;
    const toOrder = designPhases.indexOf(toPhase);
    const fromOrder = fromPhase ? designPhases.indexOf(fromPhase) : -1;

    for (const row of store.phases.filter((p) => p.project_id === projectId)) {
      const order = designPhases.indexOf(row.phase);
      if (row.phase === toPhase) {
        row.status = "in_progress";
        row.entered_at = nowIso;
        row.completed_at = null;
      } else if (row.status === "in_progress") {
        row.status = "completed";
        row.completed_at = nowIso;
      } else if (
        fromOrder >= 0 &&
        order > fromOrder &&
        order < toOrder &&
        row.status === "not_started"
      ) {
        row.status = "skipped";
      }
    }

    project.status = "active";
    project.current_phase = toPhase;
  } else {
    for (const row of store.phases.filter((p) => p.project_id === projectId)) {
      if (row.status === "in_progress") {
        if (toColumn === "completed") {
          row.status = "completed";
          row.completed_at = nowIso;
        } else {
          row.status = "not_started";
          row.entered_at = null;
          row.completed_at = null;
        }
      }
      if (toColumn === "completed" && row.status !== "skipped") {
        row.status = "completed";
        row.completed_at = row.completed_at ?? nowIso;
      }
    }
    project.status =
      toColumn === "backlog" ? "pending" : (toColumn as ProjectStatus);
    project.current_phase = null;
    if (toColumn === "completed") {
      project.archived_at = project.archived_at ?? nowIso;
    }
  }

  store.activity.unshift({
    id: crypto.randomUUID(),
    project_id: projectId,
    actor_id: actorId,
    event_type: "phase.changed",
    payload: {
      from: fromPhase ?? fromStatus,
      to: toColumn,
      from_status: fromStatus,
      to_status: project.status,
    },
    created_at: nowIso,
  });

  return project;
}
