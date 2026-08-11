# Repository Guidelines

## Project Structure & Module Organization
- `src/app` houses Next.js App Router pages; `page.tsx` renders landing, `upload/page.tsx` handles ingestion UI, `ask/page.tsx` drives query form.
- API routes live under `src/app/api/{upload,query}/route.ts`, orchestrating PDF parsing, embedding, Qdrant calls, and Gemini responses.
- Shared ingestion logic is in `src/lib` (`chunking.ts`, `chunk-store.ts`, `bm25.ts`, `qdrant.ts`, `env.ts`); treat these modules as the single source of truth when adding features.
- Static assets and Tailwind globals sit in `public` and `src/app/globals.css`; build output goes to `.next/`.

### Python PDF-to-Markdown Microservice
- `python-service/` contains a FastAPI microservice (`main.py`) for converting PDF files to Markdown using `pymupdf4llm`.
- Service exposes `/convert` endpoint for PDF uploads and returns Markdown, with health endpoints for monitoring.
- See `python-service/README.md` for setup, API usage, and environment variables.

### Next.js Integration
- The upload API (`src/app/api/upload/route.ts`) first attempts to convert PDFs to Markdown via the Python service before falling back to direct PDF extraction.
- The Python service URL is configured via the `PYTHON_SERVICE_URL` environment variable (see `src/lib/env.ts`).
- Chunking logic in `src/lib/chunking.ts` now supports multiple strategies: `paragraph`, `sentence`, `fixed` (custom word count), and `markdown`.
- The Upload UI (`src/app/upload/page.tsx`) allows users to select a chunking strategy and specify a custom chunk size for fixed-size chunking.
- The upload API accepts `chunkingStrategy` and (if applicable) `customChunkSize` in the upload form data, and applies the selected chunking method to the document.



## Build, Test, and Development Commands
- `npm install` installs Next.js + Qdrant client dependencies; rerun after package updates.
- `npm run dev` starts the TurboPack dev server with hot reload; requires a reachable Qdrant instance and populated `.env.local`.
- `npm run build` creates an optimized production bundle; `npm run start` serves that bundle and should be used to vet deployment behaviour.
- `npm run lint` runs ESLint with the Next.js/TypeScript config; fix issues with `npm run lint -- --fix` before pushing.

### Python Service Setup
1. Start the Python service (`python main.py` in `python-service/`).
2. Set `PYTHON_SERVICE_URL` in your Next.js `.env.local`.
3. Start Next.js as usual; uploads will use the Python service if available.


