import os
import json
import uuid
import subprocess
import asyncio
import folder_paths
from server import PromptServer
from aiohttp import web

# ======================================================================
# CORE RENDER ENGINE
# ======================================================================

def has_audio(file_path):
    try:
        cmd = ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file_path]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return "audio" in res.stdout.lower()
    except Exception:
        return False

def is_image(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ['.png', '.jpg', '.jpeg', '.webp', '.bmp']


def perform_ffmpeg_render(state):
    clips = state.get("clips", [])
    if not clips:
        raise ValueError("Timeline is empty. No video generated.")

    target_fps = int(state.get("fps", 30))
    res_w, res_h = state.get("resolution", [1920, 1080])
    
    is_preview = state.get("isPreview", False)

    comp_name = state.get("projectName", f"HT_Render_{uuid.uuid4().hex[:8]}")
    comp_name = "".join(c for c in comp_name if c.isalnum() or c in (" ", "_", "-")).strip()
    if not comp_name:
        comp_name = "Untitled_Composition"

    save_path = state.get("savePath", "").strip()
    output_dir = folder_paths.get_output_directory()
    
    if is_preview:
        output_dir = os.path.join(output_dir, "temp_previews")
        os.makedirs(output_dir, exist_ok=True)
        comp_name = f"preview_{uuid.uuid4().hex[:6]}"
    elif save_path:
        try:
            os.makedirs(save_path, exist_ok=True)
            output_dir = save_path
        except Exception:
            print(f"[HandyTools] Warning: Could not access custom save path '{save_path}'. Using default output.")

    output_filename = f"{comp_name}.mp4"
    output_path = os.path.join(output_dir, output_filename)
    input_dir = folder_paths.get_input_directory()
    
    total_duration = max([float(c.get("timeline_end", 0)) for c in clips]) if clips else 1.0

    ffmpeg_cmd = ["ffmpeg", "-y"]
    
    for clip in clips:
        input_file = clip["filename"]
        out_time = float(clip.get("source_out", 5.0))
        if not os.path.isabs(input_file):
            input_file = os.path.join(input_dir, input_file)
            
        if is_image(input_file):
            input_duration = max(total_duration, out_time)
            ffmpeg_cmd.extend(["-loop", "1", "-t", str(input_duration), "-i", input_file])
        else:
            ffmpeg_cmd.extend(["-i", input_file])
            
    filter_complex = []
    
    filter_complex.append(f"color=c=black:s={res_w}x{res_h}:d={total_duration}:r={target_fps},format=rgba[bg_v0]")
    
    if not is_preview:
        filter_complex.append(f"anullsrc=r=48000:cl=stereo:d={total_duration}[bg_a0]")
    
    v_idx = 0
    audio_mix_labels = ["[bg_a0]"] if not is_preview else []
    
    for i, clip in enumerate(clips):
        input_file = clip["filename"]
        if not os.path.isabs(input_file):
            input_file = os.path.join(input_dir, input_file)
            
        track = int(clip.get("track", 0))
        muted = clip.get("muted", False)
        
        c_vol = float(clip.get("volume", 1.0))
        
        in_time = float(clip.get("source_in", 0.0))
        out_time = float(clip.get("source_out", 5.0))
        t_start = float(clip.get("timeline_start", 0.0))
        t_end = float(clip.get("timeline_end", 5.0))
            
        crop = clip.get("crop", {})
        crop_w = int(crop.get("w", res_w))
        crop_h = int(crop.get("h", res_h))
        scale = float(crop.get("scale", 1.0))
        offset_x = int(crop.get("x", 0))
        offset_y = int(crop.get("y", 0))
        
        target_w = max(2, int(crop_w * scale))
        target_h = max(2, int(crop_h * scale))

        color_data = clip.get("color", {})
        c_enabled = color_data.get("enabled", True)
        
        if c_enabled:
            c_op = float(color_data.get("opacity", 1.0))
            c_con = float(color_data.get("contrast", 1.0))
            c_sat = float(color_data.get("saturation", 1.0))
            c_bri = float(color_data.get("brightness", 1.0))
            tint = color_data.get("tint", {"r": 1.0, "g": 1.0, "b": 1.0})
            sh = color_data.get("shadows", {"r": 1.0, "g": 1.0, "b": 1.0})
            md = color_data.get("midtones", {"r": 1.0, "g": 1.0, "b": 1.0})
            hi = color_data.get("highlights", {"r": 1.0, "g": 1.0, "b": 1.0})
        else:
            c_op = 1.0; c_con = 1.0; c_sat = 1.0; c_bri = 1.0
            tint = {"r": 1.0, "g": 1.0, "b": 1.0}
            sh = {"r": 1.0, "g": 1.0, "b": 1.0}
            md = {"r": 1.0, "g": 1.0, "b": 1.0}
            hi = {"r": 1.0, "g": 1.0, "b": 1.0}
            
        fx_chain = ""
        effects_data = clip.get("effects", {})
        
        if effects_data.get("enabled", True):
            for fx in effects_data.get("stack", []):
                t = fx.get("type")
                if t == "blur":
                    r = float(fx.get("radius", 0)) / 2.0
                    if r > 0: fx_chain += f",gblur=sigma={r}"
                elif t == "sharpen":
                    intensity = float(fx.get("intensity", 0))
                    if intensity > 0: fx_chain += f",unsharp=5:5:{intensity}"
                elif t == "vignette":
                    a = float(fx.get("amount", 0))
                    c = float(fx.get("curve", 3.0))
                    if a > 0:
                        eq_str = f"1-min(pow(hypot(X/W-0.5,Y/H-0.5)*1.414213,{c})*{a},1.0)"
                        fx_chain += f",geq=r='r(X,Y)*({eq_str})':g='g(X,Y)*({eq_str})':b='b(X,Y)*({eq_str})'"
                elif t == "grain":
                    s = float(fx.get("strength", 0)) * 100
                    if s > 0: fx_chain += f",noise=alls={int(s)}:allf=t+u"
                elif t == "denoise":
                    s = float(fx.get("strength", 0))
                    if s > 0: fx_chain += f",hqdn3d={s}:{s*0.75}:4:4"
        
        if track == 0:
            rs = sh["r"] - 1.0; gs = sh["g"] - 1.0; bs = sh["b"] - 1.0
            rm = md["r"] - 1.0; gm = md["g"] - 1.0; bm = md["b"] - 1.0
            rh = hi["r"] - 1.0; gh = hi["g"] - 1.0; bh = hi["b"] - 1.0
            
            v_prep_filter = (
                f"[{i}:v]"
                f"trim=start={in_time}:end={out_time},"
                f"setpts=PTS-STARTPTS+({t_start}/TB),"
                f"scale=w={target_w}:h={target_h},"
                f"pad=w='ceil(iw/2)*2':h='ceil(ih/2)*2',"
                f"eq=contrast={c_con}:saturation={c_sat}:brightness={c_bri - 1.0},"
                f"colorchannelmixer=rr={tint['r']}:gg={tint['g']}:bb={tint['b']},"
                f"colorbalance=rs={rs}:gs={gs}:bs={bs}:rm={rm}:gm={gm}:bm={bm}:rh={rh}:gh={gh}:bh={bh}"
                f"{fx_chain}," 
                f"format=rgba,colorchannelmixer=aa={c_op},"
                f"setsar=1,fps={target_fps}"
                f"[v_prep_{i}]"
            )
            filter_complex.append(v_prep_filter)
            
            x_pos = f"(W-w)/2+({offset_x})"
            y_pos = f"(H-h)/2+({offset_y})"
            
            overlay_filter = (
                f"[bg_v{v_idx}][v_prep_{i}]"
                f"overlay=x='{x_pos}':y='{y_pos}':enable='between(t,{t_start},{t_end})'"
                f"[bg_v{v_idx+1}]"
            )
            filter_complex.append(overlay_filter)
            v_idx += 1

        if (track == 1) or (track == 0 and not muted):
            if not is_preview and has_audio(input_file):
                delay_ms = int(t_start * 1000)
                a_prep_filter = (
                    f"[{i}:a]"
                    f"atrim=start={in_time}:end={out_time},"
                    f"asetpts=PTS-STARTPTS,"
                    f"aformat=sample_rates=48000:channel_layouts=stereo,"
                    f"volume={c_vol},"
                    f"adelay={delay_ms}|{delay_ms}" 
                    f"[a_prep_{i}]"
                )
                filter_complex.append(a_prep_filter)
                audio_mix_labels.append(f"[a_prep_{i}]")

    # --- NEW: Master Global Watermark Pass ---
    watermark = state.get("watermark", {})
    if watermark.get("enabled", False) and watermark.get("path"):
        wm_p = str(watermark.get("path")).strip().replace("\\", "/").replace("'", "\\'")
        if not os.path.isabs(wm_p):
            wm_p = f"{input_dir}/{wm_p}"
        
        scale = float(watermark.get("scale", 1.0))
        x_off = float(watermark.get("x", 20.0))
        y_off = float(watermark.get("y", 20.0))
        
        filter_complex.append(f"movie=filename='{wm_p}'[global_wm_raw]")
        filter_complex.append(f"[global_wm_raw]scale=iw*{scale}:-1[global_wm_s]")
        filter_complex.append(f"[bg_v{v_idx}][global_wm_s]overlay=x='W-w-{x_off}':y='H-h-{y_off}'[bg_v{v_idx+1}]")
        v_idx += 1

    if not is_preview:
        if len(audio_mix_labels) > 1:
            amix_str = "".join(audio_mix_labels)
            filter_complex.append(f"{amix_str}amix=inputs={len(audio_mix_labels)}:duration=first:dropout_transition=0[out_a]")
        else:
            filter_complex.append("[bg_a0]acopy[out_a]")
        
    final_video_label = f"[bg_v{v_idx}]"

    full_filter_string = ";".join(filter_complex)
    
    cmd_args = [
        "-filter_complex", full_filter_string,
        "-map", final_video_label,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p", 
        "-colorspace", "bt709",
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-crf", "18", 
        "-preset", "fast"
    ]
    
    if is_preview:
        cmd_args.append("-an")
    else:
        cmd_args.extend([
            "-map", "[out_a]",
            "-c:a", "aac",
            "-b:a", "192k"
        ])
        
    cmd_args.append(output_path)
    ffmpeg_cmd.extend(cmd_args)

    print(f"[HandyTools] Rendering '{comp_name}' ({len(clips)} clips)...")
    
    try:
        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"[HandyTools] Render saved to: {output_path}")
        return output_path
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.decode("utf-8")
        print("[HandyTools] FFmpeg Render Failed!")
        print(err_msg)
        short_err = "\n".join(err_msg.strip().split("\n")[-10:])
        raise RuntimeError(f"FFmpeg Error:\n{short_err}")


