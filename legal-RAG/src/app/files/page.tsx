"use client";

import { useCallback, useEffect, useState } from "react";

interface FileInfo {
  documentName: string;
  chunkCount: number;
  totalWords: number;
  pageRange: { min: number; max: number };
}

interface FilesResponse {
  files: FileInfo[];
  totalFiles: number;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/files");
      const data = (await response.json()) as FilesResponse | { error: string; details?: string };

      if (!response.ok) {
        const errorData = data as { error: string; details?: string };
        throw new Error(errorData.details || errorData.error || "Failed to fetch files");
      }

      const filesData = data as FilesResponse;
      setFiles(filesData.files);
      setTotalFiles(filesData.totalFiles);
      setStatus("success");
    } catch (error) {
      console.error("Error loading files:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to load files");
    }
  }, []);

  const deleteFile = useCallback(async (documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingFile(documentName);

    try {
      const response = await fetch(`/api/files?documentName=${encodeURIComponent(documentName)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json() as { error: string; details?: string };
        throw new Error(errorData.details || errorData.error || "Failed to delete file");
      }

      // Refresh the file list
      await loadFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete file");
      setStatus("error");
    } finally {
      setDeletingFile(null);
    }
  }, [loadFiles]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-emerald-500/5 lg:p-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50 lg:text-4xl">
              Indexed Files
            </h1>
            <p className="mt-3 text-sm text-slate-300 lg:text-base">
              Browse all documents currently stored in the Qdrant database.
            </p>
          </div>
          <button
            onClick={loadFiles}
            disabled={status === "loading"}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-emerald-300 hover:text-emerald-200 disabled:opacity-50"
          >
            {status === "loading" ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {status === "loading" && files.length === 0 && (
          <div className="mt-8 text-center text-slate-400">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400"></div>
            <p className="mt-4">Loading files...</p>
          </div>
        )}

        {status === "error" && (
          <div className="mt-8 rounded-lg border border-rose-900/50 bg-rose-950/20 p-4 text-rose-300">
            <p className="font-medium">Error loading files</p>
            <p className="mt-1 text-sm text-rose-400">{errorMessage}</p>
          </div>
        )}

        {status === "success" && files.length === 0 && (
          <div className="mt-8 rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="mx-auto h-12 w-12 text-slate-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-4 text-slate-400">No files indexed yet</p>
            <p className="mt-2 text-sm text-slate-500">Upload a PDF to get started</p>
          </div>
        )}

        {status === "success" && files.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Total documents: <span className="font-semibold text-emerald-300">{totalFiles}</span>
              </p>
              <p className="text-sm text-slate-400">
                Total chunks:{" "}
                <span className="font-semibold text-emerald-300">
                  {files.reduce((sum, file) => sum + file.chunkCount, 0)}
                </span>
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-800 bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Document Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Chunks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Total Words
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Page Range
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {files.map((file) => (
                      <tr key={file.documentName} className="transition hover:bg-slate-800/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="h-5 w-5 flex-shrink-0 text-emerald-400"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="break-all text-sm font-medium text-slate-100">
                              {file.documentName}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">{file.chunkCount}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {file.totalWords.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {file.pageRange.min === file.pageRange.max
                            ? `Page ${file.pageRange.min}`
                            : `Pages ${file.pageRange.min}-${file.pageRange.max}`}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => void deleteFile(file.documentName)}
                            disabled={deletingFile === file.documentName}
                            className="rounded border border-rose-600 bg-rose-900/20 px-3 py-1 text-sm font-medium text-rose-300 transition hover:border-rose-500 hover:bg-rose-900/40 disabled:opacity-50"
                            title="Delete file"
                          >
                            {deletingFile === file.documentName ? (
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 animate-spin rounded-full border border-rose-400 border-t-transparent"></div>
                                Deleting...
                              </div>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-base font-semibold text-slate-200">About This View</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          This page displays all documents that have been ingested and indexed in the Qdrant vector
          database. Each document is shown with its chunk count, total word count, and page range.
          The system uses hybrid search combining BM25 keyword matching and semantic vector search
          to retrieve relevant information when you query these documents.
        </p>
      </aside>
    </div>
  );
}
