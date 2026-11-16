import torch
import os
import numpy as np
from PIL import Image
import folder_paths

class HandyToolPanelExtractor:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "base_filename": ("STRING", {"default": "img01"}),
                # New input for the custom save path
                "save_path": ("STRING", {"default": ""}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "extract_panels"
    CATEGORY = "HandyTools/Image"
    OUTPUT_NODE = True 

    def extract_panels(self, image, base_filename, save_path):
        output_images = []
        
        # --- PATH HANDLING LOGIC ---
        # If the user leaves the text box blank, use ComfyUI's default output folder
        if not save_path or save_path.strip() == "":
            final_output_dir = folder_paths.get_output_directory()
        else:
            final_output_dir = save_path.strip()
            # If the custom folder doesn't exist, create it automatically
            os.makedirs(final_output_dir, exist_ok=True)
            
        # Clean the input string just in case
        base_filename = os.path.splitext(base_filename)[0]
        crop_counter = 1
        
        for img in image:
            h, w, c = img.shape
            mid_h = h // 2
            mid_w = w // 2
            
            # Slice into quadrants
            panels = [
                img[:mid_h, :mid_w, :],               # top_left
                img[:mid_h, mid_w:mid_w*2, :],        # top_right
                img[mid_h:mid_h*2, :mid_w, :],        # bottom_left
                img[mid_h:mid_h*2, mid_w:mid_w*2, :]  # bottom_right
            ]
            
            for panel in panels:
                output_images.append(panel)
                
                # Convert tensor to PIL Image
                panel_np = 255. * panel.cpu().numpy()
                img_pil = Image.fromarray(np.clip(panel_np, 0, 255).astype(np.uint8))
                
                # Format the filename
                filename = f"{base_filename}_crop_{crop_counter:02d}.png"
                
                # Use the new final_output_dir we defined above
                file_path = os.path.join(final_output_dir, filename)
                
                # Save silently
                img_pil.save(file_path)
                crop_counter += 1
            
        result_batch = torch.stack(output_images, dim=0)
        
        return (result_batch,)

NODE_CLASS_MAPPINGS = {
    "HandyToolPanelExtractor": HandyToolPanelExtractor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolPanelExtractor": "HandyTool Panel Extractor v01"
}