# queue_manager.py (Simplified - REMOVING completed_urls PERSISTENCE)

import threading
from concurrent.futures import ThreadPoolExecutor
import time
import os
import json
import logging

from downloader import download_video
from converter import convert_video

logger = logging.getLogger(__name__)

downloads = {}
downloads_lock = threading.Lock() # Keep the lock for in-memory 'downloads' dictionary

# --- REMOVE THESE LINES! ---
# completed_urls = set()
# DOWNLOAD_STATE_FILE = os.path.join(os.path.dirname(__file__), "completed_downloads.json")
# def _load_completed_urls(): ... (remove this function)
# def _save_completed_urls(): ... (remove this function)
# _load_completed_urls() # Remove this call

# --- ThreadPoolExecutors (unchanged) ---
download_executor = ThreadPoolExecutor(max_workers=1)
conversion_executor = ThreadPoolExecutor(max_workers=4)

# --- CLEAR PROGRESS FUNCTION (unchanged logic, only affects 'downloads' in memory) ---
def clear_finished_progress_from_backend():
    """
    Clears entries from the 'downloads' dictionary if their status is 'completed',
    'converted', 'failed', or 'skipped'.
    """
    with downloads_lock:
        urls_to_remove = [
            url for url, progress in downloads.items()
            if progress.get("status") in ['completed', 'converted', 'failed', 'skipped']
        ]
        for url in urls_to_remove:
            del downloads[url]
        logger.info(f"Cleared {len(urls_to_remove)} finished entries from active downloads.")
        return len(urls_to_remove)

def update_download_progress(url, status=None, progress=None, speed=None, eta=None, error=None, output_path=None, message=None, conversion_progress=None):
    """Updates the global downloads dictionary with progress information."""
    with downloads_lock:
        current_status = downloads.get(url, {})

        # --- REMOVE completed_urls.add() logic from here ---
        # if status == "converted":
        #     if url not in completed_urls:
        #         completed_urls.add(url)
        #         _save_completed_urls()
        #         logger.info(f"Added '{url}' to completed downloads list.")
        # elif status == "skipped":
        #     if url not in completed_urls:
        #         completed_urls.add(url)
        #         _save_completed_urls()
        #         logger.info(f"Added '{url}' to completed downloads list due to skipping.")

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
    logger.info(f"Starting download task for {url} into {path}")
    update_download_progress(url, status="queued", message="Download queued...")
    downloaded_filepath = None
    try:
        downloaded_filepath = download_video(url, path, # path is the target directory
                                             lambda p, s, e: update_download_progress(url, progress=p, speed=s, eta=e, status="downloading"))

        update_download_progress(url, status="completed", output_path=downloaded_filepath, message="Download completed. Queueing for conversion...")
        logger.info(f"Download completed for {url}. File at: {downloaded_filepath}")

        logger.info(f"Queueing conversion for {downloaded_filepath} to conversion executor.")
        conversion_executor.submit(_convert_task, url, downloaded_filepath)

    except Exception as e:
        error_msg = f"Download failed for {url}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        update_download_progress(url, status="failed", error=error_msg, message=error_msg)

def _convert_task(original_video_url: str, downloaded_filepath: str):
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
                status="converted",
                message=conversion_result["message"],
                output_path=conversion_result["output_file"],
                conversion_progress=100
            )
            logger.info(f"Conversion completed for {downloaded_filepath}. New file: {conversion_result['output_file']}")
        elif conversion_result["status"] == "skipped":
             update_download_progress(
                original_video_url,
                status="converted",
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

def add_download_job(url: str, path: str): # 'path' is now the target directory
    """Adds a download job to the download_executor, checking only for in-progress duplicates."""
    # --- REMOVE completed_urls check ---
    # if url in completed_urls:
    #     logger.info(f"Download for {url} skipped: Already completed in previous session.")
    #     with downloads_lock:
    #         downloads[url] = {"status": "skipped", "message": "Already downloaded/converted!", "conversion_percentage": 100}
    #     return False

    with downloads_lock:
        # Check if the URL is currently active (queued, downloading, converting)
        if url in downloads and downloads[url].get("status") not in ["failed", "converted", "skipped"]:
            logger.info(f"Download for {url} skipped: Already in progress or recently queued.")
            return False

        downloads[url] = {"status": "queued", "progress_percentage": 0, "message": "Download queued."}

    download_executor.submit(_download_task, url, path) # path is the target directory
    logger.info(f"Download job added for {url} into {path}.")
    return True
