import os
import re
import json
import torch
import safetensors.torch
import mimetypes
from server import PromptServer
from aiohttp import web

# ======================================================================
# WEB SERVER ROUTES (For V2 Video UI)
# ======================================================================

@PromptServer.instance.routes.get("/handyTool/video_list")
async def list_videos(request):
    dir_path = request.query.get("dir", "")
    if not dir_path or not os.path.exists(dir_path):
        return web.json_response({"videos": [], "error": "Directory not found"})
    
    valid_extensions = ('.mp4', '.webm', '.mov', '.avi', '.mkv', '.gif')
    videos = []
    
    try:
        # Scan the root directory directly for video files
        for file in os.listdir(dir_path):
            file_lower = file.lower()
            
            # Check if it's a video file AND has "_take" in the name to ensure we only grab previews
            if file_lower.endswith(valid_extensions) and "_take" in file_lower:
                videos.append(file)
                        
        videos.sort()
        return web.json_response({"videos": videos})
    except Exception as e:
        return web.json_response({"videos": [], "error": str(e)})


@PromptServer.instance.routes.get("/handyTool/view_video")
async def view_video(request):
    dir_path = request.query.get("dir", "")
    filename = request.query.get("file", "")
    
    full_path = os.path.join(dir_path, filename)
    if not os.path.exists(full_path):
        return web.Response(status=404)
    
    content_type, _ = mimetypes.guess_type(full_path)
    return web.FileResponse(full_path, headers={'Content-Type': content_type or 'video/mp4'})


# ======================================================================
# NODE DEFINITIONS
# ======================================================================

class HandyToolLTXSaveLatents:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "latent": ("LATENT", ),
                "folder_path": ("STRING", {"default": ""}), # Default is now empty
            },
            "optional": {
                "save_prompt": ("STRING", {"forceInput": True})
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }
    
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("folder_path", "preview_name")
    FUNCTION = "save_latent"
    OUTPUT_NODE = True
    CATEGORY = "HandyTools/LTXV"

    def save_latent(self, latent, folder_path, save_prompt=None, prompt=None, extra_pnginfo=None):
        if not folder_path:
            raise ValueError("HandyTool LTX Save: Please provide a valid folder_path.")
            
        normalized_path = os.path.normpath(folder_path)
        folder_basename = os.path.basename(normalized_path)
        
        if not folder_basename:
            folder_basename = "output"

        os.makedirs(folder_path, exist_ok=True)

        highest_take = 0
        pattern = re.compile(rf"^{re.escape(folder_basename)}_take(\d+)$")

        for item in os.listdir(folder_path):
            item_path = os.path.join(folder_path, item)
            if os.path.isdir(item_path):
                match = pattern.match(item)
                if match:
                    take_num = int(match.group(1))
                    if take_num > highest_take:
                        highest_take = take_num
                        
        next_take = highest_take + 1

        take_prefix = f"{folder_basename}_take{next_take:03d}"
        target_dir = os.path.join(folder_path, take_prefix)
        os.makedirs(target_dir, exist_ok=True)
        
        samples = latent.get("samples")
        if samples is None:
            raise ValueError("Latent dictionary does not contain 'samples'")

        if hasattr(samples, "unbind"):
            tensors = samples.unbind()
        else:
            tensors = [samples]
            
        if len(tensors) > 0:
            video_tensor = tensors[0]
            video_path = os.path.join(target_dir, f"{take_prefix}_video.safetensors")
            safetensors.torch.save_file({"samples": video_tensor}, video_path)
            print(f"Saved HandyTool LTX Video Latent to: {video_path}")
            
        if len(tensors) > 1:
            audio_tensor = tensors[1]
            audio_path = os.path.join(target_dir, f"{take_prefix}_audio.safetensors")
            safetensors.torch.save_file({"samples": audio_tensor}, audio_path)
            print(f"Saved HandyTool LTX Audio Latent to: {audio_path}")

        if save_prompt:
            prompt_path = os.path.join(target_dir, f"{take_prefix}.txt")
            with open(prompt_path, "w", encoding="utf-8") as f:
                f.write(save_prompt)
            print(f"Saved HandyTool LTX Prompt to: {prompt_path}")

        if extra_pnginfo is not None and "workflow" in extra_pnginfo:
            workflow_path = os.path.join(target_dir, f"{take_prefix}.json")
            with open(workflow_path, "w", encoding="utf-8") as f:
                json.dump(extra_pnginfo["workflow"], f, indent=4)
            print(f"Saved HandyTool LTX Workflow to: {workflow_path}")
            
        clean_folder_path = folder_path.replace("\\", "/")
        return (clean_folder_path, take_prefix)


