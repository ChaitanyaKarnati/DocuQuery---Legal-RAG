# DocuQuery

Proof-of-concept hybrid retrieval and question answering system for legal PDFs. Documents are chunked and indexed with both BM25 keyword statistics and Gemini semantic embeddings in Qdrant. Queries run a reciprocal rank fusion over lexical and vector results and ground gemini-flash-lite-latest summaries with explicit citations.

## Features
- PDF upload with 10MB cap, text extraction via `pdf-parse`, and paragraph-preserving chunking (200-500 words).
- Hybrid indexing: BM25 statistics tracked in-memory and semantic vectors stored in Qdrant using `gemini-embedding-001`.
- Query pipeline retrieving top results from BM25 and Qdrant vector search, merged with reciprocal rank fusion.
- gemini-flash-lite-latest synthesis returning a concise summary plus structured citations (doc name, page, excerpt).
- Next.js App Router interface with dedicated upload and ask flows, styled with Tailwind CSS.

## Prerequisites
- Node.js 18+
- Python 3.11+ (for PDF-to-Markdown service)
- Running Qdrant instance (local or managed) with API access
- Gemini API key with access to gemini-flash-lite-latest and `gemini-embedding-001`

## Environment Variables
Create a `.env.local` file based on `.env.example`:

```
Gemini_API_KEY=your-Gemini-key
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY= # optional if Qdrant is unsecured
QDRANT_COLLECTION=legal_docs
PYTHON_SERVICE_URL=http://localhost:8000
```

## Install & Run

### Development Mode

**Terminal 1 - Python Service:**
```bash
cd python-service
pip install -r requirements.txt
python main.py
```

**Terminal 2 - Next.js App:**
```bash
npm install
npm run dev
```

Open http://localhost:3000 to access the UI. Use the **Upload** page to ingest PDFs, then the **Ask** page to query indexed documents.

### Docker Deployment

Build and run both services in a single container:

```bash
docker build -t docuquery .
docker run -p 8080:8080 \
  -e Gemini_API_KEY=your-key \
  -e QDRANT_URL=your-qdrant-url \
  -e QDRANT_API_KEY=your-key \
  docuquery
```

Open http://localhost:8080

### Cloud Run Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive instructions on deploying to Google Cloud Run.

## API Endpoints
- `POST /api/upload` - accepts multipart form data with a `file` field (PDF). Extracts, chunks, embeds, and stores vectors plus metadata in Qdrant.
- `POST /api/query` - accepts `{ "query": string }`. Performs hybrid retrieval, runs gemini-flash-lite-latest summarisation, and returns `{ answer, chunks }`.

## Notes
- Ensure PDFs contain selectable text; OCR is not performed.
- The BM25 index is rebuilt in-memory on boot by scanning Qdrant and is updated after each upload.
- Keep total latency under 5 seconds by running Qdrant close to the application server.
