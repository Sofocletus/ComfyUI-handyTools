import os
import re

# Define paths for both Image and Video prompt files
NODE_DIR = os.path.dirname(os.path.realpath(__file__))
IMAGE_PROMPTS_FILE = os.path.join(NODE_DIR, "prompts.txt")
VIDEO_PROMPTS_FILE = os.path.join(NODE_DIR, "prompts_video.txt")

def load_presets(filepath):
    presets = {}
    if not os.path.exists(filepath):
        return {}
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    current_name = None
    current_text = []
    
    for line in content.splitlines():
        stripped_line = line.strip()
        if stripped_line.startswith("[") and stripped_line.endswith("]"):
            if current_name:
                presets[current_name] = "\n".join(current_text).strip()
            current_name = stripped_line[1:-1]
            current_text = []
        elif current_name is not None:
            if stripped_line or current_text:
                current_text.append(line)
                
    if current_name:
        presets[current_name] = "\n".join(current_text).strip()
        
    return presets

class HandyToolCaptionPrompts:
    @classmethod
    def INPUT_TYPES(s):
        # Read the files dynamically every time the UI requests the node parameters
        # This means a simple browser refresh (F5) will load new text file entries
        IMAGE_PRESETS = load_presets(IMAGE_PROMPTS_FILE)
        VIDEO_PRESETS = load_presets(VIDEO_PROMPTS_FILE)
        
        ALL_KEYS = sorted(list(set(list(IMAGE_PRESETS.keys()) + list(VIDEO_PRESETS.keys()))))
        if not ALL_KEYS:
            ALL_KEYS = ["Error: No presets found in either file"]

        return {
            "required": {
                "media_type": (["Video", "Image"], {"default": "Video"}),
                "preset": (ALL_KEYS, ),
                "trigger_word": ("STRING", {"multiline": False, "default": "chr_bob(male)"}),
                "style_focus": ("BOOLEAN", {"default": False}),
                "manual_append": ("STRING", {"multiline": True, "default": ""}),
            },
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("prompt", "system_prompt")
    FUNCTION = "generate_prompt"
    CATEGORY = "handyTools"

    def generate_prompt(self, media_type, preset, trigger_word, style_focus, manual_append):
        # Read the files dynamically right before generation so it always has the latest data
        IMAGE_PRESETS = load_presets(IMAGE_PROMPTS_FILE)
        VIDEO_PRESETS = load_presets(VIDEO_PROMPTS_FILE)

        # 1. Select correct dictionary based on UI toggle
        if media_type == "Image":
            raw_text = IMAGE_PRESETS.get(preset)
            if not raw_text:
                raw_text = VIDEO_PRESETS.get(preset, f"Error: '{preset}' not found.")
        else:
            raw_text = VIDEO_PRESETS.get(preset)
            if not raw_text:
                raw_text = IMAGE_PRESETS.get(preset, f"Error: '{preset}' not found.")
        
        # 2. Parse main rules and alternative rules for style focus
        main_lines = []
        alt_rules = {}
        
        for line in raw_text.splitlines():
            if line.strip().startswith("*##"):
                prefix = line.strip()[3:] 
                rule_num = prefix.split(".", 1)[0]
                alt_rules[rule_num] = prefix
            else:
                main_lines.append(line)
                
        # 3. Apply alternative rules if style_focus is ON
        final_lines = []
        for line in main_lines:
            if style_focus and line.strip().startswith("##"):
                prefix = line.strip()[2:]
                rule_num = prefix.split(".", 1)[0]
                
                if rule_num in alt_rules:
                    final_lines.append("##" + alt_rules[rule_num])
                    continue 
        
            final_lines.append(line)
            
        processed_text = "\n".join(final_lines)

        # 4. Handle Trigger Word and Gender
        trigger_input = trigger_word.strip()
        match = re.search(r'^(.*?)\s*\((male|female|it)\)$', trigger_input, re.IGNORECASE)
        
        if match:
            trigger_name = match.group(1).strip()
            gender = match.group(2).lower()
            
            if gender == "male":
                gender_instruction = "male (use he/him/his pronouns)"
            elif gender == "female":
                gender_instruction = "female (use she/her/hers pronouns)"
            else:
                gender_instruction = "an object or entity (use it/its pronouns)"
        else:
            trigger_name = trigger_input
            gender_instruction = "unspecified (use context-appropriate pronouns)"
            
        processed_text = processed_text.replace("***trigger_word***", trigger_name)
        processed_text = processed_text.replace("&gender&", gender_instruction)
        
        # 5. Split into User Prompt and System Prompt
        prompt_lines = []
        system_lines = []
        current_section = "system" # fallback
        
        for line in processed_text.splitlines():
            if line.startswith("Prompt:"):
                current_section = "prompt"
                content = line.replace("Prompt:", "", 1).strip()
                if content: prompt_lines.append(content)
            elif line.startswith("System Prompt:"):
                current_section = "system"
                content = line.replace("System Prompt:", "", 1).strip()
                if content: system_lines.append(content)
            else:
                if current_section == "prompt":
                    prompt_lines.append(line)
                else:
                    system_lines.append(line)

        final_prompt = "\n".join(prompt_lines).strip()
        final_system_prompt = "\n".join(system_lines).strip()

        # 6. Append manual text to the User Prompt
        if manual_append.strip():
            final_prompt += "\n\n" + manual_append.strip()
        
        return (final_prompt, final_system_prompt)

# Flush to the left margin
NODE_CLASS_MAPPINGS = {
    "HandyToolCaptionPrompts": HandyToolCaptionPrompts
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolCaptionPrompts": "HandyTool Caption Prompts"
}