import threading
from concurrent.futures import ThreadPoolExecutor
import time
import os
import json
import logging
from enum import Enum
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass, asdict

from backend.downloader import download_video
from backend.converter import convert_video

logger = logging.getLogger(__name__)

class TaskStatus(Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    DOWNLOAD_COMPLETED = "download_completed" # Renamed from DOWNLOAD_COMPLETE for consistency
    CONVERTING = "converting"
    TRANSCRIBING = "transcribing"
    FINALIZED = "finalized" # New status: The item has completed *all* its intended processes
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class TaskProgress:
    status: TaskStatus
    progress_percentage: float = 0.0 # Consolidated to one percentage field
    download_speed: Optional[str] = None # Only relevant for 'downloading'
    eta: Optional[str] = None # Only relevant for 'downloading'
    error_message: Optional[str] = None # Populated only if status is 'failed'
    output_path: Optional[str] = None # Final path if 'finalized', 'skipped', or 'download_completed'
    message: str = "" # Human-readable message for UI
    timestamp: float = 0.0
    filename: Optional[str] = None # Added for cleaner display in frontend

    def __post_init__(self):
        if self.timestamp == 0.0:
            self.timestamp = time.time()
        # Initialize optional fields to None if empty string is passed
        self.download_speed = self.download_speed if self.download_speed else None
        self.eta = self.eta if self.eta else None
        self.error_message = self.error_message if self.error_message else None
        self.output_path = self.output_path if self.output_path else None
        self.filename = self.filename if self.filename else None


class QueueManager:
    def __init__(self, max_download_workers: int = 1, max_conversion_workers: int = 4, max_transcription_workers: int = 2):
        self.downloads: Dict[str, TaskProgress] = {}
        self.downloads_lock = threading.Lock()

        self.download_executor = ThreadPoolExecutor(max_workers=max_download_workers)
        self.conversion_executor = ThreadPoolExecutor(max_workers=max_conversion_workers)
        self.transcription_executor = ThreadPoolExecutor(max_workers=max_transcription_workers)

        self.enable_transcription = False # This toggle will determine the final step after conversion

    def clear_finished_progress(self) -> int:
        """Clear entries with final statuses from the downloads dictionary."""
        # Updated to new final status: TaskStatus.FINALIZED
        final_statuses = {TaskStatus.FINALIZED, TaskStatus.FAILED, TaskStatus.SKIPPED}

        with self.downloads_lock:
            urls_to_remove = [
                url for url, progress in self.downloads.items()
                if progress.status in final_statuses
            ]
            for url in urls_to_remove:
                del self.downloads[url]

            logger.info(f"Cleared {len(urls_to_remove)} finished entries from active downloads.")
            return len(urls_to_remove)

    def update_progress(self, url: str, **kwargs) -> None:
        """Update progress for a specific URL with any TaskProgress fields."""
        with self.downloads_lock:
            if url not in self.downloads:
                # Initialize with QUEUED status and default values
                self.downloads[url] = TaskProgress(status=TaskStatus.QUEUED, message="Queued.")

            current = self.downloads[url]

            # Update any provided fields
            for field, value in kwargs.items():
                if hasattr(current, field):
                    # Set value only if it's explicitly provided, allowing None to override
                    setattr(current, field, value)

            # --- Logic to ensure data consistency based on status ---
            # If status is not downloading, clear speed and eta
            if current.status != TaskStatus.DOWNLOADING:
                current.download_speed = None
                current.eta = None

            # If status is failed, ensure error_message is set and progress is 0
            if current.status == TaskStatus.FAILED:
                current.progress_percentage = 0.0
                if current.error_message is None: # Ensure error message is not None if status is FAILED
                    current.error_message = "An unknown error occurred."
            else: # If not failed, clear error_message
                current.error_message = None

            # If status is final (FINALIZED, SKIPPED), ensure progress is 100
            if current.status in {TaskStatus.FINALIZED, TaskStatus.SKIPPED, TaskStatus.DOWNLOAD_COMPLETED}:
                current.progress_percentage = 100.0
                # output_path should be set by the task itself when it reaches finalization/completion/skipped

            # If status is queued, ensure progress is 0
            if current.status == TaskStatus.QUEUED:
                current.progress_percentage = 0.0
                current.output_path = None # Clear output path if it's reset to queued

            # Always update timestamp
            current.timestamp = time.time()

            self.downloads[url] = current

    def get_progress(self, url: str) -> Optional[Dict[str, Any]]:
        """Get progress for a specific URL."""
        with self.downloads_lock:
            progress = self.downloads.get(url)
            # Use asdict to convert dataclass to dict, preserving Optional[None] values
            return asdict(progress) if progress else None

    def get_all_progress(self) -> Dict[str, Dict[str, Any]]:
        """Get all current progress data."""
        with self.downloads_lock:
            return {url: asdict(progress) for url, progress in self.downloads.items()}

    def is_url_active(self, url: str) -> bool:
        """Check if URL is currently being processed (queued, downloading, converting, transcribing)."""
        active_statuses = {
            TaskStatus.QUEUED, TaskStatus.DOWNLOADING, TaskStatus.DOWNLOAD_COMPLETED,
            TaskStatus.CONVERTING, TaskStatus.TRANSCRIBING
        }

        with self.downloads_lock:
            if url in self.downloads:
                return self.downloads[url].status in active_statuses
            return False

    def _download_task(self, url: str, path: str) -> None:
        """Execute download task."""
        logger.info(f"Starting download task for {url} into {path}")
        self.update_progress(url, status=TaskStatus.DOWNLOADING, message="Starting download...", progress_percentage=0.0)

        try:
            def progress_callback(progress_val: float, speed: str, eta: str):
                self.update_progress(
                    url,
                    progress_percentage=progress_val,
                    download_speed=speed,
                    eta=eta,
                    message=f"Downloading: {progress_val:.1f}%"
                )

            downloaded_filepath = download_video(url, path, progress_callback)
            filename_from_path = os.path.basename(downloaded_filepath)

            self.update_progress(
                url,
                status=TaskStatus.DOWNLOAD_COMPLETED,
                output_path=downloaded_filepath,
                message="Download completed. Queueing for conversion...",
                progress_percentage=100.0, # Ensure 100% on completion
                download_speed=None, # Clear download specific fields
                eta=None, # Clear download specific fields
                filename=filename_from_path
            )

            logger.info(f"Download completed for {url}. File at: {downloaded_filepath}")

            # Queue conversion task
            self.conversion_executor.submit(self._convert_task, url, downloaded_filepath)

        except Exception as e:
            error_msg = f"Download failed for {url}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.update_progress(
                url,
                status=TaskStatus.FAILED,
                error_message=error_msg,
                message=error_msg,
                progress_percentage=0.0 # Ensure 0% on failure
            )

    def _convert_task(self, original_video_url: str, downloaded_filepath: str) -> None:
        """Execute conversion task."""
        logger.info(f"Starting conversion task for {downloaded_filepath}")
        self.update_progress(original_video_url, status=TaskStatus.CONVERTING, message="Starting conversion...", progress_percentage=0.0)

        try:
            folder, filename = os.path.split(downloaded_filepath)

            def conversion_progress_callback(percentage: float):
                self.update_progress(
                    original_video_url,
                    progress_percentage=percentage, # Use consolidated field
                    message=f"Converting: {percentage:.2f}%"
                )

            conversion_result = convert_video(folder, filename, progress_callback=conversion_progress_callback)

            if conversion_result["status"] == "success":
                # After successful conversion, if transcription is enabled, queue it
                if self.enable_transcription:
                    self.update_progress(
                        original_video_url,
                        status=TaskStatus.TRANSCRIBING, # Set to transcribing status
                        message="Conversion completed. Queueing for transcription...",
                        progress_percentage=0.0, # Reset progress for next phase
                        output_path=conversion_result["output_file"] # Update output path to converted file
                    )
                    logger.info(f"Conversion completed for {original_video_url}. Queueing for transcription.")
                    self.transcription_executor.submit(self._transcribe_task, original_video_url, conversion_result["output_file"])
                else:
                    # If no transcription, then it's FINALIZED
                    self.update_progress(
                        original_video_url,
                        status=TaskStatus.FINALIZED,
                        message="Processing completed!",
                        progress_percentage=100.0,
                        output_path=conversion_result["output_file"]
                    )
                    logger.info(f"Conversion completed for {original_video_url}. All tasks finalized.")

            elif conversion_result["status"] == "skipped":
                # If conversion is skipped, decide next step (transcription or finalization)
                if self.enable_transcription:
                    self.update_progress(
                        original_video_url,
                        status=TaskStatus.TRANSCRIBING,
                        message=f"Conversion skipped. Queueing for transcription: {conversion_result['message']}",
                        progress_percentage=0.0,
                        # Use the original downloaded file for transcription if conversion was skipped
                        output_path=downloaded_filepath
                    )
                    logger.info(f"Conversion skipped for {original_video_url}. Queueing for transcription.")
                    self.transcription_executor.submit(self._transcribe_task, original_video_url, downloaded_filepath)
                else:
                    self.update_progress(
                        original_video_url,
                        status=TaskStatus.SKIPPED, # This should be the final skipped status
                        message=f"Conversion skipped: {conversion_result['message']}",
                        progress_percentage=100.0,
                        output_path=downloaded_filepath # Output path is the original downloaded file
                    )
                    logger.info(f"Conversion skipped for {original_video_url}. No further steps. Task skipped.")
            else: # conversion_result["status"] == "failed"
                self.update_progress(
                    original_video_url,
                    status=TaskStatus.FAILED,
                    error_message=conversion_result["error"],
                    message=conversion_result["message"],
                    progress_percentage=0.0
                )
                logger.error(f"Conversion failed for {original_video_url}: {conversion_result['error']}")

        except Exception as e:
            error_msg = f"Conversion system error for {downloaded_filepath}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.update_progress(
                original_video_url,
                status=TaskStatus.FAILED,
                error_message=error_msg,
                message=error_msg,
                progress_percentage=0.0
            )

    def _transcribe_task(self, task_key: str, video_filepath: str) -> None:
        """
        Execute transcription task using the whisper_transcriber.
        task_key is used as the identifier in the queue_manager.
        """
        logger.info(f"Starting transcription task for {video_filepath} (key: {task_key})")
        self.update_progress(
            task_key,
            status=TaskStatus.TRANSCRIBING,
            message="Starting transcription...",
            progress_percentage=0.0
        )

        try:
            def transcription_progress_callback(percentage: float):
                self.update_progress(
                    task_key,
                    progress_percentage=percentage,
                    message=f"Transcribing: {percentage:.2f}%"
                )

            transcription_result = transcribe_video_with_whisper(
                video_filepath,
                progress_callback=transcription_progress_callback
            )

            if transcription_result["status"] == "success":
                self.update_progress(
                    task_key,
                    status=TaskStatus.FINALIZED, # Transcription is the final step, so it's FINALIZED
                    progress_percentage=100.0,
                    message="Transcription completed. All processing finalized!",
                    # Optionally update output_path if transcription creates a new file (e.g., .srt)
                    # output_path=transcription_result.get("srt_filepath", video_filepath)
                )
                logger.info(f"Transcription for {video_filepath} completed. Task finalized.")
            else: # Transcription failed
                self.update_progress(
                    task_key,
                    status=TaskStatus.FAILED,
                    error_message=transcription_result.get("error", "Unknown transcription error."),
                    message=transcription_result.get("message", "Transcription failed."),
                    progress_percentage=0.0
                )
                logger.error(f"Transcription failed for {video_filepath}: {transcription_result.get('error')}")

        except Exception as e:
            error_msg = f"Transcription system error for {video_filepath}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self.update_progress(
                task_key,
                status=TaskStatus.FAILED,
                error_message=error_msg,
                message=error_msg,
                progress_percentage=0.0
            )

    def add_download_job(self, url: str, path: str) -> bool:
        """Add a download job to the queue."""
        if self.is_url_active(url):
            logger.info(f"Download for {url} skipped: Already in progress.")
            # Optionally update message to indicate it's already being processed
            self.update_progress(url, message="Already in progress.")
            return False

        # Attempt to get filename before starting (if possible, e.g., from youtube_dl info dict)
        # For simplicity here, we'll get it after download if not available initially
        initial_filename = None # Placeholder if you add pre-download info fetching
        self.update_progress(
            url,
            status=TaskStatus.QUEUED,
            progress_percentage=0.0,
            message="Download queued.",
            filename=initial_filename # This will be None for now, updated later
        )

        self.download_executor.submit(self._download_task, url, path)
        logger.info(f"Download job added for {url} into {path}.")
        return True

    def shutdown(self) -> None:
        """Gracefully shutdown all executors."""
        logger.info("Shutting down queue manager...")
        self.download_executor.shutdown(wait=True)
        self.conversion_executor.shutdown(wait=True)
        self.transcription_executor.shutdown(wait=True)

# Global instance for backwards compatibility
queue_manager = QueueManager()

# Backwards compatible functions (if still needed, though direct access to queue_manager is better)
def clear_finished_progress_from_backend():
    return queue_manager.clear_finished_progress()

def update_download_progress(url, **kwargs):
    # This function is now redundant if all updates go through queue_manager.update_progress
    # Consider removing it or ensuring it properly calls queue_manager.update_progress
    return queue_manager.update_progress(url, **kwargs)


def add_download_job(url: str, path: str):
    return queue_manager.add_download_job(url, path)
