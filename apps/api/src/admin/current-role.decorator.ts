import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { HotelScopedRequest } from './hotel-scope.guard';

/** `@CurrentRole()` — the caller's effective Role for the hotel, attached by
 * HotelScopeGuard (findings-log.md #22). */
export const CurrentRole = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<HotelScopedRequest>();
    return req.role;
  },
);
