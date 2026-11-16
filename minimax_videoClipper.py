import os
import asyncio
import json
import folder_paths
from aiohttp import web
from server import PromptServer
import uuid

from . import handyTool_api_video_ops as video_ops

class MinimaxVideoClipper:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "dummy_trigger": ("STRING", {"default": "UI Node - No inputs required"}),
            }
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "do_nothing"
    CATEGORY = "HandyTools"
    OUTPUT_NODE = True

    def do_nothing(self, **kwargs):
        return ()

NODE_CLASS_MAPPINGS = {
    "MinimaxVideoClipper": MinimaxVideoClipper
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MinimaxVideoClipper": "Minimax Video Clipper"
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GLOBAL_STATE_FILE = os.path.join(BASE_DIR, "web", "videoClipper", "global_state.json")

thumb_semaphore = asyncio.Semaphore(4)

# --- ACTIVE TASK REGISTRY FOR CANCELLATION ---
active_ffmpeg_tasks = {}

@PromptServer.instance.routes.post("/video_clipper/cancel_task")
async def cancel_task(request):
    data = await request.json()
    task_id = data.get("task_id", "")
    target_file = data.get("target_file", "")
    
    if task_id in active_ffmpeg_tasks:
        task = active_ffmpeg_tasks[task_id]
        if not task.done():
            task.cancel()
            
        if target_file and os.path.isfile(target_file):
            try:
                os.remove(target_file)
            except Exception:
                pass
                
        return web.json_response({"status": "cancelled", "message": f"Task {task_id} terminated."})
    return web.json_response({"status": "not_found"})

# ------------------------------------------------------------------
# SERVER API ENDPOINTS
# ------------------------------------------------------------------

@PromptServer.instance.routes.post("/video_clipper/save_global_state")
async def save_global_state(request):
    try:
        data = await request.json()
        os.makedirs(os.path.dirname(GLOBAL_STATE_FILE), exist_ok=True)
        with open(GLOBAL_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

@PromptServer.instance.routes.get("/video_clipper/load_global_state")
async def load_global_state(request):
    if os.path.isfile(GLOBAL_STATE_FILE):
        try:
            with open(GLOBAL_STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return web.json_response({"status": "success", "state": data})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)})
    return web.json_response({"status": "error", "state": None})

@PromptServer.instance.routes.post("/video_clipper/save_project_state")
async def save_project_state(request):
    try:
        data = await request.json()
        dir_path = data.get("directory", "").strip()
        if not dir_path:
            return web.json_response({"status": "error", "message": "No directory provided"})
            
        project_state_file = os.path.join(dir_path, "_data", "project.json")
        os.makedirs(os.path.dirname(project_state_file), exist_ok=True)
        
        with open(project_state_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

@PromptServer.instance.routes.get("/video_clipper/load_project_state")
async def load_project_state(request):
    dir_path = request.query.get("dir", "").strip()
    if not dir_path:
        return web.json_response({"status": "error", "state": None})
        
    project_state_file = os.path.join(dir_path, "_data", "project.json")
    if os.path.isfile(project_state_file):
        try:
            with open(project_state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return web.json_response({"status": "success", "state": data})
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)})
    return web.json_response({"status": "error", "state": None})

