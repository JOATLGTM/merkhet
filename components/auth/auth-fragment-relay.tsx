"use client";

import { useEffect } from "react";

/**
 * Where a session-bearing fragment belongs, by the `type` Supabase stamps on
 * it. Anything else — a magic link, an email change — this app does not issue,
 * so an unknown type is left alone rather than guessed at.
 */
const DESTINATION: Record<string, string> = {
  invite: "/accept-invite",
  signup: "/accept-invite",
  recovery: "/reset-password",
};

/**
 * Rescues an emailed auth link that lands on the wrong screen.
 *
 * Supabase substitutes its own **Site URL** for any `redirectTo` missing from
 * the Redirect URLs allowlist, and does it silently. The invite then arrives at
 * `/` carrying `#access_token=…&type=invite`, the proxy bounces it to
 * `/login?next=%2F` — the fragment surviving the redirect, as fragments do —
 * and the sign-in form has no idea what it is holding. The recipient is asked
 * for a password they have never set.
 *
 * The allowlist is the real fix and lives in the Supabase dashboard. This is
 * the belt: wherever the fragment lands, it gets forwarded to the screen built
 * to consume it, with the fragment intact.
 *
 * `window.location.replace`, not `router.replace`: the fragment is the entire
 * payload, a full navigation is the one way to be certain it survives, and
 * `replace` keeps the tokens out of the back button.
 */
export function AuthFragmentRelay() {
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return;

    const hash = new URLSearchParams(raw);
    const target = DESTINATION[hash.get("type") ?? ""];
    // An error fragment carries no tokens and often no usable `type`; leaving
    // it alone is better than sending someone to a set-password screen that
    // can only tell them the link is dead.
    if (!target || !hash.get("access_token")) return;
    if (window.location.pathname === target) return;

    window.location.replace(`${target}#${raw}`);
  }, []);

  return null;
}
