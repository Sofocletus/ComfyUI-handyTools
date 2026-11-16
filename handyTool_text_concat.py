class HandyToolTextConcat:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "base_prompt": ("STRING", {"default": "Picture of a wildcard1 car", "multiline": True}),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
            },
            "optional": {
                "wildcard1": ("STRING", {"default": ""}),
                "wildcard2": ("STRING", {"default": ""}),
                "wildcard3": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("prompt", "current_index")
    FUNCTION = "concatenate"
    CATEGORY = "HandyTools/Prompt"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    def concatenate(self, base_prompt, index, wildcard1="", wildcard2="", wildcard3=""):
        prompt = base_prompt

        replacements = {
            "wildcard1": wildcard1,
            "wildcard2": wildcard2,
            "wildcard3": wildcard3,
        }

        for key, value in replacements.items():
            if value:
                prompt = prompt.replace(key, value)

        return (prompt, index)


NODE_CLASS_MAPPINGS = {"HandyToolTextConcat": HandyToolTextConcat}
NODE_DISPLAY_NAME_MAPPINGS = {"HandyToolTextConcat": "HandyTool Text Concat"}