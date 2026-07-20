import { Injectable, Logger } from '@nestjs/common';
import type {
  IngestionHandler,
  IngestionJobPayload,
  IngestionQueue,
} from './ingestion-queue';

/**
 * In-process ingestion queue — runs each job on the next tick, in the same
 * process. Genuinely async (doesn't block the enqueuer) and correct for a
 * single pilot hotel; it is NOT durable across restarts. The BullMQ + Upstash
 * adapter (durable, horizontally scalable — Architecture §8) implements the
 * same interface and swaps in once a TCP Redis URL is available.
 */
@Injectable()
export class InProcessIngestionQueue implements IngestionQueue {
  private readonly logger = new Logger(InProcessIngestionQueue.name);
  private handler: IngestionHandler | null = null;

  process(handler: IngestionHandler): void {
    this.handler = handler;
  }

  enqueue(payload: IngestionJobPayload): Promise<void> {
    if (!this.handler) {
      throw new Error('No ingestion handler registered.');
    }
    const handler = this.handler;
    setImmediate(() => {
      handler(payload).catch((err) =>
        this.logger.error(
          `Ingestion job for document ${payload.documentId} failed: ${String(
            (err as Error)?.message ?? err,
          )}`,
        ),
      );
    });
    return Promise.resolve();
  }
}
