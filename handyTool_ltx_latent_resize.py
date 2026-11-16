import torch
import torch.nn.functional as F

class HandyToolLTXLatentResize:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "samples": ("LATENT",),
                "target_pixel_width": ("INT", {"default": 1920, "min": 64, "max": 8192, "step": 32}),
                "target_pixel_height": ("INT", {"default": 1152, "min": 64, "max": 8192, "step": 32}),
                "mode": (["crop", "stretch", "crop-resize"], {"default": "crop"}),
                "resize_method": (["bicubic", "bilinear", "nearest-exact"], {"default": "bicubic"}),
            }
        }
    
    RETURN_TYPES = ("LATENT", "STRING",)
    RETURN_NAMES = ("LATENT", "input_pixel_size",)
    FUNCTION = "process_latent"
    CATEGORY = "HandyTools/LTX"

    def process_latent(self, samples, target_pixel_width, target_pixel_height, mode, resize_method):
        s = samples.copy()
        latent_tensor = samples["samples"] # LTX Shape: [Batch, Channels, Frames, Height, Width]
        
        B, C, F_frames, H, W = latent_tensor.shape
        
        # Calculate current input pixel sizes (divisible by 32 compression)
        input_pixel_w = W * 32
        input_pixel_h = H * 32
        input_size_string = f"{input_pixel_w}x{input_pixel_h}"
        
        # Target dimensions adhering to the strict divisible-by-64 rule
        latent_w = max(2, round(target_pixel_width / 64) * 2)
        latent_h = max(2, round(target_pixel_height / 64) * 2)
        
        if mode == "stretch":
            # ----------------------------------------------------
            # STRETCH MODE
            # ----------------------------------------------------
            flat_latent = latent_tensor.permute(0, 2, 1, 3, 4).reshape(B * F_frames, C, H, W)
            align_corners = False if resize_method in ["bilinear", "bicubic"] else None
            resized_flat = F.interpolate(
                flat_latent, 
                size=(latent_h, latent_w), 
                mode=resize_method, 
                align_corners=align_corners
            )
            s["samples"] = resized_flat.view(B, F_frames, C, latent_h, latent_w).permute(0, 2, 1, 3, 4)
            
            if "noise_mask" in s:
                mask = s["noise_mask"]
                leading_dims = mask.shape[:-2]
                flat_mask = mask.view(-1, 1, mask.shape[-2], mask.shape[-1])
                resized_flat_mask = F.interpolate(
                    flat_mask, 
                    size=(latent_h, latent_w), 
                    mode="bilinear", 
                    align_corners=False
                )
                s["noise_mask"] = resized_flat_mask.view(*leading_dims, latent_h, latent_w)

        elif mode == "crop":
            # ----------------------------------------------------
            # CROP MODE (CENTERED, NO SCALING)
            # ----------------------------------------------------
            crop_h = min(H, latent_h)
            crop_w = min(W, latent_w)
            
            start_h = (H - crop_h) // 2
            start_w = (W - crop_w) // 2
            
            s["samples"] = latent_tensor[:, :, :, start_h:start_h+crop_h, start_w:start_w+crop_w]
            
            if "noise_mask" in s:
                mask = s["noise_mask"]
                if len(mask.shape) == 5:
                    s["noise_mask"] = mask[:, :, :, start_h:start_h+crop_h, start_w:start_w+crop_w]
                elif len(mask.shape) == 4:
                    s["noise_mask"] = mask[:, :, start_h:start_h+crop_h, start_w:start_w+crop_w]
                elif len(mask.shape) == 3:
                    s["noise_mask"] = mask[:, start_h:start_h+crop_h, start_w:start_w+crop_w]

        elif mode == "crop-resize":
            # ----------------------------------------------------
            # CROP-RESIZE MODE (SCALES UNIFORMLY THEN CROPS)
            # ----------------------------------------------------
            scale_w = latent_w / W
            scale_h = latent_h / H
            scale = max(scale_w, scale_h)
            
            inter_w = int(round(W * scale))
            inter_h = int(round(H * scale))
            
            # Step 1: Scale uniformly
            flat_latent = latent_tensor.permute(0, 2, 1, 3, 4).reshape(B * F_frames, C, H, W)
            align_corners = False if resize_method in ["bilinear", "bicubic"] else None
            resized_flat = F.interpolate(
                flat_latent, 
                size=(inter_h, inter_w), 
                mode=resize_method, 
                align_corners=align_corners
            )
            scaled_latent = resized_flat.view(B, F_frames, C, inter_h, inter_w).permute(0, 2, 1, 3, 4)
            
            # Step 2: Center crop
            start_h = (inter_h - latent_h) // 2
            start_w = (inter_w - latent_w) // 2
            s["samples"] = scaled_latent[:, :, :, start_h:start_h+latent_h, start_w:start_w+latent_w]
            
            # Step 3: Mirror to noise mask
            if "noise_mask" in s:
                mask = s["noise_mask"]
                leading_dims = mask.shape[:-2]
                flat_mask = mask.view(-1, 1, mask.shape[-2], mask.shape[-1])
                
                resized_flat_mask = F.interpolate(
                    flat_mask, 
                    size=(inter_h, inter_w), 
                    mode="bilinear", 
                    align_corners=False
                )
                scaled_mask = resized_flat_mask.view(*leading_dims, inter_h, inter_w)
                
                if len(scaled_mask.shape) == 5:
                    s["noise_mask"] = scaled_mask[:, :, :, start_h:start_h+latent_h, start_w:start_w+latent_w]
                elif len(scaled_mask.shape) == 4:
                    s["noise_mask"] = scaled_mask[:, :, start_h:start_h+latent_h, start_w:start_w+latent_w]
                elif len(scaled_mask.shape) == 3:
                    s["noise_mask"] = scaled_mask[:, start_h:start_h+latent_h, start_w:start_w+latent_w]
                    
        return {"ui": {"text": [input_size_string]}, "result": (s, input_size_string)}

NODE_CLASS_MAPPINGS = {
    "HandyToolLTXLatentResize": HandyToolLTXLatentResize
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolLTXLatentResize": "HandyTool LTX Latent Resize"
}