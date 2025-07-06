# main.py (Updated for refined queue manager)

from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel
from scraper import scrape_video_links
from fastapi.middleware.cors import CORSMiddleware
from queue_manager import queue_manager, add_download_job, clear_finished_progress_from_backend  # Updated imports
from downloader import sanitize_and_strip_filename

import os
from pathlib import Path
import logging
import shutil

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
base_dir_from_env = os.getenv("BASE_DOWNLOAD_DIR_ENV")

if base_dir_from_env:
    BASE_DOWNLOAD_DIR = Path(base_dir_from_env).resolve()
else:
    BASE_DOWNLOAD_DIR = Path("/mnt/drive/Media/").resolve()
    logging.warning(f"BASE_DOWNLOAD_DIR_ENV not set. Using local development path: {BASE_DOWNLOAD_DIR}")

try:
    BASE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logging.info(f"Base download directory ensured: {BASE_DOWNLOAD_DIR}")
except OSError as e:
    logging.critical(f"Failed to create base download directory {BASE_DOWNLOAD_DIR}: {e}")
    raise RuntimeError(f"Critical error: Base download directory cannot be created: {e}")

# --- FastAPI App Setup ---
app = FastAPI()
api_router = APIRouter(prefix="/api")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Models ---
class ScrapeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    path: str # Target directory (relative to BASE_DOWNLOAD_DIR)
    title: str # Add title to the request

class FileSystemItem(BaseModel):
    name: str
    is_directory: bool
    size: int | None = None
    last_modified: float | None = None
    path: str

class MoveRenameRequest(BaseModel):
    source_path: str
    destination_path: str

class CreateFolderRequest(BaseModel):
    new_folder_path: str

class DeleteItemRequest(BaseModel):
    item_path: str

# --- Utility Function for Path Validation ---
def resolve_and_validate_path(relative_path: str) -> Path:
    resolved_path = (BASE_DOWNLOAD_DIR / relative_path).resolve()
    try:
        resolved_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        logging.warning(f"Path traversal attempt detected: {relative_path} resolved to {resolved_path}")
        raise HTTPException(status_code=403, detail="Access denied: Invalid path traversal attempt.")
    return resolved_path

# --- API ENDPOINTS ---

@api_router.post("/scrape")
def scrape(req: ScrapeRequest):
    result = scrape_video_links(req.url)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@api_router.post("/download")
async def download(req: DownloadRequest):
    full_target_dir = resolve_and_validate_path(req.path)

    try:
        full_target_dir.mkdir(parents=True, exist_ok=True)
        logging.info(f"Target download directory ensured: {full_target_dir}")
    except OSError as e:
        logging.error(f"Failed to create target directory {full_target_dir}: {e}")
        raise HTTPException(status_code=500, detail=f"Server could not create target directory: {e}")

    # Calculate expected filename using same sanitization as downloader
    base_filename_from_frontend = os.path.basename(req.title)
    expected_filename = sanitize_and_strip_filename(base_filename_from_frontend)
    expected_filepath = full_target_dir / expected_filename

    logging.info(f"DEBUG: Checking for existence of: '{expected_filepath}' (derived from req.title: '{req.title}')")

    if expected_filepath.exists():
        logging.info(f"Download for {req.url} skipped: File '{expected_filename}' already exists at {full_target_dir}.")
        raise HTTPException(status_code=409, detail=f"File '{expected_filename}' already exists at the chosen location.")

    # Add download job using the refined queue manager
    success = add_download_job(req.url, str(full_target_dir))
    if not success:
        raise HTTPException(status_code=409, detail="Download already in progress for this URL.")

    return {"status": "queued", "message": f"Download for {req.url} queued. Conversion will start automatically after download."}

@api_router.get("/progress")
def get_progress():
    """Get all current download progress."""
    return queue_manager.get_all_progress()

@api_router.get("/progress/{url}")
def get_progress_for_url(url: str):
    """Get progress for a specific URL."""
    progress = queue_manager.get_progress(url)
    if progress is None:
        raise HTTPException(status_code=404, detail="URL not found in progress tracking.")
    return progress

@api_router.post("/clear_progress")
def clear_progress_endpoint():
    """Clear finished entries from progress tracking."""
    cleared_count = clear_finished_progress_from_backend()
    logging.info(f"API: Cleared {cleared_count} finished entries from active downloads.")
    return {"message": f"Cleared {cleared_count} finished entries from progress list."}

@api_router.post("/queue/config")
def update_queue_config(enable_transcription: bool = False):
    """Update queue configuration (useful for enabling transcription later)."""
    queue_manager.enable_transcription = enable_transcription
    return {"message": f"Transcription {'enabled' if enable_transcription else 'disabled'}"}

