import os
import asyncio
import json
import math

async def _run_cmd(cmd, timeout=None):
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        if timeout:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        else:
            stdout, stderr = await proc.communicate()
        return proc.returncode, stdout, stderr
    except asyncio.TimeoutError:
        proc.kill()
        raise Exception("Command timed out")
    except Exception as e:
        raise Exception(f"Subprocess execution failed: {str(e)}")

# ------------------------------------------------------------------
# PROBING & METADATA
# ------------------------------------------------------------------

async def get_video_codec(file_path):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    code, stdout, _ = await _run_cmd(cmd, timeout=5.0)
    if code == 0: return stdout.decode().strip().lower()
    return ""

async def get_video_fps(file_path):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate,r_frame_rate", "-of", "json", file_path]
    code, stdout, _ = await _run_cmd(cmd, timeout=5.0)
    if code == 0:
        try:
            data = json.loads(stdout.decode())
            streams = data.get("streams", [])
            if streams:
                for key in ("avg_frame_rate", "r_frame_rate"):
                    val = streams[0].get(key, "")
                    if "/" in val:
                        num, den = val.split("/")
                        if float(den) > 0 and float(num) > 0: return float(num) / float(den)
                    elif val:
                        fval = float(val)
                        if fval > 0: return fval
        except Exception:
            pass
    return 24.0

async def get_video_duration(file_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    code, stdout, _ = await _run_cmd(cmd, timeout=5.0)
    if code == 0:
        try: return float(stdout.decode().strip())
        except ValueError: pass
    return 0.0

async def get_video_dimensions(file_path):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_tags=rotate:stream_side_data=rotation", "-of", "json", file_path]
    code, stdout, _ = await _run_cmd(cmd, timeout=5.0)
    if code == 0:
        try:
            metadata = json.loads(stdout.decode())
            if "streams" in metadata and len(metadata["streams"]) > 0:
                stream = metadata["streams"][0]
                w = stream.get("width", 0)
                h = stream.get("height", 0)
                rotate = 0
                tags = stream.get("tags", {})
                if tags and "rotate" in tags: rotate = int(tags.get("rotate", 0))
                side_data = stream.get("side_data_list", [])
                for sd in side_data:
                    if "rotation" in sd:
                        rotate = int(sd["rotation"])
                        break
                if abs(rotate) == 90 or abs(rotate) == 270: w, h = h, w
                return w, h
        except Exception:
            pass
    return 0, 0

async def has_audio_track(file_path):
    cmd = ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file_path]
    code, stdout, _ = await _run_cmd(cmd, timeout=5.0)
    if code == 0: return "audio" in stdout.decode().strip().lower()
    return False

# ------------------------------------------------------------------
# GENERATION & EXPORT DYNAMIC CONFORM ALGORITHMS
# ------------------------------------------------------------------

def is_near(val, target, tol=0.15):
    return abs(val - target) < tol

def get_24fps_conform_filters(src_fps):
    v_filters = ["setpts=PTS-STARTPTS"]
    a_filter = ""
    tempo = 1.0

    if is_near(src_fps, 24.0, 0.01):
        v_filters.append("setpts=N/(24*TB)")
    elif is_near(src_fps, 23.976):
        v_filters.append("setpts=N/(24*TB)")
        tempo = 24.0 / 23.976
    elif is_near(src_fps, 25.0):
        v_filters.append("setpts=N/(24*TB)")
        tempo = 24.0 / 25.0
    elif is_near(src_fps, 50.0):
        v_filters.extend(["fps=25", "setpts=N/(24*TB)"])
        tempo = 24.0 / 25.0
    else:
        v_filters.extend(["fps=24", "setpts=N/(24*TB)"])
        tempo = 1.0

    if abs(tempo - 1.0) > 0.001:
        a_filter = f"atempo={tempo}"
        
    return v_filters, a_filter, tempo

def get_source_time(ui_frame, src_fps):
    if is_near(src_fps, 23.976): return ui_frame / 23.976
    elif is_near(src_fps, 25.0): return ui_frame / 25.0
    elif is_near(src_fps, 50.0): return ui_frame / 25.0
    else: return ui_frame / 24.0

# ------------------------------------------------------------------
# EXPORT CLIP & KEYFRAME BAKING ENGINE (EXPLICIT GEOMETRY)
# ------------------------------------------------------------------
def _snap_32(val):
    return max(32, int(round(val / 32.0)) * 32)

