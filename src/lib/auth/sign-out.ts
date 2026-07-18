import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Local sign-out: ends session only on this browser / device.
 * Other devices keep their sessions.
 *
 * Use scope "global" only for explicit "all devices" security action.
 */
export async function signOutThisDevice(supabase: SupabaseClient) {
  return supabase.auth.signOut({ scope: "local" });
}

/** Invalidate every refresh token for this user (all devices). */
export async function signOutEverywhere(supabase: SupabaseClient) {
  return supabase.auth.signOut({ scope: "global" });
}
