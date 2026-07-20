import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  SupabaseAuthService,
  type SupabaseUser,
} from './supabase-auth.service';

/** Augmented by SupabaseAuthGuard on every guarded request. */
export interface AuthenticatedRequest extends Request {
  supabaseUser: SupabaseUser;
}

/**
 * Applied to every `/v1/admin/*` route (API §3.1: "All routes require
 * Authorization: Bearer <jwt>"). Extracts the bearer token, verifies it against
 * Supabase, and attaches the resulting user to the request — never trusts a
 * client-supplied user id.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuth: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token)
      throw new UnauthorizedException('Missing Authorization: Bearer <jwt>.');

    const user = await this.supabaseAuth.verify(token);
    if (!user) throw new UnauthorizedException('Invalid or expired token.');

    req.supabaseUser = user;
    return true;
  }
}
