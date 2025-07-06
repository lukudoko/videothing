# backend/api/download.py
import os
from fastapi import APIRouter, HTTPException
import logging

# Import models, config, and utils from the new core location
from backend.core.models import DownloadRequest
from backend.core.config import BASE_DOWNLOAD_DIR
from backend.core.utils import resolve_and_validate_path

# queue_manager.py and downloader.py are in the 'backend' parent directory relative to 'api'
from backend.queue_manager import queue_manager, add_download_job, clear_finished_progress_from_backend
from backend.downloader import sanitize_and_strip_filename

router = APIRouter()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@router.post("/download")
async def download(req: DownloadRequest):
    logging.info(f"Received download request for URL: {req.url} to path: {req.path}")
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

    logging.debug(f"Checking for existence of: '{expected_filepath}' (derived from req.title: '{req.title}')")

    if expected_filepath.exists():
        logging.info(f"Download for {req.url} skipped: File '{expected_filename}' already exists at {full_target_dir}.")
        raise HTTPException(status_code=409, detail=f"File '{expected_filename}' already exists at the chosen location.")

    success = add_download_job(req.url, str(full_target_dir))
    if not success:
        raise HTTPException(status_code=409, detail="Download already in progress for this URL.")

    logging.info(f"Download for {req.url} queued successfully.")
    return {"status": "queued", "message": f"Download for {req.url} queued. Conversion will start automatically after download."}

@router.get("/progress")
def get_progress():
    """Get all current download progress."""
    logging.debug("Fetching all download progress.")
    return queue_manager.get_all_progress()


@router.post("/clear_progress")
def clear_progress_endpoint():
    """Clear finished entries from progress tracking."""
    cleared_count = clear_finished_progress_from_backend()
    logging.info(f"API: Cleared {cleared_count} finished entries from active downloads.")
    return {"message": f"Cleared {cleared_count} finished entries from progress list."}

@router.post("/queue/config")
def update_queue_config(enable_transcription: bool = False):
    """Update queue configuration (useful for enabling transcription later)."""
    queue_manager.enable_transcription = enable_transcription
    logging.info(f"Transcription {'enabled' if enable_transcription else 'disabled'}.")
    return {"message": f"Transcription {'enabled' if enable_transcription else 'disabled'}"}

@router.get("/queue/stats")
def get_queue_stats():
    """Get current queue statistics."""
    logging.debug("Fetching queue statistics.")
    all_progress = queue_manager.get_all_progress()
    stats = {
        "total_jobs": len(all_progress),
        "by_status": {}
    }

    for progress in all_progress.values():
        status = progress["status"]
        stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

    return stats
