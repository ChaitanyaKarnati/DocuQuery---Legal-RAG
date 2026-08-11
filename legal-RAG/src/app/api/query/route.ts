import { NextRequest, NextResponse } from "next/server";
import { ensureCollection, getCollectionName, getQdrantClient } from "@/lib/qdrant";
import { bm25Search, getChunk, hydrateChunks } from "@/lib/chunk-store";
import { getOpenAI } from "@/lib/openai";
import { LlmAnswer, LlmCitation } from "@/lib/types";

export const runtime = "nodejs";

interface QueryPayload {
  query?: string;
}

const RRF_K = 60;
const MAX_RETRIES = 5;
// Free tier has strict limits: 100 RPM, 30k TPM, 1k RPD
// Start with longer delays for free tier
const INITIAL_RETRY_DELAY_MS = 5000; // 5 seconds

async function createEmbeddingsWithRetry(
  openai: ReturnType<typeof getOpenAI>,
  model: string,
  input: string,
  retries = MAX_RETRIES
): Promise<Awaited<ReturnType<typeof openai.embeddings.create>>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.embeddings.create({ model, input });
    } catch (error: unknown) {
      const isRateLimitError =
        error instanceof Error &&
        "status" in error &&
        (error as { status?: number }).status === 429;

      if (!isRateLimitError || attempt === retries) {
        throw error;
      }

      // More aggressive backoff for free tier: 5s, 10s, 20s, 40s, 80s
      const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * delayMs;
      const totalDelay = delayMs + jitter;

      console.log(
        `Rate limit hit (attempt ${attempt + 1}/${retries + 1}). Retrying in ${Math.round(totalDelay / 1000)}s...`
      );

      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  throw new Error("Max retries exceeded");
}

function reciprocalRankFusion(candidates: string[][], topK: number): string[] {
  const scores = new Map<string, number>();

  candidates.forEach((list) => {
    list.forEach((id, index) => {
      const contribution = 1 / (RRF_K + index + 1);
      scores.set(id, (scores.get(id) ?? 0) + contribution);
    });
  });

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => id);
}

function clampExcerpt(excerpt: string): string {
  const words = excerpt.split(/\s+/).filter(Boolean);
  if (words.length <= 40) {
    return excerpt;
  }
  return `${words.slice(0, 40).join(" ")}...`;
}

function safeParseAnswer(raw: string): LlmAnswer {
  try {
    // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    let cleanedRaw = raw.trim();
    const codeBlockMatch = cleanedRaw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (codeBlockMatch) {
      cleanedRaw = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(cleanedRaw) as LlmAnswer;
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.citations)) {
      throw new Error("Invalid shape");
    }

    const citations: LlmCitation[] = parsed.citations
      .map((citation) => {
        if (!citation) {
          return null;
        }
        const documentName = String((citation as LlmCitation).documentName ?? "").trim();
        const pageNumber = Number((citation as LlmCitation).pageNumber);
        const excerptValue = String((citation as LlmCitation).excerpt ?? "").trim();

        if (!documentName || Number.isNaN(pageNumber) || !excerptValue) {
          return null;
        }

        return {
          documentName,
          pageNumber,
          excerpt: clampExcerpt(excerptValue),
        } satisfies LlmCitation;
      })
      .filter((citation): citation is LlmCitation => Boolean(citation));

    return {
      summary: parsed.summary,
      citations,
    };
  } catch {
    return {
      summary: raw,
      citations: [],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as QueryPayload;
    const query = payload.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    await ensureCollection();
    await hydrateChunks();

    const openai = getOpenAI();
    const bm25Results = bm25Search(query, 5);
    const queryEmbedding = await createEmbeddingsWithRetry(
      openai,
      "gemini-embedding-001",
      query
    );

    const qdrantClient = getQdrantClient();
    const collectionName = getCollectionName();

    const semanticResults = await qdrantClient.search(collectionName, {
      vector: queryEmbedding.data[0].embedding,
      limit: 5,
      with_payload: true,
      with_vector: false,
    });

    const semanticIds = semanticResults
      .map((result) => {
        const id = typeof result.id === "number" ? result.id.toString() : String(result.id);
        return id;
      })
      .filter((id) => Boolean(id));

    const fusedIds = reciprocalRankFusion(
      [bm25Results.map((result) => result.id), semanticIds],
      3
    );

    const topChunks = fusedIds
      .map((id) => getChunk(id))
      .filter((chunk): chunk is NonNullable<ReturnType<typeof getChunk>> => Boolean(chunk));

    if (topChunks.length === 0) {
      return NextResponse.json({
        answer: {
          summary: "No relevant information found in the indexed documents.",
          citations: [],
        },
        chunks: [],
      });
    }

    const context = topChunks
      .map(
        (chunk, index) =>
          `Source ${index + 1} | Document: ${chunk.documentName} | Page: ${chunk.pageNumber} | Chunk: ${chunk.chunkIndex}\n${chunk.text}`
      )
      .join("\n\n---\n\n");

    const completion = await openai.chat.completions.create({
      model: "gemini-flash-lite-latest",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Use only the provided sources to answer. Respond with valid JSON: {\"summary\": string (<=3 sentences), \"citations\": [{\"documentName\": string, \"pageNumber\": number, \"excerpt\": string (<=40 words)}...]}. If information is insufficient, set summary to explain that and return an empty citations array.",
        },
        {
          role: "user",
          content: `Question: ${query}\n\nSources:\n${context}`,
        },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim();
    const answer = message
      ? safeParseAnswer(message)
      : {
          summary: "Unable to generate an answer at this time.",
          citations: [],
        };

    return NextResponse.json({
      answer,
      chunks: topChunks.map((chunk) => ({
        id: chunk.id,
        documentName: chunk.documentName,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      })),
    });
  } catch (error) {
    console.error("Query error", error);
    const details =
      error instanceof Error ? error.message : "Unknown error occurred while answering query";
    return NextResponse.json(
      { error: "Failed to answer query", details },
      { status: 500 }
    );
  }
}