@api_router.get("/queue/stats")
def get_queue_stats():
    """Get current queue statistics."""
    all_progress = queue_manager.get_all_progress()
    stats = {
        "total_jobs": len(all_progress),
        "by_status": {}
    }

    for progress in all_progress.values():
        status = progress["status"]
        stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

    return stats

# --- FILE SYSTEM ENDPOINTS ---

@api_router.get("/filesystems/list")
async def list_contents(current_path: str = ""):
    try:
        resolved_full_path = resolve_and_validate_path(current_path)
    except HTTPException as e:
        raise e

    if not resolved_full_path.exists():
        raise HTTPException(status_code=404, detail="Directory not found.")
    if not resolved_full_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory.")

    items = []
    try:
        for item_name in os.listdir(resolved_full_path):
            item_full_path = resolved_full_path / item_name
            is_directory = item_full_path.is_dir()

            size = None
            last_modified = None

            if not is_directory:
                try:
                    size = item_full_path.stat().st_size
                    last_modified = item_full_path.stat().st_mtime
                except OSError as e:
                    logging.warning(f"Could not get stats for file {item_full_path}: {e}")
                    pass

            relative_path_for_frontend = item_full_path.relative_to(BASE_DOWNLOAD_DIR).as_posix()

            items.append(FileSystemItem(
                name=item_name,
                is_directory=is_directory,
                size=size,
                last_modified=last_modified,
                path=relative_path_for_frontend
            ))

        items.sort(key=lambda x: (not x.is_directory, x.name.lower()))
        return items
    except PermissionError:
        logging.error(f"Permission denied to access directory: {resolved_full_path}")
        raise HTTPException(status_code=403, detail="Permission denied to access this directory.")
    except Exception as e:
        logging.exception(f"An unexpected error occurred while listing directory {resolved_full_path}:")
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

@api_router.post("/filesystems/move")
async def move_item(req: MoveRenameRequest):
    try:
        source_abs_path = resolve_and_validate_path(req.source_path)
        destination_abs_path = resolve_and_validate_path(req.destination_path)

        if not source_abs_path.exists():
            raise HTTPException(status_code=404, detail="Source item not found.")
        if destination_abs_path.exists():
            raise HTTPException(status_code=409, detail="Destination path already exists.")

        shutil.move(str(source_abs_path), str(destination_abs_path))
        logging.info(f"Moved/Renamed {source_abs_path} to {destination_abs_path}")
        return {"status": "success", "message": "Item moved/renamed successfully."}
    except HTTPException:
        raise
    except PermissionError:
        logging.error(f"Permission denied to move {req.source_path} to {req.destination_path}")
        raise HTTPException(status_code=403, detail="Permission denied to perform this operation.")
    except Exception as e:
        logging.exception(f"Error moving item from {req.source_path} to {req.destination_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to move item: {e}")

@api_router.post("/filesystems/create-folder")
async def create_folder(req: CreateFolderRequest):
    try:
        new_folder_abs_path = resolve_and_validate_path(req.new_folder_path)

        if new_folder_abs_path.exists():
            raise HTTPException(status_code=409, detail="Folder already exists at this path.")

        new_folder_abs_path.mkdir(parents=True, exist_ok=False)
        logging.info(f"Created folder: {new_folder_abs_path}")
        return {"status": "success", "message": "Folder created successfully."}
    except HTTPException:
        raise
    except PermissionError:
        logging.error(f"Permission denied to create folder: {req.new_folder_path}")
        raise HTTPException(status_code=403, detail="Permission denied to create folder.")
    except Exception as e:
        logging.exception(f"Error creating folder {req.new_folder_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {e}")

@api_router.delete("/filesystems/delete")
async def delete_item(req: DeleteItemRequest):
    try:
        item_abs_path = resolve_and_validate_path(req.item_path)

        if not item_abs_path.exists():
            raise HTTPException(status_code=404, detail="Item not found.")

        if item_abs_path.is_dir():
            shutil.rmtree(str(item_abs_path))
            logging.info(f"Recursively deleted directory: {item_abs_path}")
        else:
            item_abs_path.unlink()
            logging.info(f"Deleted file: {item_abs_path}")

        return {"status": "success", "message": "Item deleted successfully."}
    except HTTPException:
        raise
    except PermissionError:
        logging.error(f"Permission denied to delete item: {req.item_path}")
        raise HTTPException(status_code=403, detail="Permission denied to delete this item.")
    except OSError as e:
        if "Directory not empty" in str(e):
            raise HTTPException(status_code=400, detail="Cannot delete non-empty directory. Please delete its contents first.")
        logging.exception(f"OS error deleting item {req.item_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")
    except Exception as e:
        logging.exception(f"Unexpected error deleting item {req.item_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")

# Include the API router in the main app
app.include_router(api_router)

# Graceful shutdown handler
@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shutdown the queue manager on app shutdown."""
    logging.info("Shutting down application...")
    queue_manager.shutdown()

# Main entry point for uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
