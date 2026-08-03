import { Module, type Provider } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChunkerService } from './chunker.service';
import { IngestionService } from './ingestion.service';
import { IngestionTickController } from './ingestion-tick.controller';
import { ParserService } from './parser.service';
import { UrlFetcherService } from './url-fetcher.service';
import { INGESTION_QUEUE } from './queue/ingestion-queue';
import { InProcessIngestionQueue } from './queue/in-process-queue';
import { BullMqIngestionQueue } from './queue/bullmq-ingestion-queue';
import { INGESTION_TICK_RUNNER } from './queue/ingestion-tick-runner';
import { NoOpTickRunner } from './queue/no-op-tick-runner';
import { DOCUMENT_STORAGE } from './storage/document-storage';
import { LocalDocumentStorage } from './storage/local-document-storage';
import { SupabaseDocumentStorage } from './storage/supabase-document-storage';

/**
 * Knowledge ingestion (API §4 `knowledge/`, Architecture §5). The queue and
 * storage adapters are chosen here, once, from environment presence
 * (findings-log.md #41): `UPSTASH_REDIS_URL` set → durable BullMQ queue,
 * `SUPABASE_STORAGE_BUCKET` set → Supabase Storage; otherwise the
 * non-durable local/in-process dev adapters. In production, missing either
 * var is a boot-time failure rather than a silent fallback — the original
 * gap (findings-log.md #41) was exactly this: nothing ever caught a
 * production deploy quietly running on dev adapters.
 */
const useBullMq = Boolean(process.env.UPSTASH_REDIS_URL);
const useSupabaseStorage = Boolean(process.env.SUPABASE_STORAGE_BUCKET);

if (process.env.NODE_ENV === 'production') {
  if (!useBullMq) {
    throw new Error(
      'UPSTASH_REDIS_URL is required in production — refusing to fall back to the non-durable in-process ingestion queue (findings-log.md #41/#40).',
    );
  }
  if (!useSupabaseStorage) {
    throw new Error(
      'SUPABASE_STORAGE_BUCKET is required in production — refusing to fall back to local-filesystem document storage (findings-log.md #41).',
    );
  }
}

const queueProviders: Provider[] = useBullMq
  ? [
      { provide: INGESTION_QUEUE, useClass: BullMqIngestionQueue },
      { provide: INGESTION_TICK_RUNNER, useExisting: INGESTION_QUEUE },
    ]
  : [
      { provide: INGESTION_QUEUE, useClass: InProcessIngestionQueue },
      { provide: INGESTION_TICK_RUNNER, useClass: NoOpTickRunner },
    ];

const storageProvider: Provider = {
  provide: DOCUMENT_STORAGE,
  useClass: useSupabaseStorage ? SupabaseDocumentStorage : LocalDocumentStorage,
};

@Module({
  imports: [AiModule],
  controllers: [IngestionTickController],
  providers: [
    ParserService,
    ChunkerService,
    UrlFetcherService,
    IngestionService,
    ...queueProviders,
    storageProvider,
  ],
  exports: [IngestionService],
})
export class KnowledgeModule {}
