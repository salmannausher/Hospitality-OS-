/**
 * The consumer side of the ingestion queue (findings-log.md #40). This app
 * deploys as a single Vercel Function with no persistent background process
 * (Architecture §8), so a BullMQ `Worker` can't just sit there blocking on
 * Redis forever the way it would on a dedicated host. Instead, "processing"
 * happens as a bounded tick: run a short-lived `Worker` that drains whatever
 * is waiting (or times out), then closes.
 *
 * A Vercel Cron job hits an endpoint that calls `runTick()` on a schedule;
 * `BullMqIngestionQueue.enqueue()` also fires one best-effort tick right
 * after enqueueing, so the common case is picked up near-instantly without
 * waiting for the next scheduled sweep — the cron sweep is the durability
 * guarantee, not the fast path.
 *
 * The in-process dev adapter has nothing to tick (it processes on the next
 * event-loop turn via `setImmediate` already) — `NoOpTickRunner` satisfies
 * this interface for that case so the tick endpoint doesn't need to know
 * which queue adapter is active.
 */
export interface IngestionTickResult {
  processed: number;
  failed: number;
}

export interface IngestionTickRunner {
  runTick(): Promise<IngestionTickResult>;
}

/** DI token for the active IngestionTickRunner implementation. */
export const INGESTION_TICK_RUNNER = Symbol('INGESTION_TICK_RUNNER');
