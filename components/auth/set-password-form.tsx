"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { authFieldLabel, authSubmitButton } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

/** Supabase error strings arrive unpunctuated; these read mid-paragraph. */
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

type Status =
  | { kind: "checking" }
  | { kind: "ready"; email: string }
  | { kind: "invalid"; reason?: string };

export type SetPasswordCopy = {
  /** Heading once the link checks out. */
  title: string;
  /** Heading when there is no usable session. */
  expiredTitle: string;
  /** Follows the reason on the expired screen. */
  expiredHelp: string;
  submitLabel: string;
};

/**
 * Shared by the invite and password-reset screens: both land here holding a
 * one-time link, and both do the same two things — turn that link into a
 * session, then set a password on it. Only the wording differs.
 */
export function SetPasswordForm({ copy }: { copy: SetPasswordCopy }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Two ways in. /auth/confirm may have already exchanged a `token_hash` and
   * set the cookie — then there is simply a session. Otherwise Supabase's stock
   * email sends the tokens in a URL fragment, and we install them by hand:
   * `createBrowserClient` pins `flowType: "pkce"` (after the options spread, so
   * it cannot be overridden), and auth-js rejects a fragment callback under
   * PKCE as "Not a valid PKCE flow url". It returns that error rather than
   * throwing and leaves the fragment alone, so reading it here is safe.
   * `setSession` writes through the same cookie storage, so the server sees the
   * session on the next request.
   */
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const fromSession = (session: { user: { email?: string } } | null): Status =>
      session?.user.email
        ? { kind: "ready", email: session.user.email }
        : { kind: "invalid" };

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const hashError = hash.get("error_description") ?? hash.get("error");

    // Strip the tokens from the address bar either way — they should not sit
    // in history or leak through a copied URL.
    if (window.location.hash.length > 1) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Every branch resolves through a promise so the state update lands in a
    // microtask rather than synchronously inside the effect body.
    const resolveStatus = async (): Promise<Status> => {
      if (hashError) return { kind: "invalid", reason: hashError };

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          return { kind: "invalid", reason: sessionError.message };
        }
        return fromSession(data.session);
      }

      const { data } = await supabase.auth.getSession();
      return fromSession(data.session);
    };

    resolveStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // The shell reads the session server-side, so the new cookie has to be
      // picked up by a fresh render, not just a client-side push.
      router.replace("/");
      router.refresh();
    });
  };

  if (status.kind === "checking") {
    return <p className="text-[13px] text-ink-mid">Checking your link…</p>;
  }

  if (status.kind === "invalid") {
    return (
      <>
        <h1 className="text-[20px] text-ink">{copy.expiredTitle}</h1>
        <p className="mt-2 text-[13px] text-ink-mid">
          {sentence(
            status.reason ?? "This link has already been used or has run out",
          )}{" "}
          {copy.expiredHelp}
        </p>
        <Button
          onClick={() => router.replace("/login")}
          className={`mt-8 w-full ${authSubmitButton}`}
        >
          Back to sign in
        </Button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[20px] text-ink">{copy.title}</h1>
      <p className="mt-2 text-[13px] text-ink-mid">
        For <span className="font-mono text-ink">{status.email}</span>
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
        <div className="space-y-2">
          <Label htmlFor="password" className={authFieldLabel}>
            New password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-[2px] border-rule"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className={authFieldLabel}>
            Confirm password
          </Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-[2px] border-rule"
          />
        </div>
        {error && (
          <p className="text-[13px] text-redline" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className={authSubmitButton}>
          {pending ? "Saving…" : copy.submitLabel}
        </Button>
      </form>
    </>
  );
}
