import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

/**
 * Route-level role requirement on top of `HotelScopeGuard`'s one blanket rule
 * (VIEWER never mutates, findings-log.md #24). API §1 names one further,
 * specific rule — "only HOTEL_ADMIN+ touch brand/prompt/knowledge"
 * (findings-log.md #38) — which this decorator lets a controller opt into
 * without re-implementing role resolution per route.
 *
 * `@RequireRole('HOTEL_ADMIN', 'AGENCY_ADMIN', 'SUPER_ADMIN')` on a handler;
 * `HotelScopeGuard` reads this metadata and enforces it after resolving
 * `req.role`.
 */
export const RequireRole = (...roles: Role[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
