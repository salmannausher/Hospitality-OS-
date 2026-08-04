import { Injectable, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

/** API §4/§8: `30 msg/session/hour`, `300 req/key/hour`, always `429` +
 * `Retry-After`, never a silent drop. */
export const SESSION_LIMIT_PER_HOUR = 30;
export const WIDGET_KEY_LIMIT_PER_HOUR = 300;
const WINDOW_SECONDS = 3600;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry — only meaningful when !allowed. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter backed by the same Upstash Redis instance BullMQ
 * already uses (findings-log.md #40/#41) — reusing the established
 * TCP/ioredis connection pattern rather than introducing a second Redis
 * client convention. A fixed window (INCR + EXPIRE NX) is a deliberate
 * simplification over a sliding window: it can allow a short burst at a
 * window boundary, but that's an acceptable trade for a guest-facing chat
 * API where the real goal is capping sustained abuse of a leaked key, not
 * precise rate shaping (findings-log.md #39's own framing).
 */
@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly connection: IORedis | null;

  constructor() {
    const url = process.env.UPSTASH_REDIS_URL;
    // No Redis configured (e.g. local dev without it provisioned) — fail
    // open rather than block every request; findings-log.md #39 is about
    // closing an open door in production, not making local dev depend on
    // infra it doesn't have.
    this.connection = url
      ? new IORedis(url, { maxRetriesPerRequest: null })
      : null;
  }

  async checkSession(sessionId: string): Promise<RateLimitResult> {
    return this.check(`ratelimit:session:${sessionId}`, SESSION_LIMIT_PER_HOUR);
  }

  async checkWidgetKey(widgetKey: string): Promise<RateLimitResult> {
    return this.check(`ratelimit:key:${widgetKey}`, WIDGET_KEY_LIMIT_PER_HOUR);
  }

  private async check(
    redisKey: string,
    limit: number,
  ): Promise<RateLimitResult> {
    if (!this.connection) return { allowed: true, retryAfterSeconds: 0 };

    const count = await this.connection.incr(redisKey);
    if (count === 1) {
      // Only the request that created the counter sets its expiry — avoids
      // a race where a slow second request's EXPIRE could reset the window.
      await this.connection.expire(redisKey, WINDOW_SECONDS);
    }
    if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };

    const ttl = await this.connection.ttl(redisKey);
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.quit();
  }
}
