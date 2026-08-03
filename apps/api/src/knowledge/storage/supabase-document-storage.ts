import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DocumentStorage } from './document-storage';

const SCHEME = 'supabase://';

/**
 * Supabase Storage document storage (findings-log.md #41) — the production
 * counterpart to `LocalDocumentStorage`. Talks to Supabase's Storage REST API
 * via plain `fetch`, matching `SupabaseAuthService`'s existing convention of
 * not pulling in the `@supabase/supabase-js` SDK (not a dependency anywhere
 * in this repo) for what a couple of REST calls already cover.
 *
 * `storageUrl` encodes both bucket and path (`supabase://<bucket>/<path>`)
 * rather than hardcoding the bucket name into `read()` — self-describing, so
 * a future bucket rename doesn't strand already-stored documents.
 */
@Injectable()
export class SupabaseDocumentStorage implements DocumentStorage {
  private get baseUrl(): string {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('SUPABASE_URL is not set.');
    return url;
  }

  private get serviceKey(): string {
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_KEY is not set.');
    return key;
  }

  private get bucket(): string {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    if (!bucket) throw new Error('SUPABASE_STORAGE_BUCKET is not set.');
    return bucket;
  }

  async store(
    hotelId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${hotelId}/${randomUUID()}-${safeName}`;
    const bucket = this.bucket;

    const res = await fetch(
      `${this.baseUrl}/storage/v1/object/${bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          apikey: this.serviceKey,
          'Content-Type': 'application/octet-stream',
          // Each path is freshly randomUUID()'d — never intentionally
          // overwriting, so a collision means something is wrong upstream.
          'x-upsert': 'false',
        },
        // `Buffer`'s type is generic over `ArrayBufferLike` (which includes
        // `SharedArrayBuffer`), which DOM's `BodyInit`/`BlobPart` typings
        // reject — copying into a plain `Uint8Array` (backed by a real
        // `ArrayBuffer`) satisfies them.
        body: new Blob([Uint8Array.from(buffer)]),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Supabase Storage upload failed (${res.status}): ${body}`,
      );
    }
    return `${SCHEME}${bucket}/${path}`;
  }

  async read(storageUrl: string): Promise<Buffer> {
    if (!storageUrl.startsWith(SCHEME)) {
      throw new Error(`Not a Supabase storage URL: ${storageUrl}`);
    }
    const rest = storageUrl.slice(SCHEME.length);
    const slash = rest.indexOf('/');
    if (slash === -1) {
      throw new Error(`Malformed Supabase storage URL: ${storageUrl}`);
    }
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);

    const res = await fetch(
      `${this.baseUrl}/storage/v1/object/${bucket}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          apikey: this.serviceKey,
        },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase Storage read failed (${res.status}): ${body}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
