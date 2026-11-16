import os
import json
import shutil
import re
import copy
import aiohttp
from aiohttp import web
from server import PromptServer
from PIL import Image

server = PromptServer.instance

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
PRESETS_PATH = os.path.join(NODE_DIR, "web", "imageCaptioner", "exportPresets.json")
IMAGE_SIZES_PATH = os.path.join(NODE_DIR, "web", "imageCaptioner", "imageSizes.json")
STATE_PATH = os.path.join(NODE_DIR, "web", "imageCaptioner", "ui_state.json")

DEFAULT_PRESETS = {
    "SDXL": { "name": "SDXL", "sizes": "1024\n1152x896\n896x1152\n1216x832\n832x1216\n1344x768\n768x1344\n1536x640\n640x1536" },
    "Krea2": { "name": "Krea2", "sizes": "1024\n1280x768\n768x1280\n1536x512\n512x1536" },
    "Z-Image": { "name": "Z-Image", "sizes": "1024\n1280x720\n720x1280\n1536x1024\n1024x1536\n2048x1024\n1024x2048" },
    "Minimax H3": { "name": "Minimax H3", "sizes": "1024\n1024x768\n768x1024\n1280x1280\n1536x1024\n1024x1536" }
}

DEFAULT_VLM_TEMPLATE = {
  "5": {
    "inputs": {
      "prompt": ["15", 1],
      "max_length": 512,
      "sampling_mode": "on",
      "sampling_mode.temperature": 0.7,
      "sampling_mode.top_k": 64,
      "sampling_mode.top_p": 0.95,
      "sampling_mode.min_p": 0.05,
      "sampling_mode.repetition_penalty": 1.05,
      "sampling_mode.seed": 0,
      "sampling_mode.presence_penalty": 0,
      "thinking": True,
      "use_default_template": True,
      "clip": ["20", 0],
      "image": ["18", 0]
    },
    "class_type": "TextGenerate"
  },
  "15": {
    "inputs": {
      "media_type": "Image",
      "preset": "Character Dataset",
      "trigger_word": "",
      "style_focus": False,
      "manual_append": ""
    },
    "class_type": "HandyToolCaptionPrompts"
  },
  "17": {
    "inputs": {
      "folder": "",
      "filename": "",
      "caption_index": 1,
      "text": ["5", 0]
    },
    "class_type": "HandyToolSaveTextAPI"
  },
  "18": {
    "inputs": {
      "image_path": ""
    },
    "class_type": "HandyToolLoadImageAPI"
  },
  "20": {
    "inputs": {
      "clip_name": "qwen3-vl-8b-instruct-abliterated.safetensors",
      "type": "stable_diffusion",
      "device": "default"
    },
    "class_type": "CLIPLoader"
  }
}

# --- SHARED HELPERS ---
def get_json_path(folder_path):
    return os.path.join(folder_path, "_settings", "dataset.json")

def get_source_folder(folder_path, dataset_data):
    img_src = dataset_data.get("__settings__", {}).get("image_source", "_source")
    if os.path.isabs(img_src): return img_src
    return os.path.join(folder_path, img_src)

def get_backup_path(backup_dir, filename):
    bp = os.path.join(backup_dir, filename)
    if os.path.exists(bp): return bp
    name, _ = os.path.splitext(filename)
    for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
        bp2 = os.path.join(backup_dir, name + ext)
        if os.path.exists(bp2): return bp2
    return None

def update_global_tags(dataset_data):
    global_tags = {}
    for k, v in dataset_data.items():
        if k in ("__global_tags__", "__selections__", "__settings__"): continue
        if isinstance(v, dict) and "tags" in v:
            for tag in v["tags"]:
                global_tags[tag] = global_tags.get(tag, 0) + 1
    dataset_data["__global_tags__"] = global_tags


# --- ROUTES ---
@server.routes.post("/handytools/captioner/save_state")
async def save_state(request):
    data = await request.json()
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    return web.json_response({"success": True})

@server.routes.get("/handytools/captioner/load_state")
async def load_state(request):
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, 'r', encoding='utf-8') as f:
            return web.json_response(json.load(f))
    return web.json_response({})

