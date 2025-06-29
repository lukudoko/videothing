# downloader.py (FINAL for now, with auto-stripping)
import requests
import os
import time
import re
from urllib.parse import unquote # Import unquote

def sanitize_and_strip_filename(filename: str) -> str:
    # First, URL-decode the filename to handle %20 etc.
    filename = unquote(filename)

    # Then apply your existing stripping and sanitization
    filename = re.sub(r'_ImSM8O$', '', filename)
    filename = re.sub(r'\s*\((Raw|Partial)\)\s*', '', filename, flags=re.IGNORECASE).strip()
    filename = re.sub(r'[\\/*?:"<>|]', '', filename)

    return filename

def download_video(url: str, save_path: str, progress_callback=None):
    """
    Downloads a video file from a given URL to a specified path,
    automatically sanitizing and stripping common suffixes.
    Args:
        url (str): The URL of the video file.
        save_path (str): The directory to save the video file.
        progress_callback (callable, optional): A function to call with progress updates.
                                                Expected signature: (percentage, speed, eta)
    Returns:
        str: The full path to the downloaded file.
    Raises:
        requests.exceptions.RequestException: If there's an HTTP error.
        IOError: If there's an issue writing the file.
    """
    # Derive filename from URL and apply stripping/sanitization
    filename = sanitize_and_strip_filename(url.split('?')[0].split('/')[-1])

    filepath = os.path.join(save_path, filename)
    os.makedirs(save_path, exist_ok=True) # Ensure directory exists

    print(f"Starting download of {url} to {filepath}")

    try:
        with requests.get(url, stream=True) as r:
            r.raise_for_status()

            total_size = int(r.headers.get('content-length', 0))
            bytes_downloaded = 0
            start_time = time.time()

            with open(filepath, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        bytes_downloaded += len(chunk)

                        if progress_callback and total_size > 0:
                            percentage = (bytes_downloaded / total_size) * 100
                            elapsed_time = time.time() - start_time
                            speed_bps = bytes_downloaded / elapsed_time if elapsed_time > 0 else 0
                            speed_mbps = speed_bps / (1024 * 1024)

                            eta = None
                            if speed_bps > 0:
                                remaining_bytes = total_size - bytes_downloaded
                                eta_seconds = remaining_bytes / speed_bps
                                eta = f"{int(eta_seconds // 60)}m {int(eta_seconds % 60)}s"

                            progress_callback(percentage, f"{speed_mbps:.2f} MB/s", eta)
            print(f"Download finished: {filepath}")
            return filepath
    except requests.exceptions.RequestException as e:
        print(f"Download error: {e}")
        raise e
    except IOError as e:
        print(f"File write error: {e}")
        raise e
    except Exception as e:
        print(f"An unexpected error occurred during download: {e}")
        raise e