async def export_clip(input_path, base_clips_dir, base_name, clip_id, _ignore_start, _ignore_end, src_fps, 
                      target_w, target_h, crop_mode, export_w, export_h, 
                      offset_x, offset_y, rotation, include_video, include_audio, 
                      force_24fps=True, encoder="h264", crf=17,
                      keyframes=None, interp_mode="linear", start_frame=0, end_frame=0,
                      use_custom_name=False, custom_name="", save_by_size=False,
                      training_resize_enabled=False, training_buckets_str=""):
    
    probed_fps = await get_video_fps(input_path)
    if probed_fps > 0:
        src_fps = probed_fps

    true_w, true_h = await get_video_dimensions(input_path)
    vid_w, vid_h = true_w, true_h
    if rotation in (90, 270):
        vid_w, vid_h = true_h, true_w

    # 1. Determine Final Training Bucket Dimensions if Enabled
    final_w, final_h = export_w, export_h

    if training_resize_enabled and include_video and training_buckets_str.strip():
        parsed_buckets = []
        for part in training_buckets_str.replace(";", ",").split(","):
            part = part.strip()
            if "x" in part.lower():
                try:
                    raw_bw, raw_bh = map(int, part.lower().split("x"))
                    if raw_bw > 0 and raw_bh > 0:
                        parsed_buckets.append((_snap_32(raw_bw), _snap_32(raw_bh)))
                except ValueError:
                    pass
        
        if parsed_buckets:
            ref_w = target_w if (crop_mode and target_w > 0) else export_w
            ref_h = target_h if (crop_mode and target_h > 0) else export_h
            clip_ratio = ref_w / float(ref_h)
            best_bucket = min(
                parsed_buckets,
                key=lambda b: (round(abs((b[0] / float(b[1])) - clip_ratio), 4), abs((b[0] * b[1]) - (ref_w * ref_h)))
            )
            final_w, final_h = best_bucket

    # 2. Output Pathing & Naming
    if not include_video:
        output_dir = os.path.join(base_clips_dir, "audio")
    elif save_by_size:
        output_dir = os.path.join(base_clips_dir, f"{final_w}x{final_h}")
    else:
        output_dir = base_clips_dir
    os.makedirs(output_dir, exist_ok=True)

    ext = ".wav" if not include_video else (".mov" if encoder == "prores" else ".mp4")
    out_name = f"{custom_name}_{clip_id}{ext}" if (use_custom_name and custom_name) else f"{base_name}_{clip_id}{ext}"
    output_path = os.path.join(output_dir, out_name)

    v_filters, a_filter, tempo = get_24fps_conform_filters(src_fps)
    exact_frame_count = max(0, end_frame - start_frame)
    
    if exact_frame_count > 0:
        start_time = f"{get_source_time(start_frame, src_fps):.4f}"
        end_time = f"{get_source_time(end_frame + 12, src_fps):.4f}"
        audio_end_time = f"{get_source_time(end_frame, src_fps):.4f}"
    else:
        start_time = _ignore_start
        end_time = _ignore_end
        audio_end_time = _ignore_end
        
    if not include_video:
        cmd = ["ffmpeg", "-y", "-ss", start_time, "-to", audio_end_time, "-i", input_path, "-vn"]
        if a_filter: cmd.extend(["-filter:a", a_filter])
        cmd.extend(["-c:a", "pcm_s16le", output_path])
        
    else:
        rotate_filter = ""
        if rotation == 90: rotate_filter = "transpose=1," 
        elif rotation == 180: rotate_filter = "transpose=1,transpose=1," 
        elif rotation == 270: rotate_filter = "transpose=2," 
            
        anim_txt_path = None
        pad_crop_filter = ""

        if crop_mode and vid_w > 0 and vid_h > 0:
            # Safely clamp the crop box to the physical video dimensions so it never pads with black void
            safe_target_w = min(vid_w, target_w)
            safe_target_h = min(vid_h, target_h)

            if keyframes and len(keyframes) > 0:
                anim_txt_path = f"{output_path}.sendcmd.txt"
                anim_txt_path_esc = anim_txt_path.replace('\\', '/').replace(':', '\\:')
                
                kfs = sorted(keyframes, key=lambda k: k['frame'])
                def get_interpolated_pos(frame):
                    if frame <= kfs[0]['frame']: return kfs[0]['x'], kfs[0]['y']
                    if frame >= kfs[-1]['frame']: return kfs[-1]['x'], kfs[-1]['y']
                    k1, k2 = kfs[0], kfs[1]
                    for i in range(len(kfs) - 1):
                        if kfs[i]['frame'] <= frame <= kfs[i+1]['frame']:
                            k1, k2 = kfs[i], kfs[i+1]
                            break
                    denom = k2['frame'] - k1['frame']
                    if denom == 0: return k1['x'], k1['y']
                    t = (frame - k1['frame']) / float(denom)
                    if interp_mode == "smooth": t = 0.5 * (1.0 - math.cos(t * math.pi))
                    return k1['x'] + (k2['x'] - k1['x']) * t, k1['y'] + (k2['y'] - k1['y']) * t

                lines = []
                total_frames = exact_frame_count if exact_frame_count > 0 else (end_frame - start_frame)
                for i in range(total_frames + 1):
                    ui_frame = start_frame + i
                    x_off, y_off = get_interpolated_pos(ui_frame)
                    
                    x_px = int(round((vid_w - safe_target_w) * x_off))
                    y_px = int(round((vid_h - safe_target_h) * y_off))
                    x_px = max(0, min(x_px, vid_w - safe_target_w))
                    y_px = max(0, min(y_px, vid_h - safe_target_h))
                    
                    start_t = max(0.0, (i - 0.5) / 24.0)
                    end_t = (i + 0.5) / 24.0
                    lines.append(f"{start_t:.5f}-{end_t:.5f} [enter] crop x {x_px};")
                    lines.append(f"{start_t:.5f}-{end_t:.5f} [enter] crop y {y_px};")
                    
                with open(anim_txt_path, 'w', encoding='utf-8') as f_out:
                    f_out.write("\n".join(lines))
                
                crop_str = f"sendcmd=f='{anim_txt_path_esc}',crop={safe_target_w}:{safe_target_h}:0:0"
            else:
                crop_x = int(round((vid_w - safe_target_w) * offset_x))
                crop_y = int(round((vid_h - safe_target_h) * offset_y))
                crop_str = f"crop={safe_target_w}:{safe_target_h}:{crop_x}:{crop_y}"

            # Exact Python math to scale the crop proportionally so it perfectly covers the output bucket
            if final_w != safe_target_w or final_h != safe_target_h:
                scale_w_ratio = final_w / float(safe_target_w)
                scale_h_ratio = final_h / float(safe_target_h)
                cover_ratio = max(scale_w_ratio, scale_h_ratio)
                
                scaled_w = _snap_32(safe_target_w * cover_ratio)
                scaled_h = _snap_32(safe_target_h * cover_ratio)
                
                scale_str = f",scale={scaled_w}:{scaled_h},crop={final_w}:{final_h},setsar=1"
            else:
                scale_str = f",setsar=1"

            pad_crop_filter = f"{crop_str}{scale_str}"
            
        else:
            # Stretch mode (crop_mode = False)
            pad_crop_filter = f"scale={final_w}:{final_h},setsar=1"

        full_transform_chain = f"{rotate_filter}{pad_crop_filter}"
        
        if v_filters: filter_str = ",".join(v_filters + [full_transform_chain])
        else: filter_str = full_transform_chain

        cmd = [
            "ffmpeg", "-y",
            "-ss", start_time, "-to", end_time,
            "-i", input_path,
            "-filter:v", filter_str
        ]
        
        if encoder == "prores": cmd.extend(["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"])
        elif encoder == "hevc" or encoder == "h265": cmd.extend(["-c:v", "libx265", "-preset", "slow", "-crf", str(crf), "-tag:v", "hvc1", "-pix_fmt", "yuv420p"])
        else: cmd.extend(["-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart"])

        cmd.extend(["-r", "24"])
        if exact_frame_count > 0:
            cmd.extend(["-frames:v", str(exact_frame_count)])
            exact_out_dur = f"{(exact_frame_count / 24.0):.4f}"
            cmd.extend(["-t", exact_out_dur])

        if include_audio:
            has_audio = await has_audio_track(input_path)
            if has_audio:
                if a_filter: cmd.extend(["-filter:a", a_filter, "-c:a", "aac", "-b:a", "192k"])
                else: cmd.extend(["-c:a", "aac", "-b:a", "192k"])
            else: cmd.append("-an")
        else:
            cmd.append("-an")

        cmd.append(output_path)
        
    try:
        code, _, stderr = await _run_cmd(cmd)
        if code != 0:
            if os.path.isfile(output_path): os.remove(output_path)
            raise Exception(f"FFmpeg Export Error: {stderr.decode('utf-8', errors='ignore')}")
        return True
    finally:
        if include_video and anim_txt_path and os.path.isfile(anim_txt_path):
            try: os.remove(anim_txt_path)
            except Exception: pass