@server.routes.post("/handytools/captioner/update_source")
async def update_source(request):
    data = await request.json()
    folder = data.get("folder")
    new_source = data.get("image_source", "_source")
    if not folder: return web.json_response({"error": "Missing parameters"}, status=400)
    json_path = get_json_path(folder)
    os.makedirs(os.path.dirname(json_path), exist_ok=True)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
    if "__settings__" not in dataset_data: dataset_data["__settings__"] = {}
    dataset_data["__settings__"]["image_source"] = new_source
    update_global_tags(dataset_data)
    with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    return web.json_response({"success": True})


@server.routes.post("/handytools/captioner/load_project")
async def load_project(request):
    data = await request.json()
    folder = data.get("folder", "")
    if not folder: return web.json_response({"error": "Empty folder path"}, status=400)
    if not os.path.exists(folder):
        try: os.makedirs(folder, exist_ok=True)
        except Exception as e: return web.json_response({"error": f"Failed to create project folder: {str(e)}"}, status=400)
    elif not os.path.isdir(folder): return web.json_response({"error": "Invalid project folder path"}, status=400)

    settings_dir = os.path.join(folder, "_settings")
    os.makedirs(settings_dir, exist_ok=True)
    json_path = get_json_path(folder)

    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try: dataset_data = json.load(f)
            except json.JSONDecodeError: dataset_data = {}

    if "__selections__" not in dataset_data: dataset_data["__selections__"] = {}
    if "__settings__" not in dataset_data: dataset_data["__settings__"] = {"image_source": "_source"}

    source_dir = get_source_folder(folder, dataset_data)
    os.makedirs(source_dir, exist_ok=True)
    backup_dir = os.path.join(source_dir, "_backup")
    os.makedirs(backup_dir, exist_ok=True)
    temp_dir = os.path.join(source_dir, "_temp")
    os.makedirs(temp_dir, exist_ok=True)

    valid_non_png = {".jpg", ".jpeg", ".webp", ".bmp"}
    changed_db = False
    
    for filename in os.listdir(source_dir):
        name, ext = os.path.splitext(filename)
        if ext.lower() in valid_non_png:
            old_path = os.path.join(source_dir, filename)
            new_filename = f"{name}.png"
            new_path = os.path.join(source_dir, new_filename)
            counter = 1
            while os.path.exists(new_path) and old_path != new_path:
                new_filename = f"{name}_{counter}.png"
                new_path = os.path.join(source_dir, new_filename)
                counter += 1
            try:
                with Image.open(old_path) as img:
                    if img.mode in ("P", "LA"): img = img.convert("RGBA")
                    elif img.mode not in ("RGB", "RGBA"): img = img.convert("RGB")
                    img.save(new_path, format="PNG")
                os.remove(old_path)
                
                if filename in dataset_data:
                    dataset_data[new_filename] = dataset_data.pop(filename)
                if "__selections__" in dataset_data:
                    for s_list in dataset_data["__selections__"].values():
                        if filename in s_list:
                            s_list.remove(filename)
                            if new_filename not in s_list: s_list.append(new_filename)
                changed_db = True
            except Exception as e:
                print(f"[HandyTools] Failed converting {filename} to PNG: {e}")
                
    if changed_db:
        update_global_tags(dataset_data)
        with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)

    valid_exts = {".png"}
    files = []
    physical_files = set()
    temp_captions = {} 
    
    for filename in os.listdir(source_dir):
        name, ext = os.path.splitext(filename)
        if ext.lower() in valid_exts:
            physical_files.add(filename)
            img_path = os.path.join(source_dir, filename)
            txt_path = os.path.join(source_dir, f"{name}.txt")
            temp_cap_path = os.path.join(temp_dir, f"{filename}_captions.json")
            
            caption_txt = ""
            if os.path.exists(txt_path):
                with open(txt_path, 'r', encoding='utf-8') as f: caption_txt = f.read().strip()
            if os.path.exists(temp_cap_path):
                try:
                    with open(temp_cap_path, 'r', encoding='utf-8') as f: temp_captions[filename] = json.load(f)
                except Exception: pass
            
            width, height = 0, 0
            mtime = os.path.getmtime(img_path)
            try:
                with Image.open(img_path) as img: width, height = img.size
            except Exception: pass 

            if filename not in dataset_data or isinstance(dataset_data.get(filename), str):
                dataset_data[filename] = {
                    "caption1": caption_txt, "caption2": "", "caption3": "", "caption4": "",
                    "tags": [], "flagged": False, "size": {"width": width, "height": height}
                }
            else:
                if "caption" in dataset_data[filename]: dataset_data[filename]["caption1"] = dataset_data[filename].pop("caption")
                for i in range(1, 5):
                    if f"caption{i}" not in dataset_data[filename]: dataset_data[filename][f"caption{i}"] = ""
                if "flagged" not in dataset_data[filename]: dataset_data[filename]["flagged"] = False
                if caption_txt and not dataset_data[filename]["caption1"]: dataset_data[filename]["caption1"] = caption_txt
                dataset_data[filename]["size"] = {"width": width, "height": height}
            
            files.append({
                "filename": filename, "mtime": mtime, "is_missing": False,
                "has_backup": get_backup_path(backup_dir, filename) is not None,
                "has_temp": os.path.exists(os.path.join(temp_dir, filename))
            })

    for k in list(dataset_data.keys()):
        if k not in ("__global_tags__", "__selections__", "__settings__") and k not in physical_files:
            files.append({"filename": k, "mtime": 0, "is_missing": True, "has_backup": False, "has_temp": False})

    update_global_tags(dataset_data)
    with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    files.sort(key=lambda x: x["filename"].lower())
    
    return web.json_response({
        "files": files, "dataset": dataset_data, 
        "source_folder": os.path.abspath(source_dir), "temp_captions": temp_captions
    })


