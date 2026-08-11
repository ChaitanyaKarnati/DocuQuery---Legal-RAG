import { NextRequest, NextResponse } from "next/server";
import { ensureCollection, getCollectionName, getQdrantClient } from "@/lib/qdrant";
import { extractPdfChunks, chunkMarkdown, chunkBySentence, chunkByFixedSize } from "@/lib/chunking";
import { getOpenAI } from "@/lib/openai";
import { registerChunks } from "@/lib/chunk-store";
import { getEnv } from "@/lib/env";
import { ChunkRecord } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_RETRIES = 5;
// Free tier has strict limits: 100 RPM, 30k TPM, 1k RPD
// Start with longer delays for free tier
const INITIAL_RETRY_DELAY_MS = 5000; // 5 seconds
const BATCH_DELAY_MS = 1000; // 1 second between batches

async function createEmbeddingsWithRetry(
  openai: ReturnType<typeof getOpenAI>,
  model: string,
  input: string[],
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

/**
 * Convert PDF to Markdown using Python microservice.
 */
async function convertPdfToMarkdown(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const env = getEnv();
  const pythonServiceUrl = env.pythonServiceUrl;

  try {
    const formData = new FormData();
    // Convert Buffer to Uint8Array for proper Blob creation
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: "application/pdf" });
    formData.append("file", blob, filename);

    const response = await fetch(`${pythonServiceUrl}/convert`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Python service returned ${response.status}: ${
          errorData.detail || response.statusText
        }`
      );
    }

    const data = await response.json();
    
    if (!data.success || !data.markdown) {
      throw new Error("Python service did not return markdown content");
    }

    console.log(
      `Successfully converted PDF to Markdown: ${data.metadata?.word_count || 0} words`
    );

    return data.markdown;
  } catch (error) {
    console.error("Error calling Python service:", error);
    throw new Error(
      `Failed to convert PDF to Markdown: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCollection();

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
    }

    if (fileEntry.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF uploads are supported" }, { status: 400 });
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const documentName = fileEntry.name;
    
    // Get chunking strategy from form data
    const chunkingStrategy = formData.get("chunkingStrategy") || "paragraph";
    const customChunkSize = formData.get("customChunkSize");
    const chunkSize = customChunkSize ? parseInt(customChunkSize.toString(), 10) : 300;
    
    let chunks: ChunkRecord[];
    
    // Try to convert PDF to Markdown using Python microservice
    try {
      const markdown = await convertPdfToMarkdown(buffer, documentName);
      
      // Apply chunking strategy
      switch (chunkingStrategy) {
        case "markdown":
          chunks = chunkMarkdown(markdown, documentName);
          console.log(`Using Markdown chunking: ${chunks.length} chunks created`);
          break;
        case "sentence":
          chunks = chunkBySentence(markdown, documentName);
          console.log(`Using Sentence chunking: ${chunks.length} chunks created`);
          break;
        case "fixed":
          chunks = chunkByFixedSize(markdown, documentName, chunkSize);
          console.log(`Using Fixed Size chunking (${chunkSize} words): ${chunks.length} chunks created`);
          break;
        case "paragraph":
        default:
          // For paragraph chunking, we need to extract paragraphs from markdown
          // Fall back to PDF extraction which handles paragraphs
          chunks = await extractPdfChunks(buffer, documentName);
          console.log(`Using Paragraph chunking: ${chunks.length} chunks created`);
          break;
      }
    } catch (error) {
      console.error("PDF to Markdown conversion failed:", error);
      // Fallback to direct PDF extraction if Python service is unavailable
      console.log("Falling back to direct PDF text extraction...");
      chunks = await extractPdfChunks(buffer, documentName);
      console.log(`Using PDF text extraction: ${chunks.length} chunks created`);
    }

    if (chunks.length === 0) {
      return NextResponse.json({ error: "Unable to extract text from PDF" }, { status: 422 });
    }

    const openai = getOpenAI();
    const qdrantClient = getQdrantClient();
    const collectionName = getCollectionName();
    
    // Gemini API allows max 100 requests per batch
    // Free tier: 100 RPM, so use smaller batches and add delays
    const BATCH_SIZE = 50; // Reduced from 100 for free tier
    let processedCount = 0;
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`);
      
      const embeddingsResponse = await createEmbeddingsWithRetry(
        openai,
        "gemini-embedding-001",
        batch.map((chunk) => chunk.text)
      );
      
      // Log embedding details for debugging
      console.log(`Generated ${embeddingsResponse.data.length} embeddings, first vector length: ${embeddingsResponse.data[0]?.embedding.length || 'N/A'}`);
      
      // Store this batch immediately
      const points = batch.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddingsResponse.data[index].embedding,
        payload: {
          text: chunk.text,
          documentName: chunk.documentName,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          tokens: chunk.tokens,
          wordCount: chunk.wordCount,
        },
      }));
      
      try {
        await qdrantClient.upsert(collectionName, {
          wait: true,
          points,
        });
      } catch (upsertError) {
        console.error("Qdrant upsert error:", upsertError);
        // Log the full error details if available
        if (upsertError && typeof upsertError === 'object' && 'data' in upsertError) {
          console.error("Qdrant error data:", JSON.stringify(upsertError.data, null, 2));
        }
        // Log a sample point to debug the structure
        if (points.length > 0) {
          console.error("Sample point structure:", JSON.stringify({
            id: points[0].id,
            vectorLength: points[0].vector.length,
            vectorSample: points[0].vector.slice(0, 5),
            payload: points[0].payload,
          }, null, 2));
        }
        throw new Error(
          `Failed to store vectors in Qdrant: ${upsertError instanceof Error ? upsertError.message : 'Unknown error'}`
        );
      }
      
      // Register chunks for BM25 search
      registerChunks(batch);
      
      processedCount += batch.length;
      console.log(`Stored ${processedCount}/${chunks.length} chunks to vector store`);
      
      // Add delay between batches to avoid hitting rate limits
      if (i + BATCH_SIZE < chunks.length) {
        console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return NextResponse.json({ success: true, chunkCount: chunks.length });
  } catch (error) {
    console.error("Upload error", error);
    const details =
      error instanceof Error ? error.message : "Unknown error occurred during upload";
    return NextResponse.json(
      { error: "Failed to process document", details },
      { status: 500 }
    );
  }
}
