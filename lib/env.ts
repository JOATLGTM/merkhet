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
   * Redirect URLs in the Supabase dashboard, or the link is rejected.
   */
  get siteUrl() {
    const raw = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return raw.replace(/\/+$/, "");
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
