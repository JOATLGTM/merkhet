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
  review: {
    customerLabel: "Review",
    customerVisible: false,
    token: "phase-3" as const,
    sortOrder: 3,
  },
  construction_documents: {
    customerLabel: "Construction Documents",
    customerVisible: true,
    token: "phase-4" as const,
    sortOrder: 4,
  },
  final_review: {
    customerLabel: "Final Review",
    customerVisible: false,
    token: "phase-5" as const,
    sortOrder: 5,
  },
  permitting: {
    customerLabel: "Permitting",
    customerVisible: true,
    token: "phase-6" as const,
    sortOrder: 6,
  },
} satisfies Record<
  DesignPhase,
  {
    customerLabel: string;
    customerVisible: boolean;
    token: `phase-${1 | 2 | 3 | 4 | 5 | 6}`;
    sortOrder: number;
  }
>;

export const PHASE_TOKEN_CLASS: Record<DesignPhase, string> = {
  schematic_design: "bg-phase-1",
  design_development: "bg-phase-2",
  review: "bg-phase-3",
  construction_documents: "bg-phase-4",
  final_review: "bg-phase-5",
  permitting: "bg-phase-6",
};

export const PHASE_BORDER_CLASS: Record<DesignPhase, string> = {
  schematic_design: "border-t-phase-1",
  design_development: "border-t-phase-2",
  review: "border-t-phase-3",
  construction_documents: "border-t-phase-4",
  final_review: "border-t-phase-5",
  permitting: "border-t-phase-6",
};

export function columnTopBorder(column: BoardColumn): string {
  if (column === "pending" || column === "active") {
    return "border-t-rule-strong";
  }
  return PHASE_BORDER_CLASS[column];
}