@PromptServer.instance.routes.get("/video_clipper/video_list")
async def get_video_list(request):
    dir_path = request.query.get("dir", "").strip()
    if not dir_path:
        dir_path = folder_paths.get_input_directory()
        
    if not os.path.isdir(dir_path):
        return web.json_response({"videos": [], "states": [], "proxies": []})
    
    supported_exts = {".mp4", ".webm", ".mkv", ".mov", ".avi"}
    videos = []
    states = []
    proxies = []
    
    try:
        for f in os.listdir(dir_path):
            if os.path.splitext(f)[1].lower() in supported_exts:
                videos.append(f)
                
        edit_files_dir = os.path.join(dir_path, "_data", "editFiles")
        if os.path.isdir(edit_files_dir):
            for s in os.listdir(edit_files_dir):
                if s.endswith(".json"):
                    state_path = os.path.join(edit_files_dir, s)
                    try:
                        with open(state_path, "r", encoding="utf-8") as sf:
                            sdata = json.load(sf)
                            if sdata.get("clips") and len(sdata["clips"]) > 0:
                                states.append(s[:-5])
                    except Exception:
                        pass
        
        temp_dir = os.path.join(dir_path, "_data", "_temp")
        if os.path.isdir(temp_dir):
            for vid in videos:
                safe_name = os.path.splitext(vid)[0]
                if os.path.isfile(os.path.join(temp_dir, f"{safe_name}_proxy.mp4")):
                    proxies.append(vid)

    except Exception as e:
        print(f"Video Clipper Error reading directory: {e}")
        
    return web.json_response({"videos": sorted(videos), "states": states, "proxies": proxies})

