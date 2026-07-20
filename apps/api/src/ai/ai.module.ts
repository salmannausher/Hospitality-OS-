import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';
import { GatewayService } from './gateway.service';
import { PromptsService } from './prompts.service';
import { RetrievalService } from './retrieval.service';

/**
 * The AI pipeline (Architecture §7 / API §4 `ai/`): every model call, retrieval,
 * scoring, and the chat orchestration that composes them. PrismaService comes
 * from the global PrismaModule.
 */
@Module({
  providers: [
    EmbeddingsService,
    GatewayService,
    PromptsService,
    RetrievalService,
    ChatService,
  ],
  // GatewayService + EmbeddingsService are also consumed by the knowledge
  // ingestion pipeline (KnowledgeModule).
  exports: [ChatService, GatewayService, EmbeddingsService],
})
export class AiModule {}
