import os
import json
import shutil
import subprocess
from pathlib import Path

# Resolve ffmpeg and ffprobe paths (system PATH or ComfyUI bundled imageio_ffmpeg)
def get_ffmpeg_tools():
    ffmpeg_bin = shutil.which("ffmpeg")
    ffprobe_bin = shutil.which("ffprobe")

    if not ffmpeg_bin or not ffprobe_bin:
        try:
            import imageio_ffmpeg
            bundled_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            if not ffmpeg_bin:
                ffmpeg_bin = bundled_ffmpeg
            if not ffprobe_bin:
                bundled_dir = Path(bundled_ffmpeg).parent
                probe_candidate = bundled_dir / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
                if probe_candidate.is_file():
                    ffprobe_bin = str(probe_candidate)
        except ImportError:
            pass

    return ffmpeg_bin, ffprobe_bin


def parse_fps(fps_str):
    """Safely converts fractional frame rates like '24/1' or '24000/1001' to float."""
    try:
        if "/" in fps_str:
            num, den = fps_str.split("/")
            return float(num) / float(den) if float(den) != 0 else 0.0
        return float(fps_str)
    except (ValueError, TypeError, ZeroDivisionError):
        return 0.0


def floor_to_even_multiple_of_32(val):
    """
    Floors dimension to the largest even multiple of 32 (i.e. multiple of 64)
    that fits inside the original bounds.
    Example: 240 -> 192 (192 / 32 = 6).
    """
    floored = (val // 64) * 64
    return max(64, floored)


class HandyToolMinimaxVideoConverter:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "folder_path": ("STRING", {"default": "", "multiline": False}),
                "fix_size": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "convert_videos"
    CATEGORY = "handyTools/Minimax"

    def convert_videos(self, folder_path, fix_size):
        if not folder_path or not os.path.isdir(folder_path):
            print(f"[handyTools Minimax] Invalid or empty directory: '{folder_path}'")
            return ()

        ffmpeg_bin, ffprobe_bin = get_ffmpeg_tools()
        if not ffmpeg_bin or not ffprobe_bin:
            raise RuntimeError(
                "[handyTools Minimax] ffmpeg or ffprobe binary could not be found. "
                "Ensure ffmpeg is in your system PATH or imageio-ffmpeg is installed."
            )

        valid_exts = {".mp4", ".mov", ".mkv", ".avi", ".webm"}
        files = [
            f for f in os.listdir(folder_path)
            if Path(f).suffix.lower() in valid_exts and not f.startswith(".")
        ]

        if not files:
            print(f"[handyTools Minimax] No video files found in: '{folder_path}'")
            return ()

        out_dir = os.path.join(folder_path, "_minimaxFormat")
        os.makedirs(out_dir, exist_ok=True)

        total_files = len(files)
        print(f"[handyTools Minimax] Scanning {total_files} file(s) in '{folder_path}'...")

        for idx, filename in enumerate(files, start=1):
            file_path = os.path.join(folder_path, filename)
            
            cmd_probe = [
                ffprobe_bin,
                "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                file_path
            ]

            try:
                probe_res = subprocess.run(
                    cmd_probe, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
                )
                info = json.loads(probe_res.stdout)
            except Exception as e:
                print(f"[{idx}/{total_files}] Failed to probe {filename}: {e}")
                continue

            streams = info.get("streams", [])
            v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
            a_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

            # Rule: If it doesn't have audio, do nothing
            if not a_stream:
                print(f"[{idx}/{total_files}] Skipping {filename}: Missing audio track.")
                continue

            if not v_stream:
                print(f"[{idx}/{total_files}] Skipping {filename}: No video track found.")
                continue

            # Check FPS
            raw_fps = v_stream.get("r_frame_rate", "0/0")
            fps = parse_fps(raw_fps)
            needs_fps_change = abs(fps - 24.0) > 0.05

            # Check Audio Sample Rate
            sample_rate = int(a_stream.get("sample_rate", 0))
            needs_audio_resample = (sample_rate != 32000)

            # Check Dimension Alignment (Even multiple of 32 -> Multiple of 64)
            orig_w = int(v_stream.get("width", 0))
            orig_h = int(v_stream.get("height", 0))
            target_w = floor_to_even_multiple_of_32(orig_w) if fix_size else orig_w
            target_h = floor_to_even_multiple_of_32(orig_h) if fix_size else orig_h
            needs_crop = fix_size and (target_w != orig_w or target_h != orig_h)

            # Rule: If already compliant, do nothing
            if not needs_fps_change and not needs_audio_resample and not needs_crop:
                print(f"[{idx}/{total_files}] Skipping {filename}: Already compliant (24fps, 32kHz, even multiples of 32).")
                continue

            # Build export path: <stem>_minimax.mp4
            file_stem = Path(filename).stem
            out_filename = f"{file_stem}_minimax.mp4"
            out_path = os.path.join(out_dir, out_filename)

            # Assemble ffmpeg arguments
            cmd_convert = [ffmpeg_bin, "-y", "-i", file_path]

            # Video Filters / Codec
            vf_filters = []
            if needs_fps_change:
                vf_filters.append("fps=24")
            if needs_crop:
                vf_filters.append(f"crop={target_w}:{target_h}")

            if vf_filters:
                cmd_convert.extend(["-vf", ",".join(vf_filters), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18"])
            else:
                cmd_convert.extend(["-c:v", "copy"])

            # Audio resampling
            if needs_audio_resample:
                cmd_convert.extend(["-ar", "32000", "-c:a", "aac", "-b:a", "192k"])
            else:
                cmd_convert.extend(["-c:a", "copy"])

            cmd_convert.append(out_path)

            print(
                f"[{idx}/{total_files}] Converting {filename} -> {out_filename} "
                f"(FPS: {fps:.2f}->24, Audio: {sample_rate}->32k, "
                f"Crop: {orig_w}x{orig_h}->{target_w}x{target_h} [factor: {target_w//32}x{target_h//32}])"
            )
            
            try:
                subprocess.run(cmd_convert, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            except subprocess.CalledProcessError as e:
                print(f"[handyTools Minimax] Error converting {filename}: {e.stderr.decode('utf-8', errors='ignore')}")

        print(f"[handyTools Minimax] Done! Converted files stored in: '{out_dir}'")
        return ()


NODE_CLASS_MAPPINGS = {
    "HandyToolMinimaxVideoConverter": HandyToolMinimaxVideoConverter
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolMinimaxVideoConverter": "handyTools Minimax video converter"
}