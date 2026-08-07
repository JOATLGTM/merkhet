import type { BoardColumn, DesignPhase } from "@/lib/types";

export const PHASE_PRESENTATION = {
  schematic_design: {
    customerLabel: "Schematic Design",
    customerVisible: true,
    token: "phase-1" as const,
    sortOrder: 1,
  },
  design_development: {
    customerLabel: "Design Development",
    customerVisible: true,
    token: "phase-2" as const,
    sortOrder: 2,
  },
  construction_documents: {
    customerLabel: "Construction Documents",
    customerVisible: true,
    token: "phase-3" as const,
    sortOrder: 3,
  },
  review: {
    customerLabel: "Internal Review",
    customerVisible: false,
    token: "phase-4" as const,
    sortOrder: 4,
  },
  permitting: {
    customerLabel: "Permitting",
    customerVisible: true,
    token: "phase-5" as const,
    sortOrder: 5,
  },
} satisfies Record<
  DesignPhase,
  {
    customerLabel: string;
    customerVisible: boolean;
    token: `phase-${1 | 2 | 3 | 4 | 5}`;
    sortOrder: number;
  }
>;

export const PHASE_TOKEN_CLASS: Record<DesignPhase, string> = {
  schematic_design: "bg-phase-1",
  design_development: "bg-phase-2",
  construction_documents: "bg-phase-3",
  review: "bg-phase-4",
  permitting: "bg-phase-5",
};

export const PHASE_BORDER_CLASS: Record<DesignPhase, string> = {
  schematic_design: "border-t-phase-1",
  design_development: "border-t-phase-2",
  construction_documents: "border-t-phase-3",
  review: "border-t-phase-4",
  permitting: "border-t-phase-5",
};

export function columnTopBorder(column: BoardColumn): string {
  if (column === "backlog" || column === "pending" || column === "completed") {
    return "border-t-rule-strong";
  }
  return PHASE_BORDER_CLASS[column];
}
