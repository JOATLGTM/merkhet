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
  /** Optional until seeding / admin invite needs it. */
  get supabaseServiceRoleKey() {
    return (
      process.env.SUPABASE_SERVICE_MERKET_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      null
    );
  },
};
