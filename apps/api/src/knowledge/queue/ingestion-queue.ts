/**
 * The ingestion queue boundary (Architecture §8). The pipeline logic never
 * imports a queue SDK directly — it goes through this `enqueue`/`process`
 * interface, so swapping the in-process adapter for BullMQ + Upstash later is a
 * one-module change, not a rewrite. (BullMQ needs a TCP Redis URL —
 * `UPSTASH_REDIS_URL` — which isn't provisioned yet; only the REST creds are.
 * The in-process adapter runs the pipeline now; BullMQ drops in behind the same
 * interface when that URL exists.)
 */
export interface IngestionJobPayload {
  documentId: string;
  hotelId: string;
}

export type IngestionHandler = (payload: IngestionJobPayload) => Promise<void>;

export interface IngestionQueue {
  /** Enqueue a document for async processing. Returns immediately. */
  enqueue(payload: IngestionJobPayload): Promise<void>;
  /** Register the consumer that processes each enqueued job. Called once at init. */
  process(handler: IngestionHandler): void;
}

/** DI token for the active IngestionQueue implementation. */
export const INGESTION_QUEUE = Symbol('INGESTION_QUEUE');
