import os
import json
import shutil
import base64
import aiohttp
from io import BytesIO
from aiohttp import web
from server import PromptServer
from PIL import Image, ImageOps

from .handyTool_api_dataset import (
    get_json_path, get_source_folder, get_backup_path, update_global_tags,
    NODE_DIR, PRESETS_PATH, IMAGE_SIZES_PATH, DEFAULT_PRESETS
)

server = PromptServer.instance

# --- PURE PYTHON HELPERS FOR MODULAR REUSE ---
def calculate_target_size(w, h, mode="longest_edge", size=1024, target_sizes_list=None):
    """
    Modular mathematical helper that cleanly calculates aspect-ratio scaling.
    Can be imported by other custom nodes via `from custom_nodes.ComfyUI_handyTools.handyTool_api_image_ops import calculate_target_size`
    """
    if w == 0 or h == 0:
        return w, h
        
    if mode == "longest_edge":
        if w > h:
            return size, max(1, int(h * (size / w)))
        else:
            return max(1, int(w * (size / h))), size
            
    elif mode == "preset" and target_sizes_list:
        orig_ar = w / h
        orig_area = w * h
        def score(wt, ht):
            return (abs(orig_ar - (wt / ht)), abs(orig_area - (wt * ht)))
        return min(target_sizes_list, key=lambda x: score(x[0], x[1]))
        
    elif mode == "multiples_of_32":
        return max(32, round(w / 32.0) * 32), max(32, round(h / 32.0) * 32)
        
    return w, h


# --- ENDPOINTS ---
@server.routes.post("/handytools/captioner/create_dataset")
async def create_dataset(request):
    data = await request.json()
    folder, name, sizes_str = data.get("folder"), data.get("name"), data.get("sizes", "")
    caption_indices = data.get("captionIndices", [1])
    scope = data.get("scope", "all")
    selected_files = data.get("selectedFiles", [])

    if not folder or not name: return web.json_response({"error": "Missing parameters"}, status=400)

    target_sizes = []
    for s in sizes_str.split("\n"):
        s = s.strip().lower()
        if not s: continue
        if 'x' in s:
            parts = s.split('x')
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                target_sizes.append((int(parts[0]), int(parts[1])))
        elif s.isdigit(): target_sizes.append((int(s), int(s)))

    json_path = get_json_path(folder)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    out_dir = os.path.join(folder, name)
    os.makedirs(out_dir, exist_ok=True)

    targets = selected_files if scope == "selected" else [k for k, v in dataset_data.items() if isinstance(v, dict) and k not in ("__global_tags__", "__selections__", "__settings__") and not v.get("flagged", False)]

    processed_count = 0
    for filename in targets:
        source_img_path = os.path.join(source_dir, filename)
        if not os.path.exists(source_img_path): continue
        
        file_info = dataset_data.get(filename, {})
        caps = [file_info.get(f"caption{idx}", "").strip() for idx in caption_indices if file_info.get(f"caption{idx}", "").strip()]
        combined_caption = ", ".join(caps)
        base_name, _ = os.path.splitext(filename)
        
        target_subfolder = ""
        img_to_save = None

        if target_sizes:
            try:
                with Image.open(source_img_path) as img:
                    w, h = img.size
                    new_w, new_h = calculate_target_size(w, h, mode="preset", target_sizes_list=target_sizes)
                    target_subfolder = f"{new_w}x{new_h}"
                    
                    if img.mode in ("P", "LA"): img = img.convert("RGBA")
                    elif img.mode not in ("RGB", "RGBA"): img = img.convert("RGB")
                    
                    img_to_save = img.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)
            except Exception as e: print(f"Dataset create resize failed for {filename}: {e}")

        current_out_dir = os.path.join(out_dir, target_subfolder) if target_subfolder else out_dir
        os.makedirs(current_out_dir, exist_ok=True)
        
        with open(os.path.join(current_out_dir, f"{base_name}.txt"), "w", encoding="utf-8") as txt_f: txt_f.write(combined_caption)

        out_img = os.path.join(current_out_dir, f"{base_name}.png")
        if img_to_save: img_to_save.save(out_img, format="PNG")
        else:
            with Image.open(source_img_path) as img: img.save(out_img, format="PNG")
        processed_count += 1

    return web.json_response({"success": True, "processed_count": processed_count})


