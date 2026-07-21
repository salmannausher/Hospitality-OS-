import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/supabase-auth.guard';

/** Augmented by HotelScopeGuard — the hotelId every tenant-scoped admin call
 * runs against, already validated against the caller's memberships. */
export interface HotelScopedRequest extends AuthenticatedRequest {
  hotelId: string;
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
 */
@Injectable()
export class HotelScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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
        return true;
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
    return true;
  }

  private hotelIdParam(req: Request): string | null {
    const value = req.query.hotelId;
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
