# backend/core/models.py
from pydantic import BaseModel
from typing import Optional

class ScrapeRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    path: str # Target directory (relative to BASE_DOWNLOAD_DIR)
    title: str # Add title to the request

class FileSystemItem(BaseModel):
    name: str
    is_directory: bool
    size: Optional[int] = None
    last_modified: Optional[float] = None
    path: str

# Removed MoveRenameRequest as per your request

class CreateFolderRequest(BaseModel):
    new_folder_path: str

class DeleteItemRequest(BaseModel):
    item_path: str
