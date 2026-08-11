import { NextResponse } from "next/server";
import { getQdrantClient, getCollectionName } from "@/lib/qdrant";
import { unregisterChunks } from "@/lib/chunk-store";

export interface FileInfo {
  documentName: string;
  chunkCount: number;
  totalWords: number;
  pageRange: { min: number; max: number };
}

export async function GET() {
  try {
    const client = getQdrantClient();
    const collectionName = getCollectionName();

    const documentsMap = new Map<string, {
      chunkCount: number;
      totalWords: number;
      minPage: number;
      maxPage: number;
    }>();

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
        if (!point.payload) return;

        const payload = point.payload as Record<string, unknown>;
        const documentName = typeof payload.documentName === "string" ? payload.documentName : null;
        const pageNumberRaw = payload.pageNumber;
        const pageNumber = typeof pageNumberRaw === "number" ? pageNumberRaw : Number(pageNumberRaw);
        const tokensPayload = Array.isArray(payload.tokens) ? (payload.tokens as string[]) : null;
        const wordCount = tokensPayload?.length ?? 0;

        if (!documentName || Number.isNaN(pageNumber)) return;

        const existing = documentsMap.get(documentName);
        if (existing) {
          existing.chunkCount += 1;
          existing.totalWords += wordCount;
          existing.minPage = Math.min(existing.minPage, pageNumber);
          existing.maxPage = Math.max(existing.maxPage, pageNumber);
        } else {
          documentsMap.set(documentName, {
            chunkCount: 1,
            totalWords: wordCount,
            minPage: pageNumber,
            maxPage: pageNumber,
          });
        }
      });

      nextOffset = response.next_page_offset;
    } while (nextOffset != null);

    const files: FileInfo[] = Array.from(documentsMap.entries())
      .map(([documentName, data]) => ({
        documentName,
        chunkCount: data.chunkCount,
        totalWords: data.totalWords,
        pageRange: { min: data.minPage, max: data.maxPage },
      }))
      .sort((a, b) => a.documentName.localeCompare(b.documentName));

    return NextResponse.json({ files, totalFiles: files.length });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch files",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentName = searchParams.get("documentName");

    if (!documentName) {
      return NextResponse.json(
        { error: "Missing documentName parameter" },
        { status: 400 }
      );
    }

    const client = getQdrantClient();
    const collectionName = getCollectionName();

    // First, find all point IDs with the specified documentName for BM25 index removal
    const pointIds: string[] = [];
    let nextOffset: unknown = undefined;

    do {
      const request: Record<string, unknown> = {
        limit: 128,
        with_payload: true,  // Need payload to check documentName
        with_vector: false,
      };
      if (nextOffset != null) {
        request.offset = nextOffset;
      }

      const response = await client.scroll(collectionName, request as never);

      response.points.forEach((point) => {
        if (!point.payload) return;
        const payload = point.payload as Record<string, unknown>;
        const docName = typeof payload.documentName === "string" ? payload.documentName : null;
        if (docName === documentName) {
          pointIds.push(point.id.toString());
        }
      });

      nextOffset = response.next_page_offset;
    } while (nextOffset != null);

    if (pointIds.length === 0) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Remove from BM25 index and cache
    unregisterChunks(pointIds);

    // Delete the points by IDs
    await client.delete(collectionName, {
      points: pointIds,
    });

    return NextResponse.json({ success: true, deletedDocument: documentName });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      {
        error: "Failed to delete file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
