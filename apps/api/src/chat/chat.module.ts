import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatController } from './chat.controller';

/** Guest Chat API surface (API §2) over the AI pipeline. */
@Module({
  imports: [AiModule],
  controllers: [ChatController],
})
export class ChatModule {}
