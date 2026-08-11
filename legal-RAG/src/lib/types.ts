export interface ChunkRecord {
  id: string;
  text: string;
  pageNumber: number;
  chunkIndex: number;
  documentName: string;
  tokens: string[];
  wordCount: number;
}

export interface ChunkPoint extends ChunkRecord {
  embedding: number[];
}

export interface QueryResult extends ChunkRecord {
  score: number;
}

export interface LlmCitation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
}

export interface LlmAnswer {
  summary: string;
  citations: LlmCitation[];
}
