import os
import random

class HandyToolWildcard:
    def __init__(self):
        self.items = []
        self.last_source = None

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mode": (["sequential", "random"], {"default": "sequential"}),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
            },
            "optional": {
                "text_input": ("STRING", {"default": "", "multiline": True}),
                "file_path": ("STRING", {"default": "", "multiline": False}),
            }
        }

    RETURN_TYPES = ("STRING", "INT", "INT")
    RETURN_NAMES = ("wildcard", "total_items", "current_index")
    FUNCTION = "get_wildcard"
    CATEGORY = "HandyTools/Prompt"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    def get_wildcard(self, mode, index, text_input="", file_path=""):
        source = file_path if file_path else text_input

        # Reload if source changed
        if source != self.last_source:
            self._load_items(source, bool(file_path))
            self.last_source = source

        if not self.items:
            return ("", 0, 0)

        total = len(self.items)
        safe_index = index % total if total > 0 else 0

        if mode == "random":
            item = random.choice(self.items)
        else:
            item = self.items[safe_index]

        return (item.strip(), total, safe_index)

    def _load_items(self, source, is_file):
        self.items = []
        if not source:
            return

        try:
            if is_file and os.path.isfile(source):
                with open(source, "r", encoding="utf-8") as f:
                    content = f.read()
            else:
                content = source

            items = [x.strip() for x in content.split(",") if x.strip()]
            self.items = items
            print(f"✅ HandyToolWildcard: Loaded {len(items)} items")
        except Exception as e:
            print(f"❌ HandyToolWildcard Error: {e}")


NODE_CLASS_MAPPINGS = {"HandyToolWildcard": HandyToolWildcard}
NODE_DISPLAY_NAME_MAPPINGS = {"HandyToolWildcard": "HandyTool Wildcard"}