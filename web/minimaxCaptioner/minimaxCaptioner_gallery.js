import * as Icons from "./minimaxCaptioner_icons.js";

export class CaptionerGallery {
    constructor(ctx) {
        this.ctx = ctx;

        this.folderBar = document.createElement("div");
        this.folderBar.style.cssText = "display:flex; width:100%; gap:8px; align-items:center; height:30px;";

        this.folderInput = document.createElement("input");
        this.folderInput.className = "vc-input";
        this.folderInput.placeholder = "Enter folder path (leave empty for root)";
        this.folderInput.style.flex = "1";
        this.folderInput.addEventListener("keypress", (e) => { if (e.key === "Enter") this.loadFolderVideos(); });

        this.refreshBtn = document.createElement("button");
        this.refreshBtn.className = "vc-btn vc-btn-subtle";
        this.refreshBtn.innerHTML = `${Icons.ICON_REFRESH} Scan Folder`;
        this.refreshBtn.style.width = "130px";
        this.refreshBtn.onclick = () => this.loadFolderVideos();

        this.toggleHideBtn = document.createElement("button");
        this.toggleHideBtn.className = "vc-btn vc-btn-subtle";
        this.toggleHideBtn.innerText = "👁️ Hide Captioned";
        this.toggleHideBtn.style.width = "140px";
        this.toggleHideBtn.onclick = () => this.toggleHide();

        this.folderBar.append(this.folderInput, this.refreshBtn, this.toggleHideBtn);

        this.galleryStrip = document.createElement("div");
        this.galleryStrip.className = "vc-gallery-strip";
        this.galleryStrip.innerHTML = "<span style='color:#777; margin:auto; font-size:12px;'>Enter folder path and click Scan</span>";
    }

    toggleHide() {
        this.ctx.state.hideCaptioned = !this.ctx.state.hideCaptioned;
        this.toggleHideBtn.innerText = this.ctx.state.hideCaptioned ? "👁️ Show All" : "👁️ Hide Captioned";
        this.updateGalleryVisibility();
        this.ctx.methods.saveUIState(); // Persist UI toggle
    }

    updateGalleryVisibility() {
        Array.from(this.galleryStrip.children).forEach(thumb => {
            if (thumb.tagName !== 'DIV') return;
            thumb.style.display = (this.ctx.state.hideCaptioned && thumb.classList.contains('has-state')) ? "none" : "";
        });
    }

    async loadFolderVideos() {
        this.ctx.state.currentDir = this.folderInput.value ? this.folderInput.value.trim() : "";
        this.galleryStrip.innerHTML = "<span style='color:#aaa; margin:auto; font-size:12px;'>Scanning folder...</span>";

        try {
            const response = await this.ctx.api.fetchApi(`/handyTools/video_list?dir=${encodeURIComponent(this.ctx.state.currentDir)}`);
            const data = await response.json();

            this.galleryStrip.innerHTML = "";
            if (!data.videos || data.videos.length === 0) {
                this.galleryStrip.innerHTML = "<span style='color:#ff6666; margin:auto; font-size:12px;'>No supported videos found.</span>";
                return;
            }

            data.videos.forEach((vidFile) => {
                const thumbWrapper = document.createElement("div");
                thumbWrapper.className = "vc-gallery-thumb";
                thumbWrapper.dataset.filename = vidFile;

                const thumbVid = document.createElement("video");
                const relativePath = this.ctx.state.currentDir ? `${this.ctx.state.currentDir}/${vidFile}` : vidFile;
                thumbVid.src = this.ctx.api.apiURL(`/handyTools/serve_video?path=${encodeURIComponent(relativePath)}`);
                thumbVid.style.cssText = "width:100%; height:100%; object-fit:cover;";
                thumbVid.muted = true;

                const label = document.createElement("div");
                label.className = "vc-gallery-filename";
                label.innerText = vidFile;

                thumbWrapper.onmouseenter = () => thumbVid.play();
                thumbWrapper.onmouseleave = () => { thumbVid.pause(); thumbVid.currentTime = 0; };

                thumbWrapper.onclick = () => {
                    if (this.ctx.state.hasUnsavedChanges && !confirm("You have unsaved changes. Switch videos without saving?")) return;
                    Array.from(this.galleryStrip.children).forEach(c => c.classList.remove("active"));
                    thumbWrapper.classList.add("active");
                    this.ctx.methods.selectVideo(vidFile);
                };

                thumbWrapper.append(thumbVid, label);
                this.galleryStrip.appendChild(thumbWrapper);

                this.ctx.api.fetchApi(`/handyTools/load_caption_state?dir=${encodeURIComponent(this.ctx.state.currentDir)}&filename=${encodeURIComponent(vidFile)}`)
                    .then(res => res.json())
                    .then(checkJson => {
                        if (checkJson.status === "success") {
                            thumbWrapper.classList.add("has-state");
                            if (this.ctx.state.hideCaptioned) thumbWrapper.style.display = "none";
                        }
                    }).catch(e => {});
            });

            // RESTORE LOGIC: Select the previously saved file if it exists, otherwise default to the first one
            let fileToSelect = data.videos[0];
            if (this.ctx.state.currentFile && data.videos.includes(this.ctx.state.currentFile)) {
                fileToSelect = this.ctx.state.currentFile;
            }

            const targetThumb = Array.from(this.galleryStrip.children).find(c => c.dataset.filename === fileToSelect);
            if (targetThumb) targetThumb.classList.add("active");
            
            this.ctx.methods.selectVideo(fileToSelect);

            // Persist the active folder in UI state
            this.ctx.methods.saveUIState();

        } catch (err) {
            this.galleryStrip.innerHTML = "<span style='color:#ff6666; margin:auto; font-size:12px;'>Error scanning.</span>";
        }
    }

    markThumbnailSaved(filename) {
        Array.from(this.galleryStrip.children).forEach(thumb => {
            if (thumb.dataset.filename === filename) {
                thumb.classList.add("has-state");
                if (this.ctx.state.hideCaptioned) thumb.style.display = "none";
            }
        });
    }
}