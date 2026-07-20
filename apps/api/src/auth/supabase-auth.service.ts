import { Injectable, Logger } from '@nestjs/common';

export interface SupabaseUser {
  id: string;
  email: string;
}

/**
 * Verifies a Supabase-issued JWT server-side (API §3.1: "our API's only role is
 * validating that JWT"). No custom credential handling, no JWT secret needed —
 * this calls Supabase's own /auth/v1/user endpoint, which validates the token
 * against the auth server and returns the user it belongs to.
 *
 * The `apikey` header just identifies the project; either the anon or the
 * service-role key works for this specific endpoint (verified directly against
 * live Supabase) — using the service key here is fine since it never leaves
 * the server process. Never send the service key to a client.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);

  private get baseUrl(): string {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('SUPABASE_URL is not set.');
    return url;
  }

  private get serviceKey(): string {
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_KEY is not set.');
    return key;
  }

  /** Returns the authenticated user, or null if the token is missing/invalid/expired. */
  async verify(accessToken: string): Promise<SupabaseUser | null> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: this.serviceKey,
        },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { id?: string; email?: string };
      if (!body.id || !body.email) return null;
      return { id: body.id, email: body.email };
    } catch (err) {
      this.logger.warn(
        `Supabase token verification failed: ${String((err as Error)?.message ?? err)}`,
      );
      return null;
    }
  }
}
