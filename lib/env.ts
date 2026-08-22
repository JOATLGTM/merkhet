function firstDefined(
  ...pairs: Array<[string, string | undefined]>
): { name: string; value: string } | null {
  for (const [name, value] of pairs) {
    if (value) return { name, value };
  }
  return null;
}

export const env = {
  get supabaseUrl() {
    const found = firstDefined(
      [
        "NEXT_PUBLIC_SUPABASE_MERKET_URL",
        process.env.NEXT_PUBLIC_SUPABASE_MERKET_URL,
      ],
      ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    );
    if (!found) {
      throw new Error(
        "Missing environment variable: NEXT_PUBLIC_SUPABASE_MERKET_URL",
      );
    }
    return found.value;
  },
  get supabaseAnonKey() {
    const found = firstDefined(
      [
        "NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY,
      ],
      [
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ],
    );
    if (!found) {
      throw new Error(
        "Missing environment variable: NEXT_PUBLIC_SUPABASE_MERKET_ANON_KEY",
      );
    }
    return found.value;
  },
  /**
   * Absolute origin the invite email links back to. Supabase builds the
   * confirmation URL server-side, so it cannot infer the host from a request —
   * it has to be told. Must also be listed under Auth → URL Configuration →
   * Redirect URLs in the Supabase dashboard, or the link is rejected: an
   * unlisted target does not error, Supabase quietly substitutes its own
   * **Site URL**, so a stale Site URL silently overrides everything here.
   *
   * `NEXT_PUBLIC_SITE_URL` wins when set. The Vercel fallbacks exist because
   * forgetting it is not a loud failure — it mails links to `localhost` that
   * nobody but the developer can open. Both are injected by Vercel itself
   * (System Environment Variables), never read off the request, so a spoofed
   * `Host` header cannot redirect an auth link at an attacker's origin:
   *
   * - `VERCEL_PROJECT_PRODUCTION_URL` — the project's production domain
   *   (`merkhetdrafting.com`), identical on preview and production builds.
   * - `VERCEL_URL` — this deployment's own hostname; only reached on a
   *   preview, and only if the production domain is somehow absent.
   */
  get siteUrl() {
    const found = firstDefined(
      ["NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL],
      [
        "VERCEL_PROJECT_PRODUCTION_URL",
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ],
      ["VERCEL_URL", process.env.VERCEL_URL],
    );
    // The Vercel vars are bare hostnames — no scheme — and always https.
    const raw = found?.value ?? "http://localhost:3000";
    const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/+$/, "");
  },
  /**
   * True when auth links would point somewhere only this machine can reach.
   * Correct in dev; in a deployed build it means the invite and reset emails
   * are dead on arrival. See `appUrlIsLocal` in `lib/email/tokens.ts` for the
   * same idea applied to internal mail.
   */
  get siteUrlIsLocal() {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(env.siteUrl);
  },
  /** Optional until seeding / admin invite needs it. */
  get supabaseServiceRoleKey() {
    return (
      process.env.SUPABASE_SERVICE_MERKET_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      null
    );
  },
};