@server.routes.post("/handytools/captioner/batch_resize")
async def batch_resize(request):
    data = await request.json()
    folder, mode, size = data.get("folder"), data.get("mode", "longest_edge"), int(data.get("size", 1024))
    preset_sizes_str, scope, selected_files = data.get("preset_sizes", ""), data.get("scope", "all"), data.get("selectedFiles", [])

    if not folder: return web.json_response({"error": "Missing parameters"}, status=400)

    target_sizes = []
    if mode == "preset":
        for s in preset_sizes_str.split("\n"):
            s = s.strip().lower()
            if not s: continue
            if 'x' in s:
                parts = s.split('x')
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit(): target_sizes.append((int(parts[0]), int(parts[1])))
            elif s.isdigit(): target_sizes.append((int(s), int(s)))
        if not target_sizes: return web.json_response({"error": "No valid target sizes found in preset."}, status=400)

    json_path = get_json_path(folder)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    backup_dir = os.path.join(source_dir, "_backup")
    temp_dir = os.path.join(source_dir, "_temp")
    os.makedirs(backup_dir, exist_ok=True)
    os.makedirs(temp_dir, exist_ok=True)

    files_to_process = selected_files if scope == "selected" else [f for f in os.listdir(source_dir) if os.path.splitext(f)[1].lower() == ".png"]
    processed_count = 0
    changed = False

    for filename in files_to_process:
        source_img_path = os.path.join(source_dir, filename)
        if not os.path.exists(source_img_path): continue
            
        backup_path, temp_path = get_backup_path(backup_dir, filename), os.path.join(temp_dir, filename)
        
        try:
            with Image.open(source_img_path) as img:
                w, h = img.size
                new_w, new_h = calculate_target_size(w, h, mode=mode, size=size, target_sizes_list=target_sizes)
                if w == new_w and h == new_h: continue 
                
                if img.mode in ("P", "LA"): img = img.convert("RGBA")
                elif img.mode not in ("RGB", "RGBA"): img = img.convert("RGB")
                    
                img_resized = img.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)
            
            if not backup_path: shutil.copy2(source_img_path, os.path.join(backup_dir, filename))
            
            img_resized.save(source_img_path, format="PNG")
            if os.path.exists(temp_path): img_resized.save(temp_path, format="PNG")
                
            dataset_data[filename]["size"] = {"width": new_w, "height": new_h}
            changed = True
            processed_count += 1
        except Exception as e: print(f"Failed to resize {filename}: {e}")

    if changed:
        update_global_tags(dataset_data)
        with open(json_path, 'w', encoding='utf-8') as f: json.dump(dataset_data, f, indent=4)

    return web.json_response({"success": True, "processed_count": processed_count})


# --- AI EDIT WORKFLOWS ---
@server.routes.get("/handytools/captioner/get_workflows")
async def get_workflows(request):
    workflows_dir = os.path.join(NODE_DIR, "workflows")
    wfs = []
    if os.path.exists(workflows_dir):
        for f in os.listdir(workflows_dir):
            if f.startswith("imageEdit_") and f.endswith(".json"):
                name = f[10:-5]
                wfs.append({"file": f, "name": name})
    return web.json_response({"workflows": wfs})

