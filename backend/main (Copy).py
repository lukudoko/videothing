# main.py (Updated for Path Validation and File Browse)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from scraper import scrape_video_links
from fastapi.middleware.cors import CORSMiddleware
from queue_manager import add_download_job, downloads as manager_downloads

import os
from pathlib import Path
import logging
import shutil # New: For moving/deleting files and directories

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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
    BASE_DOWNLOAD_DIR = Path("/mnt/drive/Media/").resolve()
    logging.warning(f"BASE_DOWNLOAD_DIR_ENV not set. Using local development path: {BASE_DOWNLOAD_DIR}")

# Ensure the base directory exists when the app starts
try:
    BASE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logging.info(f"Base download directory ensured: {BASE_DOWNLOAD_DIR}")
except OSError as e:
    logging.critical(f"Failed to create base download directory {BASE_DOWNLOAD_DIR}: {e}")
    # For a production app, you might want to exit here if the base dir is critical
    raise RuntimeError(f"Critical error: Base download directory cannot be created: {e}")

# --- FastAPI App Setup ---
app = FastAPI()

# CORS setup
# Keep allow_origins=["*"] for development, but restrict it in production!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Consider narrowing this in production, e.g., ["http://localhost:3000", "http://your-homelab-ip:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Models ---
class ScrapeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    path: str # This `path` will now be relative to BASE_DOWNLOAD_DIR (e.g., "tv_shows/anime")

# --- NEW: File System Models ---
class FileSystemItem(BaseModel):
    name: str
    is_directory: bool
    size: int | None = None  # in bytes
    last_modified: float | None = None # Unix timestamp
    path: str # Relative path from BASE_DOWNLOAD_DIR

class MoveRenameRequest(BaseModel):
    source_path: str # Relative to BASE_DOWNLOAD_DIR
    destination_path: str # Relative to BASE_DOWNLOAD_DIR

class CreateFolderRequest(BaseModel):
    new_folder_path: str # Relative to BASE_DOWNLOAD_DIR

class DeleteItemRequest(BaseModel):
    item_path: str # Relative to BASE_DOWNLOAD_DIR

# --- Utility Function for Path Validation (CRITICAL FOR SECURITY) ---
def resolve_and_validate_path(relative_path: str) -> Path:
    """
    Resolves a relative path to an absolute path within BASE_DOWNLOAD_DIR
    and performs security checks to prevent directory traversal.
    """
    # Normalize the path to handle ".." and other relative indicators safely
    resolved_path = (BASE_DOWNLOAD_DIR / relative_path).resolve()

    # Check if the resolved path is actually a sub-path of BASE_DOWNLOAD_DIR
    try:
        resolved_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        # If relative_to fails, it means resolved_path is not a child of BASE_DOWNLOAD_DIR
        logging.warning(f"Path traversal attempt detected: {relative_path} resolved to {resolved_path}")
        raise HTTPException(status_code=403, detail="Access denied: Invalid path traversal attempt.")

    return resolved_path

# --- EXISTING ENDPOINTS ---
@app.post("/scrape")
def scrape(req: ScrapeRequest):
    result = scrape_video_links(req.url)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/download")
async def download(req: DownloadRequest):
    # Use the new utility function for path validation
    full_target_path = resolve_and_validate_path(req.path)

    # Ensure the specific target directory exists (create it if not)
    try:
        full_target_path.mkdir(parents=True, exist_ok=True)
        logging.info(f"Target download directory ensured: {full_target_path}")
    except OSError as e:
        logging.error(f"Failed to create target directory {full_target_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Server could not create target directory: {e}")

    # Pass the fully validated and resolved path to the queue manager
    success = add_download_job(req.url, str(full_target_path))
    if not success:
        raise HTTPException(status_code=409, detail="Download already queued or in progress for this URL.")

    return {"status": "queued", "message": f"Download for {req.url} queued. Conversion will start automatically after download."}

@app.get("/progress")
def get_progress():
    return manager_downloads

# --- NEW: FILE SYSTEM Browse ENDPOINTS ---

