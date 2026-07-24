import { Module } from '@nestjs/common';
import { EscalationsModule } from '../escalations/escalations.module';
import { CardAssemblyService } from './card-assembly.service';
import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';
import { GatewayService } from './gateway.service';
import { PromptsService } from './prompts.service';
import { RetrievalService } from './retrieval.service';

/**
 * The AI pipeline (Architecture §7 / API §4 `ai/`): every model call, retrieval,
 * scoring, and the chat orchestration that composes them. PrismaService comes
 * from the global PrismaModule. EscalationsModule is imported so ChatService
 * can create the `Escalation` row an `escalation` SSE event references
 * (ABS §7) — the same `EscalationsService` ChatModule imports directly for
 * `POST /v1/chat/escalation/choose`, not a second implementation.
 */
@Module({
  imports: [EscalationsModule],
  providers: [
    CardAssemblyService,
    EmbeddingsService,
    GatewayService,
    PromptsService,
    RetrievalService,
    ChatService,
  ],
  // GatewayService + EmbeddingsService are also consumed by the knowledge
  // ingestion pipeline (KnowledgeModule). CardAssemblyService is consumed by
  // the admin Relationships module (bundle preview) and, from Sprint 3 ticket
  // 3 onward, ChatService itself (the live guest `card` SSE event) — one
  // implementation, no drift (API §3.3).
  exports: [
    ChatService,
    GatewayService,
    EmbeddingsService,
    CardAssemblyService,
  ],
})
export class AiModule {}