# ======================================================================
# CUSTOM API ROUTES & PRESET MANAGEMENT
# ======================================================================

NODE_DIR = os.path.dirname(os.path.realpath(__file__))
WEB_DIR = os.path.join(NODE_DIR, "web")
PRESETS_FILE = os.path.join(WEB_DIR, "videoEditor_presets.json")

DEFAULT_PRESETS = {
    "Film Look": { "opacity": 1.0, "contrast": 1.1, "saturation": 0.9, "brightness": 1.0, "tint": {"r":1.0,"g":1.0,"b":1.0}, "shadows": {"r":0.95,"g":0.98,"b":1.05}, "midtones": {"r":1.0,"g":1.0,"b":1.0}, "highlights": {"r":1.05,"g":1.0,"b":0.95} },
    "Vibrant": { "opacity": 1.0, "contrast": 1.2, "saturation": 1.4, "brightness": 1.05, "tint": {"r":1.0,"g":1.0,"b":1.0}, "shadows": {"r":1.0,"g":1.0,"b":1.0}, "midtones": {"r":1.0,"g":1.0,"b":1.0}, "highlights": {"r":1.0,"g":1.0,"b":1.0} },
    "Vintage": { "opacity": 1.0, "contrast": 0.85, "saturation": 0.65, "brightness": 1.1, "tint": {"r":1.1,"g":1.05,"b":0.9}, "shadows": {"r":1.1,"g":1.0,"b":0.9}, "midtones": {"r":1.0,"g":1.0,"b":1.0}, "highlights": {"r":1.0,"g":0.95,"b":0.9} },
    "Teal & Orange": { "opacity": 1.0, "contrast": 1.15, "saturation": 1.1, "brightness": 1.0, "tint": {"r":1.0,"g":1.0,"b":1.0}, "shadows": {"r":0.9,"g":1.0,"b":1.15}, "midtones": {"r":1.05,"g":1.0,"b":0.95}, "highlights": {"r":1.15,"g":1.05,"b":0.9} },
    "B&W High Contrast": { "opacity": 1.0, "contrast": 1.4, "saturation": 0.0, "brightness": 1.0, "tint": {"r":1.0,"g":1.0,"b":1.0}, "shadows": {"r":1.0,"g":1.0,"b":1.0}, "midtones": {"r":1.0,"g":1.0,"b":1.0}, "highlights": {"r":1.0,"g":1.0,"b":1.0} },
    "Cool Muted": { "opacity": 1.0, "contrast": 0.95, "saturation": 0.75, "brightness": 1.0, "tint": {"r":0.9,"g":0.95,"b":1.1}, "shadows": {"r":0.95,"g":0.95,"b":1.05}, "midtones": {"r":0.95,"g":0.95,"b":1.05}, "highlights": {"r":0.95,"g":1.0,"b":1.05} }
}

