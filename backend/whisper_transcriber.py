# backend/whisper_transcriber.py
import os
import time
import logging
from typing import Callable, Dict, Any, Optional
import gc # Import garbage collection module

# --- BEGIN WHISPER INTEGRATION ---
import whisper
import torch
import datetime

logger = logging.getLogger(__name__)

# Global variable to store the loaded Whisper model.
_whisper_model = None
_model_name = "small" # As requested by you
_device = "cuda" if torch.cuda.is_available() else "cpu"

def _load_whisper_model():
    """
    Loads the Whisper model. This function is designed to be called once
    and then return the cached model for subsequent calls.
    """
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Loading Whisper model '{_model_name}'. This may take a while, especially on first run.")
        logger.info(f"Attempting to use device: {_device}")
        try:
            # Load the model onto the determined device (CUDA or CPU)
            _whisper_model = whisper.load_model(_model_name, device=_device)
            logger.info(f"Whisper model '{_model_name}' loaded successfully on {_device}.")
        except Exception as e:
            logger.error(f"Failed to load Whisper model '{_model_name}': {e}", exc_info=True)
            raise RuntimeError(f"Whisper model loading failed: {e}. Check your PyTorch/CUDA/Whisper installation.") from e
    return _whisper_model

def unload_whisper_model():
    """
    Explicitly unloads the Whisper model from memory (including GPU VRAM)
    and clears the CUDA cache. Call this when the model is no longer needed.
    """
    global _whisper_model
    if _whisper_model is not None:
        logger.info(f"Unloading Whisper model '{_model_name}' from {_device} to free up resources.")
        try:
            del _whisper_model
            _whisper_model = None
            if _device == "cuda":
                torch.cuda.empty_cache() # Clear CUDA memory cache
            gc.collect() # Trigger Python garbage collection
            logger.info("Whisper model unloaded and resources released.")
        except Exception as e:
            logger.error(f"Error during Whisper model unloading: {e}", exc_info=True)
    else:
        logger.info("Whisper model is already unloaded.")


def _format_timestamp_srt(seconds: float) -> str:
    """Formats a float of seconds into an SRT timestamp string."""
    td = datetime.timedelta(seconds=seconds)
    hours, remainder = divmod(td.total_seconds(), 3600)
    minutes, remainder = divmod(remainder, 60)
    seconds, milliseconds = divmod(remainder, 1)
    return f"{int(hours):02}:{int(minutes):02}:{int(seconds):02},{int(milliseconds*1000):03}"

def _write_srt(segments: list, output_filepath: str):
    """
    Writes transcription segments to an SRT file.
    Segments are expected to be from Whisper's transcription result.
    """
    with open(output_filepath, "w", encoding="utf-8") as f:
        for i, segment in enumerate(segments):
            f.write(f"{i + 1}\n")
            f.write(f"{_format_timestamp_srt(segment['start'])} --> {_format_timestamp_srt(segment['end'])}\n")
            f.write(f"{segment['text'].strip()}\n\n")
    logger.info(f"SRT file written to: {output_filepath}")

# --- END WHISPER INTEGRATION ---

def transcribe_video_with_whisper(
    video_filepath: str,
    progress_callback: Callable[[float], None],
    initial_prompt: Optional[str] = None # New optional parameter for prompt
) -> Dict[str, Any]:
    """
    Transcribes a video file using the Whisper model.

    Args:
        video_filepath (str): The path to the video file to transcribe.
        progress_callback (Callable[[float], None]): A callback function
                                                     to report transcription progress (0-100).
        initial_prompt (Optional[str]): An optional text prompt to guide the transcription.

    Returns:
        Dict[str, Any]: A dictionary with 'status' (success/failed) and 'message',
                        and potentially 'srt_filepath' or 'text_content'.
    """
    logger.info(f"Starting actual Whisper transcription for: {video_filepath}")
    progress_callback(0) # Initial progress: 0%

    try:
        # Load the model (will load once, then retrieve cached version)
        # Check if model is already loaded before attempting to load
        if _whisper_model is None:
            progress_callback(5) # Report progress as model loading starts
        model = _load_whisper_model()
        progress_callback(15) # Progress after model loading (or retrieval)

        # Ensure the video file exists before proceeding
        if not os.path.exists(video_filepath):
            raise FileNotFoundError(f"Video file not found: {video_filepath}")

        logger.info(f"Transcribing '{video_filepath}' using Whisper on {_device}...")
        progress_callback(20) # Audio processing/transcription started

        # Perform transcription with refined parameters
        # - language="ja": Explicitly set to Japanese
        # - task="transcribe": (Default, but explicit)
        # - fp16=_device == "cuda": Use half-precision if CUDA is available for speed/VRAM
        # - condition_on_previous_text=False: Each segment is independent for better handling of chaotic audio
        # - word_timestamps=True: Enable word-level timestamps for more flexible SRT generation
        # - initial_prompt: Pass the optional prompt
        result = model.transcribe(
            video_filepath,
            language="ja",
            task="transcribe",
            fp16=(_device == "cuda"), # Use FP16 only if on CUDA
            condition_on_previous_text=False, # Disable conditioning for independent segments
            word_timestamps=True, # Enable word-level timestamps
            #initial_prompt=initial_prompt, # Pass optional prompt
            verbose=False # Suppress Whisper's verbose console output
        )

        progress_callback(85) # Progress before writing SRT (approx. 85%)

        # Extract segments and write to SRT file
        srt_filepath = f"{os.path.splitext(video_filepath)[0]}.srt"
        _write_srt(result["segments"], srt_filepath)

        progress_callback(100) # Final progress: 100%

        logger.info(f"Whisper transcription completed successfully for {video_filepath}. SRT saved to {srt_filepath}")
        return {
            "status": "success",
            "message": "Transcription completed successfully.",
            "srt_filepath": srt_filepath
        }

    except FileNotFoundError as e:
        logger.error(f"Transcription failed: Video file not found at {video_filepath}. Error: {e}")
        progress_callback(-1) # Indicate failure visually if possible (or just stop updates)
        return {
            "status": "failed",
            "message": f"Transcription failed: File not found. {str(e)}",
            "error": str(e)
        }
    except RuntimeError as e:
        # Catch specific RuntimeError from model loading failure
        logger.error(f"Transcription failed due to model loading error for {video_filepath}: {e}", exc_info=True)
        progress_callback(-1)
        return {
            "status": "failed",
            "message": f"Transcription failed: Model loading error. {str(e)}",
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"General Whisper transcription failure for {video_filepath}: {e}", exc_info=True)
        progress_callback(-1)
        return {
            "status": "failed",
            "message": f"Transcription failed: {str(e)}",
            "error": str(e)
        }
