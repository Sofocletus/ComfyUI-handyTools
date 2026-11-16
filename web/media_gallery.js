export class MediaGallery {
    constructor(container, stateManager, compositor) {
        this.stateManager = stateManager;
        this.compositor = compositor;
        this.renderedThumbs = new Set();
        
        this._buildUI(container);
        this._setupDragAndDrop();
        
        this.stateManager.subscribe((state, event) => {
            if (event === 'NEW_PROJECT') {
                this.thumbStrip.innerHTML = "";
                this.renderedThumbs.clear();
                this._checkEmptyState();
            } else if (event === 'GALLERY_UPDATE') {
                this._updateSidebar();
            }
            this._syncGalleryFromState(state);
        });
        
        this._updateSidebar();
    }

    _buildUI(container) {
        this.containerWrapper = document.createElement("div");
        this.containerWrapper.style.cssText = "display: flex; width: 100%; height: 135px; background: #111; border-top: 1px solid #444;";

        // --- NEW: Left Sidebar Controls ---
        this.sidebar = document.createElement("div");
        this.sidebar.style.cssText = "flex: 0 0 160px; padding: 10px; display: flex; flex-direction: column; gap: 8px; border-right: 1px solid #333; background: #151515; box-sizing: border-box;";
        
        this.modeBtn = document.createElement("button");
        this.modeBtn.style.cssText = "background: #333; color: white; border: 1px solid #555; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; transition: background 0.2s;";
        this.modeBtn.onmouseover = () => this.modeBtn.style.background = "#555";
        this.modeBtn.onmouseout = () => this.modeBtn.style.background = "#333";
        
        this.pathGroup = document.createElement("div");
        this.pathGroup.style.cssText = "display: flex; flex-direction: column; gap: 5px;";
        
        this.pathInput = document.createElement("input");
        this.pathInput.type = "text";
        this.pathInput.placeholder = "Paste folder path...";
        this.pathInput.style.cssText = "background: #111; color: #82deff; border: 1px solid #444; border-radius: 4px; padding: 6px; font-size: 10px; box-sizing: border-box;";
        
        this.loadFolderBtn = document.createElement("button");
        this.loadFolderBtn.innerText = "Load Folder";
        this.loadFolderBtn.style.cssText = "background: #2196F3; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;";
        
        this.pathGroup.appendChild(this.pathInput);
        this.pathGroup.appendChild(this.loadFolderBtn);
        
        this.sidebar.appendChild(this.modeBtn);
        this.sidebar.appendChild(this.pathGroup);
        
        // --- Gallery Area ---
        this.galleryWrapper = document.createElement("div");
        this.galleryWrapper.style.cssText = "flex: 1; position: relative; display: flex; padding: 10px; box-sizing: border-box; transition: background 0.2s; overflow: hidden;";

        this.placeholder = document.createElement("div");
        this.placeholder.style.cssText = "position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #555; border-radius: 6px; color: #888; font-size: 13px; text-align: center; pointer-events: none; z-index: 2;";

        this.thumbStrip = document.createElement("div");
        this.thumbStrip.style.cssText = "display: flex; gap: 10px; width: 100%; height: 100%; overflow-x: auto; z-index: 1;";

        this.galleryWrapper.appendChild(this.placeholder);
        this.galleryWrapper.appendChild(this.thumbStrip);
        
        this.containerWrapper.appendChild(this.sidebar);
        this.containerWrapper.appendChild(this.galleryWrapper);
        container.appendChild(this.containerWrapper);

        // --- Event Listeners ---
        this.modeBtn.onclick = () => {
            const current = this.stateManager.getState().galleryMode || "drag";
            this.stateManager.setGalleryMode(current === "drag" ? "folder" : "drag");
        };

        this.loadFolderBtn.onclick = () => this._loadFolder(this.pathInput.value);
        this.pathInput.onchange = (e) => this.stateManager.setGalleryFolder(e.target.value);
    }

    _updateSidebar() {
        const state = this.stateManager.getState();
        const mode = state.galleryMode || "drag";
        
        const svgFolder = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
        
        if (mode === "drag") {
            this.modeBtn.innerHTML = `Mode: Drag & Drop`;
            this.pathGroup.style.display = "none";
        } else {
            this.modeBtn.innerHTML = `${svgFolder} Mode: Folder`;
            this.pathGroup.style.display = "flex";
            this.pathInput.value = state.galleryFolder || "";
        }
        this._checkEmptyState();
    }

    async _loadFolder(path) {
        if (!path) return;
        this.thumbStrip.innerHTML = "";
        this.renderedThumbs.clear();
        this.placeholder.style.display = "flex";
        this.placeholder.innerHTML = `Scanning folder...`;
        
        try {
            const res = await fetch("/handytools/list_folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: path })
            });
            const data = await res.json();
            
            if (data.status === "success") {
                if (data.files.length === 0) {
                    alert("No supported media files found in this folder.");
                } else {
                    data.files.forEach(absolutePath => {
                        const ext = absolutePath.split('.').pop().toLowerCase();
                        let mime = "video/mp4";
                        if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) mime = "audio/mpeg";
                        else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) mime = "image/png";
                        
                        this._createThumbnail(absolutePath, mime);
                    });
                }
            } else {
                alert(data.message);
            }
        } catch(e) {
            console.error("[HandyTools] Error loading folder", e);
            alert("Error loading folder");
        }
        this._checkEmptyState();
    }

    _setupDragAndDrop() {
        const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

        this.galleryWrapper.addEventListener("dragenter", (e) => {
            prevent(e);
            if (this.stateManager.getState().galleryMode !== "drag") return;
            this.placeholder.style.borderColor = "#2196F3";
            this.placeholder.style.color = "#2196F3";
            this.galleryWrapper.style.background = "#1a2a3a";
        });

        this.galleryWrapper.addEventListener("dragover", prevent);

        this.galleryWrapper.addEventListener("dragleave", (e) => {
            prevent(e);
            if (this.stateManager.getState().galleryMode !== "drag") return;
            this.placeholder.style.borderColor = "#555";
            this.placeholder.style.color = "#888";
            this.galleryWrapper.style.background = "#111";
        });

        this.galleryWrapper.addEventListener("drop", (e) => {
            prevent(e);
            
            if (this.stateManager.getState().galleryMode !== "drag") {
                alert("Please switch to Drag & Drop mode to upload files.");
                return;
            }
            
            this.placeholder.style.borderColor = "#555";
            this.placeholder.style.color = "#888";
            this.galleryWrapper.style.background = "#111";

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(file => {
                    const t = file.type;
                    if (t.startsWith("video/") || t.startsWith("image/") || t.startsWith("audio/")) {
                        this._uploadFile(file, t);
                    } else {
                        console.warn("[HandyTools] Unsupported file type:", t);
                    }
                });
            }
        });
    }

    _syncGalleryFromState(state) {
        if (!state.clips) return;
        const uniqueFiles = new Set(state.clips.map(c => c.filename));
        
        uniqueFiles.forEach(filename => {
            if (!this.renderedThumbs.has(filename)) {
                const ext = filename.split('.').pop().toLowerCase();
                let mime = "video/mp4";
                if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
                    mime = "audio/mpeg";
                } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
                    mime = "image/png";
                }
                this._createThumbnail(filename, mime);
            }
        });
    }

    async _uploadFile(file, mimeType) {
        this.placeholder.style.display = "flex";
        this.placeholder.innerHTML = `Uploading ${file.name}...`;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/handytools/upload_media", { method: "POST", body: formData });
            const data = await response.json();

            if (data.status === "success") {
                if (!this.renderedThumbs.has(data.filename)) {
                    this._createThumbnail(data.filename, mimeType);
                } else {
                    this._checkEmptyState();
                }
            } else {
                throw new Error(data.message || "Upload failed");
            }
        } catch (error) {
            console.error("[HandyTools] File upload error:", error);
            this.placeholder.innerText = "Upload failed.";
            setTimeout(() => this._checkEmptyState(), 3000);
        }
    }

    _createThumbnail(filename, mimeType) {
        this.renderedThumbs.add(filename);
        
        const isAudioOnly = mimeType.startsWith("audio/");
        const isImage = mimeType.startsWith("image/");
        
        const svgTrash = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        const svgAudio = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style="margin-bottom: 5px;"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        const svgAdd = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;

        const fileColors = this.stateManager.getColorForFile(filename);

        const thumbWrapper = document.createElement("div");
        thumbWrapper.title = filename; 
        
        thumbWrapper.style.cssText = `
            min-width: 140px; height: 100%; 
            background: ${fileColors.bg}; 
            border: 3px solid ${fileColors.border};
            border-radius: 4px; position: relative; cursor: pointer; overflow: hidden;
            display: flex; flex-direction: column; flex-shrink: 0; box-sizing: border-box;
        `;

        // --- FIX: Gallery now uses the new media endpoint for absolute paths ---
        const mediaSrc = `/handytools/media?path=${encodeURIComponent(filename)}`;
        let mediaEl;

        if (isImage) {
            mediaEl = document.createElement("img");
            mediaEl.src = mediaSrc;
            mediaEl.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
            thumbWrapper.appendChild(mediaEl);
        } else {
            mediaEl = document.createElement("video");
            mediaEl.src = mediaSrc;
            mediaEl.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
            mediaEl.muted = true;
            if (!isAudioOnly) {
                thumbWrapper.appendChild(mediaEl);
            }
        }
        
        let audioCheckbox = null;

        if (isAudioOnly) {
            const displayLabel = filename.split(/[\\/]/).pop(); // Just show the file name, not the massive path
            const audioIcon = document.createElement("div");
            audioIcon.innerHTML = `${svgAudio}<br><span style="font-size:10px; word-break:break-all;">${displayLabel}</span>`;
            audioIcon.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); color:#8df; text-align:center; padding:10px; box-sizing:border-box;";
            thumbWrapper.appendChild(audioIcon);
        } else if (!isImage) {
            const cbWrapper = document.createElement("div");
            cbWrapper.style.cssText = "position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.7); padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; z-index: 5;";
            
            audioCheckbox = document.createElement("input");
            audioCheckbox.type = "checkbox";
            audioCheckbox.style.cursor = "pointer";
            audioCheckbox.onclick = (e) => e.stopPropagation();
            
            const cbLabel = document.createElement("span");
            cbLabel.innerText = "As Audio";
            cbLabel.style.cssText = "color: white; font-size: 10px;";
            
            cbWrapper.appendChild(audioCheckbox);
            cbWrapper.appendChild(cbLabel);
            thumbWrapper.appendChild(cbWrapper);
        }

        const trashBtn = document.createElement("button");
        trashBtn.innerHTML = svgTrash;
        trashBtn.style.cssText = `
            position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); 
            color: white; border: none; border-radius: 4px; cursor: pointer; 
            padding: 4px; z-index: 6; transition: background 0.2s; display: flex; align-items: center; justify-content: center;
        `;
        trashBtn.onmouseover = () => trashBtn.style.background = "#d32f2f";
        trashBtn.onmouseout = () => trashBtn.style.background = "rgba(0,0,0,0.7)";
        
        trashBtn.onclick = (e) => {
            e.stopPropagation(); 
            this.thumbStrip.removeChild(thumbWrapper);
            this.renderedThumbs.delete(filename);
            this._checkEmptyState();
        };
        thumbWrapper.appendChild(trashBtn);

        const addLabel = document.createElement("div");
        addLabel.innerHTML = `${svgAdd} Add to Timeline`;
        addLabel.style.cssText = `
            position: absolute; bottom: 0; width: 100%; background: rgba(33, 150, 243, 0.9);
            color: white; font-size: 10px; text-align: center; padding: 5px 0; font-weight: bold;
            opacity: 0; transition: opacity 0.2s; z-index: 4; display: flex; align-items: center; justify-content: center;
        `;

        thumbWrapper.addEventListener("mouseenter", () => {
            if (!isImage && !isAudioOnly && mediaEl.readyState >= 2) mediaEl.play().catch(() => {}); 
            addLabel.style.opacity = "1";
        });
        
        thumbWrapper.addEventListener("mouseleave", () => {
            if (!isImage && !isAudioOnly) { mediaEl.pause(); mediaEl.currentTime = 0; }
            addLabel.style.opacity = "0";
        });

        thumbWrapper.addEventListener("click", () => {
            let vW = 0, vH = 0, sourceDuration = 5.0;
            if (isImage) {
                vW = mediaEl.naturalWidth || this.stateManager.getState().resolution[0];
                vH = mediaEl.naturalHeight || this.stateManager.getState().resolution[1];
            } else {
                vW = mediaEl.videoWidth || this.stateManager.getState().resolution[0];
                vH = mediaEl.videoHeight || this.stateManager.getState().resolution[1];
                sourceDuration = isNaN(mediaEl.duration) ? 5.0 : mediaEl.duration;
            }
            
            const loadAsAudio = isAudioOnly || (audioCheckbox && audioCheckbox.checked);
            this._addToTimeline(filename, sourceDuration, vW, vH, loadAsAudio);
            
            if (audioCheckbox) audioCheckbox.checked = false; 
        });

        thumbWrapper.appendChild(addLabel);
        this.thumbStrip.appendChild(thumbWrapper);
        this._checkEmptyState();
    }
    
    _checkEmptyState() {
        const state = this.stateManager.getState();
        const mode = state.galleryMode || "drag";
        
        if (this.thumbStrip.children.length > 0) {
            this.placeholder.style.display = "none";
        } else {
            this.placeholder.style.display = "flex";
            if (mode === "drag") {
                this.placeholder.innerHTML = `<div>Drag & Drop Video, Image, or Audio Files Here</div><div style="font-size: 11px; color: #666;">Files will be copied to the ComfyUI input folder</div>`;
            } else {
                this.placeholder.innerHTML = `<div>Select folder containing media</div>`;
            }
        }
    }

    _addToTimeline(filename, sourceDuration, vW, vH, isAudioTrack) {
        const insertTime = this.compositor ? this.compositor.currentTime : 0;
        
        let clipLength = sourceDuration;
        if (isNaN(clipLength) || clipLength === Infinity || clipLength <= 0) clipLength = 5.0;
        
        const targetTrack = isAudioTrack ? 1 : 0;

        this.stateManager.addClip({
            filename: filename,
            track: targetTrack, 
            muted: false,
            timeline_start: insertTime,
            timeline_end: insertTime + clipLength,
            source_in: 0.0,
            source_out: clipLength,
            crop: { x: 0, y: 0, w: vW, h: vH, scale: 1.0 }
        });
    }
}