# PDF to Markdown Conversion Service

Simple FastAPI microservice that converts PDF documents to Markdown format using pymupdf4llm. This service runs locally alongside your Next.js application.

## Features

- **High-quality PDF to Markdown conversion** using pymupdf4llm
- **Structure preservation** - maintains headers, lists, tables, and formatting
- **Page range support** - convert specific pages or ranges
- **Fast and lightweight** - simple local service

## Local Development Setup

### 1. Create Virtual Environment

```bash
cd python-service
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Service

```bash
python main.py
```

The service will start on `http://localhost:8000`

You can customize the port by setting the `PORT` environment variable:
```bash
set PORT=8080  # Windows
export PORT=8080  # macOS/Linux
python main.py
```

## Using with Next.js

The Next.js upload API (`src/app/api/upload/route.ts`) is configured to call this service. Make sure to:

1. Start the Python service first (on port 8000)
2. Set `PYTHON_SERVICE_URL=http://localhost:8000` in your Next.js `.env.local` file
3. Start your Next.js app with `npm run dev`

The upload API will automatically use the Python service to convert PDFs to Markdown, and fall back to direct PDF extraction if the service is unavailable.

## API Documentation

Once running, visit:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

## API Endpoints

### POST /convert

Convert a PDF file to Markdown.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Parameters:
  - `file` (required): PDF file to convert
  - `pages` (optional): Page range (e.g., "1-5", "1,3,5", or "3")

**Example using curl:**
```bash
curl -X POST http://localhost:8000/convert -F "file=@sample.pdf"
```

**Response:**
```json
{
  "success": true,
  "markdown": "# Document Title\n\nContent...",
  "metadata": {
    "filename": "sample.pdf",
    "file_size_bytes": 12345,
    "word_count": 1500,
    "char_count": 9000
  }
}
```

### GET /health

Health check endpoint with version information.

```bash
curl http://localhost:8000/health
```

### GET /

Basic health check.

```bash
curl http://localhost:8000/
```

## Testing the Service

### Test with a PDF file:

```bash
curl -X POST http://localhost:8000/convert \
  -F "file=@your-document.pdf" \
  -o response.json
```

### Test with specific pages:

```bash
curl -X POST http://localhost:8000/convert \
  -F "file=@your-document.pdf" \
  -F "pages=1-5"
```

## Environment Variables

- `PORT`: Server port (default: 8000)

## Troubleshooting

**Port already in use:**
```bash
# Change the port
set PORT=8001  # Windows
python main.py
```

**Module not found errors:**
Make sure your virtual environment is activated and dependencies are installed:
```bash
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

## Dependencies

- **FastAPI**: Modern web framework for building APIs
- **pymupdf4llm**: PDF to Markdown conversion optimized for LLMs
- **uvicorn**: ASGI server for FastAPI
- **python-multipart**: For handling file uploads

