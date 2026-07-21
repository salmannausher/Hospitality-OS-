import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { HotelScopedRequest } from './hotel-scope.guard';

/** `@CurrentHotelId()` — the authorized hotelId attached by HotelScopeGuard. */
export const CurrentHotelId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<HotelScopedRequest>();
    return req.hotelId;
  },
);
