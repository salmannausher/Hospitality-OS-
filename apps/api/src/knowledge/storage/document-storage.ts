/**
 * Raw document storage boundary (Architecture §8: "Object storage — raw
 * uploaded documents"). Behind an interface so the local-filesystem dev adapter
 * swaps for Supabase Storage (signed uploads, PRD §15) with no pipeline changes.
 */
export interface DocumentStorage {
  /** Persist raw bytes; returns an opaque storageUrl to record on the Document. */
  store(hotelId: string, filename: string, buffer: Buffer): Promise<string>;
  /** Read raw bytes back for (re)processing. */
  read(storageUrl: string): Promise<Buffer>;
}

/** DI token for the active DocumentStorage implementation. */
export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');
