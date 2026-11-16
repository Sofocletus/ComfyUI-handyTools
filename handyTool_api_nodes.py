import os
import torch
import numpy as np
import urllib.request
import json
import base64
from io import BytesIO
from PIL import Image, ImageOps
from server import PromptServer

class HandyToolLoadImageAPI:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image_path": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load_image"
    CATEGORY = "handyTools/API"

    def load_image(self, image_path):
        # Fallback to a 1x1 dummy image if the path is empty (e.g., when building the template)
        if not image_path or not os.path.exists(image_path):
            img = Image.new('RGB', (1, 1), color=(0, 0, 0))
        else:
            img = Image.open(image_path)
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")

        # Convert to ComfyUI standard tensor format [B, H, W, C]
        image = np.array(img).astype(np.float32) / 255.0
        image = torch.from_numpy(image)[None,]
        
        return (image,)


class HandyToolSaveTextAPI:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
                "folder": ("STRING", {"default": ""}),
                "filename": ("STRING", {"default": ""}),
                "caption_index": ("INT", {"default": 1, "min": 1, "max": 4}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    OUTPUT_NODE = True
    FUNCTION = "save_text"
    CATEGORY = "handyTools/API"

    def save_text(self, text, folder, filename, caption_index):
        if folder and filename:
            try:
                # Dynamically get the port ComfyUI is currently running on
                port = PromptServer.instance.port
                url = f"http://127.0.0.1:{port}/handytools/api/receive_text"
                
                payload = {
                    "folder": folder,
                    "filename": filename,
                    "text": text,
                    "captionIndex": caption_index
                }
                
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
                
                # Fire the request to the internal backend
                with urllib.request.urlopen(req) as response:
                    pass
                    
            except Exception as e:
                print(f"[HandyToolSaveTextAPI] Failed to save caption to API: {e}")
        
        return (text,)


class HandyToolSaveImageAPI:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE", ),
                "folder": ("STRING", {"default": ""}),
                "filename": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    OUTPUT_NODE = True
    FUNCTION = "save_image"
    CATEGORY = "handyTools/API"

    def save_image(self, image, folder, filename):
        if folder and filename:
            try:
                # Convert ComfyUI Tensor to PIL Image
                img_tensor = image[0]
                img_np = (img_tensor.cpu().numpy() * 255).astype(np.uint8)
                img_pil = Image.fromarray(img_np)
                
                # Buffer to Base64
                buffered = BytesIO()
                img_pil.save(buffered, format="PNG")
                img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                
                port = PromptServer.instance.port
                url = f"http://127.0.0.1:{port}/handytools/api/receive_image"
                
                payload = {
                    "folder": folder,
                    "filename": filename,
                    "image_data": img_base64
                }
                
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
                
                with urllib.request.urlopen(req) as response:
                    pass
                    
            except Exception as e:
                print(f"[HandyToolSaveImageAPI] Failed to save image to API: {e}")
        
        return (image,)


class HandyToolGetTextAPI:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "get_text"
    CATEGORY = "handyTools/API"

    def get_text(self, text):
        return (text,)


NODE_CLASS_MAPPINGS = {
    "HandyToolLoadImageAPI": HandyToolLoadImageAPI,
    "HandyToolSaveTextAPI": HandyToolSaveTextAPI,
    "HandyToolSaveImageAPI": HandyToolSaveImageAPI,
    "HandyToolGetTextAPI": HandyToolGetTextAPI
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolLoadImageAPI": "HandyTool Load Image API",
    "HandyToolSaveTextAPI": "HandyTool Save Text API",
    "HandyToolSaveImageAPI": "HandyTool Save Image API",
    "HandyToolGetTextAPI": "HandyTool Get Text API"
}