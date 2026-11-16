import os
import shutil
import numpy as np
from PIL import Image

class HandyToolDatasetSizeTool:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_directory": ("STRING", {"default": "C:/MyDataset/Input"}),
                "target_sizes": ("STRING", {
                    "multiline": True, 
                    "default": "512\n768x512\n512x768\n1024x1024"
                }),
                "scaling_method": (["lanczos", "bicubic", "bilinear", "nearest"],),
                "upscale_if_too_small": ("BOOLEAN", {"default": True}),
                "base_output_path": ("STRING", {"default": "C:/MyDataset/Output"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("status",)
    FUNCTION = "process_dataset"
    CATEGORY = "HandyTools/Image"
    OUTPUT_NODE = True 

    def process_dataset(self, input_directory, target_sizes, scaling_method, upscale_if_too_small, base_output_path):
        if not os.path.exists(input_directory):
            return (f"Error: Input directory {input_directory} does not exist.",)

        parsed_sizes = []
        for line in target_sizes.replace(',', '\n').split('\n'):
            line = line.strip().lower()
            if not line:
                continue
            if 'x' in line:
                parts = line.split('x')
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                    parsed_sizes.append((int(parts[0]), int(parts[1])))
            elif line.isdigit():
                parsed_sizes.append((int(line), int(line)))

        if not parsed_sizes:
            parsed_sizes = [(512, 512)]

        resample_filters = {
            "lanczos": Image.Resampling.LANCZOS,
            "bicubic": Image.Resampling.BICUBIC,
            "bilinear": Image.Resampling.BILINEAR,
            "nearest": Image.Resampling.NEAREST,
        }
        resample_filter = resample_filters.get(scaling_method, Image.Resampling.LANCZOS)
        
        # Absolute minimum dimension available in the user's size sets
        min_allowed_dim = min(min(tw, th) for tw, th in parsed_sizes)
        
        valid_image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        processed_count = 0

        for filename in os.listdir(input_directory):
            ext = os.path.splitext(filename)[1].lower()
            
            if ext in valid_image_extensions:
                file_path = os.path.join(input_directory, filename)
                base_name = os.path.splitext(filename)[0]
                
                try:
                    img = Image.open(file_path).convert("RGB")
                except Exception as e:
                    print(f"Failed to open {filename}: {e}")
                    continue
                
                w, h = img.size

                # --- NEW PENALTY-BASED MATCHING ALGORITHM ---
                best_size = None
                min_penalty = float('inf')

                for target_w, target_h in parsed_sizes:
                    # Calculate the scale factor required to completely fill this target size
                    scale = max(target_w / w, target_h / h)
                    
                    upscale_penalty = 0
                    # If this size forces the image to upscale...
                    if scale > 1.0:
                        if upscale_if_too_small:
                            # Only penalize if the image is ALREADY large enough for the smallest setting
                            if min(w, h) >= min_allowed_dim:
                                upscale_penalty = 1_000_000_000
                        else:
                            # If upscale is disabled, penalize any bucket that forces upscaling
                            upscale_penalty = 1_000_000_000
                    
                    # Calculate how many pixels would be cropped out (wasted area)
                    new_w = w * scale
                    new_h = h * scale
                    crop_area = (new_w * new_h) - (target_w * target_h)
                    
                    # Calculate resolution distance to break ties between identical aspect ratios
                    area_diff = abs((w * h) - (target_w * target_h))
                    
                    # Total penalty score (Prioritize zero upscaling, then minimal crop, then closest resolution)
                    total_penalty = upscale_penalty + crop_area + (area_diff * 0.1)
                    
                    if total_penalty < min_penalty:
                        min_penalty = total_penalty
                        best_size = (target_w, target_h)
                
                target_w, target_h = best_size
                # --------------------------------------------

                # Scale & Crop based on the winning size
                ratio_w = target_w / w
                ratio_h = target_h / h
                scale_ratio = max(ratio_w, ratio_h) 

                final_w = int(round(w * scale_ratio))
                final_h = int(round(h * scale_ratio))

                resized_img = img.resize((final_w, final_h), resample=resample_filter)

                left = (final_w - target_w) / 2
                top = (final_h - target_h) / 2
                right = (final_w + target_w) / 2
                bottom = (final_h + target_h) / 2

                cropped_img = resized_img.crop((left, top, right, bottom))

                # Handle Saving Logic
                folder_name = str(target_w) if target_w == target_h else f"{target_w}x{target_h}"
                save_dir = os.path.join(base_output_path, folder_name)
                os.makedirs(save_dir, exist_ok=True)

                save_path = os.path.join(save_dir, f"{base_name}{ext}")
                cropped_img.save(save_path)

                # Copy corresponding .txt file
                text_file_path = os.path.join(input_directory, f"{base_name}.txt")
                if os.path.exists(text_file_path):
                    target_text_path = os.path.join(save_dir, f"{base_name}.txt")
                    shutil.copy2(text_file_path, target_text_path)

                processed_count += 1

        status_message = f"Successfully processed {processed_count} image-text pairs."
        print(f"HandyToolDatasetSizeTool: {status_message}")
        
        return (status_message,)

# Mappings
NODE_CLASS_MAPPINGS = {
    "HandyToolDatasetSizeTool": HandyToolDatasetSizeTool
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolDatasetSizeTool": "HandyTool Dataset Size Tool"
}