@server.routes.post("/handytools/captioner/cleanup_orphans")
async def cleanup_orphans(request):
    data = await request.json()
    folder = data.get("folder")
    if not folder: return web.json_response({"error": "Missing parameters"}, status=400)
    json_path = get_json_path(folder)
    if not os.path.exists(json_path): return web.json_response({"success": True})
    with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
    source_dir = get_source_folder(folder, dataset_data)
    
    removed_count = 0
    keys_to_remove = [k for k in dataset_data.keys() if k not in ("__global_tags__", "__selections__", "__settings__") and not os.path.exists(os.path.join(source_dir, k))]
            
    for k in keys_to_remove:
        del dataset_data[k]
        removed_count += 1
        if "__selections__" in dataset_data:
            for s_list in dataset_data["__selections__"].values():
                if k in s_list: s_list.remove(k)
                    
    if removed_count > 0:
        update_global_tags(dataset_data)
        with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    return web.json_response({"success": True, "removed": removed_count})


# --- RESTORED DATASET ENDPOINTS ---

@server.routes.post("/handytools/captioner/update_selections")
async def update_selections(request):
    data = await request.json()
    folder = data.get("folder")
    selections = data.get("selections", {})
    if not folder: return web.json_response({"error": "Missing parameters"}, status=400)
        
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
        dataset_data["__selections__"] = selections
        with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    return web.json_response({"success": True})


@server.routes.post("/handytools/captioner/update_tags")
async def update_tags(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    tags = data.get("tags", [])
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)
        
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
        if filename in dataset_data and isinstance(dataset_data[filename], dict):
            dataset_data[filename]["tags"] = tags
            update_global_tags(dataset_data)
            with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    return web.json_response({"success": True})


@server.routes.post("/handytools/captioner/toggle_flag")
async def toggle_flag(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    flagged = data.get("flagged", False)
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)
        
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
        if filename in dataset_data and isinstance(dataset_data[filename], dict):
            dataset_data[filename]["flagged"] = flagged
            with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    return web.json_response({"success": True})


