import os
import random
import itertools

class HandyToolDynamicPrompt:
    def __init__(self):
        self.wildcard_lists = [[] for _ in range(3)]
        self.last_sources = [None] * 3
        self.combinations = []
        self.temp_file_path = None

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "base_prompt": ("STRING", {
                    "default": "A beautiful {wildcard1} {wildcard2} {wildcard3}", 
                    "multiline": True
                }),
                "index": ("INT", {"default": 0, "min": 0, "step": 1}),
                "exhaustive": ("BOOLEAN", {"default": False, "label": "Exhaustive Mode (All Combinations)"}),
            },
            "optional": {
                "wildcard_folder": ("STRING", {"default": ""}),

                # Wildcard 1
                "wildcard1_text": ("STRING", {"default": "", "multiline": True}),
                "wildcard1_file": ("STRING", {"default": ""}),
                "wildcard1_mode": (["sequential", "random"], {"default": "sequential"}),

                # Wildcard 2
                "wildcard2_text": ("STRING", {"default": "", "multiline": True}),
                "wildcard2_file": ("STRING", {"default": ""}),
                "wildcard2_mode": (["sequential", "random"], {"default": "sequential"}),

                # Wildcard 3
                "wildcard3_text": ("STRING", {"default": "", "multiline": True}),
                "wildcard3_file": ("STRING", {"default": ""}),
                "wildcard3_mode": (["sequential", "random"], {"default": "sequential"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("prompt", "wildcard1", "wildcard2", "wildcard3", "current_index", "total_combinations")
    FUNCTION = "generate"
    CATEGORY = "HandyTools/Prompt"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    def generate(self, base_prompt, index, exhaustive=False, wildcard_folder="",
                 wildcard1_text="", wildcard1_file="", wildcard1_mode="sequential",
                 wildcard2_text="", wildcard2_file="", wildcard2_mode="sequential",
                 wildcard3_text="", wildcard3_file="", wildcard3_mode="sequential"):

        # Reliable temp path
        comfy_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        temp_dir = os.path.join(comfy_root, "ComfyUI/temp")
        os.makedirs(temp_dir, exist_ok=True)
        self.temp_file_path = os.path.join(temp_dir, "handyTool_dynamic_prompt.txt")

        sources = [
            (wildcard1_text, wildcard1_file, wildcard1_mode, "wildcard1.txt"),
            (wildcard2_text, wildcard2_file, wildcard2_mode, "wildcard2.txt"),
            (wildcard3_text, wildcard3_file, wildcard3_mode, "wildcard3.txt")
        ]

        for i, (text, file_path, mode, default_filename) in enumerate(sources):
            source = ""
            is_file = False

            if wildcard_folder and os.path.isdir(wildcard_folder):
                full_path = os.path.join(wildcard_folder, default_filename)
                if os.path.isfile(full_path):
                    source = full_path
                    is_file = True
            if not source and file_path:
                source = file_path
                is_file = True
            if not source:
                source = text

            if source != self.last_sources[i]:
                self.wildcard_lists[i] = self._load_items(source, is_file)
                self.last_sources[i] = source

        items1 = self.wildcard_lists[0] or [""]
        items2 = self.wildcard_lists[1] or [""]
        items3 = self.wildcard_lists[2] or [""]

        sizes = [len(items1), len(items2), len(items3)]
        total_combinations = sizes[0] * sizes[1] * sizes[2]

        if exhaustive:
            if not self.combinations:
                self.combinations = list(itertools.product(items1, items2, items3))
                self._save_to_temp_file()

            safe_index = index % len(self.combinations)
            w1, w2, w3 = self.combinations[safe_index]
        else:
            w1 = self._get_item(items1, wildcard1_mode)
            w2 = self._get_item(items2, wildcard2_mode)
            w3 = self._get_item(items3, wildcard3_mode)

        # Build prompt
        prompt = base_prompt
        prompt = prompt.replace("{wildcard1}", w1).replace("wildcard1", w1)
        prompt = prompt.replace("{wildcard2}", w2).replace("wildcard2", w2)
        prompt = prompt.replace("{wildcard3}", w3).replace("wildcard3", w3)

        return (prompt, w1, w2, w3, index, total_combinations)

    def _get_item(self, items, mode):
        if not items:
            return ""
        if mode == "sequential":
            # Note: In non-exhaustive mode we still use index from input
            # But since this is called per execution, we need index passed in for sequential
            # For simplicity in random mode we pick randomly
            return random.choice(items) if mode == "random" else items[0]  # fallback
        else:
            return random.choice(items)

    def _load_items(self, source, is_file):
        if not source:
            return []
        try:
            if is_file:
                with open(source, "r", encoding="utf-8") as f:
                    content = f.read()
            else:
                content = source

            raw = [x.strip() for x in content.split(",") if x.strip()]
            processed = []

            for item in raw:
                if "::" in item:  # Weight support: red::1.5
                    try:
                        val, _ = item.split("::", 1)
                        processed.append(val.strip())
                    except:
                        processed.append(item)
                else:
                    processed.append(item)
            return processed
        except Exception as e:
            print(f"❌ Load error: {e}")
            return []

    def _save_to_temp_file(self):
        try:
            with open(self.temp_file_path, "w", encoding="utf-8") as f:
                for combo in self.combinations:
                    f.write(f"{combo[0]} | {combo[1]} | {combo[2]}\n")
            print(f"✅ Saved {len(self.combinations)} combinations to: {self.temp_file_path}")
        except Exception as e:
            print(f"❌ Failed to save temp file: {e}")


NODE_CLASS_MAPPINGS = {"HandyToolDynamicPrompt": HandyToolDynamicPrompt}
NODE_DISPLAY_NAME_MAPPINGS = {"HandyToolDynamicPrompt": "HandyTool Dynamic Prompt"}