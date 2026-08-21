"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error?: string } | null;

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ResetRequestState = { sent?: boolean; error?: string } | null;

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email address." };
  }

  /**
   * A plain client rather than the SSR one on purpose. `createServerClient`
   * pins `flowType: "pkce"`, which stashes a code verifier in the requesting
   * browser's cookies and mints a link only that browser can complete —
   * so asking for a reset on a laptop and opening the mail on a phone would
   * fail. The default implicit flow puts the tokens in the link itself, which
   * /reset-password knows how to consume.
   */
  const supabase = createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.siteUrl}/reset-password`,
  });

  // Rate limiting is worth showing; "no such user" is not — reporting it would
  // turn this form into a way to test which addresses have accounts.
  if (error && error.status === 429) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  return { sent: true };
}
