from .handyTool_counter import NODE_CLASS_MAPPINGS as COUNTER_MAPPINGS
from .handyTool_counter import NODE_DISPLAY_NAME_MAPPINGS as COUNTER_DISPLAY
from .handyTool_image_loader import NODE_CLASS_MAPPINGS as LOADER_MAPPINGS
from .handyTool_image_loader import NODE_DISPLAY_NAME_MAPPINGS as LOADER_DISPLAY
from .handyTool_wildcard import NODE_CLASS_MAPPINGS as WILDCARD_MAPPINGS
from .handyTool_wildcard import NODE_DISPLAY_NAME_MAPPINGS as WILDCARD_DISPLAY
from .handyTool_text_concat import NODE_CLASS_MAPPINGS as CONCAT_MAPPINGS
from .handyTool_text_concat import NODE_DISPLAY_NAME_MAPPINGS as CONCAT_DISPLAY
from .handyTool_dynamic_prompt import NODE_CLASS_MAPPINGS as DYNAMIC_MAPPINGS
from .handyTool_dynamic_prompt import NODE_DISPLAY_NAME_MAPPINGS as DYNAMIC_DISPLAY

# LTX nodes
from .handyTool_ltx_latents import NODE_CLASS_MAPPINGS as LTX_LATENTS_MAPPINGS
from .handyTool_ltx_latents import NODE_DISPLAY_NAME_MAPPINGS as LTX_LATENTS_DISPLAY
from .handyTool_ltx_latent_resize import NODE_CLASS_MAPPINGS as LTX_RESIZE_MAPPINGS
from .handyTool_ltx_latent_resize import NODE_DISPLAY_NAME_MAPPINGS as LTX_RESIZE_DISPLAY
from .handyTool_ltx_setup import NODE_CLASS_MAPPINGS as LTX_SETUP_MAPPINGS
from .handyTool_ltx_setup import NODE_DISPLAY_NAME_MAPPINGS as LTX_SETUP_DISPLAY

# LTX Simple nodes
from .handyTool_ltx_latents_simple import NODE_CLASS_MAPPINGS as LTX_SIMPLE_MAPPINGS
from .handyTool_ltx_latents_simple import NODE_DISPLAY_NAME_MAPPINGS as LTX_SIMPLE_DISPLAY

# HandyTool Dataset Size Tool
from .handyTool_dataset_size import NODE_CLASS_MAPPINGS as DATASET_SIZE_MAPPINGS
from .handyTool_dataset_size import NODE_DISPLAY_NAME_MAPPINGS as DATASET_SIZE_DISPLAY

# HandyTool Caption Prompts
from .handyTool_caption_prompts import NODE_CLASS_MAPPINGS as CAPTION_MAPPINGS
from .handyTool_caption_prompts import NODE_DISPLAY_NAME_MAPPINGS as CAPTION_DISPLAY

# HandyTool Panel Extractor (v01 - Symmetrical Math Split)
from .handyTool_panel_extractor import NODE_CLASS_MAPPINGS as PANEL_EXTRACTOR_MAPPINGS
from .handyTool_panel_extractor import NODE_DISPLAY_NAME_MAPPINGS as PANEL_EXTRACTOR_DISPLAY

# HandyTool Rename
from .handyTool_rename import NODE_CLASS_MAPPINGS as RENAME_MAPPINGS
from .handyTool_rename import NODE_DISPLAY_NAME_MAPPINGS as RENAME_DISPLAY

# HandyTool VL (Native)
from .handyTool_vl import HandyToolVL

# HandyTool Video Saver
from .handyTool_video_saver import NODE_CLASS_MAPPINGS as VIDEO_SAVER_MAPPINGS
from .handyTool_video_saver import NODE_DISPLAY_NAME_MAPPINGS as VIDEO_SAVER_DISPLAY

# HandyTool Frame Padder
from .handyTool_frame_padder import NODE_CLASS_MAPPINGS as FRAME_PADDER_MAPPINGS
from .handyTool_frame_padder import NODE_DISPLAY_NAME_MAPPINGS as FRAME_PADDER_DISPLAY

