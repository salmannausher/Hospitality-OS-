import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/supabase-auth.guard';
import { authorizeHotelAccess } from './authorize-hotel-access';
import { REQUIRED_ROLES_KEY } from './require-role.decorator';

/** Augmented by HotelScopeGuard — the hotelId every tenant-scoped admin call
 * runs against, already validated against the caller's memberships, plus the
 * caller's effective `Role` for it (findings-log.md #22). */
export interface HotelScopedRequest extends AuthenticatedRequest {
  hotelId: string;
  role: Role;
}

/**
 * Resolves and authorizes the hotel a `/v1/admin/*` request operates on (API
 * §1: "Admin API: JWT → memberships → allowed hotel(s); multi-hotel admins
 * pass `hotelId` as a query param, validated against membership"). Tenant
 * resolution is never client-supplied trust — a `hotelId` query param is only
 * ever a claim, checked here against `resolveMemberHotels` before anything
 * downstream treats it as authoritative.
 *
 * Must run after SupabaseAuthGuard (`@UseGuards(SupabaseAuthGuard,
 * HotelScopeGuard)`) — it reads `req.supabaseUser`, which that guard attaches.
 * Shared across every admin route that touches hotel-scoped data (knowledge,
 * entities, relationships, ...), not re-implemented per controller.
 *
 * Also resolves and attaches the caller's effective `Role` for the hotel
 * (`req.role`, via `resolveHotelRole` — findings-log.md #22), and enforces
 * the one blanket role rule that's actually documented (Sprint 4 ticket 8,
 * API §3.1, findings-log.md #24): `VIEWER` can read but never mutate.
 * Applied here rather than per-controller so no mutating endpoint can be
 * added later without this check automatically covering it.
 *
 * Additionally enforces any route-level `@RequireRole(...)` metadata (API
 * §1's "only HOTEL_ADMIN+ touch brand/prompt/knowledge" — findings-log.md
 * #38) — resolved once here, same as the VIEWER rule, rather than
 * re-implemented per controller.
 */
@Injectable()
export class HotelScopeGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HotelScopedRequest>();
    const hotels = await this.prisma.resolveMemberHotels(req.supabaseUser.id);

    if (hotels.length === 0) {
      throw new ForbiddenException({
        error: {
          code: 'NOT_PROVISIONED',
          message: 'This account has no hotel memberships yet.',
          requestId: req.supabaseUser.id,
        },
      });
    }

    const requested = this.hotelIdParam(req);
    if (!requested) {
      if (hotels.length === 1) {
        req.hotelId = hotels[0].id;
        return this.authorizeRole(req, context);
      }
      throw new BadRequestException({
        error: {
          code: 'HOTEL_ID_REQUIRED',
          message:
            'This account has multiple hotels — pass ?hotelId= to specify which one.',
          requestId: req.supabaseUser.id,
        },
      });
    }

    if (!hotels.some((h) => h.id === requested)) {
      throw new ForbiddenException({
        error: {
          code: 'HOTEL_NOT_AUTHORIZED',
          message: 'This account has no membership on the requested hotel.',
          requestId: req.supabaseUser.id,
        },
      });
    }

    req.hotelId = requested;
    return this.authorizeRole(req, context);
  }

  /** Resolves `req.role`, enforces the one documented blanket rule (VIEWER
   * can read but never mutate, findings-log.md #24), then any route-level
   * `@RequireRole(...)` metadata (findings-log.md #38). */
  private async authorizeRole(
    req: HotelScopedRequest,
    context: ExecutionContext,
  ): Promise<boolean> {
    req.role = await authorizeHotelAccess(
      this.prisma,
      req.supabaseUser.id,
      req.hotelId,
      req.method,
    );

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length && !requiredRoles.includes(req.role)) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `This action requires one of: ${requiredRoles.join(', ')}.`,
          requestId: req.supabaseUser.id,
        },
      });
    }
    return true;
  }

  private hotelIdParam(req: Request): string | null {
    const value = req.query.hotelId;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
