# backend/whisper_transcriber.py
import os
import time
import logging
from typing import Callable, Dict, Any, Optional

# --- BEGIN WHISPER INTEGRATION ---
# You will need to install the whisper library:
# pip install -U openai-whisper
# You will also need PyTorch and torchaudio. For CUDA support,
# INSTALL TORCH AND TORCHAUDIO WITH CUDA ACCORDING TO PYTORCH'S WEBSITE:
# Example for CUDA 11.8: pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
# (Check your CUDA version and PyTorch's website for the exact command)
# Ensure ffmpeg is installed on your system (Whisper uses it for audio extraction)

import whisper
import torch # Used to check for CUDA availability
import datetime # Used for formatting SRT timestamps

logger = logging.getLogger(__name__)

# Global variable to store the loaded Whisper model.
# This ensures the model is loaded only once when the backend starts,
# rather than for every transcription request, saving a lot of time.
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
    progress_callback: Callable[[float], None]
) -> Dict[str, Any]:
    """
    Transcribes a video file using the Whisper model.

    Args:
        video_filepath (str): The path to the video file to transcribe.
        progress_callback (Callable[[float], None]): A callback function
                                                     to report transcription progress (0-100).

    Returns:
        Dict[str, Any]: A dictionary with 'status' (success/failed) and 'message',
                        and potentially 'srt_filepath' or 'text_content'.
    """
    logger.info(f"Starting actual Whisper transcription for: {video_filepath}")
    progress_callback(0) # Initial progress: 0%

    try:
        # Load the model (will load once, then retrieve cached version)
        model = _load_whisper_model()
        progress_callback(10) # Progress after model loading (approx. 10%)

        # Ensure the video file exists before proceeding
        if not os.path.exists(video_filepath):
            raise FileNotFoundError(f"Video file not found: {video_filepath}")

        logger.info(f"Transcribing '{video_filepath}' using Whisper on {_device}...")

        # Perform transcription
        # Whisper automatically handles audio extraction using ffmpeg
        # We specify language="ja" for Japanese and task="transcribe" (default, but explicit)
        result = model.transcribe(
            video_filepath,
            language="ja",
            task="transcribe",
            verbose=False # Suppress Whisper's verbose console output
        )

        progress_callback(90) # Progress before writing SRT (approx. 90%)

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
