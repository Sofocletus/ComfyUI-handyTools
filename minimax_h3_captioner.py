import folder_paths
import os
import json
from server import PromptServer
from aiohttp import web

# --- Global UI State paths ---
WEB_DIR = os.path.join(os.path.dirname(__file__), "web", "minimaxCaptioner")
UI_STATE_FILE = os.path.join(WEB_DIR, "ui_state.json")

# --- Route to save global UI state (ui_state.json) ---
@PromptServer.instance.routes.post("/handyTools/save_ui_state")
async def save_ui_state(request):
    try:
        data = await request.json()
        os.makedirs(WEB_DIR, exist_ok=True)
        with open(UI_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        return web.json_response({"status": "success"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

# --- Route to load global UI state (ui_state.json) ---
@PromptServer.instance.routes.get("/handyTools/load_ui_state")
async def load_ui_state(request):
    try:
        if os.path.exists(UI_STATE_FILE):
            with open(UI_STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return web.json_response({"status": "success", "data": data})
        else:
            return web.json_response({"status": "empty", "data": {}})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

# --- Route to serve video to the HTML player ---
@PromptServer.instance.routes.get("/handyTools/serve_video")
async def serve_video(request):
    video_path = request.query.get("path", "")
    
    if not os.path.isabs(video_path):
        video_path = os.path.join(folder_paths.get_input_directory(), video_path)
        
    if os.path.exists(video_path):
        return web.FileResponse(video_path)
    return web.Response(status=404, text="Video not found")

# --- Route to scan a directory for videos ---
@PromptServer.instance.routes.get("/handyTools/video_list")
async def video_list(request):
    dir_path = request.query.get("dir", "")
    
    if not os.path.isabs(dir_path):
        dir_path = os.path.join(folder_paths.get_input_directory(), dir_path)
        
    if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
        return web.json_response({"videos": []})
        
    valid_extensions = ('.mp4', '.webm', '.mov', '.mkv', '.avi')
    videos = []
    
    for f in sorted(os.listdir(dir_path)):
        # Ignore subdirectories like _captionerFiles when scanning for videos
        if f.lower().endswith(valid_extensions):
            videos.append(f)
            
    return web.json_response({"videos": videos})

# --- Route to load saved caption state (.json) from _captionerFiles subfolder ---
@PromptServer.instance.routes.get("/handyTools/load_caption_state")
async def load_caption_state(request):
    try:
        dir_path = request.query.get("dir", "")
        filename = request.query.get("filename", "")
        
        if not filename:
            return web.json_response({"status": "error", "message": "No filename provided."})
            
        if not os.path.isabs(dir_path):
            dir_path = os.path.join(folder_paths.get_input_directory(), dir_path)
            
        # Point to the subfolder for states
        state_dir = os.path.join(dir_path, "_captionerFiles")
        json_path = os.path.join(state_dir, os.path.splitext(filename)[0] + ".json")
        
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return web.json_response({"status": "success", "data": data})
            
        return web.json_response({"status": "not_found"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

# --- Route to save .txt in root and state .json in _captionerFiles subfolder ---
@PromptServer.instance.routes.post("/handyTools/save_caption")
async def save_caption(request):
    try:
        post_data = await request.read()
        data = json.loads(post_data.decode("utf-8"))
        
        dir_path = data.get("dir_path", "")
        filename = data.get("filename", "")
        text = data.get("text", "")
        state_payload = data.get("state", {})
        
        if not filename:
            return web.json_response({"status": "error", "message": "No filename provided."})
            
        if not os.path.isabs(dir_path):
            dir_path = os.path.join(folder_paths.get_input_directory(), dir_path)
            
        base_name = os.path.splitext(filename)[0]
        
        # 1. Save Minimax .txt file directly in the main folder (alongside video)
        txt_path = os.path.join(dir_path, base_name + ".txt")
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)
            
        # 2. Ensure the _captionerFiles subfolder exists
        state_dir = os.path.join(dir_path, "_captionerFiles")
        os.makedirs(state_dir, exist_ok=True)
        
        # 3. Save workstation state .json file inside the subfolder
        json_path = os.path.join(state_dir, base_name + ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(state_payload, f, indent=2)
            
        return web.json_response({"status": "success", "message": f"Saved files successfully."})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)})

# --- The Node Definition ---
class MinimaxH3Captioner:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {}
        }

    RETURN_TYPES = ()
    FUNCTION = "process"
    CATEGORY = "HandyTools"
    OUTPUT_NODE = True 

    def process(self):
        return ()

NODE_CLASS_MAPPINGS = {
    "MinimaxH3Captioner": MinimaxH3Captioner
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MinimaxH3Captioner": "Minimax H3 Captioner"
}