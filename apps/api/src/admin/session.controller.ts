import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CurrentSupabaseUser } from '../auth/current-supabase-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { SupabaseUser } from '../auth/supabase-auth.service';

/**
 * GET /v1/admin/session (API §3.1) — what the frontend calls once after
 * Supabase Auth hands it a JWT, to know which hotel(s)/org(s) and roles it's
 * working with. `User.id` is the Supabase provider's own id (DB §1), so this is
 * a direct primary-key lookup, not an email join.
 *
 * Org/HotelMembership tables carry no RLS predicate (migration 1_rls_policies'
 * explicit exception — access here is application-layer, since an Agency
 * Admin's memberships legitimately span multiple hotels) — a plain Prisma
 * query is correct, no withTenant needed.
 */
@Controller('v1/admin')
@UseGuards(SupabaseAuthGuard)
export class SessionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('session')
  async getSession(@CurrentSupabaseUser() supabaseUser: SupabaseUser) {
    // Organization is not RLS-scoped (migration 1's explicit exception), so
    // Prisma's include works fine there. Hotel IS RLS-scoped, so it's resolved
    // separately via resolveMemberHotels — see that method's doc comment.
    const user = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
      include: {
        organizationMemberships: { include: { organization: true } },
        hotelMemberships: true,
      },
    });

    if (!user) {
      // A valid Supabase identity with no app-level grant — authenticated but
      // not authorized. Never silently invent access.
      throw new ForbiddenException({
        error: {
          code: 'NOT_PROVISIONED',
          message: 'This account has no memberships yet — contact an admin.',
          requestId: supabaseUser.id,
        },
      });
    }

    const hotels = await this.prisma.resolveMemberHotels(user.id);
    const hotelsById = new Map(hotels.map((h) => [h.id, h]));

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organizationMemberships: user.organizationMemberships.map((m) => ({
        id: m.id,
        organizationId: m.organizationId,
        role: m.role,
        organization: { id: m.organization.id, name: m.organization.name },
      })),
      hotelMemberships: user.hotelMemberships.map((m) => ({
        id: m.id,
        hotelId: m.hotelId,
        role: m.role,
        hotel: hotelsById.get(m.hotelId) ?? null,
      })),
    };
  }
}
