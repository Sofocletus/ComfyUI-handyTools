class HandyToolLTXSetup:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "width": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 64}),
                "height": ("INT", {"default": 576, "min": 64, "max": 8192, "step": 64}),
                "frame_count": ("INT", {"default": 49, "min": 1, "max": 4097, "step": 8}),
                "fps": ("INT", {"default": 24, "min": 1, "max": 240, "step": 1}),
            }
        }
    
    # Kept strictly to the 4 essential integer outputs
    RETURN_TYPES = ("INT", "INT", "INT", "INT",)
    RETURN_NAMES = ("width", "height", "frame_count", "fps",)
    FUNCTION = "configure_ltx"
    CATEGORY = "HandyTools/LTX"

    def configure_ltx(self, width, height, frame_count, fps):
        # Enforce strict divisible-by-64 formatting for dimensions
        safe_width = (width // 64) * 64
        safe_height = (height // 64) * 64
        
        # Enforce strict (multiples of 8) + 1 formatting for LTX video frames
        safe_frame_count = max(1, ((frame_count - 1) // 8) * 8 + 1)
        
        return (safe_width, safe_height, safe_frame_count, fps)

NODE_CLASS_MAPPINGS = {
    "HandyToolLTXSetup": HandyToolLTXSetup
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolLTXSetup": "HandyTool LTX Setup"
}