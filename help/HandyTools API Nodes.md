# HandyTools API Nodes - Reference for AI Agents

When generating or debugging workflows for ComfyUI that utilize the HandyTools image captioner ecosystem, use the specific API routing nodes provided by the `ComfyUI-handyTools` module.

The HandyTools system operates on a headless WebSocket relay. It acts as both the file provider and the file destination for dynamic dataset image/text processing. The backend logic is modularized across `handyTool_api_dataset.py` (JSON/state management) and `handyTool_api_image_ops.py` (image resizing/conversions).

## Available Nodes

### 1. `HandyToolLoadImageAPI`
**Role:** Injects an image dynamically from the active UI Viewer's temporary cache.
- **Inputs:** `image_path` (STRING). *(The frontend dynamically overwrites this parameter at execution time).*
- **Outputs:** `IMAGE` (ComfyUI standard tensor format).
- **Behavior:** Automatically falls back to a 1x1 dummy tensor if the string path is empty so that template validation succeeds. Converts all images to RGB tensor arrays.

### 2. `HandyToolSaveImageAPI`
**Role:** Pushes a completed workflow image back into the UI Viewer's temporary state without touching the hard drive.
- **Inputs:** 
  - `image` (IMAGE): The tensor to be saved.
  - `folder` (STRING): Provided dynamically.
  - `filename` (STRING): Provided dynamically.
- **Behavior:** Encodes the tensor as a lossless Base64 PNG buffer and executes a POST request to `/handytools/api/receive_image`. This triggers the UI websocket to display the edited image instantly as a preview.

### 3. `HandyToolGetTextAPI`
**Role:** Acts as a generic text injection point for AI prompts.
- **Inputs:** `text` (multiline STRING). 
- **Outputs:** `STRING`.
- **Behavior:** Used primarily for search-and-replace strings or custom AI edit prompts passed by the UI.

### 4. `HandyToolSaveTextAPI`
**Role:** Pushes a generated caption (from an LLM/VLM node) back into the dataset database.
- **Inputs:**
  - `text` (STRING, forceInput: True): The string output from the text generation node.
  - `folder` (STRING): Provided dynamically.
  - `filename` (STRING): Provided dynamically.
  - `caption_index` (INT): Provided dynamically (1-4).
- **Behavior:** Fires a POST request to `/handytools/api/receive_text`. Triggers the UI websocket to update the text area without permanently overwriting the committed file.

---

## Workflow Integration Rules

When a user asks you (the AI) to write a ComfyUI workflow JSON that utilizes HandyTools:

1. **For Image Edits:** Always begin with `HandyToolLoadImageAPI` and end with `HandyToolSaveImageAPI`. Ensure the JSON filename begins with the prefix `imageEdit_` (e.g., `imageEdit_RemoveBackground.json`) and is saved in the `/workflows` subdirectory. The backend actively scans for files matching this naming convention.
2. **For VLM Captions:** The default workflow string structure MUST pass the image from `HandyToolLoadImageAPI` directly into the VLM (or CLIP vision model). The output string of the VLM must route into the `text` input port of `HandyToolSaveTextAPI`.
3. **Lossless Requirement:** Do not inject JPEG or WEBP saving nodes into these pipelines. The backend `handyTool_api_image_ops.py` exclusively manages the losslessness constraints.
4. **Modular Imports:** If you need to manipulate aspect ratios mathematically within other custom nodes, import `calculate_target_size` directly from `custom_nodes.ComfyUI_handyTools.handyTool_api_image_ops`.