@PromptServer.instance.routes.get("/video_clipper/gallery_asset")
async def get_gallery_asset(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    asset_type = request.query.get("type", "jpg").lower()
    frames_count = int(request.query.get("frames", 12))
    anim_threshold = float(request.query.get("threshold", 30.0))
    sample_mode = request.query.get("sample_mode", "full")
    
    if not dir_path or not filename: return web.Response(status=400, text="Missing params")
    input_path = os.path.join(dir_path, filename)
    if not os.path.isfile(input_path): return web.Response(status=404, text="File not found")
        
    temp_dir = os.path.join(dir_path, "_data", "_temp", "thumbs")
    os.makedirs(temp_dir, exist_ok=True)
    safe_name = os.path.splitext(filename)[0]
    out_path = os.path.join(temp_dir, f"{safe_name}_{frames_count}_{sample_mode}.{asset_type}")
    
    async with thumb_semaphore:
        if os.path.isfile(out_path): return web.FileResponse(out_path)
        try:
            if asset_type == "jpg": await video_ops.generate_gallery_thumbnail(input_path, out_path)
            elif asset_type == "webp":
                duration = await video_ops.get_video_duration(input_path)
                await video_ops.generate_gallery_webp(input_path, out_path, duration, frames_count, anim_threshold, sample_mode)
            else: return web.Response(status=400, text="Invalid asset type")
            return web.FileResponse(out_path)
        except Exception as e: return web.Response(status=500, text=str(e))

@PromptServer.instance.routes.get("/video_clipper/clip_thumb")
async def get_clip_thumb(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    time_str = request.query.get("time", "0")
    use_proxy = request.query.get("proxy", "false").lower() == "true"
    
    try: timestamp = float(time_str)
    except ValueError: timestamp = 0.0

    if not dir_path or not filename: return web.Response(status=400, text="Missing params")
        
    temp_dir = os.path.join(dir_path, "_data", "_temp", "clip_thumbs")
    os.makedirs(temp_dir, exist_ok=True)
    safe_name = os.path.splitext(filename)[0]
    safe_time = str(timestamp).replace(".", "_")
    out_path = os.path.join(temp_dir, f"{safe_name}_t{safe_time}.jpg")

    async with thumb_semaphore:
        if os.path.isfile(out_path): return web.FileResponse(out_path)
        if use_proxy:
            proxy_path = os.path.join(dir_path, "_data", "_temp", f"{safe_name}_proxy.mp4")
            input_path = proxy_path if os.path.isfile(proxy_path) else os.path.join(dir_path, filename)
        else: input_path = os.path.join(dir_path, filename)
        if not os.path.isfile(input_path): return web.Response(status=404, text="Source file not found")
            
        try:
            await video_ops.generate_clip_thumbnail(input_path, out_path, timestamp)
            return web.FileResponse(out_path)
        except Exception as e: return web.Response(status=500, text=str(e))

@PromptServer.instance.routes.get("/video_clipper/file_info")
async def get_file_info(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    if not dir_path: dir_path = folder_paths.get_input_directory()
    file_path = os.path.join(dir_path, filename)
    proxy_path = os.path.join(dir_path, "_data", "_temp", f"{os.path.splitext(filename)[0]}_proxy.mp4")
    
    if not os.path.isfile(file_path):
        return web.json_response({"exists": False, "size": 0, "sizeMb": 0, "hasProxy": False, "isHeavy": False, "needsProxyFormat": False, "needsFpsProxy": False, "width": 0, "height": 0, "codec": "", "fps": 24.0})
        
    size_bytes = os.path.getsize(file_path)
    has_proxy = os.path.isfile(proxy_path)
    width, height = await video_ops.get_video_dimensions(file_path)
    src_fps = await video_ops.get_video_fps(file_path)
    
    codec = ""
    ffprobe_err = ""
    try:
        cmd = ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=codec_name", "-of", "json", file_path]
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await proc.communicate()
        if stderr: ffprobe_err = stderr.decode("utf-8", errors="ignore").strip()
        if stdout:
            meta = json.loads(stdout.decode("utf-8", errors="ignore"))
            for stream in meta.get("streams", []):
                cname = stream.get("codec_name", "").strip().lower()
                if cname and cname not in ["mjpeg", "png", "bmp"]:
                    codec = cname
                    break
            if not codec and meta.get("streams"):
                codec = meta["streams"][0].get("codec_name", "").strip().lower()
    except Exception as e: ffprobe_err = str(e)
        
    size_mb = round(size_bytes / (1024 * 1024), 1)
    is_heavy = size_mb > 250
    safe_codecs = ["h264", "hevc", "h265", "hvc1", "hev1", "vp8", "vp9", "av1", ""]
    
    is_near_24 = abs(src_fps - 24.0) < 0.05 or abs(src_fps - 23.976) < 0.05 or abs(src_fps - 25.0) < 0.05
    needs_fps_proxy = not is_near_24
    
    needs_proxy_format = (codec not in safe_codecs) or needs_fps_proxy
    
    if needs_proxy_format and ffprobe_err: codec = f"{codec} | FFPROBE ERROR: {ffprobe_err}"
    
    return web.json_response({
        "exists": True, "size": size_bytes, "sizeMb": size_mb, "hasProxy": has_proxy,
        "isHeavy": is_heavy, "needsProxyFormat": needs_proxy_format, "needsFpsProxy": needs_fps_proxy,
        "width": width, "height": height, "codec": codec, "fps": src_fps
    })

@PromptServer.instance.routes.get("/video_clipper/serve_video")
async def serve_video(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    is_proxy = request.query.get("proxy", "false").lower() == "true"
    
    if not dir_path: dir_path = folder_paths.get_input_directory()
    if is_proxy: file_path = os.path.join(dir_path, "_data", "_temp", f"{os.path.splitext(filename)[0]}_proxy.mp4")
    else: file_path = os.path.join(dir_path, filename)
    
    if not os.path.isfile(file_path): return web.Response(status=404, text="Video not found")
        
    ext = os.path.splitext(file_path)[1].lower()
    mime_type = "video/mp4"
    if ext == ".webm": mime_type = "video/webm"
    elif ext in [".ogg", ".ogv"]: mime_type = "video/ogg"
        
    response = web.FileResponse(file_path)
    response.headers["Content-Type"] = mime_type
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.enable_compression()
    response.headers["Accept-Ranges"] = "bytes"
    return response

@PromptServer.instance.routes.get("/video_clipper/check_proxy")
async def check_proxy(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    if not dir_path: dir_path = folder_paths.get_input_directory()
    proxy_path = os.path.join(dir_path, "_data", "_temp", f"{os.path.splitext(filename)[0]}_proxy.mp4")
    return web.json_response({"exists": os.path.isfile(proxy_path)})

@PromptServer.instance.routes.post("/video_clipper/create_proxy")
async def create_proxy(request):
    data = await request.json()
    task_id = request.headers.get("X-Task-ID", str(uuid.uuid4()))
    
    dir_path = data.get("directory", "").strip()
    filename = data.get("filename", "").strip()
    skip_existing = data.get("skip_existing", False)
    hw_encoder = data.get("hw_encoder", "libx264")
    
    if not dir_path: dir_path = folder_paths.get_input_directory()
    input_path = os.path.join(dir_path, filename)
    if not os.path.isfile(input_path): return web.json_response({"status": "error", "message": "Source file not found"})
        
    temp_dir = os.path.join(dir_path, "_data", "_temp")
    os.makedirs(temp_dir, exist_ok=True)
    proxy_path = os.path.join(temp_dir, f"{os.path.splitext(filename)[0]}_proxy.mp4")
    if skip_existing and os.path.isfile(proxy_path): return web.json_response({"status": "skipped", "message": "Proxy already exists"})
    
    task = asyncio.create_task(video_ops.generate_proxy(input_path, proxy_path, hw_encoder))
    active_ffmpeg_tasks[task_id] = task
    
    try:
        await task
        return web.json_response({"status": "success"})
    except asyncio.CancelledError:
        return web.json_response({"status": "cancelled", "message": "Proxy generation was cancelled by user."})
    except Exception as e: 
        return web.json_response({"status": "error", "message": str(e)})
    finally:
        active_ffmpeg_tasks.pop(task_id, None)

@PromptServer.instance.routes.get("/video_clipper/audio_peaks")
async def get_audio_peaks(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    points = int(request.query.get("points", 1000))
    use_proxy = request.query.get("proxy", "false").lower() == "true"
    
    if not dir_path: dir_path = folder_paths.get_input_directory()
    if use_proxy: input_path = os.path.join(dir_path, "_data", "_temp", f"{os.path.splitext(filename)[0]}_proxy.mp4")
    else: input_path = os.path.join(dir_path, filename)
        
    if not os.path.isfile(input_path): return web.json_response({"peaks": []})
    try:
        peaks = await video_ops.extract_audio_peaks(input_path, points)
        return web.json_response({"peaks": peaks})
    except Exception: return web.json_response({"peaks": []})

@PromptServer.instance.routes.post("/video_clipper/save_state")
async def save_state(request):
    data = await request.json()
    dir_path = data.get("directory", "").strip()
    filename = data.get("filename", "").strip()
    clips = data.get("clips", [])
    selected_idx = data.get("selectedClipIndex", -1)
    selected_indices = data.get("selectedClipIndices", [])
    
    if not dir_path: dir_path = folder_paths.get_input_directory()
    edit_files_dir = os.path.join(dir_path, "_data", "editFiles")
    os.makedirs(edit_files_dir, exist_ok=True)
    state_file = os.path.join(edit_files_dir, f"{filename}.json")
    
    try:
        if clips and len(clips) > 0:
            indices_str = json.dumps(selected_indices)
            clip_lines = ",\n    ".join(json.dumps(c) for c in clips)
            content = "{\n  \"selectedClipIndex\": " + str(selected_idx) + ",\n  \"selectedClipIndices\": " + indices_str + ",\n  \"clips\": [\n    " + clip_lines + "\n  ]\n}\n"
            with open(state_file, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            if os.path.isfile(state_file): os.remove(state_file)
        return web.json_response({"status": "success"})
    except Exception as e: return web.json_response({"status": "error", "message": str(e)})

@PromptServer.instance.routes.get("/video_clipper/load_state")
async def load_state(request):
    dir_path = request.query.get("dir", "").strip()
    filename = request.query.get("filename", "").strip()
    
    if not dir_path: dir_path = folder_paths.get_input_directory()
    state_file = os.path.join(dir_path, "_data", "editFiles", f"{filename}.json")
    if os.path.isfile(state_file):
        try:
            with open(state_file, "r", encoding="utf-8") as f: data = json.load(f)
            return web.json_response({
                "status": "success", "clips": data.get("clips", []),
                "selectedClipIndex": data.get("selectedClipIndex", -1),
                "selectedClipIndices": data.get("selectedClipIndices", [])
            })
        except Exception: pass
    return web.json_response({"status": "error", "clips": [], "selectedClipIndex": -1, "selectedClipIndices": []})

@PromptServer.instance.routes.post("/video_clipper/export")
async def export_clips(request):
    data = await request.json()
    task_id = request.headers.get("X-Task-ID", str(uuid.uuid4()))
    
    dir_path = data.get("directory", "").strip()
    filename = data.get("filename", "").strip()
    use_custom_name = data.get("use_custom_name", False)
    custom_name = data.get("custom_name", "").strip()
    save_by_size = data.get("save_by_size", False)
    force_24fps = data.get("force_24fps", True)
    clips = data.get("clips", [])
    export_encoder = data.get("encoder", "h264")
    export_crf = data.get("crf", 17)
    
    training_resize_enabled = data.get("training_resize_enabled", False)
    training_buckets_str = data.get("training_buckets", "")
    
    if not dir_path: dir_path = folder_paths.get_input_directory()
    if not filename or not clips: return web.json_response({"status": "error", "message": "Missing parameters"})
    input_path = os.path.join(dir_path, filename)
    if not os.path.isfile(input_path): return web.json_response({"status": "error", "message": "Input file not found"})
        
    base_clips_dir = os.path.join(dir_path, "_clips")
    os.makedirs(base_clips_dir, exist_ok=True)
    base_name = os.path.splitext(filename)[0]
    src_fps = await video_ops.get_video_fps(input_path) if force_24fps else 24.0
    
    async def export_loop():
        for idx, clip in enumerate(clips):
            clip_id = clip.get("id", f"Clip{idx+1}")
            start_time = str(clip.get("startTime", 0))
            end_time = str(clip.get("endTime", 0))
            start_frame = clip.get("startFrame", 0)
            end_frame = clip.get("endFrame", 0)
            keyframes = clip.get("keyframes", [])
            interp_mode = clip.get("interpMode", "linear")

            target_w, target_h = clip.get("target_width", 1280), clip.get("target_height", 736)
            crop_mode = clip.get("crop_mode", True)
            actual_export_w, actual_export_h = clip.get("actual_export_w", target_w), clip.get("actual_export_h", target_h)
            offset_x, offset_y, rotation = clip.get("offset_x", 0.5), clip.get("offset_y", 0.5), clip.get("rotation", 0)
            include_video, include_audio = clip.get("include_video", True), clip.get("include_audio", True)

            await video_ops.export_clip(
                input_path, base_clips_dir, base_name, clip_id, start_time, end_time, src_fps,
                target_w, target_h, crop_mode, actual_export_w, actual_export_h,
                offset_x, offset_y, rotation, include_video, include_audio, 
                force_24fps, export_encoder, export_crf,
                keyframes=keyframes, interp_mode=interp_mode,
                start_frame=start_frame, end_frame=end_frame,
                use_custom_name=use_custom_name, custom_name=custom_name,
                save_by_size=save_by_size,
                training_resize_enabled=training_resize_enabled,
                training_buckets_str=training_buckets_str
            )
            
    task = asyncio.create_task(export_loop())
    active_ffmpeg_tasks[task_id] = task

    try:
        await task
        return web.json_response({"status": "success", "message": f"Exported {len(clips)} clips"})
    except asyncio.CancelledError:
        return web.json_response({"status": "cancelled", "message": "Export cancelled by user."})
    except Exception as e:
        print(f"Video Clipper Export Error: {str(e)}")
        return web.json_response({"status": "error", "message": str(e)})
    finally:
        active_ffmpeg_tasks.pop(task_id, None)
