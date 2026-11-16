import torch

class HandyToolFramePadder:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "model_type": (["Minimax", "LTX"], {"default": "Minimax"}),
            },
        }

    # Added "INT" to the return types
    RETURN_TYPES = ("IMAGE", "INT")
    # Named the new output "FRAME_COUNT" for clarity in the UI
    RETURN_NAMES = ("IMAGE", "FRAME_COUNT")
    FUNCTION = "pad_frames"
    CATEGORY = "HandyTool/Video"

    def pad_frames(self, images, model_type):
        # ComfyUI treats video frames as a batched image tensor: [Batch/Frames, Height, Width, Channels]
        current_frames = images.shape[0]
        target_frames = current_frames

        if model_type == "Minimax":
            # Minimax valid frames: 22, 39, 56, 73, 90... (22 + 17n)
            if current_frames <= 22:
                target_frames = 22
            else:
                n = (current_frames - 22 + 16) // 17
                target_frames = 22 + n * 17
                
        elif model_type == "LTX":
            # LTX valid frames: 9, 17, 25, 33... (8n + 1)
            if current_frames <= 9:
                target_frames = 9
            else:
                n = (current_frames - 1 + 7) // 8
                target_frames = 8 * n + 1

        # Pad by duplicating the last frame if necessary
        if target_frames > current_frames:
            pad_count = target_frames - current_frames
            last_frame = images[-1:] # Slice to keep the batch dimension: [1, H, W, C]
            padding = last_frame.repeat(pad_count, 1, 1, 1)
            images = torch.cat([images, padding], dim=0)
            
        print(f"[HandyTool Frame Padder] Received {current_frames} frames. Padded to {target_frames} frames for {model_type}.")

        # Return both the images tensor and the integer frame count
        return (images, int(target_frames))

NODE_CLASS_MAPPINGS = {
    "HandyToolFramePadder": HandyToolFramePadder
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolFramePadder": "HandyTool Frame Padder"
}