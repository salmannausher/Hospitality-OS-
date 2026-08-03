import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import type {
  IngestionHandler,
  IngestionJobPayload,
  IngestionQueue,
} from './ingestion-queue';
import type {
  IngestionTickResult,
  IngestionTickRunner,
} from './ingestion-tick-runner';

const QUEUE_NAME = 'ingestion';
const MAX_ATTEMPTS = 3;
/** Stay well under a Vercel Function's execution limit — a tick is a bounded
 * sweep, not a listener. */
const TICK_MAX_DURATION_MS = 45_000;
const WORKER_CONCURRENCY = 3;

/**
 * Durable ingestion queue (findings-log.md #41) backed by Upstash Redis via
 * BullMQ — durable job storage/retries/backoff survive a process restart or
 * a job outliving the request that enqueued it, unlike `InProcessIngestionQueue`.
 *
 * The consumer side is NOT a persistent `Worker` (findings-log.md #40 — this
 * app has no long-running process for one to live in). `process()` only
 * registers the handler `IngestionService.onModuleInit()` provides; actual
 * processing happens in bounded `runTick()` calls — one fired best-effort
 * right after `enqueue()` (so the common case feels instant), and one on
 * every Vercel Cron hit (the actual durability guarantee — see
 * `IngestionTickController`). Concurrent/overlapping ticks are safe: BullMQ's
 * own per-job locking prevents two `Worker`s from double-processing the same
 * job, so the post-enqueue tick and a cron tick landing at the same time is
 * harmless, not a race.
 */
@Injectable()
export class BullMqIngestionQueue
  implements IngestionQueue, IngestionTickRunner, OnModuleDestroy
{
  private readonly logger = new Logger(BullMqIngestionQueue.name);
  private readonly connection: IORedis;
  private readonly queue: Queue<IngestionJobPayload>;
  private handler: IngestionHandler | null = null;

  constructor() {
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url) {
      throw new Error(
        'UPSTASH_REDIS_URL is not set — BullMqIngestionQueue cannot connect.',
      );
    }
    // BullMQ recommends `maxRetriesPerRequest: null` on any connection it
    // manages (its own retry/backoff logic replaces ioredis's), and sharing
    // one connection across the Queue and each tick's Worker is BullMQ's own
    // documented pattern for keeping connection/command counts down on a
    // metered free tier.
    this.connection = new IORedis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue<IngestionJobPayload>(QUEUE_NAME, {
      connection: this.connection,
    });
  }

  /** Registers the handler a tick's `Worker` will call — mirrors
   * `InProcessIngestionQueue.process()`'s shape so `IngestionService` doesn't
   * need to know which adapter is active. */
  process(handler: IngestionHandler): void {
    this.handler = handler;
  }

  async enqueue(payload: IngestionJobPayload): Promise<void> {
    await this.queue.add('process', payload, {
      // `documentId` as the job id makes a re-enqueue of an already-queued or
      // already-completed document a safe no-op (BullMQ dedupes on job id)
      // rather than a duplicate job — covers `reindex()`'s bulk re-enqueue
      // and any accidental double-submit.
      jobId: payload.documentId,
      attempts: MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      // Keep failed jobs around (the dead-letter case) so they stay visible
      // for inspection instead of vanishing — the Document's own `FAILED`
      // status (written by `processDocument`'s existing error handling) is
      // the guest/admin-facing signal; this is the operator-facing one.
      removeOnFail: false,
    });

    // Best-effort immediate pickup (findings-log.md #40) — never blocks or
    // rejects the caller, and any failure here is not the durability
    // guarantee (the cron sweep is), just an optimization for the common
    // case.
    void this.runTick().catch((err) => {
      this.logger.warn(
        `Immediate post-enqueue tick failed (the next cron sweep will still pick this up): ${String(
          (err as Error)?.message ?? err,
        )}`,
      );
    });
  }

  async runTick(): Promise<IngestionTickResult> {
    if (!this.handler) {
      throw new Error(
        'No ingestion handler registered — IngestionService must call process() before any tick runs.',
      );
    }
    const handler = this.handler;
    let processed = 0;
    let failed = 0;

    const worker = new Worker<IngestionJobPayload>(
      QUEUE_NAME,
      async (job: Job<IngestionJobPayload>) => {
        await handler(job.data);
      },
      { connection: this.connection, concurrency: WORKER_CONCURRENCY },
    );

    worker.on('completed', () => {
      processed++;
    });
    worker.on('failed', (_job, err) => {
      failed++;
      this.logger.error(`Ingestion job failed: ${String(err?.message ?? err)}`);
    });

    try {
      await this.drainOrTimeout(worker);
    } finally {
      await worker.close();
    }
    return { processed, failed };
  }

  /** Resolves once the queue has nothing left waiting/active/delayed, or
   * after `TICK_MAX_DURATION_MS`, whichever comes first — a tick is a
   * bounded sweep, never an open-ended listener. */
  private drainOrTimeout(worker: Worker): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, TICK_MAX_DURATION_MS);

      const checkDrained = async () => {
        if (settled) return;
        const counts = await this.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
        );
        if (
          counts.waiting === 0 &&
          counts.active === 0 &&
          counts.delayed === 0
        ) {
          finish();
        }
      };

      worker.on('completed', () => void checkDrained());
      worker.on('failed', () => void checkDrained());
      void checkDrained();
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