@server.routes.post("/handytools/captioner/search_replace")
async def search_replace(request):
    data = await request.json()
    folder = data.get("folder")
    find_text = data.get("find", "")
    replace_text = data.get("replace", "")
    scope = data.get("scope", "current")
    current_file = data.get("filename")
    selected_files = data.get("selectedFiles", [])
    
    # Safely extract captionIndex, defaulting to 1
    caption_index = data.get("captionIndex", data.get("caption_index", 1))
    
    if not folder or not find_text: 
        return web.json_response({"error": "Missing parameters"}, status=400)
        
    json_path = get_json_path(folder)
    if not os.path.exists(json_path): 
        return web.json_response({"error": "Dataset not loaded"}, status=400)
        
    try:
        with open(json_path, 'r', encoding='utf-8') as f: 
            dataset_data = json.load(f)
            
        source_dir = get_source_folder(folder, dataset_data)
                
        updated_files = []
        cap_key = f"caption{caption_index}"
        
        targets = []
        if scope == "current" and current_file: targets = [current_file]
        elif scope == "selected": targets = selected_files
        else: targets = [k for k, v in dataset_data.items() if isinstance(v, dict) and k not in ("__global_tags__", "__selections__", "__settings__")]
            
        for filename in targets:
            if filename in dataset_data and isinstance(dataset_data[filename], dict):
                info = dataset_data[filename]
                old_cap = info.get(cap_key, "")
                if find_text in old_cap:
                    new_cap = old_cap.replace(find_text, replace_text)
                    info[cap_key] = new_cap
                    
                    if caption_index == 1:
                        name, _ = os.path.splitext(filename)
                        txt_path = os.path.join(source_dir, f"{name}.txt")
                        if os.path.exists(source_dir):
                            with open(txt_path, 'w', encoding='utf-8') as f: f.write(new_cap)
                    
                    updated_files.append({"filename": filename, "caption": new_cap})
                        
        if updated_files:
            update_global_tags(dataset_data)
            with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
                
        return web.json_response({"success": True, "updated": updated_files})
        
    except Exception as e:
        print(f"[HandyTools] Search & Replace Error: {e}")
        return web.json_response({"error": str(e)}, status=500)


@server.routes.post("/handytools/captioner/delete_image")
async def delete_image(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)

    json_path = get_json_path(folder)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
            
    source_dir = get_source_folder(folder, dataset_data)
    bin_dir = os.path.join(source_dir, "_bin")
    os.makedirs(bin_dir, exist_ok=True)
    
    img_path = os.path.join(source_dir, filename)
    name, _ = os.path.splitext(filename)
    txt_path = os.path.join(source_dir, f"{name}.txt")
    
    try:
        if os.path.exists(img_path): shutil.move(img_path, os.path.join(bin_dir, filename))
        if os.path.exists(txt_path): shutil.move(txt_path, os.path.join(bin_dir, f"{name}.txt"))
            
        if filename in dataset_data:
            del dataset_data[filename]
            update_global_tags(dataset_data)
            if "__selections__" in dataset_data:
                for s_list in dataset_data["__selections__"].values():
                    if filename in s_list: s_list.remove(filename)

            with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
        return web.json_response({"success": True})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)


# --- GENERAL DATA ROUTES ---

@server.routes.post("/handytools/captioner/save_caption")
async def save_caption(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    caption = data.get("caption", "")
    caption_index = data.get("captionIndex", data.get("caption_index", 1))
    
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)
        
    cap_key = f"caption{caption_index}"
    json_path = get_json_path(folder)
    
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
        if filename not in dataset_data or not isinstance(dataset_data[filename], dict):
            dataset_data[filename] = {"tags": [], "flagged": False, "size": {"width": 0, "height": 0}}
            for i in range(1, 5): dataset_data[filename][f"caption{i}"] = ""
            
        dataset_data[filename][cap_key] = caption
        update_global_tags(dataset_data)
        with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
            
        source_dir = get_source_folder(folder, dataset_data)
        temp_cap_path = os.path.join(source_dir, "_temp", f"{filename}_captions.json")
        if os.path.exists(temp_cap_path):
            try: os.remove(temp_cap_path)
            except Exception: pass
        
        if caption_index == 1:
            name, _ = os.path.splitext(filename)
            txt_path = os.path.join(source_dir, f"{name}.txt")
            if os.path.exists(source_dir):
                with open(txt_path, 'w', encoding='utf-8') as f: f.write(caption)

    server.send_sync("ht-caption-updated", {"folder": folder, "filename": filename, "caption": caption, "captionIndex": caption_index})
    return web.json_response({"success": True})

