import { getCollectionName, getQdrantClient } from "./qdrant";
import { BM25Index } from "./bm25";
import { ChunkRecord, QueryResult } from "./types";
import { deriveTokens } from "./chunking";

const bm25Index = new BM25Index();
const chunkCache = new Map<string, ChunkRecord>();
let hydrated = false;

function coerceChunk(point: {
  id: string | number;
  payload?: Record<string, unknown> | null;
}): ChunkRecord | null {
  if (!point.payload) {
    return null;
  }

  const payload = point.payload as Record<string, unknown>;
  const text = typeof payload.text === "string" ? payload.text : null;
  const documentName = typeof payload.documentName === "string" ? payload.documentName : null;
  const pageNumberRaw = payload.pageNumber;
  const chunkIndexRaw = payload.chunkIndex;
  const pageNumber = typeof pageNumberRaw === "number" ? pageNumberRaw : Number(pageNumberRaw);
  const chunkIndex = typeof chunkIndexRaw === "number" ? chunkIndexRaw : Number(chunkIndexRaw);
  const tokensPayload = Array.isArray(payload.tokens) ? (payload.tokens as string[]) : null;
  const id = typeof point.id === "number" ? point.id.toString() : String(point.id);

  if (!text || !documentName || Number.isNaN(pageNumber) || Number.isNaN(chunkIndex)) {
    return null;
  }

  const tokens = tokensPayload?.filter((token) => typeof token === "string") ?? deriveTokens(text);

  return {
    id,
    text,
    documentName,
    pageNumber,
    chunkIndex,
    tokens,
    wordCount: tokens.length,
  };
}

export async function hydrateChunks(force = false): Promise<void> {
  if (hydrated && !force) {
    return;
  }

  bm25Index.reset();
  chunkCache.clear();

  const client = getQdrantClient();
  const collectionName = getCollectionName();

  let nextOffset: unknown = undefined;

  do {
    const request: Record<string, unknown> = {
      limit: 128,
      with_payload: true,
      with_vector: false,
    };
    if (nextOffset != null) {
      request.offset = nextOffset;
    }

    const response = await client.scroll(collectionName, request as never);

    response.points.forEach((point) => {
      const chunk = coerceChunk(point);
      if (!chunk) {
        return;
      }
      chunkCache.set(chunk.id, chunk);
      bm25Index.addChunk(chunk);
    });

    nextOffset = response.next_page_offset;
  } while (nextOffset != null);

  hydrated = true;
}

export function registerChunks(chunks: ChunkRecord[]): void {
  chunks.forEach((chunk) => {
    chunkCache.set(chunk.id, chunk);
    bm25Index.addChunk(chunk);
  });
  hydrated = true;
}

export function unregisterChunks(chunkIds: string[]): void {
  chunkIds.forEach((id) => {
    chunkCache.delete(id);
    bm25Index.removeDocument(id);
  });
}

export function bm25Search(query: string, limit = 5): QueryResult[] {
  const results = bm25Index.score(query, limit);
  return results
    .map(({ id, score }) => {
      const chunk = chunkCache.get(id);
      if (!chunk) {
        return null;
      }
      return { ...chunk, score } satisfies QueryResult;
    })
    .filter((entry): entry is QueryResult => Boolean(entry));
}

export function getChunk(id: string): ChunkRecord | undefined {
  return chunkCache.get(id);
}

export function getChunks(ids: string[]): ChunkRecord[] {
  return ids
    .map((id) => chunkCache.get(id))
    .filter((chunk): chunk is ChunkRecord => Boolean(chunk));
}