@server.routes.post("/handytools/captioner/run_ai_edit")
async def run_ai_edit(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    prompt = data.get("prompt", "")
    workflow_file = data.get("workflow")
    use_original = data.get("use_original", False)

    if not folder or not filename or not workflow_file:
        return web.json_response({"error": "Missing parameters"}, status=400)

    json_path = get_json_path(folder)
    with open(json_path, 'r', encoding='utf-8') as f:
        dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    temp_dir = os.path.join(source_dir, "_temp")
    backup_dir = os.path.join(source_dir, "_backup")
    os.makedirs(temp_dir, exist_ok=True)
    
    source_path = os.path.join(source_dir, filename)
    temp_path = os.path.join(temp_dir, filename)
    backup_path = get_backup_path(backup_dir, filename)

    load_path = source_path
    if use_original and backup_path:
        load_path = backup_path
    elif os.path.exists(temp_path):
        load_path = temp_path

    if not os.path.exists(load_path):
        return web.json_response({"error": "Base image not found"}, status=404)

    if os.path.abspath(load_path) != os.path.abspath(temp_path):
        try:
            shutil.copy2(load_path, temp_path)
        except Exception as e:
            pass

    wf_path = os.path.join(NODE_DIR, "workflows", workflow_file)
    if not os.path.exists(wf_path):
        return web.json_response({"error": "Workflow file not found"}, status=404)

    with open(wf_path, 'r', encoding='utf-8') as f:
        workflow = json.load(f)

    for node_id, node_info in workflow.items():
        c_type = node_info.get("class_type")
        if c_type == "HandyToolLoadImageAPI":
            node_info["inputs"]["image_path"] = temp_path
        elif c_type == "HandyToolGetTextAPI":
            node_info["inputs"]["text"] = prompt
        elif c_type == "HandyToolSaveImageAPI":
            node_info["inputs"]["folder"] = folder
            node_info["inputs"]["filename"] = filename

    port = PromptServer.instance.port
    url = f"http://127.0.0.1:{port}/prompt"
    payload = {"prompt": workflow}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    return web.json_response({"success": True})
                else:
                    return web.json_response({"error": f"ComfyUI HTTP {response.status}"}, status=500)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# --- VIEWER CROP & RESIZE TOOLS ---
@server.routes.post("/handytools/captioner/crop_image")
async def crop_image(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    x = int(data.get("x", 0))
    y = int(data.get("y", 0))
    w = int(data.get("w", 0))
    h = int(data.get("h", 0))

    if not folder or not filename or w <= 0 or h <= 0:
        return web.json_response({"error": "Invalid crop parameters"}, status=400)

    json_path = get_json_path(folder)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    temp_dir = os.path.join(source_dir, "_temp")
    os.makedirs(temp_dir, exist_ok=True)

    source_path = os.path.join(source_dir, filename)
    temp_path = os.path.join(temp_dir, filename)

    load_path = source_path
    if os.path.exists(temp_path):
        load_path = temp_path

    if not os.path.exists(load_path):
        return web.json_response({"error": "Image not found"}, status=404)

    try:
        with Image.open(load_path) as img:
            img = img.convert("RGBA") if img.mode in ("P", "RGBA", "LA") else img.convert("RGB")
            cropped_img = img.crop((x, y, x + w, y + h))
        
        cropped_img.save(temp_path, format="PNG") 
        return web.json_response({"success": True, "width": w, "height": h})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@server.routes.post("/handytools/captioner/custom_resize")
async def custom_resize(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")
    w = int(data.get("width", 0))
    h = int(data.get("height", 0))
    use_original = data.get("use_original", False)

    if not folder or not filename or w <= 0 or h <= 0:
        return web.json_response({"error": "Invalid parameters"}, status=400)

    json_path = get_json_path(folder)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    temp_dir = os.path.join(source_dir, "_temp")
    backup_dir = os.path.join(source_dir, "_backup")
    os.makedirs(temp_dir, exist_ok=True)

    source_path = os.path.join(source_dir, filename)
    temp_path = os.path.join(temp_dir, filename)
    backup_path = get_backup_path(backup_dir, filename)

    load_path = source_path
    if use_original and backup_path:
        load_path = backup_path
    elif os.path.exists(temp_path):
        load_path = temp_path

    if not os.path.exists(load_path):
        return web.json_response({"error": "Image not found"}, status=404)

    try:
        with Image.open(load_path) as img:
            img = img.convert("RGBA") if img.mode in ("P", "RGBA", "LA") else img.convert("RGB")
            resized_img = img.resize((w, h), resample=Image.Resampling.LANCZOS)
        
        resized_img.save(temp_path, format="PNG") 
        return web.json_response({"success": True, "width": w, "height": h})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


@server.routes.post("/handytools/captioner/auto_resize")
async def auto_resize(request):
    data = await request.json()
    folder = data.get("folder")
    scope = data.get("scope", "current")
    current_file = data.get("filename")
    selected_files = data.get("selectedFiles", [])
    use_original = data.get("use_original", False)

    if not folder:
        return web.json_response({"error": "Missing folder parameter"}, status=400)

    json_path = get_json_path(folder)
    dataset_data = {}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            try:
                dataset_data = json.load(f)
            except json.JSONDecodeError:
                pass

    source_dir = get_source_folder(folder, dataset_data)
    backup_dir = os.path.join(source_dir, "_backup")
    temp_dir = os.path.join(source_dir, "_temp")
    os.makedirs(backup_dir, exist_ok=True)
    os.makedirs(temp_dir, exist_ok=True)

    files_to_process = []
    if scope == "current" and current_file:
        files_to_process = [current_file]
    elif scope == "selected":
        files_to_process = selected_files
    else:
        valid_exts = {".png"} 
        for filename in os.listdir(source_dir):
            if os.path.splitext(filename)[1].lower() in valid_exts:
                files_to_process.append(filename)

    processed_count = 0
    changed = False
    new_dims = None

    for filename in files_to_process:
        source_img_path = os.path.join(source_dir, filename)
        if not os.path.exists(source_img_path):
            continue
            
        backup_path = get_backup_path(backup_dir, filename)
        temp_path = os.path.join(temp_dir, filename)
        
        load_path = source_img_path
        if use_original and backup_path:
            load_path = backup_path
        elif scope == "current" and os.path.exists(temp_path):
            load_path = temp_path
            
        try:
            with Image.open(load_path) as img:
                w, h = img.size
                w_new = max(32, round(w / 32.0) * 32)
                h_new = max(32, round(h / 32.0) * 32)
                
                if w == w_new and h == h_new:
                    continue
                    
                img = img.convert("RGBA") if img.mode in ("P", "RGBA", "LA") else img.convert("RGB")
                img_resized = ImageOps.fit(img, (w_new, h_new), method=Image.Resampling.LANCZOS)
            
            if scope == "current":
                img_resized.save(temp_path, format="PNG") 
                new_dims = {"width": w_new, "height": h_new}
                processed_count += 1
                continue
                
            if not backup_path:
                shutil.copy2(source_img_path, os.path.join(backup_dir, filename))
            
            img_resized.save(source_img_path, format="PNG")
            
            dataset_data[filename]["size"] = {"width": w_new, "height": h_new}
            changed = True
            processed_count += 1
            
        except Exception as e:
            print(f"Failed to resize {filename}: {e}")

    if changed:
        update_global_tags(dataset_data)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(dataset_data, f, indent=4)

    return web.json_response({"success": True, "processed_count": processed_count, "new_dims": new_dims})


# --- TEMPORARY FILE MANAGEMENT ---
@server.routes.post("/handytools/captioner/preview_original")
async def preview_original(request):
    data = await request.json()
    folder, filename = data.get("folder"), data.get("filename")
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)

    dataset_data = {}
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    backup_dir, temp_dir = os.path.join(source_dir, "_backup"), os.path.join(source_dir, "_temp")
    os.makedirs(temp_dir, exist_ok=True)

    backup_path, temp_path = get_backup_path(backup_dir, filename), os.path.join(temp_dir, filename)

    if not backup_path: return web.json_response({"error": "No original backup found"}, status=404)
    try:
        shutil.copy2(backup_path, temp_path)
        with Image.open(temp_path) as img: return web.json_response({"success": True, "width": img.width, "height": img.height})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)


@server.routes.post("/handytools/captioner/discard_edit")
async def discard_edit(request):
    data = await request.json()
    folder, filename = data.get("folder"), data.get("filename")
    if not folder or not filename: return web.json_response({"error": "Missing parameters"}, status=400)

    dataset_data = {}
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    temp_path = os.path.join(get_source_folder(folder, dataset_data), "_temp", filename)
    if os.path.exists(temp_path):
        try: os.remove(temp_path)
        except Exception: pass
    return web.json_response({"success": True})


@server.routes.post("/handytools/captioner/discard_all_edits")
async def discard_all_edits(request):
    data = await request.json()
    folder = data.get("folder")
    if not folder: return web.json_response({"error": "Missing parameters"}, status=400)

    dataset_data = {}
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    temp_dir = os.path.join(get_source_folder(folder, dataset_data), "_temp")
    if os.path.exists(temp_dir):
        try: shutil.rmtree(temp_dir)
        except Exception: pass
    return web.json_response({"success": True})


@server.routes.post("/handytools/captioner/commit_edit")
async def commit_edit(request):
    data = await request.json()
    folder = data.get("folder")
    filename = data.get("filename")

    if not folder or not filename:
        return web.json_response({"error": "Missing parameters"}, status=400)

    json_path = get_json_path(folder)
    with open(json_path, 'r', encoding='utf-8') as f:
        dataset_data = json.load(f)

    source_dir = get_source_folder(folder, dataset_data)
    temp_dir = os.path.join(source_dir, "_temp")
    backup_dir = os.path.join(source_dir, "_backup")
    os.makedirs(backup_dir, exist_ok=True)

    temp_path = os.path.join(temp_dir, filename)
    source_path = os.path.join(source_dir, filename)
    backup_path = get_backup_path(backup_dir, filename)

    if not os.path.exists(temp_path):
        return web.json_response({"error": "No temporary edit to commit"}, status=404)

    try:
        if not backup_path and os.path.exists(source_path):
            shutil.copy2(source_path, os.path.join(backup_dir, filename))

        with Image.open(temp_path) as img:
            img.save(source_path, format="PNG")
            
        os.remove(temp_path)

        with Image.open(source_path) as img:
            w, h = img.size
        dataset_data[filename]["size"] = {"width": w, "height": h}
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(dataset_data, f, indent=4)

        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


# --- GENERAL UPLOADS AND FETCHING ---
@server.routes.post("/handytools/captioner/upload_images")
async def upload_images(request):
    try:
        reader = await request.multipart()
        folder = None
        files_to_save = []
        
        while True:
            field = await reader.next()
            if field is None: break
            if field.name == "folder":
                folder = (await field.read()).decode('utf-8')
            elif field.name == "images[]" and field.filename:
                files_to_save.append((field.filename, await field.read()))
                    
        if not folder: return web.json_response({"error": "Missing folder parameter"}, status=400)
            
        json_path = get_json_path(folder)
        dataset_data = {}
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                try: dataset_data = json.load(f)
                except json.JSONDecodeError: dataset_data = {}
                    
        source_dir = get_source_folder(folder, dataset_data)
        os.makedirs(source_dir, exist_ok=True)
        
        uploaded_count = 0
        for filename, file_bytes in files_to_save:
            name, ext = os.path.splitext(os.path.basename(filename))
            new_filename = f"{name}.png"
            save_path = os.path.join(source_dir, new_filename)
            
            counter = 1
            while os.path.exists(save_path):
                new_filename = f"{name}_{counter}.png"
                save_path = os.path.join(source_dir, new_filename)
                counter += 1
                
            try:
                with Image.open(BytesIO(file_bytes)) as img:
                    if img.mode in ("P", "LA"): img = img.convert("RGBA")
                    elif img.mode not in ("RGB", "RGBA"): img = img.convert("RGB")
                    img.save(save_path, format="PNG")
                uploaded_count += 1
            except Exception as e: print(f"[HandyTools] Upload Error on {filename}: {e}")
            
        return web.json_response({"success": True, "uploaded_count": uploaded_count})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

@server.routes.post("/handytools/api/receive_image")
async def api_receive_image(request):
    data = await request.json()
    folder, filename, image_data = data.get("folder"), data.get("filename"), data.get("image_data")
    if not folder or not filename or not image_data: return web.json_response({"error": "Missing parameters"}, status=400)

    dataset_data = {}
    json_path = get_json_path(folder)
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f: dataset_data = json.load(f)

    temp_dir = os.path.join(get_source_folder(folder, dataset_data), "_temp")
    os.makedirs(temp_dir, exist_ok=True)

    try:
        img = Image.open(BytesIO(base64.b64decode(image_data))).convert("RGB")
        img.save(os.path.join(temp_dir, filename), format="PNG")
        server.send_sync("ht-image-edited", {"folder": folder, "filename": filename, "width": img.width, "height": img.height})
        return web.json_response({"success": True})
    except Exception as e: return web.json_response({"error": str(e)}, status=500)

@server.routes.get("/handytools/captioner/get_image")
async def get_image(request):
    folder = request.query.get("folder", "")
    filename = request.query.get("filename", "")
    use_backup = request.query.get("backup", "false").lower() == "true"
    preview_temp = request.query.get("temp", "false").lower() == "true"
    
    if not folder or not filename: return web.Response(status=400, text="Missing folder or filename")
        
    folder_abs = os.path.abspath(folder)
    img_path = os.path.abspath(os.path.join(folder_abs, filename))
    
    try:
        if os.path.commonpath([img_path, folder_abs]) != folder_abs: return web.Response(status=403, text="Forbidden path")
    except ValueError: return web.Response(status=403, text="Forbidden path")

    if preview_temp:
        temp_path = os.path.join(folder_abs, "_temp", filename)
        if os.path.exists(temp_path): img_path = temp_path
    elif use_backup:
        bp = get_backup_path(os.path.join(folder_abs, "_backup"), filename)
        if bp: img_path = bp

    if not os.path.exists(img_path): return web.Response(status=404, text="Image not found")
        
    try:
        with open(img_path, "rb") as f: return web.Response(body=f.read(), content_type="image/png")
    except Exception as e: return web.Response(status=500, text=str(e))
    

@server.routes.get("/handytools/captioner/get_presets")
async def get_presets(request):
    os.makedirs(os.path.dirname(PRESETS_PATH), exist_ok=True)
    if not os.path.exists(PRESETS_PATH):
        with open(PRESETS_PATH, 'w', encoding='utf-8') as f: json.dump(DEFAULT_PRESETS, f, indent=4)
        return web.json_response(DEFAULT_PRESETS)
    try:
        with open(PRESETS_PATH, 'r', encoding='utf-8') as f: return web.json_response(json.load(f))
    except Exception: return web.json_response(DEFAULT_PRESETS)


@server.routes.post("/handytools/captioner/update_presets")
async def update_presets(request):
    data = await request.json()
    os.makedirs(os.path.dirname(PRESETS_PATH), exist_ok=True)
    with open(PRESETS_PATH, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)
    return web.json_response({"success": True})


@server.routes.get("/handytools/captioner/get_image_sizes")
async def get_image_sizes(request):
    os.makedirs(os.path.dirname(IMAGE_SIZES_PATH), exist_ok=True)
    if not os.path.exists(IMAGE_SIZES_PATH):
        with open(IMAGE_SIZES_PATH, 'w', encoding='utf-8') as f: json.dump(DEFAULT_PRESETS, f, indent=4)
        return web.json_response(DEFAULT_PRESETS)
    try:
        with open(IMAGE_SIZES_PATH, 'r', encoding='utf-8') as f: return web.json_response(json.load(f))
    except Exception: return web.json_response(DEFAULT_PRESETS)