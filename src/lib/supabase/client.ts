import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Single Supabase client for the whole app. No Auth is configured anywhere
 * in this project (explicit product decision — no login screen, no users) —
 * every table is reachable with just the public anon key, gated by
 * permissive RLS policies (see supabase/migrations/0001_init.sql).
 *
 * `NEXT_PUBLIC_*` env vars are safe to expose to the browser by design
 * (that's what the prefix means in Next.js) — the anon key is meant to be
 * public. Never put the service_role key in a `NEXT_PUBLIC_*` var or ship
 * it to the client.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
