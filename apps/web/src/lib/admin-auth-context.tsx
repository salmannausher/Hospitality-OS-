"use client";

// Admin session/user state — React Context, per Engineering Conventions §4
// ("Session/user state → React Context... small, infrequently-changing,
// genuinely global"). Wraps the Supabase browser session AND the app-level
// membership data from GET /v1/admin/session (API §3.1) — both belong in this
// same global bucket, neither is per-screen server data.
//
// State is derived rather than synced where possible (session is `undefined`
// until the initial check resolves, `null` once resolved-signed-out) —
// setState only happens inside callbacks (promise .then/.catch, the Supabase
// subscription), never as a bare statement in an effect body.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getAdminSession, type AdminSessionResponse } from "@hospitality/sdk";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "./supabase-client";

interface AdminAuthState {
  loading: boolean;
  session: Session | null;
  sessionData: AdminSessionResponse | null;
  sessionError: string | null;
  /** Non-null when NEXT_PUBLIC_SUPABASE_* env vars are missing — login cannot work. */
  configError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  // Computed once at mount, during render — not inside an effect.
  const [configError] = useState<string | null>(() => getSupabaseConfigError());

  // undefined = not yet checked; null = checked, signed out; Session = signed in.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sessionData, setSessionData] = useState<AdminSessionResponse | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // Derived, not tracked: true exactly while a session exists but its
  // membership data hasn't resolved (success or error) yet.
  const sessionDataLoading = !!session && !sessionData && !sessionError;

  useEffect(() => {
    if (configError) return; // nothing to check — session stays "unresolved" forever, but loading is derived off configError too (see below)

    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (!newSession) {
          setSessionData(null);
          setSessionError(null);
        }
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, [configError]);

  useEffect(() => {
    if (!session) return; // no session (yet, or signed out) — nothing to fetch
    let cancelled = false;
    getAdminSession(session.access_token)
      .then((data) => {
        if (cancelled) return;
        setSessionData(data);
        setSessionError(null);
      })
      .catch((err) => {
        if (!cancelled) setSessionError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut(): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSession(null);
    setSessionData(null);
    setSessionError(null);
  }

  const loading = !configError && (session === undefined || sessionDataLoading);

  return (
    <AdminAuthContext.Provider
      value={{
        loading,
        session: session ?? null,
        sessionData,
        sessionError,
        configError,
        signIn,
        signOut,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
