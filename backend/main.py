# main.py (Updated /api/download and DownloadRequest)

from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel
from scraper import scrape_video_links
from fastapi.middleware.cors import CORSMiddleware
from queue_manager import add_download_job, downloads # 'downloads' is for the /progress endpoint
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

# --- Request Models (UPDATED DownloadRequest) ---
class ScrapeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    path: str # Target directory (relative to BASE_DOWNLOAD_DIR)
    title: str # NEW: Add title to the request

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

# --- Utility Function for Path Validation (no change here) ---
def resolve_and_validate_path(relative_path: str) -> Path:
    resolved_path = (BASE_DOWNLOAD_DIR / relative_path).resolve()
    try:
        resolved_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        logging.warning(f"Path traversal attempt detected: {relative_path} resolved to {resolved_path}")
        raise HTTPException(status_code=403, detail="Access denied: Invalid path traversal attempt.")
    return resolved_path

# --- EXISTING ENDPOINTS ---

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

    # --- UPDATED FILENAME CALCULATION: USE THE SHARED SANITIZATION ---
    # First, get the base filename from the frontend's title (which is videoDetail.filename)
    base_filename_from_frontend = os.path.basename(req.title)

    # Now, apply the EXACT SAME sanitization logic as your downloader.py
    expected_filename = sanitize_and_strip_filename(base_filename_from_frontend)

    expected_filepath = full_target_dir / expected_filename

    logging.info(f"DEBUG: Checking for existence of: '{expected_filepath}' (derived from req.title: '{req.title}')")

    if expected_filepath.exists():
        logging.info(f"Download for {req.url} skipped: File '{expected_filename}' already exists at {full_target_dir}.")
        raise HTTPException(status_code=409, detail=f"File '{expected_filename}' already exists at the chosen location.")

    # Call the manager to add the job, passing the full target directory path and URL
    # queue_manager.add_download_job will now NOT check completed_urls
    success = add_download_job(req.url, str(full_target_dir))
    if not success:
        # This will now typically only happen if the URL is already IN PROGRESS
        # (as the existence check handles 'completed' status)
        raise HTTPException(status_code=409, detail="Download already in progress for this URL.")

    return {"status": "queued", "message": f"Download for {req.url} queued. Conversion will start automatically after download."}




@api_router.get("/progress")
def get_progress():
    # queue_manager.downloads should still be used here for in-progress tasks
    return downloads.copy() # Use .copy() to return a snapshot

@api_router.post("/clear_progress")
def clear_progress_endpoint():
    # This function is unchanged and still desirable for clearing the *active* progress view
    cleared_count = queue_manager.clear_finished_progress_from_backend()
    logging.info(f"API: Cleared {cleared_count} finished entries from active downloads.")
    return {"message": f"Cleared {cleared_count} finished entries from progress list."}

# --- FILE SYSTEM Browse ENDPOINTS (unchanged logic, just part of the router) ---

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

# Main entry point for uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
