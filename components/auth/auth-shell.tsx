import { BackgroundPaths } from "@/components/kokonutui/background-paths";

/** The bordered card every signed-out screen sits in. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-paper px-6">
      <BackgroundPaths />
      <div className="relative z-10 w-full max-w-sm border border-rule bg-surface p-8 shadow-[0_1px_24px_rgba(22,24,26,0.06)]">
        <div className="mb-8 flex items-center gap-2">
          <span className="size-2 bg-ink" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.32em] text-ink">
            Merkhet
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

export const authFieldLabel =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft";

export const authSubmitButton =
  "h-11 rounded-[3px] bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-surface hover:bg-ink/90";
