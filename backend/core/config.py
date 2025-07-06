# backend/core/config.py
import os
from pathlib import Path
import logging

# Configure logging specifically for this module if needed,
# or rely on main.py's global config setup.
# For consistency, we'll keep the basic setup here.
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Configuration ---
base_dir_from_env = os.getenv("BASE_DOWNLOAD_DIR_ENV")

if base_dir_from_env:
    BASE_DOWNLOAD_DIR = Path(base_dir_from_env).resolve()
else:
    # This path is relative to the *root* of your file system, not the project.
    # On Docker, this would usually be a mounted volume path.
    BASE_DOWNLOAD_DIR = Path("/mnt/drive/Media/").resolve()
    logging.warning(f"BASE_DOWNLOAD_DIR_ENV not set. Using default development path: {BASE_DOWNLOAD_DIR}")

try:
    BASE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logging.info(f"Base download directory ensured: {BASE_DOWNLOAD_DIR}")
except OSError as e:
    logging.critical(f"Failed to create base download directory {BASE_DOWNLOAD_DIR}: {e}")
    raise RuntimeError(f"Critical error: Base download directory cannot be created: {e}")

# You can add more configuration variables here