@PromptServer.instance.routes.get("/handytools/get_presets")
async def get_presets_api(request):
    try:
        if not os.path.exists(WEB_DIR):
            os.makedirs(WEB_DIR, exist_ok=True)
        if not os.path.exists(PRESETS_FILE):
            with open(PRESETS_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_PRESETS, f, indent=4)
            return web.json_response(DEFAULT_PRESETS)
            
        with open(PRESETS_FILE, "r", encoding="utf-8") as f:
            presets = json.load(f)
        return web.json_response(presets)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@PromptServer.instance.routes.post("/handytools/save_presets")
async def save_presets_api(request):
    try:
        presets = await request.json()
        if not os.path.exists(WEB_DIR):
            os.makedirs(WEB_DIR, exist_ok=True)
        with open(PRESETS_FILE, "w", encoding="utf-8") as f:
            json.dump(presets, f, indent=4)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@PromptServer.instance.routes.get("/handytools/media")
async def serve_handytools_media(request):
    file_path = request.query.get("path")
    if not file_path: return web.Response(status=404)
    if not os.path.isabs(file_path):
        file_path = os.path.join(folder_paths.get_input_directory(), file_path)
    if not os.path.exists(file_path):
        return web.Response(status=404)
    return web.FileResponse(file_path)


@PromptServer.instance.routes.post("/handytools/list_folder")
async def list_folder_api(request):
    data = await request.json()
    folder_path = data.get("path", "").strip()
    if not folder_path or not os.path.isdir(folder_path):
        return web.json_response({"status": "error", "message": "Invalid directory path"})
    
    valid_exts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.mp3', '.wav', '.ogg', '.m4a', '.flac']
    files = []
    try:
        for f in os.listdir(folder_path):
            abs_path = os.path.join(folder_path, f)
            if os.path.isfile(abs_path) and os.path.splitext(f)[1].lower() in valid_exts:
                files.append(abs_path)
        return web.json_response({"status": "success", "files": files})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})


