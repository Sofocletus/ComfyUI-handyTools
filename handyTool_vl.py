import torch
import torch.nn.functional as F
import comfy.model_management as mm

class HandyToolVL:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "image": ("IMAGE",),
                "prompt": ("STRING", {"multiline": True, "default": "Describe this video/image in detail."}),
                "max_new_tokens": ("INT", {"default": 512, "min": 1, "max": 4096, "step": 1}),
                "temperature": ("FLOAT", {"default": 0.7, "min": 0.1, "max": 2.0, "step": 0.1}),
                "frame_interval": ("INT", {"default": 10, "min": 1, "max": 300, "step": 1}),
                "max_resolution": ("INT", {"default": 768, "min": 256, "max": 4096, "step": 64}), 
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "analyze"
    CATEGORY = "HandyTools/VisionLanguage"

    def analyze(self, clip, image, prompt, max_new_tokens, temperature, frame_interval, max_resolution):
        # 1. Video / Image Frame Sampling
        frames_to_process = image[::frame_interval]
        
        # 2. Downscaling using PyTorch
        img_tensor = frames_to_process.permute(0, 3, 1, 2)
        _, _, h, w = img_tensor.shape
        if max(h, w) > max_resolution:
            scale = max_resolution / max(h, w)
            new_h, new_w = int(h * scale), int(w * scale)
            img_tensor = F.interpolate(
                img_tensor, size=(new_h, new_w), mode='bilinear', align_corners=False
            )
            
        processed_image = img_tensor.permute(0, 2, 3, 1).cpu()

        # 3. Format prompt with native multimodal placeholders if not present
        formatted_prompt = prompt
        if "<|image|>" not in formatted_prompt and processed_image.shape[0] == 1:
            formatted_prompt = "<|image|>\n" + prompt
        elif "<|video|>" not in formatted_prompt and processed_image.shape[0] > 1:
            formatted_prompt = "<|video|>\n" + prompt

        # 4. Tokenize using the shared text_encoder clip model
        tokens = clip.tokenize(formatted_prompt)
        
        # 5. Inject image/video tensor into the token payload structure expected by ComfyUI backend
        if isinstance(tokens, dict):
            if processed_image.shape[0] > 1:
                tokens["video"] = processed_image
            else:
                tokens["image"] = processed_image
        
        try:
            # Load the model weights from text_encoders into GPU VRAM
            mm.load_models_gpu([clip.patcher])
            
            # 6. Execute native generation matching ComfyUI's internal call signature
            with torch.inference_mode():
                result = clip.generate(
                    tokens,
                    max_length=max_new_tokens,
                    temperature=temperature,
                    do_sample=(temperature > 0.0),
                    seed=0
                )
            
            # 7. Safely decode token IDs back into readable text string
            if isinstance(result, tuple) and len(result) > 0:
                generated_ids = result[0]
            else:
                generated_ids = result
                
            if isinstance(generated_ids, (list, tuple)) and len(generated_ids) > 0 and isinstance(generated_ids[0], (list, tuple, torch.Tensor)):
                generated_ids = generated_ids[0]
                
            if hasattr(clip.tokenizer, "decode"):
                decoded_text = clip.tokenizer.decode(generated_ids)
            elif hasattr(clip.tokenizer, "tokenizer") and hasattr(clip.tokenizer.tokenizer, "decode"):
                decoded_text = clip.tokenizer.tokenizer.decode(generated_ids, skip_special_tokens=True)
            else:
                decoded_text = str(generated_ids)

            return (str(decoded_text).strip(),)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            return (f"Error during native generation: {str(e)}",)