# ... [Leave generate_proxy, generate_gallery_thumbnail, generate_clip_thumbnail, generate_gallery_webp, and extract_audio_peaks exactly as they were below this point] ...

async def generate_proxy(input_path, output_path, hw_encoder="libx264"):
    has_audio = await has_audio_track(input_path)
    src_fps = await get_video_fps(input_path)
    v_filters, a_filter, tempo = get_24fps_conform_filters(src_fps)
    proxy_v_filters = v_filters + ["scale=-2:360,setsar=1"]
    filter_v_str = ",".join(proxy_v_filters)
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vf", filter_v_str, "-r", "24", "-g", "12", "-pix_fmt", "yuv420p"]
    if has_audio:
        if a_filter: cmd.extend(["-filter:a", a_filter])
        cmd.extend(["-c:a", "aac", "-b:a", "96k", "-ac", "2"])
    else:
        cmd.extend(["-an"])
    if hw_encoder == "h264_nvenc":
        cmd[1:1] = ["-hwaccel", "auto"]
        cmd.extend(["-c:v", "h264_nvenc", "-preset", "p4", "-b:v", "800k", "-maxrate", "800k", "-bufsize", "1600k"])
    elif hw_encoder == "h264_amf":
        cmd[1:1] = ["-hwaccel", "auto"]
        cmd.extend(["-c:v", "h264_amf", "-quality", "speed", "-b:v", "800k"])
    elif hw_encoder == "h264_qsv":
        cmd[1:1] = ["-hwaccel", "auto"]
        cmd.extend(["-c:v", "h264_qsv", "-preset", "fast", "-b:v", "800k"])
    elif hw_encoder == "h264_videotoolbox":
        cmd.extend(["-c:v", "h264_videotoolbox", "-b:v", "800k"])
    else: 
        cmd.extend(["-c:v", "libx264", "-preset", "veryfast", "-tune", "fastdecode", "-crf", "30", "-maxrate", "800k", "-bufsize", "1600k"])
    cmd.append(output_path)
    try:
        code, stdout, stderr = await _run_cmd(cmd)
        if code != 0:
            if os.path.isfile(output_path): os.remove(output_path)
            raise Exception(f"FFmpeg Error ({hw_encoder}): {stderr.decode('utf-8', errors='ignore')}")
        return True
    except Exception as e:
        if os.path.isfile(output_path): os.remove(output_path)
        raise e

