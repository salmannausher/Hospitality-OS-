import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChunkerService } from './chunker.service';
import { IngestionService } from './ingestion.service';
import { ParserService } from './parser.service';
import { UrlFetcherService } from './url-fetcher.service';
import { INGESTION_QUEUE } from './queue/ingestion-queue';
import { InProcessIngestionQueue } from './queue/in-process-queue';
import { DOCUMENT_STORAGE } from './storage/document-storage';
import { LocalDocumentStorage } from './storage/local-document-storage';

/**
 * Knowledge ingestion (API §4 `knowledge/`, Architecture §5). The queue and
 * storage are bound to their dev adapters here — swap to BullMQ+Upstash and
 * Supabase Storage by changing only these two `useClass` bindings.
 */
@Module({
  imports: [AiModule],
  providers: [
    ParserService,
    ChunkerService,
    UrlFetcherService,
    IngestionService,
    { provide: INGESTION_QUEUE, useClass: InProcessIngestionQueue },
    { provide: DOCUMENT_STORAGE, useClass: LocalDocumentStorage },
  ],
  exports: [IngestionService],
})
export class KnowledgeModule {}
