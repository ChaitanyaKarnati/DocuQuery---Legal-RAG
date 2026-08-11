"use client";

import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { Search, FileText, CheckCircle, Sparkles, ChevronDown } from "lucide-react";

interface Citation {
  documentName: string;
  pageNumber: number;
  excerpt: string;
}

interface RetrievedChunk {
  id: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
}

interface QueryResponsePayload {
  answer: {
    summary: string;
    citations: Citation[];
  };
  chunks: RetrievedChunk[];
  error?: unknown;
  details?: unknown;
}

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<QueryResponsePayload["answer"] | null>(null);
  const [chunks, setChunks] = useState<RetrievedChunk[]>([]);
  const [showChunks, setShowChunks] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setAnswer(null);
      setChunks([]);
      setShowChunks(false);

      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        setError("Enter a question to search your documents.");
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: trimmedQuery }),
        });

        const payload = (await response.json()) as QueryResponsePayload;
        if (!response.ok) {
          const errorMessage =
            typeof payload.details === "string"
              ? payload.details
              : typeof payload.error === "string"
                ? payload.error
                : "Query failed";
          throw new Error(errorMessage);
        }

        setAnswer(payload.answer);
        setChunks(payload.chunks);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Unable to complete the search");
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    []
  );

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 -z-10" />
      <div className="relative z-10">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
        {/* Header Section */}
        <div className="mb-8 text-center lg:mb-12">
          <div className="mb-4 flex justify-center">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-400/20 p-4 shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-8 w-8 text-emerald-300" />
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent lg:text-5xl">
            DocuQuery
          </h1>
          <p className="mt-3 text-slate-400 lg:text-lg">
            Ask questions and get instant answers from your documents
          </p>
        </div>

        {/* Search Card */}
        <div className="mb-8 rounded-3xl border border-slate-800/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-6 shadow-2xl backdrop-blur-sm lg:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 blur transition group-focus-within:opacity-20"></div>
              <div className="relative flex items-center">
                <Search className="absolute left-5 h-5 w-5 text-slate-400 transition group-focus-within:text-emerald-400" />
                <input
                  type="text"
                  value={query}
                  onChange={handleChange}
                  placeholder="What would you like to know about your documents?"
                  className="w-full rounded-2xl border border-slate-700/50 bg-slate-900/90 py-5 pl-14 pr-32 text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-400/50 focus:bg-slate-900"
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="absolute right-2 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:shadow-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></div>
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span>Search</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-start gap-2 rounded-xl bg-slate-800/30 px-4 py-3">
              <div className="mt-0.5 rounded-full bg-emerald-400/20 p-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                <span className="font-medium text-slate-300">Pro tip:</span> Ask specific, factual questions for best results. The system uses hybrid search with BM25 + semantic vectors.
              </p>
            </div>
          </form>

          {/* Error State */}
          {error && (
            <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-rose-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-rose-500/20 p-1.5">
                    <svg className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-rose-200">Error</h3>
                    <p className="mt-1 text-sm text-rose-300/90">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Answer Section */}
        {answer && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Answer Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 via-teal-400/10 to-emerald-400/5 p-6 shadow-2xl shadow-emerald-500/10 lg:p-8">
              <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl"></div>
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-400/20 p-2 shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                    Answer
                  </h2>
                </div>
                <p className="text-lg leading-relaxed text-slate-50 lg:text-xl">
                  {answer.summary}
                </p>
              </div>
            </div>

            {/* Citations */}
            {answer.citations.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                    Sources ({answer.citations.length})
                  </h3>
                </div>
                
                <div className="grid gap-4 lg:grid-cols-2">
                  {answer.citations.map((citation, index) => (
                    <div
                      key={`${citation.documentName}-${citation.pageNumber}-${index}`}
                      className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-900/50 p-5 shadow-lg backdrop-blur-sm transition hover:border-emerald-400/30 hover:shadow-xl hover:shadow-emerald-500/5"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeInUp 0.5s ease-out backwards'
                      }}
                    >
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/5 blur-2xl transition group-hover:bg-emerald-400/10"></div>
                      
                      <div className="relative flex gap-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-400/20 text-sm font-bold text-emerald-300 shadow-lg shadow-emerald-500/20">
                          {index + 1}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-100">
                              {citation.documentName}
                            </span>
                            <span className="rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                              Page {citation.pageNumber}
                            </span>
                          </div>
                          
                          <blockquote className="border-l-2 border-emerald-400/40 pl-4 text-sm italic leading-relaxed text-slate-300">
                            &ldquo;{citation.excerpt}&rdquo;
                          </blockquote>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Citations State */}
            {answer.citations.length === 0 && (
              <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6 text-center backdrop-blur-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/50">
                  <FileText className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-sm text-slate-400">No supporting citations found</p>
              </div>
            )}

            {/* Retrieved Sources Toggle */}
            {chunks.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <button
                  onClick={() => setShowChunks(!showChunks)}
                  className="group flex w-full items-center justify-between rounded-2xl border border-slate-800/50 bg-slate-900/30 p-4 transition hover:border-slate-700 hover:bg-slate-900/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-800/50 p-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-slate-300">
                        Retrieved Sources
                      </h3>
                      <p className="text-xs text-slate-500">
                        View top {chunks.length} fused results
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      showChunks ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showChunks && (
                  <div className="mt-4 grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300 lg:grid-cols-2">
                    {chunks.map((chunk, index) => (
                      <article
                        key={chunk.id}
                        className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5 shadow-lg backdrop-blur-sm"
                        style={{
                          animationDelay: `${index * 30}ms`,
                          animation: 'fadeInUp 0.4s ease-out backwards'
                        }}
                      >
                        <header className="mb-4 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100">
                            {chunk.documentName}
                          </span>
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            Page {chunk.pageNumber}
                          </span>
                          <span className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400">
                            Chunk {chunk.chunkIndex}
                          </span>
                        </header>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                          {chunk.text}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!answer && !loading && !error && (
          <div className="mt-12 text-center animate-in fade-in duration-700">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 shadow-xl">
              <Search className="h-10 w-10 text-slate-600" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-300">
              Ready to search
            </h3>
            <p className="text-sm text-slate-500">
              Enter your question above to get started
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
    </>
  );
}