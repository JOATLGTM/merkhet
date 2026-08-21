"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";

import { signIn, type SignInState } from "@/app/actions/auth";
import {
  AuthShell,
  authFieldLabel,
  authSubmitButton,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = null;

/** Set by /auth/confirm when an emailed link cannot be exchanged. */
const LINK_ERRORS: Record<string, string> = {
  invalid_link: "That link is not valid. Request a new one.",
  expired_link: "That link has expired or was already used. Request a new one.",
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
    <AuthShell>
      <h1 className="text-[20px] text-ink">Sign in</h1>
      <p className="mt-2 text-[13px] text-ink-mid">
        Internal project record. Accounts are created by invite only.
      </p>

      <Suspense fallback={null}>
        <LinkError />
      </Suspense>

      <form action={action} className="mt-8 flex flex-col gap-5">
        <div className="space-y-2">
          <Label htmlFor="email" className={authFieldLabel}>
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
          <Label htmlFor="password" className={authFieldLabel}>
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
        <Button type="submit" disabled={pending} className={authSubmitButton}>
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>

      <Link
        href="/forgot-password"
        className="mt-6 block text-center text-[13px] text-ink-mid underline underline-offset-4 hover:text-ink"
      >
        Forgot your password?
      </Link>
    </AuthShell>
  );
}
