import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [PrismaModule, AiModule, ChatModule, KnowledgeModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
