import { ForbiddenException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { PrismaService } from '../common/prisma/prisma.service';

/** HTTP methods treated as a mutation for role-gating purposes. */
export const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Resolves a caller's effective `Role` for one hotel and enforces the one
 * blanket role rule that's actually documented (findings-log.md #24):
 * `VIEWER` can read but never mutate. Shared by `HotelScopeGuard` (every
 * `?hotelId=`-scoped admin route) and `HotelsService` (whose resource id
 * IS the hotel, via a path param rather than a query param) so this check
 * lives once rather than being re-typed per call site.
 */
export async function authorizeHotelAccess(
  prisma: PrismaService,
  userId: string,
  hotelId: string,
  method: string,
): Promise<Role> {
  const role = await prisma.resolveHotelRole(userId, hotelId);
  if (!role) {
    throw new ForbiddenException({
      error: {
        code: 'HOTEL_NOT_AUTHORIZED',
        message: 'This account has no membership on the requested hotel.',
        requestId: userId,
      },
    });
  }

  if (role === 'VIEWER' && MUTATING_METHODS.has(method)) {
    throw new ForbiddenException({
      error: {
        code: 'FORBIDDEN_ROLE',
        message: 'Viewers cannot make changes.',
        requestId: userId,
      },
    });
  }
  return role as Role;
}
