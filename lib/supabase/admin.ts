import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { env } from "@/lib/env";

/**
 * Service-role / secret client. Server-only — bypasses RLS.
 * Used for seed scripts and admin invite. Do not import from client components.
 */
export function createServiceClient() {
  const key = env.supabaseServiceRoleKey;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (service_role JWT or sb_secret_…).",
    );
  }
  return createClient(env.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: WebSocket as unknown as typeof globalThis.WebSocket,
    },
  });
}
