import { cn } from "@/lib/utils";
import { DESIGN_PHASES, type DesignPhase } from "@/lib/types";
import { PHASE_TOKEN_CLASS } from "@/lib/phases";

type PhaseRuleProps = {
  currentPhase: DesignPhase | null;
  className?: string;
  /** When true, fill through current phase; when status is backlog/pending, fill none */
  filledThrough?: number;
};

export function PhaseRule({
  currentPhase,
  className,
  filledThrough,
}: PhaseRuleProps) {
  const currentIndex =
    filledThrough != null
      ? filledThrough
      : currentPhase
        ? DESIGN_PHASES.indexOf(currentPhase)
        : -1;

  return (
    <div
      className={cn("flex gap-[2px]", className)}
      aria-label={
        currentIndex >= 0
          ? `Phase ${currentIndex + 1} of ${DESIGN_PHASES.length}`
          : "No active phase"
      }
    >
      {DESIGN_PHASES.map((phase, index) => {
        const filled = index <= currentIndex;
        return (
          <span
            key={phase}
            className={cn(
              "h-[3px] flex-1",
              filled
                ? cn(PHASE_TOKEN_CLASS[phase], "opacity-75")
                : "bg-rule",
            )}
          />
        );
      })}
    </div>
  );
}
