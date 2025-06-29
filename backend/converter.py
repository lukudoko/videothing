# converter.py (Revised to skip re-converting existing MP4s by default)

import os
import subprocess
import re
import time
from urllib.parse import unquote

def sanitize_and_strip_filename(filename: str) -> str:
    # First, URL-decode the filename to handle %20 etc.
    filename = unquote(filename)

    # Then apply your existing stripping and sanitization
    filename = re.sub(r'_ImSM8O$', '', filename)
    filename = re.sub(r'\s*\((Raw|Partial)\)\s*', '', filename, flags=re.IGNORECASE).strip()
    filename = re.sub(r'[\\/*?:"<>|]', '', filename)

    return filename

def convert_video(folder: str, video_path_in_folder: str, delete_original: bool = True, progress_callback=None):
    """
    Converts a video file using FFmpeg with progress reporting.
    It will skip conversion if the input file is already an MP4.

    Args:
        folder (str): The directory where the video is located.
        video_path_in_folder (str): The filename of the video within the folder.
        delete_original (bool): Whether to delete the original file after successful conversion.
        progress_callback (callable, optional): A function to call with progress updates.
                                                Expected signature: (percentage)
    Returns:
        dict: A dictionary containing conversion status and messages.
    """
    filepath = os.path.join(folder, video_path_in_folder)

    if not os.path.exists(filepath):
        return {"status": "failed", "error": "file_not_found", "message": f"File not found for conversion: {filepath}"}

    base_name, original_ext = os.path.splitext(os.path.basename(filepath))
    output_filename = f"{base_name}.mp4"
    output_filepath = os.path.join(folder, output_filename)

    # --- NEW LOGIC HERE ---
    # If the file is already an MP4, skip conversion.
    # We treat it as "converted" because it's already in the target format.
    if original_ext.lower() == '.mp4':
        # Even if it's an MP4, check if an output_filepath (same name) already exists
        # This handles cases where a .mp4 might have been moved/renamed manually
        if os.path.normcase(filepath) == os.path.normcase(output_filepath) and os.path.exists(output_filepath):
             return {"status": "skipped", "message": f"File is already an MP4!", "output_file": output_filepath}
        else:
            # If it's an MP4 but the file name implies it's not converted,
            # this means we *don't* want to re-encode. We can "fake" a conversion
            # by saying it's already completed and its output path is its current path.
            # This makes the UI think it's done without actually re-encoding.
            print(f"Skipping re-conversion: {filepath} is already an MP4.")
            return {"status": "converted", "message": "Already MP4, no re-conversion needed.", "output_file": filepath} # Note: output_file is original filepath
    # --- END NEW LOGIC ---

    # Existing check: If the target output file already exists, skip
    if os.path.exists(output_filepath):
        return {"status": "skipped", "message": f"Output file already exists: {output_filepath}"}


    # Create a temporary file for FFmpeg progress output
    progress_file_path = f"{output_filepath}.ffmpeg_progress"

    try:
        # Get duration of input video to calculate percentage
        duration_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", filepath
        ]
        duration_output = subprocess.check_output(duration_cmd, text=True).strip()
        total_duration_seconds = float(duration_output) if duration_output else 0

        if total_duration_seconds == 0:
            print(f"Warning: Could not determine video duration for {filepath}. Progress percentage might be inaccurate.")

        print(f"Starting conversion of {filepath} to {output_filepath} (Duration: {total_duration_seconds:.2f}s)")

        command = [
            "ffmpeg",
            "-hwaccel", "cuda",
            "-i", filepath,
            "-c:v", "h264_nvenc",
            "-preset", "medium",
            "-tune", "hq",
            "-cq:v", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-y",
            "-progress", progress_file_path,
            output_filepath
        ]

        with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as process:
            last_reported_percentage = 0

            while process.poll() is None:
                current_time_seconds = 0
                try:
                    with open(progress_file_path, 'r') as f:
                        lines = f.readlines()
                        for line in reversed(lines):
                            time_match = re.search(r'out_time_ms=(\d+)', line)
                            if time_match:
                                current_time_microseconds = int(time_match.group(1))
                                current_time_seconds = current_time_microseconds / 1_000_000
                                break
                            time_match_fallback = re.search(r'time=(\d{2}:\d{2}:\d{2}\.\d+)', line)
                            if time_match_fallback:
                                h, m, s = map(float, time_match_fallback.group(1).split(':'))
                                current_time_seconds = h * 3600 + m * 60 + s
                                break
                except FileNotFoundError:
                    pass
                except Exception as e:
                    print(f"Warning: Error parsing FFmpeg progress file {progress_file_path}: {e}")

                if total_duration_seconds > 0 and current_time_seconds > 0:
                    percentage = (current_time_seconds / total_duration_seconds) * 100
                    percentage = min(100, max(0, percentage))

                    if progress_callback and int(percentage) > int(last_reported_percentage):
                        progress_callback(percentage)
                        last_reported_percentage = percentage

                time.sleep(0.5)

            stdout, stderr = process.communicate()
            if process.returncode != 0:
                raise subprocess.CalledProcessError(process.returncode, command, stdout, stderr)

        if progress_callback:
            progress_callback(100)

        if delete_original:
            os.remove(filepath)
            print(f"Deleted original file: {filepath}")

        return {"status": "success", "output_file": output_filepath, "message": f"Converted!"}

    except FileNotFoundError:
        return {"status": "failed", "error": "ffmpeg_ffprobe_not_found", "message": "FFmpeg or FFprobe command not found. Ensure both are installed and in your system's PATH."}
    except subprocess.CalledProcessError as e:
        error_message = f"Conversion failed for {filepath}. FFmpeg error: {e.stderr}"
        print(error_message)
        return {"status": "failed", "error": "conversion_error", "message": error_message, "details": e.stderr}
    except Exception as e:
        error_message = f"An unexpected error occurred during conversion: {e}"
        print(error_message)
        return {"status": "failed", "error": "unexpected_error", "message": error_message}
    finally:
        if os.path.exists(progress_file_path):
            os.remove(progress_file_path)
