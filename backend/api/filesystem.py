# backend/api/filesystem.py
import os
import shutil
from fastapi import APIRouter, HTTPException
import logging

# Import models, config, and utils from the new core location
from backend.core.models import FileSystemItem, CreateFolderRequest, DeleteItemRequest, MoveRenameRequest
from backend.core.utils import resolve_and_validate_path
from backend.core.config import BASE_DOWNLOAD_DIR # Also used here for relative_to

router = APIRouter()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@router.get("/filesystems/list")
async def list_contents(current_path: str = ""):
    """Lists contents of a directory within BASE_DOWNLOAD_DIR."""
    try:
        resolved_full_path = resolve_and_validate_path(current_path)
    except HTTPException as e:
        raise e

    if not resolved_full_path.exists():
        logging.warning(f"Attempted to list non-existent directory: {resolved_full_path}")
        raise HTTPException(status_code=404, detail="Directory not found.")
    if not resolved_full_path.is_dir():
        logging.warning(f"Attempted to list a file as a directory: {resolved_full_path}")
        raise HTTPException(status_code=400, detail="Path is not a directory.")

    items = []
    try:
        for item_name in os.listdir(resolved_full_path):
            item_full_path = resolved_full_path / item_name
            is_directory = item_full_path.is_dir()

            size = None
            last_modified = None

            if not is_directory:
                try:
                    size = item_full_path.stat().st_size
                    last_modified = item_full_path.stat().st_mtime
                except OSError as e:
                    logging.warning(f"Could not get stats for file {item_full_path}: {e}")
                    pass # Continue processing other files

            # Path for frontend should be relative to BASE_DOWNLOAD_DIR
            relative_path_for_frontend = item_full_path.relative_to(BASE_DOWNLOAD_DIR).as_posix()

            items.append(FileSystemItem(
                name=item_name,
                is_directory=is_directory,
                size=size,
                last_modified=last_modified,
                path=relative_path_for_frontend
            ))

        items.sort(key=lambda x: (not x.is_directory, x.name.lower()))
        logging.info(f"Listed contents of: {resolved_full_path}")
        return items
    except PermissionError:
        logging.error(f"Permission denied to access directory: {resolved_full_path}")
        raise HTTPException(status_code=403, detail="Permission denied to access this directory.")
    except Exception as e:
        logging.exception(f"An unexpected error occurred while listing directory {resolved_full_path}:")
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

@router.post("/filesystems/create-folder")
async def create_folder(req: CreateFolderRequest):
    """Creates a new folder within BASE_DOWNLOAD_DIR."""
    try:
        new_folder_abs_path = resolve_and_validate_path(req.new_folder_path)

        if new_folder_abs_path.exists():
            logging.warning(f"Attempted to create existing folder: {new_folder_abs_path}")
            raise HTTPException(status_code=409, detail="Folder already exists at this path.")

        new_folder_abs_path.mkdir(parents=True, exist_ok=False)
        logging.info(f"Created folder: {new_folder_abs_path}")
        return {"status": "success", "message": "Folder created successfully."}
    except HTTPException:
        raise
    except PermissionError:
        logging.error(f"Permission denied to create folder: {req.new_folder_path}")
        raise HTTPException(status_code=403, detail="Permission denied to create folder.")
    except Exception as e:
        logging.exception(f"Error creating folder {req.new_folder_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {e}")

@router.delete("/filesystems/delete")
async def delete_item(req: DeleteItemRequest):
    """Deletes a file or an empty directory within BASE_DOWNLOAD_DIR."""
    try:
        item_abs_path = resolve_and_validate_path(req.item_path)

        if not item_abs_path.exists():
            logging.warning(f"Attempted to delete non-existent item: {item_abs_path}")
            raise HTTPException(status_code=404, detail="Item not found.")

        if item_abs_path.is_dir():
            shutil.rmtree(str(item_abs_path)) # Removes directory and its contents
            logging.info(f"Recursively deleted directory: {item_abs_path}")
        else:
            item_abs_path.unlink() # Deletes file
            logging.info(f"Deleted file: {item_abs_path}")

        return {"status": "success", "message": "Item deleted successfully."}
    except HTTPException:
        raise
    except PermissionError:
        logging.error(f"Permission denied to delete item: {req.item_path}")
        raise HTTPException(status_code=403, detail="Permission denied to delete this item.")
    except OSError as e:
        if "Directory not empty" in str(e):
            logging.warning(f"Attempted to delete non-empty directory: {req.item_path}")
            raise HTTPException(status_code=400, detail="Cannot delete non-empty directory. Please delete its contents first.")
        logging.exception(f"OS error deleting item {req.item_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")
    except Exception as e:
        logging.exception(f"Unexpected error deleting item {req.item_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")




@router.post("/filesystems/move")
async def move_item(req: MoveRenameRequest):
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
        raise
    except PermissionError:
        logging.error(f"Permission denied to move {req.source_path} to {req.destination_path}")
        raise HTTPException(status_code=403, detail="Permission denied to perform this operation.")
    except Exception as e:
        logging.exception(f"Error moving item from {req.source_path} to {req.destination_path}:")
        raise HTTPException(status_code=500, detail=f"Failed to move item: {e}")
