"use client";

import { type ChangeEvent, type DragEvent, useCallback, useMemo, useState } from "react";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type UploadResponsePayload = {
  chunkCount?: number;
  error?: unknown;
  details?: unknown;
};

export default function UploadPage() {
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [chunkingStrategy, setChunkingStrategy] = useState<string>("paragraph");
  const [customChunkSize, setCustomChunkSize] = useState<string>("300");

  const resetFeedback = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setChunkCount(null);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    resetFeedback();
    setFileName(file.name);

    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("Unsupported file type. Please upload a PDF.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatus("error");
      setMessage("File exceeds 10MB limit. Split or compress the document and try again.");
      return;
    }

    setStatus("loading");
    setMessage("Uploading and indexing...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chunkingStrategy", chunkingStrategy);
      if (chunkingStrategy === "fixed") {
        formData.append("customChunkSize", customChunkSize);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as UploadResponsePayload;

      if (!response.ok) {
        const errorMessage =
          typeof payload.details === "string"
            ? payload.details
            : typeof payload.error === "string"
              ? payload.error
              : "Failed to upload document";
        throw new Error(errorMessage);
      }

      setStatus("success");
      setChunkCount(payload.chunkCount ?? null);
      setMessage("Document indexed successfully. You can now run queries.");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error while uploading");
    }
  }, [resetFeedback]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      const files = event.dataTransfer.files;
      if (files && files[0]) {
        void handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const onSelectFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files[0]) {
        await handleFile(files[0]);
        event.target.value = "";
      }
    },
    [handleFile]
  );

  const borderClasses = useMemo(
    () =>
      isDragActive
        ? "border-emerald-300 bg-emerald-400/10"
        : "border-slate-700 bg-slate-900/40",
    [isDragActive]
  );

  const statusClasses = useMemo(() => {
    switch (status) {
      case "success":
        return "text-emerald-300";
      case "error":
        return "text-rose-300";
      default:
        return "text-slate-300";
    }
  }, [status]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/5 lg:p-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50 lg:text-4xl">Upload a PDF</h1>
        <p className="mt-3 text-sm text-slate-300 lg:text-base">
          Drag and drop a PDF (max 10MB). We will extract text, chunk it using your selected strategy,
          and index it in Qdrant with both keyword and semantic search features.
        </p>

        {/* Chunking Strategy Selection */}
        <div className="mt-6 space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Chunking Strategy</h2>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="chunkingStrategy"
                value="paragraph"
                checked={chunkingStrategy === "paragraph"}
                onChange={(e) => setChunkingStrategy(e.target.value)}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
              />
              <div>
                <div className="font-medium text-slate-100">By Paragraph</div>
                <div className="text-xs text-slate-400">
                  Splits text at paragraph boundaries (200-500 words per chunk)
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="chunkingStrategy"
                value="sentence"
                checked={chunkingStrategy === "sentence"}
                onChange={(e) => setChunkingStrategy(e.target.value)}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
              />
              <div>
                <div className="font-medium text-slate-100">By Sentence</div>
                <div className="text-xs text-slate-400">
                  Splits text at sentence boundaries while maintaining target chunk size
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="chunkingStrategy"
                value="markdown"
                checked={chunkingStrategy === "markdown"}
                onChange={(e) => setChunkingStrategy(e.target.value)}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
              />
              <div>
                <div className="font-medium text-slate-100">By Markdown Section</div>
                <div className="text-xs text-slate-400">
                  Preserves document structure by splitting at headers and sections
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="radio"
                name="chunkingStrategy"
                value="fixed"
                checked={chunkingStrategy === "fixed"}
                onChange={(e) => setChunkingStrategy(e.target.value)}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
              />
              <div className="flex-1">
                <div className="font-medium text-slate-100">Fixed Size</div>
                <div className="text-xs text-slate-400">
                  Splits text into equal-sized chunks of specified word count
                </div>
                {chunkingStrategy === "fixed" && (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      Words per chunk:
                      <input
                        type="number"
                        min="50"
                        max="1000"
                        value={customChunkSize}
                        onChange={(e) => setCustomChunkSize(e.target.value)}
                        className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
                      />
                    </label>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div
          className={`mt-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition ${borderClasses}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={onDrop}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-12 w-12 text-emerald-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16V4m0 0L8 8m4-4 4 4M6 20h12a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2Z"
            />
          </svg>
          <p className="mt-4 text-sm font-medium text-slate-100">
            Drop your PDF here or
            <label className="ml-1 cursor-pointer text-emerald-300 underline">
              browse
              <input type="file" accept="application/pdf" className="hidden" onChange={onSelectFile} />
            </label>
          </p>
          <p className="mt-2 text-xs text-slate-400">Only PDF files up to 10MB are supported.</p>
          {fileName ? (
            <p className="mt-4 text-xs text-slate-500">Selected: {fileName}</p>
          ) : (
            <p className="mt-4 text-xs text-slate-500">No file selected yet.</p>
          )}
        </div>

        {message && (
          <div className={`mt-6 text-sm ${statusClasses}`}>
            {message}
            {status === "success" && chunkCount != null ? (
              <span className="ml-2 text-slate-400">Indexed chunks: {chunkCount}</span>
            ) : null}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-base font-semibold text-slate-200">What happens next?</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-400 leading-relaxed">
            <li>PDF is converted to Markdown (or direct text extraction as fallback).</li>
            <li>Text is chunked using your selected strategy.</li>
            <li>Each chunk gets BM25 keywords and Gemini embeddings.</li>
            <li>Chunks are stored in Qdrant, ready for hybrid retrieval.</li>
          </ol>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          <h3 className="text-base font-semibold text-slate-200">Chunking Strategies</h3>
          <ul className="mt-4 space-y-3 leading-relaxed">
            <li><strong className="text-slate-300">Paragraph:</strong> Best for natural text flow, respects document structure.</li>
            <li><strong className="text-slate-300">Sentence:</strong> Maintains complete thoughts, good for precise queries.</li>
            <li><strong className="text-slate-300">Markdown:</strong> Preserves headers and sections, ideal for structured docs.</li>
            <li><strong className="text-slate-300">Fixed Size:</strong> Consistent chunk sizes, useful for uniform processing.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
          <h3 className="text-base font-semibold text-slate-200">Tips</h3>
          <ul className="mt-4 space-y-3 leading-relaxed">
            <li>Split very large documents to stay under the 10MB limit.</li>
            <li>Ensure scanned PDFs include selectable text; OCR is not applied.</li>
            <li>Choose chunking strategy based on your document type and query needs.</li>
            <li>Once processed, head to the Ask page to run your first query.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
