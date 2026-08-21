"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BackgroundPaths } from "@/components/kokonutui/background-paths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD = 8;

/** Supabase error strings arrive unpunctuated; this one is mid-paragraph. */
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

type Status =
  | { kind: "checking" }
  | { kind: "ready"; email: string }
  | { kind: "invalid"; reason?: string };

export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Two ways in. /auth/confirm may have already exchanged a `token_hash` and
   * set the cookie — then there is simply a session. Otherwise Supabase's stock
   * invite email sends the tokens in a URL fragment, and we have to install
   * them by hand: `createBrowserClient` pins `flowType: "pkce"` (after the
   * options spread, so it cannot be overridden), and auth-js rejects a fragment
   * callback under PKCE as "Not a valid PKCE flow url". It returns that error
   * rather than throwing and leaves the fragment alone, so reading it here is
   * safe. `setSession` writes through the same cookie storage, so the server
   * sees the session on the next request.
   */
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const settle = (session: { user: { email?: string } } | null) => {
      if (cancelled) return;
      const email = session?.user.email;
      setStatus(email ? { kind: "ready", email } : { kind: "invalid" });
    };

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const hashError = hash.get("error_description") ?? hash.get("error");

    // Strip the tokens from the address bar either way — they should not sit
    // in history or leak through a copied URL.
    if (window.location.hash.length > 1) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (hashError) {
      setStatus({ kind: "invalid", reason: hashError });
      return;
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            setStatus({ kind: "invalid", reason: error.message });
            return;
          }
          settle(data.session);
        });
    } else {
      supabase.auth.getSession().then(({ data }) => settle(data.session));
    }

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

        {status.kind === "checking" && (
          <p className="text-[13px] text-ink-mid">Checking your invite…</p>
        )}

        {status.kind === "invalid" && (
          <>
            <h1 className="text-[20px] text-ink">Invite link expired</h1>
            <p className="mt-2 text-[13px] text-ink-mid">
              {sentence(
                status.reason ?? "This link has already been used or has run out",
              )}{" "}
              Ask an admin to send you a new invite.
            </p>
            <Button
              onClick={() => router.replace("/login")}
              className="mt-8 h-11 w-full rounded-[3px] bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-surface hover:bg-ink/90"
            >
              Back to sign in
            </Button>
          </>
        )}

        {status.kind === "ready" && (
          <>
            <h1 className="text-[20px] text-ink">Set your password</h1>
            <p className="mt-2 text-[13px] text-ink-mid">
              Finishing setup for{" "}
              <span className="font-mono text-ink">{status.email}</span>
            </p>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
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
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-[2px] border-rule"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="confirm"
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft"
                >
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
              <Button
                type="submit"
                disabled={pending}
                className="h-11 rounded-[3px] bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-surface hover:bg-ink/90"
              >
                {pending ? "Saving…" : "Set password and continue"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
