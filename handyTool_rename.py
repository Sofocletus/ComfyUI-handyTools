import shutil
from pathlib import Path

class HandyToolRename:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "folder_path": ("STRING", {"default": "", "multiline": False}),
                "new_name": ("STRING", {"default": "example", "multiline": False}),
                "digits": ("INT", {"default": 3, "min": 1, "max": 10, "step": 1}),
                "save_to_same_folder": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "output_folder": ("STRING", {"default": "", "multiline": False}),
            }
        }

    # We return a string status so the node can easily connect to a text display node if desired.
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("status",)
    FUNCTION = "rename_files"
    CATEGORY = "HandyTools/File Management"
    
    # Ensures the node will execute even if its output isn't connected to anything else.
    OUTPUT_NODE = True 

    # Note: ComfyUI passes arguments by matching the dictionary keys in INPUT_TYPES
    def rename_files(self, folder_path, new_name, digits, save_to_same_folder, output_folder=""):
        src_dir = Path(folder_path)

        if not folder_path or not src_dir.exists() or not src_dir.is_dir():
            print(f"[HandyTool Rename] Error: Invalid source folder path '{folder_path}'")
            return (f"Error: Invalid folder path '{folder_path}'",)

        if save_to_same_folder:
            dest_dir = src_dir
        else:
            if not output_folder:
                print("[HandyTool Rename] Error: Output folder must be specified when 'save_to_same_folder' is OFF.")
                return ("Error: Output folder required.",)
            
            dest_dir = Path(output_folder)
            dest_dir.mkdir(parents=True, exist_ok=True)

        # 1. Group files by stem (the filename without its extension)
        files_by_stem = {}
        for f in src_dir.iterdir():
            if f.is_file():
                stem = f.stem
                if stem not in files_by_stem:
                    files_by_stem[stem] = []
                files_by_stem[stem].append(f)

        # 2. Sort stems to maintain deterministic pairing and alphabetical numbering
        sorted_stems = sorted(files_by_stem.keys())

        # 3. Process the files
        counter = 1
        for stem in sorted_stems:
            # All files sharing the same stem get the same counter number
            for file_path in files_by_stem[stem]:
                ext = file_path.suffix
                
                # Dynamic zero-padding based on the 'digits' input
                new_file_name = f"{new_name}_{counter:0{digits}d}{ext}"
                new_file_path = dest_dir / new_file_name

                # Prevent error if the generated name is identical to the current name
                if file_path == new_file_path:
                    continue

                try:
                    if save_to_same_folder:
                        # Rename in place
                        file_path.rename(new_file_path)
                    else:
                        # Copy to the new directory to preserve the original
                        shutil.copy2(file_path, new_file_path)
                except Exception as e:
                    print(f"[HandyTool Rename] Error processing {file_path.name}: {e}")

            counter += 1

        success_msg = f"Successfully processed {len(sorted_stems)} file groups."
        print(f"[HandyTool Rename] {success_msg}")
        
        return (success_msg,)

# Node mappings required for ComfyUI to register the node
NODE_CLASS_MAPPINGS = {
    "HandyToolRename": HandyToolRename
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HandyToolRename": "HandyTool Rename"
}