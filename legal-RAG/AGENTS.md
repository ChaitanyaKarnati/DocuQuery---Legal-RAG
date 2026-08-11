
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
- New chunking logic (`chunkMarkdown`) added to `src/lib/chunking.ts` for improved Markdown chunking.



## Build, Test, and Development Commands
- `npm install` installs Next.js + Qdrant client dependencies; rerun after package updates.
- `npm run dev` starts the TurboPack dev server with hot reload; requires a reachable Qdrant instance and populated `.env.local`.
- `npm run build` creates an optimized production bundle; `npm run start` serves that bundle and should be used to vet deployment behaviour.
- `npm run lint` runs ESLint with the Next.js/TypeScript config; fix issues with `npm run lint -- --fix` before pushing.

### Python Service Setup
1. Start the Python service (`python main.py` in `python-service/`).
2. Set `PYTHON_SERVICE_URL` in your Next.js `.env.local`.
3. Start Next.js as usual; uploads will use the Python service if available.



## Coding Style & Naming Conventions
- TypeScript everywhere; prefer named exports for shared helpers in `src/lib` and default exports for App Router components.
- Use 2-space indentation, `camelCase` for variables/functions, `PascalCase` for React components, and keep Tailwind utility classes grouped by layout → color → state.
- Centralize configuration in `src/lib/env.ts`; avoid accessing `process.env` outside that module.
- Python microservice follows PEP8 and FastAPI conventions; see `python-service/README.md` for details.



## Testing Guidelines
- There is no dedicated test runner yet; rely on `npm run lint` plus functional checks through the UI.
- Exercise the ingestion path with a small PDF and verify entries in Qdrant after each change.
- Smoke-test the API layer with a local call such as:
  ```bash
  curl -X POST http://localhost:3000/api/query -H "Content-Type: application/json" -d '{"query":"Summarize the NDA"}'
  ```
- Document any new manual test scenarios in the PR description until automated coverage is introduced.
- For Python service, test with:
  ```bash
  curl -X POST http://localhost:8000/convert -F "file=@sample.pdf"
  ```



## Commit & Pull Request Guidelines
- Follow Conventional Commit prefixes (`feat`, `fix`, `chore`) as seen in `git log`.
- Keep commits scoped to one concern and include schema or env updates in the same commit as the code that needs them.
- PRs should describe the change, list manual test steps, link relevant issues, and attach before/after screenshots for UI tweaks.
- Flag any migrations or Qdrant schema changes in the PR title so deployers can plan updates.

