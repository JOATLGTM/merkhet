import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for the links Supabase mails out (invite, recovery, email
 * change). The email template must send `token_hash` + `type` here rather than
 * using the stock `{{ .ConfirmationURL }}`: that one hands the session back in
 * a URL fragment, which never reaches the server, so the cookie the rest of
 * the app reads would never be written. See README → Inviting people.
 *
 * Exchanging the token sets the auth cookie, then we forward to `next` — for
 * invites, /accept-invite, where they choose a password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Only same-origin paths — `next` comes off the URL, so an absolute value
  // would make this an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!token_hash || !type) {
    redirect("/login?error=invalid_link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    redirect("/login?error=expired_link");
  }

  redirect(safeNext);
}
