# backend/main.py
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import logging
import uvicorn

from backend.core.config import BASE_DOWNLOAD_DIR
from backend.queue_manager import queue_manager

# Import your new routers
from backend.api import scrape, download, filesystem, transcribe # <--- ADD TRANSCRIBE HERE

# Configure global logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# --- FastAPI App Setup ---
app = FastAPI(
    title="Video Scraper & Converter API",
    description="API for scraping Japanese TV show videos, managing downloads, and organizing files for Jellyfin.",
    version="1.0.0"
)

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include API Routers ---
app.include_router(scrape.router, prefix="/api", tags=["Scraping"])
app.include_router(download.router, prefix="/api", tags=["Downloads & Queue"])
app.include_router(filesystem.router, prefix="/api", tags=["File System Management"])
app.include_router(transcribe.router, prefix="/api", tags=["Transcription"]) # <--- INCLUDE NEW ROUTER

# Graceful shutdown handler
@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shutdown the queue manager on app shutdown."""
    logging.info("Shutting down application...")
    queue_manager.shutdown()
    logging.info("Application shutdown complete.")

# Main entry point for uvicorn
if __name__ == "__main__":
    logging.info(f"Starting FastAPI application. Base download directory: {BASE_DOWNLOAD_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8005)
