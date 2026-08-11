"""
FastAPI microservice for converting PDF files to Markdown.

This service provides a single endpoint that accepts PDF files
and returns Markdown-formatted text using pymupdf4llm.
"""

import io
import logging
import tempfile
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pymupdf4llm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF to Markdown Converter",
    description="Microservice for converting PDF documents to Markdown format",
    version="1.0.0"
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB limit


@app.get("/")
async def health_check():
    """Health check endpoint for Cloud Run and monitoring."""
    return {"status": "healthy", "service": "pdf-to-markdown"}


@app.post("/convert")
async def convert_pdf_to_markdown(
    file: UploadFile = File(...),
    pages: Optional[str] = None
) -> JSONResponse:
    """
    Convert a PDF file to Markdown format.
    
    Args:
        file: PDF file to convert
        pages: Optional page range (e.g., "1-5" or "1,3,5")
    
    Returns:
        JSON with markdown content and metadata
    """
    # Validate file type
    if not file.content_type or file.content_type != "application/pdf":
        logger.warning(f"Invalid content type: {file.content_type}")
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )
    
    # Read file content
    try:
        content = await file.read()
        file_size = len(content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum size of {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB"
            )
        
        logger.info(f"Processing PDF: {file.filename} ({file_size} bytes)")
        
        # Convert PDF to Markdown using pymupdf4llm
        # This library is specifically designed for LLM applications
        # and preserves document structure well
        
        # Create a temporary file to handle the PDF content
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Parse page range if provided
            page_chunks = None
            if pages:
                try:
                    # pymupdf4llm uses page_chunks parameter for specific pages
                    # Format: [[start, end], [start, end], ...]
                    if "-" in pages:
                        start, end = pages.split("-")
                        page_chunks = [[int(start) - 1, int(end) - 1]]
                    elif "," in pages:
                        page_list = [int(p.strip()) - 1 for p in pages.split(",")]
                        page_chunks = [[p, p] for p in page_list]
                    else:
                        page_num = int(pages) - 1
                        page_chunks = [[page_num, page_num]]
                except ValueError:
                    logger.warning(f"Invalid page range format: {pages}")
            
            # Convert PDF to markdown
            markdown_result = pymupdf4llm.to_markdown(
                temp_file_path,
                page_chunks=page_chunks,
                write_images=False,  # Don't extract images for now
                show_progress=False
            )
            
            # pymupdf4llm can return a list of page dictionaries or a string
            # Handle both cases
            if isinstance(markdown_result, list):
                # Extract text from list of page dictionaries
                markdown_text = "\n\n".join(
                    page.get("text", "") if isinstance(page, dict) else str(page)
                    for page in markdown_result
                )
            else:
                markdown_text = markdown_result
        finally:
            # Clean up the temporary file
            import os
            os.unlink(temp_file_path)
        
        if not markdown_text or len(markdown_text.strip()) == 0:
            logger.error("Failed to extract text from PDF")
            raise HTTPException(
                status_code=422,
                detail="Unable to extract text from PDF"
            )
        
        # Get basic metadata
        word_count = len(markdown_text.split())
        char_count = len(markdown_text)
        
        logger.info(
            f"Successfully converted {file.filename}: "
            f"{word_count} words, {char_count} characters"
        )
        
        return JSONResponse(
            content={
                "success": True,
                "markdown": markdown_text,
                "metadata": {
                    "filename": file.filename,
                    "file_size_bytes": file_size,
                    "word_count": word_count,
                    "char_count": char_count
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to convert PDF: {str(e)}"
        )


@app.get("/health")
async def detailed_health():
    """Detailed health check with version info."""
    import pymupdf
    return {
        "status": "healthy",
        "service": "pdf-to-markdown",
        "version": "1.0.0",
        "dependencies": {
            "pymupdf": pymupdf.__version__,
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