# HandyTool Minimax H3 Captioner
from .minimax_h3_captioner import NODE_CLASS_MAPPINGS as MINIMAX_CAPTIONER_MAPPINGS
from .minimax_h3_captioner import NODE_DISPLAY_NAME_MAPPINGS as MINIMAX_CAPTIONER_DISPLAY

# Minimax Video Clipper
from .minimax_videoClipper import NODE_CLASS_MAPPINGS as MINIMAX_CLIPPER_MAPPINGS
from .minimax_videoClipper import NODE_DISPLAY_NAME_MAPPINGS as MINIMAX_CLIPPER_DISPLAY

# Minimax Video Converter
from .handyTool_minimax_video_converter import NODE_CLASS_MAPPINGS as MINIMAX_CONVERTER_MAPPINGS
from .handyTool_minimax_video_converter import NODE_DISPLAY_NAME_MAPPINGS as MINIMAX_CONVERTER_DISPLAY

# --- NEW: HandyTool Video Editor ---
from .handyTool_video_editor import NODE_CLASS_MAPPINGS as VIDEO_EDITOR_MAPPINGS
from .handyTool_video_editor import NODE_DISPLAY_NAME_MAPPINGS as VIDEO_EDITOR_DISPLAY

# --- NEW: HandyTool Image Captioner ---
from .handyTool_image_captioner import NODE_CLASS_MAPPINGS as IMAGE_CAPTIONER_MAPPINGS
from .handyTool_image_captioner import NODE_DISPLAY_NAME_MAPPINGS as IMAGE_CAPTIONER_DISPLAY

# --- NEW: HandyTool API Nodes ---
from .handyTool_api_nodes import NODE_CLASS_MAPPINGS as API_NODES_MAPPINGS
from .handyTool_api_nodes import NODE_DISPLAY_NAME_MAPPINGS as API_NODES_DISPLAY

# Combine all mappings
NODE_CLASS_MAPPINGS = {
    **COUNTER_MAPPINGS,
    **LOADER_MAPPINGS,
    **WILDCARD_MAPPINGS,
    **CONCAT_MAPPINGS,
    **DYNAMIC_MAPPINGS,
    **LTX_LATENTS_MAPPINGS,
    **LTX_RESIZE_MAPPINGS,
    **LTX_SETUP_MAPPINGS,
    **LTX_SIMPLE_MAPPINGS,
    **DATASET_SIZE_MAPPINGS,
    **CAPTION_MAPPINGS,
    **PANEL_EXTRACTOR_MAPPINGS,
    **RENAME_MAPPINGS,
    **VIDEO_SAVER_MAPPINGS,
    **FRAME_PADDER_MAPPINGS,
    **MINIMAX_CAPTIONER_MAPPINGS,
    **MINIMAX_CLIPPER_MAPPINGS,
    **MINIMAX_CONVERTER_MAPPINGS,
    **VIDEO_EDITOR_MAPPINGS,
    **IMAGE_CAPTIONER_MAPPINGS,
    **API_NODES_MAPPINGS,
    "HandyToolVL": HandyToolVL
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **COUNTER_DISPLAY,
    **LOADER_DISPLAY,
    **WILDCARD_DISPLAY,
    **CONCAT_DISPLAY,
    **DYNAMIC_DISPLAY,
    **LTX_LATENTS_DISPLAY,
    **LTX_RESIZE_DISPLAY,
    **LTX_SETUP_DISPLAY,
    **LTX_SIMPLE_DISPLAY,
    **DATASET_SIZE_DISPLAY,
    **CAPTION_DISPLAY,
    **PANEL_EXTRACTOR_DISPLAY,
    **RENAME_DISPLAY,
    **VIDEO_SAVER_DISPLAY,
    **FRAME_PADDER_DISPLAY,
    **MINIMAX_CAPTIONER_DISPLAY,
    **MINIMAX_CLIPPER_DISPLAY,
    **MINIMAX_CONVERTER_DISPLAY,
    **VIDEO_EDITOR_DISPLAY,
    **IMAGE_CAPTIONER_DISPLAY,
    **API_NODES_DISPLAY,
    "HandyToolVL": "HandyTool VL (Native)"
}

WEB_DIRECTORY = "./web"
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']