import { Injectable } from '@nestjs/common';
import type {
  IngestionTickResult,
  IngestionTickRunner,
} from './ingestion-tick-runner';

/** Satisfies `IngestionTickRunner` when `InProcessIngestionQueue` is active —
 * that adapter already processes each job on the next tick via
 * `setImmediate`, so there is nothing for a scheduled sweep to do. */
@Injectable()
export class NoOpTickRunner implements IngestionTickRunner {
  runTick(): Promise<IngestionTickResult> {
    return Promise.resolve({ processed: 0, failed: 0 });
  }
}
