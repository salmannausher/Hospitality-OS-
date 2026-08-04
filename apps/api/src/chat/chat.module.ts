import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { LeadsModule } from '../leads/leads.module';
import { ChatController } from './chat.controller';
import { RateLimiterService } from './rate-limiter.service';

/** Guest Chat API surface (API §2) over the AI pipeline. */
@Module({
  imports: [AiModule, LeadsModule, EscalationsModule],
  controllers: [ChatController],
  providers: [RateLimiterService],
})
export class ChatModule {}
