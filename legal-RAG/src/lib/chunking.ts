import { PDFParse } from "pdf-parse";
import { v4 as uuidv4 } from "uuid";
import { ChunkRecord } from "./types";

const MIN_WORDS_PER_CHUNK = 200;
const MAX_WORDS_PER_CHUNK = 500;

function normalizeParagraph(text: string): string {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoParagraphs(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const segments = normalized.split(/\n{2,}/);
  return segments
    .map((segment) => segment.replace(/\n/g, " "))
    .map((segment) => normalizeParagraph(segment))
    .filter((segment) => segment.length > 0);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildChunksFromParagraphs(
  paragraphs: string[],
  pageNumber: number,
  documentName: string,
  startingIndex: number
): { chunks: ChunkRecord[]; nextIndex: number } {
  const chunks: ChunkRecord[] = [];
  let buffer: string[] = [];
  let wordCount = 0;
  let chunkIndex = startingIndex;

  const flushBuffer = () => {
    if (buffer.length === 0) {
      return;
    }
    const text = buffer.join("\n\n");
    const tokens = tokenize(text);
    const chunk: ChunkRecord = {
      id: uuidv4(),
      text,
      tokens,
      pageNumber,
      chunkIndex,
      documentName,
      wordCount: tokens.length,
    };
    chunks.push(chunk);
    buffer = [];
    wordCount = 0;
    chunkIndex += 1;
  };

  paragraphs.forEach((paragraph) => {
    const paragraphTokens = tokenize(paragraph);
    const paragraphWordCount = paragraphTokens.length;

    if (paragraphWordCount === 0) {
      return;
    }

    if (wordCount + paragraphWordCount > MAX_WORDS_PER_CHUNK && wordCount >= MIN_WORDS_PER_CHUNK) {
      flushBuffer();
    }

    buffer.push(paragraph);
    wordCount += paragraphWordCount;

    if (wordCount >= MAX_WORDS_PER_CHUNK) {
      flushBuffer();
    }
  });

  if (buffer.length > 0) {
    flushBuffer();
  }

  return { chunks, nextIndex: chunkIndex };
}

export async function extractPdfChunks(buffer: Buffer, documentName: string): Promise<ChunkRecord[]> {
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  const pages = textResult.pages?.map((page) => page.text ?? "") ?? [];

  const allChunks: ChunkRecord[] = [];
  let runningIndex = 0;

  pages.forEach((page, index) => {
    const paragraphs = splitIntoParagraphs(page);
    if (paragraphs.length === 0) {
      return;
    }
    const { chunks, nextIndex } = buildChunksFromParagraphs(paragraphs, index + 1, documentName, runningIndex);
    allChunks.push(...chunks);
    runningIndex = nextIndex;
  });

  return allChunks;
}

export function deriveTokens(text: string): string[] {
  return tokenize(text);
}

/**
 * Chunk Markdown text while preserving document structure.
 * Splits on headers first, then further chunks large sections while
 * maintaining semantic boundaries.
 */
export function chunkMarkdown(
  markdown: string,
  documentName: string
): ChunkRecord[] {
  const allChunks: ChunkRecord[] = [];
  let chunkIndex = 0;

  // Split by major headers (# and ##) to maintain document structure
  const sections = splitMarkdownSections(markdown);

  sections.forEach((section, sectionIndex) => {
    const { header, content, level } = section;
    
    // Combine header with content for context
    const fullText = header ? `${header}\n\n${content}` : content;
    
    // If section is small enough, treat as single chunk
    const tokens = tokenize(fullText);
    if (tokens.length <= MAX_WORDS_PER_CHUNK) {
      const chunk: ChunkRecord = {
        id: uuidv4(),
        text: fullText.trim(),
        tokens,
        pageNumber: sectionIndex + 1, // Use section number as page equivalent
        chunkIndex,
        documentName,
        wordCount: tokens.length,
      };
      allChunks.push(chunk);
      chunkIndex += 1;
      return;
    }

    // Section is too large, split into smaller chunks while preserving structure
    const paragraphs = splitMarkdownParagraphs(content);
    
    // Add header context to first paragraph if header exists
    if (header && paragraphs.length > 0) {
      paragraphs[0] = `${header}\n\n${paragraphs[0]}`;
    }

    const { chunks, nextIndex } = buildChunksFromParagraphs(
      paragraphs,
      sectionIndex + 1,
      documentName,
      chunkIndex
    );
    
    allChunks.push(...chunks);
    chunkIndex = nextIndex;
  });

  return allChunks;
}

/**
 * Split Markdown into sections based on headers.
 */
function splitMarkdownSections(markdown: string): Array<{
  header: string | null;
  content: string;
  level: number;
}> {
  const lines = markdown.split('\n');
  const sections: Array<{ header: string | null; content: string; level: number }> = [];
  let currentHeader: string | null = null;
  let currentLevel = 0;
  let currentContent: string[] = [];

  const flushSection = () => {
    if (currentContent.length > 0 || currentHeader) {
      sections.push({
        header: currentHeader,
        content: currentContent.join('\n').trim(),
        level: currentLevel,
      });
      currentContent = [];
    }
  };

  lines.forEach((line) => {
    // Check for headers (# or ##)
    const headerMatch = line.match(/^(#{1,2})\s+(.+)$/);
    
    if (headerMatch) {
      // Flush previous section
      flushSection();
      
      // Start new section
      currentLevel = headerMatch[1].length;
      currentHeader = line;
    } else {
      currentContent.push(line);
    }
  });

  // Flush last section
  flushSection();

  return sections;
}

/**
 * Split Markdown content into paragraphs while preserving structure.
 * Handles lists, code blocks, and tables as semantic units.
 */
function splitMarkdownParagraphs(content: string): string[] {
  const paragraphs: string[] = [];
  const lines = content.split('\n');
  let buffer: string[] = [];
  let inCodeBlock = false;
  let inList = false;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      const text = buffer.join('\n').trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
      buffer = [];
    }
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        // Starting code block
        flushBuffer();
        inCodeBlock = true;
        buffer.push(line);
      } else {
        // Ending code block
        buffer.push(line);
        flushBuffer();
        inCodeBlock = false;
      }
      return;
    }

    // If in code block, accumulate all lines
    if (inCodeBlock) {
      buffer.push(line);
      return;
    }

    // Handle lists (-, *, +, or numbered)
    const isListItem = /^[-*+]\s/.test(trimmedLine) || /^\d+\.\s/.test(trimmedLine);
    
    if (isListItem) {
      if (!inList) {
        // Starting list
        flushBuffer();
        inList = true;
      }
      buffer.push(line);
      return;
    }

    // If we were in a list and this isn't a list item, flush
    if (inList && !isListItem && trimmedLine.length > 0) {
      flushBuffer();
      inList = false;
    }

    // Handle empty lines
    if (trimmedLine.length === 0) {
      if (buffer.length > 0 && !inList) {
        flushBuffer();
      } else if (buffer.length > 0) {
        buffer.push(line); // Preserve spacing in lists/code
      }
      return;
    }

    // Regular content
    buffer.push(line);
  });

  // Flush remaining content
  flushBuffer();

  return paragraphs;
}

