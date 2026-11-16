class HandyToolCounter:
    def __init__(self):
        self.current_index = 0

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "max_index": ("INT", {"default": 9999, "min": 1, "step": 1}),
            }
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("index",)
    FUNCTION = "run"
    CATEGORY = "HandyTools"

    def run(self, max_index=9999):
        current = self.current_index
        self.current_index = (self.current_index + 1) % max_index
        return (current,)


NODE_CLASS_MAPPINGS = {
    "HandyToolCounter": HandyToolCounter
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolCounter": "HandyTool Counter"
}