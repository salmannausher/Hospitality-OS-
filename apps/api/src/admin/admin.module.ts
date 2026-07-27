import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LeadsModule } from '../leads/leads.module';
import { SessionController } from './session.controller';
import { HotelScopeGuard } from './hotel-scope.guard';
import { AdminKnowledgeController } from './knowledge/admin-knowledge.controller';
import { AdminEntitiesController } from './entities/entities.controller';
import { EntitiesService } from './entities/entities.service';
import { AdminRelationshipsController } from './relationships/relationships.controller';
import { RelationshipsService } from './relationships/relationships.service';
import { AdminAnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AdminConversationsController } from './conversations/conversations.controller';
import { ConversationsService } from './conversations/conversations.service';
import { AdminLeadsController } from './leads/leads.controller';

/** Admin API surface (API §3) — session/hotels/knowledge/etc. modules land here as they're built. */
@Module({
  imports: [AuthModule, KnowledgeModule, AiModule, LeadsModule],
  controllers: [
    SessionController,
    AdminKnowledgeController,
    AdminEntitiesController,
    AdminRelationshipsController,
    AdminAnalyticsController,
    AdminConversationsController,
    AdminLeadsController,
  ],
  providers: [
    HotelScopeGuard,
    EntitiesService,
    RelationshipsService,
    AnalyticsService,
    ConversationsService,
  ],
})
export class AdminModule {}
