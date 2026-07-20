"use client";

// Browser Supabase client for the admin portal (API §3.1: the frontend
// authenticates directly against Supabase — no custom /auth/login endpoint).
// Only ever uses the public anon/publishable key — the secret key stays
// server-side in apps/api and must never reach this file.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const CONFIG_ERROR_MESSAGE =
  "Admin login is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) " +
  "in apps/web/.env.local — Project Settings → API in the Supabase dashboard. " +
  "This must be the anon/publishable key, never the secret key.";

/**
 * Pure check — no client construction, safe to call during render (e.g. a
 * useState lazy initializer) rather than inside an effect.
 */
export function getSupabaseConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase's dashboard has used both names across versions ("anon key" and,
  // more recently, "publishable key") for the same safe-for-browser credential.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && anonKey ? null : CONFIG_ERROR_MESSAGE;
}

/**
 * Lazily creates the browser client. Throws with an actionable message if the
 * public key is missing rather than failing silently — callers should check
 * getSupabaseConfigError() first and avoid calling this at all in that case.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error(CONFIG_ERROR_MESSAGE);

  client = createClient(url, anonKey);
  return client;
}
