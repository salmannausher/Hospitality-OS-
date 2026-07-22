import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { LeadsModule } from '../leads/leads.module';
import { ChatController } from './chat.controller';

/** Guest Chat API surface (API §2) over the AI pipeline. */
@Module({
  imports: [AiModule, LeadsModule],
  controllers: [ChatController],
})
export class ChatModule {}
