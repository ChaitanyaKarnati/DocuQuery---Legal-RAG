import { deriveTokens } from "./chunking";
import { ChunkRecord } from "./types";

const K1 = 1.5;
const B = 0.75;

interface DocumentStats {
  id: string;
  length: number;
  termFrequency: Map<string, number>;
}

export class BM25Index {
  private documents = new Map<string, DocumentStats>();
  private documentFrequencies = new Map<string, number>();
  private totalLength = 0;

  addChunk(chunk: ChunkRecord): void {
    this.addDocument(chunk.id, chunk.tokens ?? deriveTokens(chunk.text));
  }

  addDocument(id: string, tokens: string[]): void {
    if (tokens.length === 0) {
      return;
    }

    if (this.documents.has(id)) {
      this.removeDocument(id);
    }

    const termFrequency = new Map<string, number>();
    tokens.forEach((token) => {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    });

    termFrequency.forEach((_, token) => {
      this.documentFrequencies.set(token, (this.documentFrequencies.get(token) ?? 0) + 1);
    });

    const length = tokens.length;
    this.documents.set(id, { id, length, termFrequency });
    this.totalLength += length;
  }

  reset(): void {
    this.documents.clear();
    this.documentFrequencies.clear();
    this.totalLength = 0;
  }

  size(): number {
    return this.documents.size;
  }

  removeDocument(id: string): void {
    const existing = this.documents.get(id);
    if (!existing) {
      return;
    }

    existing.termFrequency.forEach((count, token) => {
      const currentDf = this.documentFrequencies.get(token) ?? 0;
      if (currentDf <= 1) {
        this.documentFrequencies.delete(token);
      } else {
        this.documentFrequencies.set(token, currentDf - 1);
      }
    });

    this.totalLength -= existing.length;
    this.documents.delete(id);
  }

  score(query: string, limit = 5): Array<{ id: string; score: number }> {
    if (this.documents.size === 0) {
      return [];
    }

    const queryTokens = deriveTokens(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const uniqueTokens = Array.from(new Set(queryTokens));
    const avgDocLength = this.totalLength / this.documents.size;

    const scores = new Map<string, number>();

    uniqueTokens.forEach((token) => {
      const df = this.documentFrequencies.get(token);
      if (!df) {
        return;
      }
      const idf = Math.log((this.documents.size - df + 0.5) / (df + 0.5) + 1);

      this.documents.forEach((doc) => {
        const tf = doc.termFrequency.get(token);
        if (!tf) {
          return;
        }
        const numerator = tf * (K1 + 1);
        const denominator = tf + K1 * (1 - B + (B * doc.length) / avgDocLength);
        const contribution = idf * (numerator / denominator);
        scores.set(doc.id, (scores.get(doc.id) ?? 0) + contribution);
      });
    });

    return Array.from(scores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
