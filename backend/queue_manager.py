# queue_manager.py (With Duplicate Prevention)

import threading
from concurrent.futures import ThreadPoolExecutor
import time
import os
import json # Import json for reading/writing state
import logging # For better logging

from downloader import download_video
from converter import convert_video

# Setup basic logging for this module
logger = logging.getLogger(__name__)
# Assuming basicConfig is set up in main.py, so this logger will inherit its settings.
# If not, you might want to add logging.basicConfig here for local testing/debugging.


downloads = {} # Global dictionary accessible by FastAPI's /progress endpoint

# --- Configuration for Download State Persistence ---
# Define the path for your completed downloads state file.
# It's good practice to place this in a known configuration/data directory.
# For simplicity, let's put it next to your main.py or in the BASE_DOWNLOAD_DIR.
# Adjust this path as needed.
DOWNLOAD_STATE_FILE = os.path.join(os.path.dirname(__file__), "completed_downloads.json")

# Set to store URLs that have successfully finished
completed_urls = set()

# --- Functions for State Persistence ---
def _load_completed_urls():
    """Loads previously completed URLs from the state file."""
    global completed_urls
    if os.path.exists(DOWNLOAD_STATE_FILE):
        try:
            with open(DOWNLOAD_STATE_FILE, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    completed_urls = set(data)
                    logger.info(f"Loaded {len(completed_urls)} completed URLs from {DOWNLOAD_STATE_FILE}")
                else:
                    logger.warning(f"State file {DOWNLOAD_STATE_FILE} has unexpected format. Starting fresh.")
                    completed_urls = set()
        except json.JSONDecodeError as e:
            logger.error(f"Error decoding JSON from {DOWNLOAD_STATE_FILE}: {e}. Starting fresh.")
            completed_urls = set()
        except Exception as e:
            logger.error(f"Unexpected error loading state from {DOWNLOAD_STATE_FILE}: {e}. Starting fresh.")
            completed_urls = set()
    else:
        logger.info(f"No completed downloads state file found at {DOWNLOAD_STATE_FILE}.")
    return completed_urls

def _save_completed_urls():
    """Saves the current set of completed URLs to the state file."""
    try:
        with open(DOWNLOAD_STATE_FILE, 'w') as f:
            json.dump(list(completed_urls), f) # Convert set to list for JSON serialization
            logger.debug(f"Saved {len(completed_urls)} completed URLs to {DOWNLOAD_STATE_FILE}")
    except Exception as e:
        logger.error(f"Error saving completed URLs to {DOWNLOAD_STATE_FILE}: {e}")

# Load state when the module is imported (i.e., when FastAPI app starts)
_load_completed_urls()

# --- ThreadPoolExecutors (as previously configured) ---
download_executor = ThreadPoolExecutor(max_workers=1)
conversion_executor = ThreadPoolExecutor(max_workers=4)

def update_download_progress(url, status=None, progress=None, speed=None, eta=None, error=None, output_path=None, message=None, conversion_progress=None):
    """Updates the global downloads dictionary with progress information."""
    current_status = downloads.get(url, {})

    # Check for specific status changes that indicate completion
    if status == "converted":
        if url not in completed_urls:
            completed_urls.add(url) # Add to our set of completed URLs
            _save_completed_urls()   # Persist the updated set
            logger.info(f"Added '{url}' to completed downloads list.")

    # Also handle "skipped" if you consider skipped items as "already done" and want to prevent re-attempts
    # elif status == "skipped":
    #     if url not in completed_urls:
    #         completed_urls.add(url)
    #         _save_completed_urls()
    #         logger.info(f"Added '{url}' to completed downloads list due to skipping.")


    # --- Rest of the function remains the same ---
    if status is not None:
        current_status["status"] = status
    current_status["timestamp"] = time.time()

    if progress is not None:
        current_status["progress_percentage"] = progress
    if speed is not None:
        current_status["download_speed"] = speed
    if eta is not None:
        current_status["eta"] = eta
    if error is not None:
        current_status["error_message"] = error
    if output_path is not None:
        current_status["output_path"] = output_path
    if message is not None:
        current_status["message"] = message
    if conversion_progress is not None:
        current_status["conversion_percentage"] = conversion_progress

    downloads[url] = current_status

def _download_task(url: str, path: str):
    """Background task for downloading a video."""
    logger.info(f"Starting download task for {url} into {path}")
    update_download_progress(url, status="queued", message="Download queued...")
    downloaded_filepath = None
    try:
        downloaded_filepath = download_video(url, path,
                                             lambda p, s, e: update_download_progress(url, progress=p, speed=s, eta=e, status="downloading"))

        update_download_progress(url, status="completed", output_path=downloaded_filepath, message="Download completed. Queueing for conversion...")
        logger.info(f"Download completed for {url}. File at: {downloaded_filepath}")

        logger.info(f"Queueing conversion for {downloaded_filepath} to conversion executor.")
        conversion_executor.submit(_convert_task, url, downloaded_filepath)

    except Exception as e:
        error_msg = f"Download failed for {url}: {str(e)}"
        logger.error(error_msg, exc_info=True) # exc_info=True logs traceback
        update_download_progress(url, status="failed", error=error_msg, message=error_msg)

def _convert_task(original_video_url: str, downloaded_filepath: str):
    """Background task for converting a video."""
    logger.info(f"Starting conversion task for {downloaded_filepath}")
    update_download_progress(original_video_url, status="converting", message="Starting conversion...")
    try:
        folder, filename = os.path.split(downloaded_filepath)

        def conversion_progress_callback(percentage):
            update_download_progress(original_video_url, status="converting", conversion_progress=percentage, message=f"Converting: {percentage:.2f}%")

        conversion_result = convert_video(folder, filename, progress_callback=conversion_progress_callback)

        if conversion_result["status"] == "success":
            update_download_progress(
                original_video_url,
                status="converted", # This will trigger adding to completed_urls and saving
                message=conversion_result["message"],
                output_path=conversion_result["output_file"],
                conversion_progress=100
            )
            logger.info(f"Conversion completed for {downloaded_filepath}. New file: {conversion_result['output_file']}")
        elif conversion_result["status"] == "skipped":
             update_download_progress(
                original_video_url,
                status="converted", # Treat skipped as effectively converted for deduplication
                message=conversion_result["message"],
                conversion_progress=100
            )
             logger.info(f"Conversion skipped for {downloaded_filepath}: {conversion_result['message']}")
        else: # status is "failed"
            update_download_progress(
                original_video_url,
                status="failed",
                error=conversion_result["error"],
                message=conversion_result["message"]
            )
            logger.error(f"Conversion failed for {downloaded_filepath}: {conversion_result['message']}")

    except Exception as e:
        error_msg = f"Conversion failed for {downloaded_filepath} due to an unexpected error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        update_download_progress(original_video_url, status="failed", error=error_msg, message=error_msg)

def add_download_job(url: str, path: str):
    """Adds a download job to the download_executor, checking for duplicates first."""
    # First, check if the URL is already in our persistently completed list
    if url in completed_urls:
        logger.info(f"Download for {url} skipped: Already completed in previous session.")
        # Optionally, update status to "skipped" and set conversion_progress to 100
        downloads[url] = {"status": "skipped", "message": "Already downloaded/converted!", "conversion_percentage": 100}
        return False # Indicate that the job was not actually queued

    # Then, check if the URL is currently active or recently completed in the current session
    if url in downloads and downloads[url].get("status") not in ["failed", "converted", "skipped"]:
        logger.info(f"Download for {url} skipped: Already in progress or recently queued.")
        return False # Job already active in current session

    downloads[url] = {"status": "queued", "progress_percentage": 0, "message": "Download queued."}

    # Submit download task to the *download_executor*
    download_executor.submit(_download_task, url, path)
    logger.info(f"Download job added for {url} into {path}.")
    return True