/**
 * Split text into sentences for sentence-based chunking.
 */
function splitIntoSentences(text: string): string[] {
  // Split on periods, question marks, and exclamation marks followed by space or end of text
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
  return sentences
    .map((sentence) => normalizeParagraph(sentence))
    .filter((sentence) => sentence.length > 0);
}

/**
 * Chunk text by sentence boundaries.
 */
export function chunkBySentence(
  text: string,
  documentName: string,
  minWords = MIN_WORDS_PER_CHUNK,
  maxWords = MAX_WORDS_PER_CHUNK
): ChunkRecord[] {
  const sentences = splitIntoSentences(text);
  const chunks: ChunkRecord[] = [];
  let buffer: string[] = [];
  let wordCount = 0;
  let chunkIndex = 0;

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ");
    const tokens = tokenize(text);
    const chunk: ChunkRecord = {
      id: uuidv4(),
      text,
      tokens,
      pageNumber: 1,
      chunkIndex,
      documentName,
      wordCount: tokens.length,
    };
    chunks.push(chunk);
    buffer = [];
    wordCount = 0;
    chunkIndex += 1;
  };

  sentences.forEach((sentence) => {
    const sentenceTokens = tokenize(sentence);
    const sentenceWordCount = sentenceTokens.length;

    if (sentenceWordCount === 0) return;

    if (wordCount + sentenceWordCount > maxWords && wordCount >= minWords) {
      flushBuffer();
    }

    buffer.push(sentence);
    wordCount += sentenceWordCount;

    if (wordCount >= maxWords) {
      flushBuffer();
    }
  });

  if (buffer.length > 0) {
    flushBuffer();
  }

  return chunks;
}

/**
 * Chunk text by fixed word count.
 */
export function chunkByFixedSize(
  text: string,
  documentName: string,
  targetSize = 300
): ChunkRecord[] {
  const allTokens = tokenize(text);
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: ChunkRecord[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < words.length; i += targetSize) {
    const chunkWords = words.slice(i, i + targetSize);
    const chunkText = chunkWords.join(" ");
    const chunkTokens = tokenize(chunkText);

    const chunk: ChunkRecord = {
      id: uuidv4(),
      text: chunkText,
      tokens: chunkTokens,
      pageNumber: Math.floor(i / targetSize) + 1,
      chunkIndex,
      documentName,
      wordCount: chunkTokens.length,
    };
    chunks.push(chunk);
    chunkIndex += 1;
  }

  return chunks;
}
