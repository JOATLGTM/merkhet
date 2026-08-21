"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { signIn, type SignInState } from "@/app/actions/auth";
import { BackgroundPaths } from "@/components/kokonutui/background-paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = null;

/** Set by /auth/confirm when an emailed link cannot be exchanged. */
const LINK_ERRORS: Record<string, string> = {
  invalid_link: "That link is not a valid invite. Ask an admin to resend it.",
  expired_link:
    "That invite link has expired or was already used. Ask an admin to resend it.",
};

/**
 * Its own component behind Suspense: `useSearchParams` opts whatever reads it
 * out of the prerender, and with cacheComponents on that would take the whole
 * sign-in form with it.
 */
function LinkError() {
  const message = LINK_ERRORS[useSearchParams().get("error") ?? ""];
  if (!message) return null;
  return (
    <p
      className="mt-4 border border-redline/40 bg-redline/5 px-3 py-2 text-[13px] text-redline"
      role="alert"
    >
      {message}
    </p>
  );
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, initialState);

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
        <h1 className="text-[20px] text-ink">Sign in</h1>
        <p className="mt-2 text-[13px] text-ink-mid">
          Internal project record. Accounts are created by invite only.
        </p>

        <Suspense fallback={null}>
          <LinkError />
        </Suspense>

        <form action={action} className="mt-8 flex flex-col gap-5">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
            >
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-[2px] border-rule"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
            >
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-[2px] border-rule"
            />
          </div>
          {state?.error && (
            <p className="text-[13px] text-redline" role="alert">
              {state.error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="h-11 rounded-[3px] bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-surface hover:bg-ink/90"
          >
            {pending ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </div>
    </main>
  );
}
