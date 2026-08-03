import {
  Controller,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  INGESTION_TICK_RUNNER,
  type IngestionTickRunner,
} from './queue/ingestion-tick-runner';

/**
 * `POST /internal/ingestion/tick` — the consumer side of the durable
 * ingestion queue (findings-log.md #41/#40). Not part of the public or admin
 * API surface: it exists only for Vercel Cron to hit on a schedule (see
 * `vercel.json`), running a bounded processing sweep instead of a persistent
 * worker this deployment has no process for.
 *
 * Guarded by `CRON_SECRET` rather than `SupabaseAuthGuard`/`HotelScopeGuard`
 * — there is no hotel or admin user context for a scheduled job, and Vercel
 * Cron itself sends `Authorization: Bearer $CRON_SECRET` automatically when
 * that env var is set on the project, so this is the documented way to
 * authenticate a Vercel Cron-invoked endpoint.
 */
@Controller('internal/ingestion')
export class IngestionTickController {
  constructor(
    @Inject(INGESTION_TICK_RUNNER)
    private readonly tickRunner: IngestionTickRunner,
  ) {}

  @Post('tick')
  async tick(@Headers('authorization') authHeader: string | undefined) {
    this.assertCronAuth(authHeader);
    return this.tickRunner.runTick();
  }

  private assertCronAuth(authHeader: string | undefined): void {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new UnauthorizedException(
        'CRON_SECRET is not configured — refusing to run an unauthenticated ingestion tick.',
      );
    }
    if (authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid or missing cron credentials.');
    }
  }
}