@PromptServer.instance.routes.post("/handytools/upload_media")
async def upload_media(request):
    post = await request.post()
    file_data = post.get("file")
    if file_data and file_data.file:
        filename = file_data.filename
        input_dir = folder_paths.get_input_directory()
        raw_bytes = file_data.file.read()
        uploaded_size = len(raw_bytes)
        target_path = os.path.join(input_dir, filename)
        
        if os.path.exists(target_path):
            if os.path.getsize(target_path) == uploaded_size:
                return web.json_response({"status": "success", "filename": filename})
            else:
                name, ext = os.path.splitext(filename)
                filename = f"{name}_{uuid.uuid4().hex[:8]}{ext}"
                target_path = os.path.join(input_dir, filename)
        
        with open(target_path, "wb") as f:
            f.write(raw_bytes)
        return web.json_response({"status": "success", "filename": filename})
    return web.json_response({"status": "error", "message": "No file provided"}, status=400)


@PromptServer.instance.routes.post("/handytools/render_composition")
async def render_composition_api(request):
    try:
        state = await request.json()
        loop = asyncio.get_event_loop()
        output_path = await loop.run_in_executor(None, perform_ffmpeg_render, state)
        return web.json_response({"status": "success", "path": output_path})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@PromptServer.instance.routes.post("/handytools/save_project")
async def save_project_api(request):
    try:
        state = await request.json()
        comp_name = state.get("projectName", f"HT_Project_{uuid.uuid4().hex[:8]}")
        comp_name = "".join(c for c in comp_name if c.isalnum() or c in (" ", "_", "-")).strip()
        if not comp_name: comp_name = "Untitled_Composition"
            
        save_path = state.get("savePath", "").strip()
        output_dir = folder_paths.get_output_directory()
        if save_path:
            try:
                os.makedirs(save_path, exist_ok=True)
                output_dir = save_path
            except Exception: pass
                
        output_filename = f"{comp_name}.json"
        output_path = os.path.join(output_dir, output_filename)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=4)
        return web.json_response({"status": "success", "path": output_path})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# ======================================================================
# THE NODE CLASS
# ======================================================================

class HandyToolVideoTimeline:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "timeline_data": ("STRING", {"multiline": True, "default": "{}"}),
            }
        }

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    OUTPUT_NODE = True 

    FUNCTION = "process"
    CATEGORY = "HandyTools"

    def process(self, timeline_data):
        return ()

NODE_CLASS_MAPPINGS = { "HandyToolVideoTimeline": HandyToolVideoTimeline }
NODE_DISPLAY_NAME_MAPPINGS = { "HandyToolVideoTimeline": "HandyTool Video Editor" }