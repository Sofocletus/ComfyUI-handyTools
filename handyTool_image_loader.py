import os
import torch
import numpy as np
from PIL import Image
import hashlib

class HandyToolImageBatchLoad:
    def __init__(self):
        self.image_paths = []
        self.last_directory = None
        self.total_images = 0
        
        # Use the standard ComfyUI temp directory
        self.temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp")
        os.makedirs(self.temp_dir, exist_ok=True)
        print(f"✅ HandyToolImageBatchLoad: Using temp directory: {self.temp_dir}")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "directory": ("STRING", {"default": "", "multiline": True}),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
            }
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("image", "filename", "directory_path", "total_images", "current_index")
    FUNCTION = "load_image"
    CATEGORY = "HandyTools"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    def load_image(self, directory, index=0):
        if directory != self.last_directory:
            self._scan_directory(directory)
            self.last_directory = directory

        if self.total_images == 0:
            empty = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
            return (empty, "No images found", directory, 0, 0)

        safe_index = index % self.total_images
        img_path = self.image_paths[safe_index]
        filename = os.path.splitext(os.path.basename(img_path))[0]

        try:
            pil_img = Image.open(img_path).convert("RGB")
            img_array = np.array(pil_img).astype(np.float32) / 255.0
            image_tensor = torch.from_numpy(img_array)[None,]

            preview_filename = self._save_preview_to_temp(pil_img, filename)

            return {
                "result": (image_tensor, filename, directory, self.total_images, safe_index),
                "ui": {"images": [preview_filename]}
            }
        except Exception as e:
            print(f"[HandyToolImageBatchLoad] Error loading image: {e}")
            empty = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
            return (empty, "ERROR", directory, self.total_images, safe_index)

    def _save_preview_to_temp(self, pil_img, filename):
        try:
            thumb = pil_img.copy()
            thumb.thumbnail((512, 512), Image.Resampling.LANCZOS)

            thumb_name = f"handyTool_{hashlib.md5(filename.encode()).hexdigest()[:12]}.jpg"
            thumb_path = os.path.join(self.temp_dir, thumb_name)

            thumb.save(thumb_path, "JPEG", quality=85, optimize=True)
            print(f"✅ Preview saved to temp: {thumb_name}")
            return thumb_name

        except Exception as e:
            print(f"❌ Failed to save preview: {e}")
            return ""

    def _scan_directory(self, directory):
        self.image_paths = []
        if not os.path.isdir(directory):
            self.total_images = 0
            return

        supported = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'}
        for f in os.listdir(directory):
            if os.path.splitext(f)[1].lower() in supported:
                self.image_paths.append(os.path.join(directory, f))

        self.image_paths.sort()
        self.total_images = len(self.image_paths)
        print(f"✅ HandyToolImageBatchLoad: Found {self.total_images} images")


NODE_CLASS_MAPPINGS = {"HandyToolImageBatchLoad": HandyToolImageBatchLoad}
NODE_DISPLAY_NAME_MAPPINGS = {"HandyToolImageBatchLoad": "HandyTool Image Batch Load"}