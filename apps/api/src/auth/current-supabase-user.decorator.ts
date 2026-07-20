import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './supabase-auth.guard';

/** `@CurrentSupabaseUser()` — the verified user attached by SupabaseAuthGuard. */
export const CurrentSupabaseUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.supabaseUser;
  },
);
