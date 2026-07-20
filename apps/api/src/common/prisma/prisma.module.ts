import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every feature module (ai, conversations, hotels, ...) injects the
 * single runtime PrismaService without re-importing it — there is exactly one
 * runtime connection pool, and one correct way to scope tenant access
 * (PrismaService.withTenant).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
