"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestPasswordReset,
  type ResetRequestState,
} from "@/app/actions/auth";
import {
  AuthShell,
  authFieldLabel,
  authSubmitButton,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ResetRequestState = null;

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state?.sent) {
    return (
      <AuthShell>
        <h1 className="text-[20px] text-ink">Check your email</h1>
        <p className="mt-2 text-[13px] text-ink-mid">
          If that address has an account, a reset link is on its way. It can
          only be used once and expires in an hour.
        </p>
        <Link
          href="/login"
          className={`mt-8 flex items-center justify-center ${authSubmitButton}`}
        >
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-[20px] text-ink">Reset your password</h1>
      <p className="mt-2 text-[13px] text-ink-mid">
        We will email you a link to choose a new one.
      </p>

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
        {state?.error && (
          <p className="text-[13px] text-redline" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className={authSubmitButton}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 block text-center text-[13px] text-ink-mid underline underline-offset-4 hover:text-ink"
      >
        Back to sign in
      </Link>
    </AuthShell>
  );
}
