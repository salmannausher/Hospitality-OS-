import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { DocumentStorage } from './document-storage';

/**
 * Local-filesystem document storage for dev — writes under apps/api/.data/uploads.
 * The production adapter is Supabase Storage (signed uploads); it implements the
 * same interface. storageUrl here is a `local://<absolute-path>` string.
 */
@Injectable()
export class LocalDocumentStorage implements DocumentStorage {
  private readonly root = resolve(process.cwd(), '.data', 'uploads');
  private static readonly SCHEME = 'local://';

  async store(
    hotelId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = join(this.root, hotelId, `${randomUUID()}-${safeName}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return `${LocalDocumentStorage.SCHEME}${path}`;
  }

  async read(storageUrl: string): Promise<Buffer> {
    if (!storageUrl.startsWith(LocalDocumentStorage.SCHEME)) {
      throw new Error(
        `Unsupported storageUrl for local storage: ${storageUrl}`,
      );
    }
    return readFile(storageUrl.slice(LocalDocumentStorage.SCHEME.length));
  }
}
