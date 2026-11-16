import os
import json
import subprocess
import re
import mimetypes
from pathlib import Path
import numpy as np
import torch
from PIL import Image, ExifTags
from PIL.PngImagePlugin import PngInfo
from typing import List
import folder_paths
from comfy.utils import ProgressBar
from server import PromptServer
from aiohttp import web

# ---------------------------------------------------------------------------
# Web server route — serve saved video files to the browser
# ---------------------------------------------------------------------------
@PromptServer.instance.routes.get("/handyTool/view_saved_video")
async def view_saved_video(request):
    filepath = request.query.get("path", "")
    if not filepath or not os.path.exists(filepath):
        return web.Response(status=404)

    content_type, _ = mimetypes.guess_type(filepath)
    return web.FileResponse(
        filepath, headers={"Content-Type": content_type or "video/mp4"}
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_ffmpeg_path():
    """Return path to ffmpeg executable or raise an error."""
    candidates = [
        os.path.join(os.environ.get("COMFYUI_FFMPEG_PATH", ""), "ffmpeg"),
        os.path.abspath("ffmpeg"),
    ]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    import shutil
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError(
        "ffmpeg executable not found. Install ffmpeg or set COMFYUI_FFMPEG_PATH."
    )


def _tensor_to_uint8(tensor):
    """Convert a 0-1 float tensor to uint8 numpy array."""
    t = tensor.cpu().numpy() * 255.0 + 0.5
    return np.clip(t, 0, 255).astype(np.uint8)


def _pingpong(iterable):
    """Yield items forward then backward (excluding first and last)."""
    frames = list(iterable)
    yield from frames
    for i in range(len(frames) - 2, 0, -1):
        yield frames[i]


# ---------------------------------------------------------------------------
# Main Node Class
# ---------------------------------------------------------------------------

class HandyToolVideoSaver:
    """
    Save a batch of images as a video file.

    Supports MP4 (H.264), WebM (VP9), GIF, and WebP formats.
    An optional audio track can be muxed into the output.
    A custom output_path lets you choose where the video is saved.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "output_path": (
                    "STRING",
                    {
                        "default": "",
                        "multiline": False,
                        "tooltip": "Custom folder path for saving. Leave empty for ComfyUI default output directory.",
                    },
                ),
                "frame_rate": ("FLOAT", {"default": 8.0, "min": 0.1, "max": 240.0, "step": 0.1}),
                "format": (["mp4", "webm", "gif", "webp"],),
                "filename_prefix": ("STRING", {"default": "HandyTools"}),
                "save_output": ("BOOLEAN", {"default": True}),
                "pingpong": ("BOOLEAN", {"default": False}),
                "loop_count": ("INT", {"default": 0, "min": 0, "max": 100, "step": 1}),
                "crf_quality": (
                    "INT",
                    {
                        "default": 23,
                        "min": 0,
                        "max": 51,
                        "step": 1,
                        "tooltip": "CRF quality for MP4/WebM. Lower = better quality, higher = smaller file. 0-51 range.",
                    },
                ),
            },
            "optional": {
                "audio": ("AUDIO",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("VHS_FILENAMES",)
    RETURN_NAMES = ("filenames",)
    OUTPUT_NODE = True
    CATEGORY = "HandyTools/video"
    FUNCTION = "save_video"
    # -----------------------------------------------------------------------
    # Main execution method
    # -----------------------------------------------------------------------
    def save_video(
        self,
        images: torch.Tensor,
        output_path: str = "",
        frame_rate: float = 8.0,
        format: str = "mp4",
        filename_prefix: str = "HandyTools",
        save_output: bool = True,
        pingpong: bool = False,
        loop_count: int = 0,
        crf_quality: int = 23,
        audio=None,
        prompt=None,
        extra_pnginfo=None,
        unique_id=None,
    ):
        # ---- Early exits ---------------------------------------------------
        if images is None or (isinstance(images, torch.Tensor) and images.size(0) == 0):
            return ((save_output, []),)

        # Resolve the target directory ----------------------------------------
        use_custom = bool(output_path.strip())
        if use_custom:
            target_dir = output_path.strip()
            os.makedirs(target_dir, exist_ok=True)
            print(f"[HandyToolVideoSaver] Saving to custom path: {target_dir}")
        else:
            target_dir = (
                folder_paths.get_output_directory()
                if save_output
                else folder_paths.get_temp_directory()
            )

        # ---- Determine next counter (filename numbering) --------------------
        base_filename = filename_prefix
        max_counter = 0
        matcher = re.compile(
            rf"{re.escape(base_filename)}_(\d+)\D*\.", re.IGNORECASE
        )
        try:
            for f in os.listdir(target_dir):
                m = matcher.search(f)
                if m:
                    cnt = int(m.group(1))
                    if cnt > max_counter:
                        max_counter = cnt
        except OSError:
            pass
        counter = max_counter + 1

        # ---- Prepare frame iterator -----------------------------------------
        if pingpong:
            img_iter = _pingpong(images)
        else:
            img_iter = images

        frames_list = list(img_iter)
        num_frames = len(frames_list)
        pbar = ProgressBar(num_frames)

        first_frame = frames_list[0]
        has_alpha = first_frame.shape[-1] == 4

        # ---- Extension mapping -----------------------------------------------
        ext_map = {"mp4": "mp4", "webm": "webm", "gif": "gif", "webp": "webp"}
        ext = ext_map.get(format, "mp4")
        video_filename = f"{base_filename}_{counter:05}.{ext}"
        video_path = os.path.join(target_dir, video_filename)

        output_files: List[str] = []

        # ---- Save first-frame PNG with metadata -----------------------------
        self._save_metadata_png(
            target_dir, base_filename, counter, first_frame, prompt, extra_pnginfo,
            output_files
        )

        # ---- Encode video ----------------------------------------------------
        final_video = None

        if format in ("gif", "webp"):
            final_video = self._encode_pillow(
                frames_list, video_path, ext.upper(), frame_rate, loop_count
            )
        else:
            final_video = self._encode_ffmpeg(
                frames_list,
                video_path,
                ext,
                frame_rate,
                crf_quality,
                loop_count,
                has_alpha,
            )

        if final_video:
            output_files.append(final_video)

        # ---- Mux audio (optional) --------------------------------------------
        if audio is not None and final_video is not None:
            self._try_mux_audio(
                final_video, target_dir, base_filename, counter, ext,
                audio, frame_rate, num_frames
            )

        # ---- Build UI response -----------------------------------------------
        preview_file = os.path.basename(output_files[-1]) if output_files else video_filename
        png_filename = f"{base_filename}_{counter:05}.png"
        subfolder, output_type = self._compute_preview_info(
            target_dir, use_custom, save_output
        )

        preview = {
            "filename": preview_file,
            "subfolder": subfolder,
            "type": output_type,
            "format": f"video/{ext}",
            "frame_rate": frame_rate,
            "workflow": png_filename if any(png_filename in p for p in output_files) else "",
            "fullpath": output_files[-1] if output_files else video_path,
        }

        # Also pass video info to the DOM-based player widget
        video_player_info = None
        if final_video and os.path.exists(final_video):
            video_player_info = {
                "path": os.path.abspath(final_video),
                "filename": preview_file,
                "format": ext,
            }

        return {
            "ui": {"gifs": [preview], "video_player": [video_player_info]},
            "result": ((save_output, output_files),),
        }

    # -----------------------------------------------------------------------
    # Internal: Save first-frame PNG with metadata
    # -----------------------------------------------------------------------
    def _save_metadata_png(
        self, target_dir, prefix, counter, first_frame, prompt, extra_pnginfo, output_files
    ):
        png_filename = f"{prefix}_{counter:05}.png"
        png_path = os.path.join(target_dir, png_filename)

        metadata = PngInfo()
        if prompt is not None:
            try:
                metadata.add_text("prompt", json.dumps(prompt))
            except Exception:
                pass
        if extra_pnginfo is not None:
            for k, v in extra_pnginfo.items():
                try:
                    metadata.add_text(k, json.dumps(v))
                except Exception:
                    pass

        try:
            rgb_frame = first_frame[:,:,:3]  # strip alpha if present
            Image.fromarray(_tensor_to_uint8(rgb_frame)).save(
                png_path, pnginfo=metadata, compress_level=4
            )
            output_files.append(png_path)
        except Exception as e:
            print(f"[HandyToolVideoSaver] Warning: could not save metadata PNG: {e}")

    # -----------------------------------------------------------------------
    # Internal: Compute preview subfolder and type for UI
    # -----------------------------------------------------------------------
    def _compute_preview_info(self, target_dir, use_custom, save_output):
        if use_custom:
            return ("", "custom")
        base_dir = (
            folder_paths.get_output_directory()
            if save_output
            else folder_paths.get_temp_directory()
        )
        try:
            rel = os.path.relpath(target_dir, base_dir)
            subfolder = rel if rel != "." else ""
        except ValueError:
            subfolder = ""
        output_type = "output" if save_output else "temp"
        return (subfolder, output_type)

    # -----------------------------------------------------------------------
    # Internal: Pillow-based encoding (GIF / WebP)
    # -----------------------------------------------------------------------
    def _encode_pillow(self, frames, filepath, fmt, fps, loop):
        duration_ms = max(1, int(1000.0 / fps))
        pil_frames = [
            Image.fromarray(_tensor_to_uint8(f[:,:,:3])) for f in frames
        ]
        if not pil_frames:
            return None

        kwargs = {
            "save_all": True,
            "duration": duration_ms,
            "loop": loop,
            "compress_level": 4,
        }
        if fmt == "GIF":
            kwargs["disposal"] = 2
        elif fmt == "WEBP":
            kwargs["lossless"] = False

        try:
            pil_frames[0].save(
                filepath, format=fmt, append_images=pil_frames[1:], **kwargs
            )
            return filepath
        except Exception as e:
            print(f"[HandyToolVideoSaver] Pillow encode failed: {e}")
            return None

    # -----------------------------------------------------------------------
    # Internal: FFmpeg-based encoding (MP4 / WebM)
    # -----------------------------------------------------------------------
    def _encode_ffmpeg(self, frames, filepath, ext, fps, crf, loop, has_alpha):
        ffmpeg = _get_ffmpeg_path()

        codec_map = {"mp4": "libx264", "webm": "libvpx-vp9"}
        pix_fmt_map = {
            ("mp4", True): "yuv420p",
            ("mp4", False): "yuv420p",
            ("webm", True): "yuva420p",
            ("webm", False): "yuv420p",
        }

        codec = codec_map.get(ext, "libx264")
        pix_fmt = pix_fmt_map.get((ext, has_alpha), "yuv420p")
        h, w = frames[0].shape[0], frames[0].shape[1]

        pixel_in = "rgba" if has_alpha else "rgb24"
        args = [
            ffmpeg, "-v", "error",
            "-f", "rawvideo",
            "-pix_fmt", pixel_in,
            "-s", f"{w}x{h}",
            "-r", str(fps),
            "-i", "-",
        ]

        if loop > 0:
            total = len(frames)
            args += ["-vf", f"loop=loop={loop}:size={total}"]

        args += ["-c:v", codec, "-crf", str(crf), "-pix_fmt", pix_fmt]

        if ext == "mp4":
            args += ["-movflags", "+faststart"]

        raw_bytes = b"".join(
            _tensor_to_uint8(f[:,:,:3]).tobytes() for f in frames
        )

        try:
            proc = subprocess.run(
                args + [filepath],
                input=raw_bytes,
                capture_output=True,
                env=os.environ.copy(),
            )
            if proc.returncode != 0:
                err = proc.stderr.decode(errors="replace")
                print(f"[HandyToolVideoSaver] FFmpeg error: {err}")
                return None
            return filepath
        except Exception as e:
            print(f"[HandyToolVideoSaver] FFmpeg subprocess exception: {e}")
            return None

    # -----------------------------------------------------------------------
    # Internal: Mux audio into video (FFmpeg)
    # -----------------------------------------------------------------------
    def _try_mux_audio(
        self, video_path, target_dir, prefix, counter, ext,
        audio, fps, num_frames
    ):
        try:
            a_waveform = audio.get("waveform")
            a_sample_rate = audio.get("sample_rate", 44100)
        except Exception:
            return None

        if a_waveform is None or ext not in ("mp4", "webm"):
            return None

        ffmpeg = _get_ffmpeg_path()

        channels = a_waveform.size(1) if a_waveform.dim() >= 2 else 1
        min_dur = num_frames / fps + 1.0
        codec_a = {"mp4": "aac", "webm": "libopus"}.get(ext, "aac")

        # ------------------------------------------------------------------
        # Write audio to a temporary WAV file instead of piping via stdin.
        # On Windows, FFmpeg + piped stdin consistently produces 0-byte
        # output files (return code 0 but empty output).  Using a real file
        # for both inputs avoids this entirely.
        # ------------------------------------------------------------------
        audio_np = a_waveform.squeeze(0).transpose(0, 1).numpy()
        # Convert float32 [-1, 1] to int16 PCM
        audio_int16 = np.clip(audio_np * 32767., -32768, 32767).astype(np.int16)

        import tempfile as _tf
        video_dir = os.path.dirname(video_path) or "."

        fd_wav, wav_path = _tf.mkstemp(suffix=".wav", dir=video_dir)
        os.close(fd_wav)
        fd_mixed, mixed_path = _tf.mkstemp(
            suffix=f"_mux_tmp.{ext}", dir=video_dir
        )
        os.close(fd_mixed)

        try:
            # Write WAV file (PCM 16-bit, little-endian)
            import wave as _wave
            with _wave.open(wav_path, "w") as wf:
                wf.setnchannels(channels)
                wf.setsampwidth(2)   # 16-bit
                wf.setframerate(a_sample_rate)
                wf.writeframes(audio_int16.tobytes())

            # Mux video + WAV -> final output (both read as file inputs)
            args = [
                ffmpeg, "-y", "-v", "error",
                "-i", video_path,
                "-i", wav_path,
                "-c:v", "copy",
                "-c:a", codec_a,
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-t", str(min_dur),
                mixed_path,
            ]

            proc = subprocess.run(
                args,
                capture_output=True,
                env=os.environ.copy(),
            )

            if proc.returncode != 0:
                err = proc.stderr.decode(errors="replace")
                print(f"[HandyToolVideoSaver] Audio mux error: {err}")
                return video_path  # return original on failure

            # Verify the output file is actually valid (non-zero size)
            if not os.path.exists(mixed_path) or os.path.getsize(mixed_path) < 500:
                print("[HandyToolVideoSaver] Mux produced empty file, keeping original.")
                return video_path

            # Mux succeeded — atomically replace the original file
            os.replace(mixed_path, video_path)
            print(f"[HandyToolVideoSaver] Audio muxed successfully -> {os.path.basename(video_path)}")
            return video_path

        except Exception as e:
            print(f"[HandyToolVideoSaver] Audio mux exception: {e}")
            return None
        finally:
            # Always clean up temp files
            for _p in (wav_path, mixed_path):
                if os.path.exists(_p):
                    try: os.remove(_p)
                    except OSError: pass


NODE_CLASS_MAPPINGS = {"HandyToolVideoSaver": HandyToolVideoSaver}
NODE_DISPLAY_NAME_MAPPINGS = {"HandyToolVideoSaver": "Save Video 🛠"}

