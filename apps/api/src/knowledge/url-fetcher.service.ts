import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB — a hotel page, not a video.
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches a public web page and extracts its readable text (IA §4 "Web pages
 * (URL sync)"). One-shot fetch-and-extract only — the fuller "scheduled
 * re-crawl, diffed against last-indexed version" from IA §4 needs recurring-job
 * infra (BullMQ isn't wired to a real queue yet, Architecture §8) and is
 * deliberately deferred, not built here.
 */
@Injectable()
export class UrlFetcherService {
  async fetchText(sourceUrl: string): Promise<string> {
    this.assertSafeUrl(sourceUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(sourceUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'HospitalityAIOS-KnowledgeSync/1.0' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`Fetching ${sourceUrl} failed: HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html') && !contentType.includes('text')) {
      throw new Error(`Unsupported content-type for URL sync: ${contentType}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      throw new Error(
        `Response from ${sourceUrl} exceeds the ${MAX_RESPONSE_BYTES} byte limit for URL sync.`,
      );
    }

    return this.extractText(buffer.toString('utf8'));
  }

  private extractText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, noscript, template').remove();
    return $('body')
      .text()
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Best-effort SSRF guard: only public http(s) URLs, no literal
   * loopback/private-range hostnames. Not DNS-rebinding-safe (that needs
   * resolving the hostname and checking the actual IP at connect time) —
   * sufficient for an admin-entered hotel URL, not a hardened arbitrary-URL
   * fetcher.
   */
  private assertSafeUrl(sourceUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      throw new Error(`Not a valid URL: ${sourceUrl}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
    }
    const host = parsed.hostname.toLowerCase();
    const isPrivate =
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    if (isPrivate) {
      throw new Error(`Refusing to fetch a private/internal address: ${host}`);
    }
  }
}
