import os
import json
import torch
import safetensors.torch

class HandyToolLTXSaveLatentSimple:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "latent": ("LATENT", ),
                "folder_path": ("STRING", {"default": ""}), 
                "latent_name": ("STRING", {"default": "my_latent_01"})
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO"
            }
        }
    
    RETURN_TYPES = ()
    FUNCTION = "save_latent"
    OUTPUT_NODE = True
    CATEGORY = "HandyTools/LTXV"

    def save_latent(self, latent, folder_path, latent_name, extra_pnginfo=None):
        if not folder_path or not latent_name:
            raise ValueError("HandyTool LTX Save Simple: Please provide both a folder_path and latent_name.")
            
        target_dir = os.path.join(folder_path, latent_name)
        os.makedirs(target_dir, exist_ok=True)
        
        samples = latent.get("samples")
        if samples is None:
            raise ValueError("Latent dictionary does not contain 'samples'")

        if hasattr(samples, "unbind"):
            tensors = samples.unbind()
        else:
            tensors = [samples]
            
        if len(tensors) > 0:
            video_tensor = tensors[0]
            video_path = os.path.join(target_dir, f"{latent_name}_video.safetensors")
            safetensors.torch.save_file({"samples": video_tensor}, video_path)
            print(f"Saved Simple Video Latent to: {video_path}")
            
        if len(tensors) > 1:
            audio_tensor = tensors[1]
            audio_path = os.path.join(target_dir, f"{latent_name}_audio.safetensors")
            safetensors.torch.save_file({"samples": audio_tensor}, audio_path)
            print(f"Saved Simple Audio Latent to: {audio_path}")

        if extra_pnginfo is not None and "workflow" in extra_pnginfo:
            workflow_path = os.path.join(target_dir, f"{latent_name}_workflow.json")
            with open(workflow_path, "w", encoding="utf-8") as f:
                json.dump(extra_pnginfo["workflow"], f, indent=4)
            print(f"Saved Workflow to: {workflow_path}")
            
        return ()


class HandyToolLTXLoadLatentSimple:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "folder_path": ("STRING", {"default": ""}) 
            }
        }
    
    RETURN_TYPES = ("LATENT", "LATENT", "INT", "INT")
    RETURN_NAMES = ("video_latent", "audio_latent", "pixel_width", "pixel_height")
    FUNCTION = "load_latent"
    CATEGORY = "HandyTools/LTXV"
    OUTPUT_NODE = True

    def load_latent(self, folder_path):
        if not folder_path or not os.path.exists(folder_path) or not os.path.isdir(folder_path):
            raise FileNotFoundError(f"Directory not found or empty: {folder_path}")

        video_path = None
        audio_path = None

        for file in os.listdir(folder_path):
            if file.endswith("_video.safetensors"):
                video_path = os.path.join(folder_path, file)
            elif file.endswith("_audio.safetensors"):
                audio_path = os.path.join(folder_path, file)
        
        pixel_width = 0
        pixel_height = 0
        
        if video_path and os.path.exists(video_path):
            video_dict = safetensors.torch.load_file(video_path)
            video_tensor = video_dict["samples"]
            video_latent = {"samples": video_tensor}
            
            # Extract dimensions and multiply by 32 (LTX-Video VAE spatial scale)
            if len(video_tensor.shape) >= 2:
                pixel_height = int(video_tensor.shape[-2]) * 32
                pixel_width = int(video_tensor.shape[-1]) * 32
                
            print(f"Loaded Simple Video Latent: {os.path.basename(video_path)} (W:{pixel_width}px x H:{pixel_height}px)")
        else:
            raise FileNotFoundError(f"No *_video.safetensors file found in: {folder_path}")
            
        audio_latent = {} 
        if audio_path and os.path.exists(audio_path):
            audio_dict = safetensors.torch.load_file(audio_path)
            audio_latent = {"samples": audio_dict["samples"]}
            print(f"Loaded Simple Audio Latent: {os.path.basename(audio_path)}")
        else:
            print(f"Warning: No *_audio.safetensors found in {folder_path}. Outputting empty dictionary.")
            
        ui_text = f"Width: {pixel_width} px\nHeight: {pixel_height} px"

        return {
            "ui": {"text": [ui_text]},
            "result": (video_latent, audio_latent, pixel_width, pixel_height)
        }

NODE_CLASS_MAPPINGS = {
    "HandyToolLTXSaveLatentSimple": HandyToolLTXSaveLatentSimple,
    "HandyToolLTXLoadLatentSimple": HandyToolLTXLoadLatentSimple
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolLTXSaveLatentSimple": "HandyTool LTX Latent Save Simple",
    "HandyToolLTXLoadLatentSimple": "HandyTool LTX Latent Load Simple"
}