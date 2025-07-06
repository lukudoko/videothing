# backend/api/transcribe.py
from fastapi import APIRouter, HTTPException
import logging

from backend.core.models import DownloadRequest # Re-using DownloadRequest for path/title
from backend.core.utils import resolve_and_validate_path
from backend.queue_manager import queue_manager, TaskStatus # Import TaskStatus for clarity

router = APIRouter()
logger = logging.getLogger(__name__)

class TranscribeRequest(DownloadRequest): # Inherit from DownloadRequest for path/title
    """
    Request model for triggering transcription.
    Uses 'path' to specify the video file's location relative to BASE_DOWNLOAD_DIR.
    """
    # No additional fields needed beyond what DownloadRequest provides for now
    pass

@router.post("/transcribe")
async def transcribe_video_endpoint(req: TranscribeRequest):
    """
    Triggers the transcription of a video file located at the given path.
    The path should be relative to the BASE_DOWNLOAD_DIR.
    """
    full_video_filepath = resolve_and_validate_path(req.path)

    if not full_video_filepath.is_file():
        logger.warning(f"Transcription requested for non-existent or non-file path: {full_video_filepath}")
        raise HTTPException(status_code=404, detail="Video file not found or is not a file.")

    # Check if this URL (representing the video file) is already being processed
    # We'll use the full_video_filepath as the key for transcription tasks in queue_manager
    # This assumes a video file only needs to be transcribed once at a time.
    # If the video was downloaded via the app, its original URL would be the key.
    # For standalone transcription, we need a unique key. Let's use the file path itself.
    task_key = str(full_video_filepath)

    if queue_manager.is_url_active(task_key):
        logger.info(f"Transcription for {task_key} skipped: Already in progress.")
        raise HTTPException(status_code=409, detail="Transcription for this file is already in progress.")

    # Add the transcription job to the queue manager
    # We submit directly to the transcription executor
    queue_manager.update_progress(
        task_key,
        status=TaskStatus.QUEUED, # Initially queued for transcription
        message="Transcription queued.",
        progress_percentage=0.0,
        output_path=str(full_video_filepath), # The input file is also the initial output path
        filename=req.title # Use the title provided by frontend as filename
    )
    queue_manager.transcription_executor.submit(
        queue_manager._transcribe_task,
        task_key, # Use the file path as the unique key for transcription tasks
        str(full_video_filepath)
    )

    logger.info(f"Transcription job added for {full_video_filepath}.")
    return {"status": "queued", "message": f"Transcription for {req.title} queued."}