@server.routes.post("/handytools/captioner/batch_rename")
async def batch_rename(request):
    data = await request.json()
    folder = data.get("folder")
    base_name = data.get("baseName")
    digits = int(data.get("digits", 3))
    sort_order = data.get("sortOrder", "name")
    scope = data.get("scope", "all")
    selected_files = data.get("selectedFiles", [])

    if not folder or not base_name: return web.json_response({"error": "Missing parameters"}, status=400)
    json_path = get_json_path(folder)
    if not os.path.exists(json_path): return web.json_response({"error": "Dataset not loaded"}, status=400)

    with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    backup_dir = os.path.join(source_dir, "_backup")
    temp_dir = os.path.join(source_dir, "_temp")

    targets = selected_files if scope == "selected" else [k for k, v in dataset_data.items() if isinstance(v, dict) and k not in ("__global_tags__", "__selections__", "__settings__")]

    pattern = re.compile(rf"^{re.escape(base_name)}_(\d+)\.[a-zA-Z0-9]+$")
    max_idx = max([int(pattern.match(fname).group(1)) for fname in dataset_data.keys() if pattern.match(fname)] + [0])
    
    files_to_rename = [fname for fname in targets if not pattern.match(fname)]
    if not files_to_rename: return web.json_response({"success": True, "renamed_count": 0})

    def get_mtime(fname): return os.path.getmtime(os.path.join(source_dir, fname)) if os.path.exists(os.path.join(source_dir, fname)) else 0
    if sort_order == "newest": files_to_rename.sort(key=get_mtime, reverse=True)
    elif sort_order == "oldest": files_to_rename.sort(key=get_mtime, reverse=False)
    else: files_to_rename.sort(key=lambda x: x.lower())

    def rename_if_exists(directory, old, new):
        if os.path.exists(os.path.join(directory, old)): shutil.move(os.path.join(directory, old), os.path.join(directory, new))

    renamed_count = 0
    for old_fname in files_to_rename:
        max_idx += 1
        new_fname = f"{base_name}_{str(max_idx).zfill(digits)}{os.path.splitext(old_fname)[1]}"
        old_no_ext = os.path.splitext(old_fname)[0]
        new_no_ext = os.path.splitext(new_fname)[0]

        rename_if_exists(source_dir, old_fname, new_fname)
        rename_if_exists(source_dir, f"{old_no_ext}.txt", f"{new_no_ext}.txt")
        rename_if_exists(temp_dir, old_fname, new_fname)
        rename_if_exists(temp_dir, f"{old_no_ext}.txt", f"{new_no_ext}.txt")
        rename_if_exists(temp_dir, f"{old_fname}_captions.json", f"{new_fname}_captions.json")
        rename_if_exists(backup_dir, old_fname, new_fname)
        rename_if_exists(backup_dir, f"{old_no_ext}.txt", f"{new_no_ext}.txt")

        if old_fname in dataset_data:
            item_data = dataset_data.pop(old_fname)
            if "original_filename" not in item_data: item_data["original_filename"] = old_fname
            dataset_data[new_fname] = item_data
        
        for s_list in dataset_data.get("__selections__", {}).values():
            if old_fname in s_list:
                s_list.remove(old_fname)
                s_list.append(new_fname)
        renamed_count += 1

    update_global_tags(dataset_data)
    with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)
    return web.json_response({"success": True, "renamed_count": renamed_count})

