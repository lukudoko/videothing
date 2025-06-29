# main.py (Updated for Path Validation)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from scraper import scrape_video_links
from fastapi.middleware.cors import CORSMiddleware
from queue_manager import add_download_job, downloads as manager_downloads

import os
from pathlib import Path # Import Path for robust path handling
import logging # For better logging later, but good to import now

# --- Configuration ---
# Define your base download directory. This MUST be an absolute path.
# Make sure your FastAPI application has read/write permissions to this directory.
# Example for Linux/macOS:
base_dir_from_env = os.getenv("BASE_DOWNLOAD_DIR_ENV")

if base_dir_from_env:
    BASE_DOWNLOAD_DIR = Path(base_dir_from_env).resolve()
else:
    # Fallback for local development outside Docker
    # This should point to your local development media folder
    BASE_DOWNLOAD_DIR = Path("/home/hlab/Documents/videothing/").resolve()
    print(f"Warning: BASE_DOWNLOAD_DIR_ENV not set. Using local development path: {BASE_DOWNLOAD_DIR}")

# You can add checks to ensure the path exists if desired
if not BASE_DOWNLOAD_DIR.exists():
    print(f"Error: BASE_DOWNLOAD_DIR path does not exist: {BASE_DOWNLOAD_DIR}")
    # You might want to raise an exception or handle this more robustly
    # For a production app, this would likely be a fatal error during startup.
# Example for Windows:
# BASE_DOWNLOAD_DIR = Path("C:/HomelabDownloads").resolve()

# Ensure the base directory exists when the app starts
try:
    BASE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logging.info(f"Base download directory ensured: {BASE_DOWNLOAD_DIR}")
except OSError as e:
    logging.critical(f"Failed to create base download directory {BASE_DOWNLOAD_DIR}: {e}")
    # You might want to exit or raise an error if the base dir is critical for app function
    # For now, let's just log it.

# --- FastAPI App Setup ---
app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class ScrapeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    path: str # This `path` will now be relative to BASE_DOWNLOAD_DIR (e.g., "tv_shows/anime")

# Endpoints
@app.post("/scrape")
def scrape(req: ScrapeRequest):
    result = scrape_video_links(req.url)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/download")
async def download(req: DownloadRequest):
    # Construct the full, absolute path using the base directory
    # User's req.path should be treated as a *relative* path within BASE_DOWNLOAD_DIR
    full_target_path = (BASE_DOWNLOAD_DIR / req.path).resolve()

    # --- SECURITY CHECK ---
    # 1. Ensure the resolved path is indeed a sub-path of BASE_DOWNLOAD_DIR
    try:
        full_target_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid download path specified. Path must be within the allowed download directory.")

    # 2. Ensure the specific target directory exists (create it if not)
    try:
        full_target_path.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Server could not create target directory: {e}")

    # Pass the fully validated and resolved path to the queue manager
    success = add_download_job(req.url, str(full_target_path))
    if not success:
        raise HTTPException(status_code=409, detail="Download already queued or in progress for this URL.")

    return {"status": "queued", "message": f"Download for {req.url} queued. Conversion will start automatically after download."}

@app.get("/progress")
def get_progress():
    return manager_downloads
