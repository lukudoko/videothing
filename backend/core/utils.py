# backend/core/utils.py
from pathlib import Path
from fastapi import HTTPException
import logging

# Import BASE_DOWNLOAD_DIR from the *new* location
from backend.core.config import BASE_DOWNLOAD_DIR

def resolve_and_validate_path(relative_path: str) -> Path:
    """
    Resolves a relative path to an absolute path within BASE_DOWNLOAD_DIR
    and validates against path traversal attempts.
    """
    # Use BASE_DOWNLOAD_DIR as the anchor for all file system operations
    resolved_path = (BASE_DOWNLOAD_DIR / relative_path).resolve()
    try:
        # Ensure the resolved path is still a sub-path of BASE_DOWNLOAD_DIR
        resolved_path.relative_to(BASE_DOWNLOAD_DIR)
    except ValueError:
        logging.warning(f"Path traversal attempt detected: {relative_path} resolved to {resolved_path}")
        raise HTTPException(status_code=403, detail="Access denied: Invalid path traversal attempt.")
    return resolved_path