@server.routes.post("/handytools/api/receive_text")
async def api_receive_text(request):
    data = await request.json()
    folder, filename, text, caption_index = data.get("folder"), data.get("filename"), data.get("text", ""), data.get("captionIndex", 1)
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)

    dataset_data = {}
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    temp_dir = os.path.join(get_source_folder(folder, dataset_data), "_temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_cap_path = os.path.join(temp_dir, f"{filename}_captions.json")
    
    temp_caps = {}
    if os.path.exists(temp_cap_path):
        try:
            with open(temp_cap_path, 'r', encoding='utf-8') as f: temp_caps = json.load(f)
        except json.JSONDecodeError: pass

    temp_caps[f"caption{caption_index}"] = text
    with open(temp_cap_path, 'w', encoding='utf-8') as f: json.dump(temp_caps, f, indent=4)

    server.send_sync("ht-caption-temp-ready", {"folder": folder, "filename": filename, "caption": text, "captionIndex": caption_index})
    return web.json_response({"success": True})

@server.routes.post("/handytools/captioner/discard_temp_caption")
async def discard_temp_caption(request):
    data = await request.json()
    folder, filename = data.get("folder"), data.get("filename")
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)
    
    dataset_data = {}
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
        
    temp_cap_path = os.path.join(get_source_folder(folder, dataset_data), "_temp", f"{filename}_captions.json")
    if os.path.exists(temp_cap_path):
        try: os.remove(temp_cap_path)
        except Exception: pass
    return web.json_response({"success": True})

@server.routes.post("/handytools/captioner/run_vlm")
async def run_vlm(request):
    try:
        data = await request.json()
        folder = data.get("folder")
        scope = data.get("scope", "current")
        current_file = data.get("filename", data.get("currentFile"))
        selected_files = data.get("selectedFiles", [])
        
        preset = data.get("preset", data.get("presetName", "Character Dataset"))
        trigger_word = data.get("trigger_word", data.get("triggerWord", ""))
        style_focus = data.get("style_focus", data.get("styleFocus", False))
        manual_append = data.get("manual_append", data.get("manualAppend", ""))
        caption_index = data.get("caption_index", data.get("captionIndex", 1))

        if not folder: return web.json_response({"error": "Missing folder parameter"}, status=400)
            
        template_path = os.path.join(NODE_DIR, "workflows", "imageCaption_API.json")
        if not os.path.exists(template_path):
            os.makedirs(os.path.dirname(template_path), exist_ok=True)
            with open(template_path, 'w', encoding='utf-8') as f: json.dump(DEFAULT_VLM_TEMPLATE, f, indent=4)
            template = DEFAULT_VLM_TEMPLATE
        else:
            with open(template_path, 'r', encoding='utf-8') as f: template = json.load(f)

        json_path = get_json_path(folder)
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)
        source_dir = get_source_folder(folder, dataset_data)

        files_to_process = []
        if scope == "current" and current_file: files_to_process = [current_file]
        elif scope == "selected": files_to_process = selected_files
        else:
            for k, v in dataset_data.items():
                if isinstance(v, dict) and k not in ("__global_tags__", "__selections__", "__settings__") and not v.get("flagged", False):
                    files_to_process.append(k)

        url = f"http://127.0.0.1:{PromptServer.instance.port}/prompt"
        queued_count = 0
        queued_files = {}

        async with aiohttp.ClientSession() as session:
            for filename in files_to_process:
                img_path = os.path.abspath(os.path.join(source_dir, filename))
                if not os.path.exists(img_path): continue
                    
                prompt_data = copy.deepcopy(template)
                for node_id, node_info in prompt_data.items():
                    c_type = node_info.get("class_type")
                    if c_type == "HandyToolCaptionPrompts":
                        node_info["inputs"]["preset"] = preset
                        node_info["inputs"]["trigger_word"] = trigger_word
                        node_info["inputs"]["style_focus"] = style_focus
                        node_info["inputs"]["manual_append"] = manual_append
                    elif c_type == "HandyToolSaveTextAPI":
                        node_info["inputs"]["folder"] = folder
                        node_info["inputs"]["filename"] = filename
                        node_info["inputs"]["caption_index"] = caption_index
                    elif c_type == "HandyToolLoadImageAPI":
                        node_info["inputs"]["image_path"] = img_path
                        
                try:
                    async with session.post(url, json={"prompt": prompt_data}) as response:
                        if response.status == 200:
                            resp_json = await response.json()
                            if resp_json.get("prompt_id"): queued_files[resp_json.get("prompt_id")] = filename
                            queued_count += 1
                except Exception as e:
                    print(f"[HandyTools VLM Error] Failed to queue {filename}: {e}")

        return web.json_response({"success": True, "queued_count": queued_count, "queued_files": queued_files})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)