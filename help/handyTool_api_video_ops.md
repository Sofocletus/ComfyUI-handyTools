# HandyTools API Video Operations

`handyTool_api_video_ops.py` is a standalone Python utility module designed to centralize and safely execute FFmpeg and FFprobe subprocess commands without relying on ComfyUI's web server framework.

This allows the logic to be highly reusable across any AI dataset preparation tool, ensuring safe file handling, hardware acceleration detection, and silent-video crash protection.

## Core Features
- **Zero Framework Dependency:** Takes raw file paths and returns primitive Python types.
- **Corpse File Cleanup:** If FFmpeg throws a fatal error mid-render, the corrupt 0-byte output file is automatically deleted.
- **Silent Video Safety:** Automatically probes for audio streams before applying `-c:a aac` flags to prevent instant FFmpeg crashes on GIFs/silent MP4s.

---

## Probing & Metadata

### `get_video_fps(file_path)` -> `float`
Returns the exact video framerate (e.g., `23.976`, `60.0`). Defaults to `24.0` if parsing fails.

### `get_video_duration(file_path)` -> `float`
Returns the video duration in seconds.

### `get_video_dimensions(file_path)` -> `tuple (width, height)`
Extracts the true raw dimensions of the physical video stream, independent of rotation metadata. Useful for resolving mismatches when editing vertical mobile videos.

### `has_audio_track(file_path)` -> `bool`
Fast probe that explicitly checks if an audio stream exists. Used internally by the generation tools to drop audio processing arguments safely.

---

## Generation & Export

### `generate_proxy(input_path, output_path, hw_encoder="libx264")` -> `bool`
Safely generates a lightweight 360p `.mp4` proxy for browser UI scrubbing.
- Handles audio detection.
- Cleans up `output_path` on exception.
- Accepts `h264_nvenc`, `h264_amf`, `h264_qsv`, or `h264_videotoolbox` for GPU acceleration.

### `generate_gallery_thumbnail(input_path, output_path)` -> `bool`
Generates a static lightweight JPEG frame for gallery views.

### `generate_gallery_webp(input_path, output_path, duration, frames_count, anim_threshold, sample_mode)` -> `bool`
Generates an animated `.webp` preview. 
- Uses `-skip_frame nokey` on large files to safely pull frames from across the entire duration without triggering intense Disk/CPU loads.

### `extract_audio_peaks(input_path, points=1200)` -> `list[float]`
Resamples the target file's audio track into an array of amplitude coordinates between `-1.0` and `1.0` suitable for rendering timeline waveforms. Returns an empty list if the file is silent.

### `export_clip(...)` -> `bool`
Handles the precise mathematical crop and scale extraction for AI dataset prep.
**Arguments:** `(input_path, output_path, start_time, end_time, src_fps, target_w, target_h, crop_mode, export_w, export_h, offset_x, offset_y, include_video, include_audio, force_24fps)`
- Handles zero-duplication framerate conforming to 24fps.
- Applies aspect-ratio black-padding if crop targets exceed source boundaries.
- Automatically cleans up partial files on crash.