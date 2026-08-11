import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 shadow-xl shadow-emerald-500/5 lg:p-12">
        {/* Main Heading with gradient text */}
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Document Querying and Retrieval Simplified
        </h1>
        <p className="mt-6 max-w-3xl text-base text-slate-300 lg:text-lg">
          Upload PDFs, index them with hybrid BM25 and vector search, and get grounded answers with transparent citations powered by Gemini.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/upload"
            className="rounded-full bg-emerald-400 px-8 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 lg:px-10 lg:py-4"
          >
            Upload a PDF
          </Link>
          <Link
            href="/files"
            className="rounded-full border border-slate-600 px-8 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-300 hover:text-emerald-200 lg:px-10 lg:py-4"
          >
            View Files
          </Link>
          <Link
            href="/ask"
            className="rounded-full border border-slate-600 px-8 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-300 hover:text-emerald-200 lg:px-10 lg:py-4"
          >
            Ask a Question
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 lg:p-7">
          <h2 className="text-lg font-semibold text-slate-100">Hybrid Retrieval</h2>
          <p className="mt-2 text-sm text-slate-300">
            Combines BM25 keyword scores with semantic embeddings via Qdrant and blends results using Reciprocal Rank Fusion for high recall.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 lg:p-7">
          <h2 className="text-lg font-semibold text-slate-100">Grounded Answers</h2>
          <p className="mt-2 text-sm text-slate-300">
            gemini-flash-lite-latest summarizes the top three chunks and produces concise answers with document-level citations and sourced excerpts.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 lg:p-7">
          <h2 className="text-lg font-semibold text-slate-100">Fast PDF Ingest</h2>
          <p className="mt-2 text-sm text-slate-300">
            Extracts paragraphs with pdf-parse, chunks into 200-500 word segments, and indexes with Gemini embeddings.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 lg:p-7">
          <h2 className="text-lg font-semibold text-slate-100">Secure & Lightweight</h2>
          <p className="mt-2 text-sm text-slate-300">
            POC-ready configuration with environment-based secrets and support for concurrent uploads and queries.
          </p>
        </div>
      </section>
    </div>
  );
}