class HandyToolLTXLoadLatents:
    current_sequence_index = 0
    last_sequence_string = ""

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "folder_path": ("STRING", {"default": ""}), # Default is now empty
                "take_sequence": ("STRING", {"default": "0"})
            }
        }
    
    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("NaN")

    RETURN_TYPES = ("LATENT", "LATENT", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("video_latent", "audio_latent", "prompt_text", "take_name", "upscaled_take_name", "upscaled_path")
    FUNCTION = "load_latent"
    CATEGORY = "HandyTools/LTXV"

    def load_latent(self, folder_path, take_sequence):
        if not folder_path or not os.path.exists(folder_path) or not os.path.isdir(folder_path):
            raise FileNotFoundError(f"Base directory not found or empty: {folder_path}")

        try:
            takes_list = [int(x.strip()) for x in take_sequence.split(",") if x.strip()]
        except ValueError:
            print(f"Warning: Invalid take_sequence format '{take_sequence}'. Defaulting to 0.")
            takes_list = [0]
            
        if not takes_list:
            takes_list = [0]

        if take_sequence != HandyToolLTXLoadLatents.last_sequence_string:
            HandyToolLTXLoadLatents.current_sequence_index = 0
            HandyToolLTXLoadLatents.last_sequence_string = take_sequence

        take_number = takes_list[HandyToolLTXLoadLatents.current_sequence_index % len(takes_list)]
        HandyToolLTXLoadLatents.current_sequence_index += 1

        normalized_path = os.path.normpath(folder_path)
        folder_basename = os.path.basename(normalized_path)
        target_take_dir = None

        if take_number == 0:
            highest_take = 0
            pattern = re.compile(rf"^{re.escape(folder_basename)}_take(\d+)$")
            
            for item in os.listdir(folder_path):
                item_path = os.path.join(folder_path, item)
                if os.path.isdir(item_path):
                    match = pattern.match(item)
                    if match:
                        take_num = int(match.group(1))
                        if take_num > highest_take:
                            highest_take = take_num
                            target_take_dir = item_path
                            
            if target_take_dir is None:
                raise FileNotFoundError(f"No take folders found inside {folder_path}")
            else:
                print(f"HandyTool LTX Load: Auto-selected latest take -> {os.path.basename(target_take_dir)}")

        else:
            take_folder_name = f"{folder_basename}_take{take_number:03d}"
            target_take_dir = os.path.join(folder_path, take_folder_name)
            
            if not os.path.exists(target_take_dir):
                raise FileNotFoundError(f"Requested take folder not found: {target_take_dir}")
            else:
                print(f"HandyTool LTX Load: Selected specific take -> {take_folder_name} (from sequence: [{take_sequence}])")

        video_path = None
        audio_path = None
        prompt_path = None

        for file in os.listdir(target_take_dir):
            if file.endswith("_video.safetensors"):
                video_path = os.path.join(target_take_dir, file)
            elif file.endswith("_audio.safetensors"):
                audio_path = os.path.join(target_take_dir, file)
            elif file.endswith(".txt"):
                prompt_path = os.path.join(target_take_dir, file)
        
        if video_path and os.path.exists(video_path):
            video_dict = safetensors.torch.load_file(video_path)
            video_latent = {"samples": video_dict["samples"]}
        else:
            raise FileNotFoundError(f"No *_video.safetensors file found in: {target_take_dir}")
            
        audio_latent = {} 
        if audio_path and os.path.exists(audio_path):
            audio_dict = safetensors.torch.load_file(audio_path)
            audio_latent = {"samples": audio_dict["samples"]}
            
        prompt_text = ""
        if prompt_path and os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                prompt_text = f.read()

        take_name_output = os.path.basename(target_take_dir)
        upscaled_take_name = f"upscaled_{take_name_output}"
        upscaled_path = folder_path.replace("\\", "/") + "/upscaled"
        return (video_latent, audio_latent, prompt_text, take_name_output, upscaled_take_name, upscaled_path)


class HandyToolLTXLoadLatentsV2(HandyToolLTXLoadLatents):
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "folder_path": ("STRING", {"default": ""}), # Default is now empty
                "take_sequence": ("STRING", {"default": "0"})
            }
        }

# ======================================================================
# NODE MAPPINGS
# ======================================================================

NODE_CLASS_MAPPINGS = {
    "HandyToolLTXSaveLatents": HandyToolLTXSaveLatents,
    "HandyToolLTXLoadLatents": HandyToolLTXLoadLatents,
    "HandyToolLTXLoadLatentsV2": HandyToolLTXLoadLatentsV2
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolLTXSaveLatents": "HandyTool LTX save latents",
    "HandyToolLTXLoadLatents": "HandyTool LTX Load Latents",
    "HandyToolLTXLoadLatentsV2": "HandyTool LTX Load Latents V2"
}