@app.get("/api/filesystems/list")
async def list_contents(current_path: str = ""):
    """
    Lists the contents of a directory relative to BASE_DOWNLOAD_DIR.
    """
    # Resolve and validate the requested path
    try:
        resolved_full_path = resolve_and_validate_path(current_path)
    except HTTPException as e:
        raise e # Re-raise if it's a validation error

    if not resolved_full_path.exists():
        raise HTTPException(status_code=404, detail="Directory not found.")

    if not resolved_full_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory.")

    items = []
    try:
        for item_name in os.listdir(resolved_full_path):
            item_full_path = resolved_full_path / item_name # Use Path objects for joining
            is_directory = item_full_path.is_dir()

            size = None
            last_modified = None

            if not is_directory:
                try:
                    size = item_full_path.stat().st_size
                    last_modified = item_full_path.stat().st_mtime
                except OSError as e:
                    logging.warning(f"Could not get stats for file {item_full_path}: {e}")
                    pass # Silently fail or log if file is inaccessible

            # Calculate the path relative to BASE_DOWNLOAD_DIR for the frontend
            # Use as_posix() to ensure forward slashes, which are standard for URLs/web paths
            relative_path_for_frontend = item_full_path.relative_to(BASE_DOWNLOAD_DIR).as_posix()

            items.append(FileSystemItem(
                name=item_name,
                is_directory=is_directory,
                size=size,
                last_modified=last_modified,
                path=relative_path_for_frontend
            ))

        # Sort directories first, then files, both alphabetically (case-insensitive)
        items.sort(key=lambda x: (not x.is_directory, x.name.lower()))

        return items
    except PermissionError:
        logging.error(f"Permission denied to access directory: {resolved_full_path}")
        raise HTTPException(status_code=403, detail="Permission denied to access this directory.")
    except Exception as e:
        logging.exception(f"An unexpected error occurred while listing directory {resolved_full_path}:")
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

@app.post("/api/filesystems/move")
async def move_item(req: MoveRenameRequest):
    """Moves or renames a file/folder."""
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
        raise # Re-raise FastAPI HTTP exceptions
    except PermissionError:
        logging.error(f"Permission denied to move {req.source_path} to {req.destination_path}")
        raise HTTPException(status_code=403, detail="Permission denied to perform this operation.")
    except Exception as e:
        logging.exception(f"Error moving item from {req.source_path} to {req.destination_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to move item: {e}")

@app.post("/api/filesystems/create-folder")
async def create_folder(req: CreateFolderRequest):
    """Creates a new folder."""
    try:
        new_folder_abs_path = resolve_and_validate_path(req.new_folder_path)

        if new_folder_abs_path.exists():
            raise HTTPException(status_code=409, detail="Folder already exists at this path.")

        new_folder_abs_path.mkdir(parents=True, exist_ok=False) # exist_ok=False to strictly check for existence
        logging.info(f"Created folder: {new_folder_abs_path}")
        return {"status": "success", "message": "Folder created successfully."}
    except HTTPException:
        raise # Re-raise FastAPI HTTP exceptions
    except PermissionError:
        logging.error(f"Permission denied to create folder: {req.new_folder_path}")
        raise HTTPException(status_code=403, detail="Permission denied to create folder.")
    except Exception as e:
        logging.exception(f"Error creating folder {req.new_folder_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {e}")

@app.delete("/api/filesystems/delete")
async def delete_item(req: DeleteItemRequest):
    """Deletes a file or an empty folder."""
    try:
        item_abs_path = resolve_and_validate_path(req.item_path)

        if not item_abs_path.exists():
            raise HTTPException(status_code=404, detail="Item not found.")

        if item_abs_path.is_dir():
            # For directories, ensure it's empty or use shutil.rmtree if you allow recursive deletion
            # For this basic example, let's allow recursive deletion of directories for simplicity
            # BUT BE VERY CAREFUL WITH THIS IN PRODUCTION!
            shutil.rmtree(str(item_abs_path))
            logging.info(f"Recursively deleted directory: {item_abs_path}")
        else:
            item_abs_path.unlink() # Delete file
            logging.info(f"Deleted file: {item_abs_path}")

        return {"status": "success", "message": "Item deleted successfully."}
    except HTTPException:
        raise # Re-raise FastAPI HTTP exceptions
    except PermissionError:
        logging.error(f"Permission denied to delete item: {req.item_path}")
        raise HTTPException(status_code=403, detail="Permission denied to delete this item.")
    except OSError as e:
        # Catch specific OS errors for better feedback, e.g., Directory not empty
        if "Directory not empty" in str(e):
            raise HTTPException(status_code=400, detail="Cannot delete non-empty directory. Please delete its contents first.")
        logging.exception(f"OS error deleting item {req.item_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")
    except Exception as e:
        logging.exception(f"Unexpected error deleting item {req.item_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")


# Main entry point for uvicorn (if running directly via `python main.py`)
if __name__ == "__main__":
    import uvicorn
    # Make sure to run this with `uvicorn main:app --reload` during development
    # For production, use `uvicorn main:app --host 0.0.0.0 --port 8000`
    uvicorn.run(app, host="0.0.0.0", port=8005)
