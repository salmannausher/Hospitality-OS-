import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { SessionController } from './session.controller';
import { HotelScopeGuard } from './hotel-scope.guard';
import { AdminKnowledgeController } from './knowledge/admin-knowledge.controller';

/** Admin API surface (API §3) — session/hotels/knowledge/etc. modules land here as they're built. */
@Module({
  imports: [AuthModule, KnowledgeModule],
  controllers: [SessionController, AdminKnowledgeController],
  providers: [HotelScopeGuard],
})
export class AdminModule {}