async def generate_gallery_thumbnail(input_path, output_path):
    cmd = ["ffmpeg", "-y", "-threads", "1", "-i", input_path, "-frames:v", "1", "-vf", "scale=240:-2,setsar=1", "-q:v", "5", output_path]
    code, _, stderr = await _run_cmd(cmd)
    if code != 0: raise Exception(f"Thumb generation failed: {stderr.decode('utf-8', errors='ignore')}")
    return True

async def generate_clip_thumbnail(input_path, output_path, timestamp):
    cmd = ["ffmpeg", "-y", "-threads", "1", "-ss", str(timestamp), "-i", input_path, "-frames:v", "1", "-vf", "scale=160:-2,setsar=1", "-q:v", "5", output_path]
    code, _, stderr = await _run_cmd(cmd)
    if code != 0: raise Exception(f"Clip thumb failed: {stderr.decode('utf-8', errors='ignore')}")
    return True

async def generate_gallery_webp(input_path, output_path, duration, frames_count, anim_threshold, sample_mode):
    if sample_mode == "full" and duration > anim_threshold:
        fps_val = frames_count / duration
        cmd = ["ffmpeg", "-y", "-threads", "1", "-skip_frame", "nokey", "-i", input_path, "-vf", f"fps={fps_val},scale=240:-2,setsar=1", "-vframes", str(frames_count), "-c:v", "libwebp", "-loop", "0", "-q:v", "50", output_path]
    else:
        fps_val = max(1.0, frames_count / 5.0)
        cmd = ["ffmpeg", "-y", "-threads", "1", "-i", input_path, "-t", "5", "-vf", f"fps={fps_val},scale=240:-2,setsar=1", "-vframes", str(frames_count), "-c:v", "libwebp", "-loop", "0", "-q:v", "50", output_path]
    code, _, stderr = await _run_cmd(cmd)
    if code != 0: raise Exception(f"WebP generation failed: {stderr.decode('utf-8', errors='ignore')}")
    return True

async def extract_audio_peaks(input_path, points=1200):
    cmd = ["ffmpeg", "-y", "-threads", "2", "-i", input_path, "-ac", "1", "-filter:a", f"aresample={points}", "-map", "0:a:0", "-f", "u8", "-c:a", "pcm_u8", "-"]
    code, stdout, _ = await _run_cmd(cmd, timeout=8.0)
    if code == 0 and stdout: return [round((b - 128) / 128.0, 3) for b in stdout]
    return []