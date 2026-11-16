import { api } from "../../../scripts/api.js";

export class ViewerManager {
    constructor(container, datasetState, loadBtn, showPrompt) {
        this.container = container;
        this.datasetState = datasetState;
        this.loadBtn = loadBtn;
        this.showPrompt = showPrompt;

        // Elements
        this.viewer = container.querySelector('#ht-viewer');
        this.imgContainer = container.querySelector('#ht-img-container');
        this.mainImg = container.querySelector('#ht-main-img');
        this.cropBox = container.querySelector('#ht-crop-box');
        this.cropInfo = container.querySelector('.ht-crop-info');
        this.noImgTxt = container.querySelector('#ht-no-image-text');
        
        // Toolbar
        this.nameEl = container.querySelector('#ht-viewer-name');
        this.dimsEl = container.querySelector('#ht-viewer-dims');
        this.btnUseOrig = container.querySelector('#ht-btn-use-orig');
        
        // AI Edit Menu
        this.btnAiEdit = container.querySelector('#ht-btn-ai-edit');
        this.aiEditMenu = container.querySelector('#ht-aiedit-menu');
        this.aiWorkflowSelect = container.querySelector('#ht-aiedit-workflow');
        this.aiPromptInput = container.querySelector('#ht-aiedit-prompt');
        this.btnAiRun = container.querySelector('#ht-aiedit-run-btn');
        
        // Custom Resize Menu
        this.btnCustomResize = container.querySelector('#ht-btn-resize-tool');
        this.resizeMenu = container.querySelector('#ht-resize-menu');
        this.resizeW = container.querySelector('#ht-resize-w');
        this.resizeH = container.querySelector('#ht-resize-h');
        this.resizeLink = container.querySelector('#ht-resize-link');
        this.resizeApplyBtn = container.querySelector('#ht-resize-apply-btn');

        this.btnCrop = container.querySelector('#ht-btn-crop-tool');
        this.btnResize = container.querySelector('#ht-btn-viewer-resize');
        this.btnZoomFit = container.querySelector('#ht-btn-zoom-fit');
        this.btnZoom100 = container.querySelector('#ht-btn-zoom-100');
        
        // Unsaved Edit Tools
        this.btnSave = container.querySelector('#ht-btn-viewer-save');
        this.btnDiscard = container.querySelector('#ht-btn-viewer-discard');
        
        this.snapCheck = container.querySelector('#ht-crop-snap-check');
        
        // Crop Actions
        this.btnCropAccept = container.querySelector('#ht-crop-accept');
        this.btnCropCancel = container.querySelector('#ht-crop-cancel');

        // Edit Overlay
        this.viewerOverlay = container.querySelector('#ht-viewer-overlay');
        this.editLoading = container.querySelector('#ht-edit-loading');
        this.editPreview = container.querySelector('#ht-edit-preview');

        // State
        this.panX = 0;
        this.panY = 0;
        this.scale = 1;
        
        this.isCropMode = false;
        this.cropState = { x: 0, y: 0, w: 0, h: 0 }; 

        this.aspectRatioLocked = true;
        this.originalRatio = 1;

        // Drag tracking
        this.isDragging = false;
        this.dragAction = null; 
        this.dragStart = { cx: 0, cy: 0, ix: 0, iy: 0, origCrop: null, px: 0, py: 0 };

        this.initEvents();
        this.fetchWorkflows();
    }

    async fetchWorkflows() {
        try {
            const res = await fetch('/handytools/captioner/get_workflows');
            const data = await res.json();
            this.aiWorkflowSelect.innerHTML = '';
            if (data.workflows && data.workflows.length > 0) {
                data.workflows.forEach(wf => {
                    const opt = document.createElement('option');
                    opt.value = wf.file;
                    opt.textContent = wf.name;
                    this.aiWorkflowSelect.appendChild(opt);
                });
            } else {
                this.aiWorkflowSelect.innerHTML = '<option value="">No workflows found</option>';
            }
        } catch(e) { console.error("Failed to load workflows:", e); }
    }

    getViewerMouse(e) {
        const vRect = this.viewer.getBoundingClientRect();
        const comfyScale = (this.viewer.offsetWidth > 0) ? (vRect.width / this.viewer.offsetWidth) : 1;
        return {
            vx: (e.clientX - vRect.left) / comfyScale,
            vy: (e.clientY - vRect.top) / comfyScale
        };
    }

    setUnsavedState(isUnsaved, width = null, height = null) {
        this.btnSave.disabled = !isUnsaved;
        this.btnDiscard.disabled = !isUnsaved;

        if (isUnsaved) {
            this.btnSave.classList.add('ht-unsaved-btn');
            if (width && height) {
                this.dimsEl.textContent = `${width} × ${height} (Unsaved Edit)`;
            } else {
                this.dimsEl.textContent = `(Unsaved Edit)`;
            }
        } else {
            this.btnSave.classList.remove('ht-unsaved-btn');
        }
    }

    updateViewerState(file) {
        if (!file) return;

        const isGenerating = this.datasetState.generatingEdits.has(file.filename);
        
        if (isGenerating) {
            this.setUnsavedState(false);
            this.viewerOverlay.classList.remove('ht-hidden', 'bg-transparent');
            this.viewerOverlay.classList.add('bg-dim');
            this.editLoading.classList.remove('ht-hidden');
            this.editPreview.style.display = 'none';
            this.loadImage(file, false); 
            
        } else if (file.has_temp) {
            this.setUnsavedState(true);
            this.viewerOverlay.classList.add('ht-hidden');
            this.editLoading.classList.add('ht-hidden');
            this.loadImage(file, true); 
            
        } else {
            this.setUnsavedState(false);
            this.viewerOverlay.classList.add('ht-hidden');
            this.editLoading.classList.add('ht-hidden');
            this.loadImage(file, false);
        }
    }

    initEvents() {
        this.viewer.addEventListener('viewer-load-image', (e) => {
            const file = e.detail.file;
            this.updateViewerState(file);
        });

        this.btnDiscard.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            try {
                await fetch('/handytools/captioner/discard_edit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder, filename: this.datasetState.currentFile })
                });
                
                const file = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                if (file) {
                    file.has_temp = false;
                    this.updateViewerState(file);
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
            } catch(e) { console.error(e); }
        });
        
        this.btnSave.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            const prevText = this.btnSave.innerHTML;
            this.btnSave.innerHTML = "Saving...";
            try {
                const res = await fetch('/handytools/captioner/commit_edit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder, filename: this.datasetState.currentFile })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                
                const file = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                if (file) file.has_temp = false;
                
                this.loadBtn.click(); 
            } catch(e) { console.error(e); }
            finally { this.btnSave.innerHTML = prevText; }
        });

        this.btnAiEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            this.resizeMenu.classList.add('ht-hidden');
            this.btnCustomResize.classList.remove('active');
            
            const isHidden = this.aiEditMenu.classList.contains('ht-hidden');
            this.aiEditMenu.classList.toggle('ht-hidden', !isHidden);
            this.btnAiEdit.classList.toggle('active', isHidden);
            if (isHidden) this.fetchWorkflows(); 
        });
        
        this.btnCustomResize.addEventListener('click', (e) => {
            e.stopPropagation();
            this.aiEditMenu.classList.add('ht-hidden');
            this.btnAiEdit.classList.remove('active');
            
            const isHidden = this.resizeMenu.classList.contains('ht-hidden');
            this.resizeMenu.classList.toggle('ht-hidden', !isHidden);
            this.btnCustomResize.classList.toggle('active', isHidden);
            
            if (isHidden && this.mainImg.naturalWidth) {
                this.resizeW.value = this.mainImg.naturalWidth;
                this.resizeH.value = this.mainImg.naturalHeight;
                this.originalRatio = this.mainImg.naturalWidth / this.mainImg.naturalHeight;
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!this.btnAiEdit.contains(e.target) && !this.aiEditMenu.contains(e.target)) {
                this.aiEditMenu.classList.add('ht-hidden');
                this.btnAiEdit.classList.remove('active');
            }
            if (!this.btnCustomResize.contains(e.target) && !this.resizeMenu.contains(e.target)) {
                this.resizeMenu.classList.add('ht-hidden');
                this.btnCustomResize.classList.remove('active');
            }
        });

        this.btnAiRun.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            const wf = this.aiWorkflowSelect.value;
            if (!wf) { await this.showPrompt("No valid workflow selected.", true); return; }

            const prompt = this.aiPromptInput.value.trim();
            const currentFileName = this.datasetState.currentFile;
            
            this.aiEditMenu.classList.add('ht-hidden');
            this.btnAiEdit.classList.remove('active');
            
            this.datasetState.generatingEdits.add(currentFileName);
            const file = this.datasetState.files.find(f => f.filename === currentFileName);
            if (file) this.updateViewerState(file);
            
            this.container.dispatchEvent(new CustomEvent('refresh-gallery'));

            try {
                const response = await fetch('/handytools/captioner/run_ai_edit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: this.datasetState.currentFolder,
                        filename: currentFileName,
                        prompt: prompt,
                        workflow: wf,
                        use_original: this.btnUseOrig.classList.contains('active')
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                
            } catch (err) { 
                console.error(err); 
                this.datasetState.generatingEdits.delete(currentFileName);
                if (this.datasetState.currentFile === currentFileName && file) {
                    this.updateViewerState(file);
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
                await this.showPrompt("AI Edit generation failed.", true);
            }
        });

        this.resizeLink.addEventListener('click', () => {
            this.aspectRatioLocked = !this.aspectRatioLocked;
            this.resizeLink.classList.toggle('active', this.aspectRatioLocked);
            if (this.aspectRatioLocked) {
                this.originalRatio = parseFloat(this.resizeW.value) / parseFloat(this.resizeH.value) || 1;
            }
        });
        
        this.resizeW.addEventListener('input', () => {
            if (this.aspectRatioLocked) {
                this.resizeH.value = Math.round(this.resizeW.value / this.originalRatio);
            }
        });
        
        this.resizeH.addEventListener('input', () => {
            if (this.aspectRatioLocked) {
                this.resizeW.value = Math.round(this.resizeH.value * this.originalRatio);
            }
        });
        
        this.resizeApplyBtn.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            const w = parseInt(this.resizeW.value);
            const h = parseInt(this.resizeH.value);
            if (!w || !h) return;
            
            const prevText = this.resizeApplyBtn.innerHTML;
            this.resizeApplyBtn.innerHTML = "Working...";
            
            try {
                const res = await fetch('/handytools/captioner/custom_resize', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: this.datasetState.currentFolder,
                        filename: this.datasetState.currentFile,
                        width: w, height: h,
                        use_original: this.btnUseOrig.classList.contains('active')
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                
                this.resizeMenu.classList.add('ht-hidden');
                this.btnCustomResize.classList.remove('active');
                
                const file = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                if (file) {
                    file.has_temp = true;
                    file.mtime = Date.now();
                    this.updateViewerState(file);
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
            } catch(e) { console.error(e); }
            finally { this.resizeApplyBtn.innerHTML = prevText; }
        });

        api.addEventListener("b64Preview", (e) => {
            if (this.datasetState.currentFile && this.datasetState.generatingEdits.has(this.datasetState.currentFile)) {
                this.editPreview.style.display = 'block';
                this.editPreview.src = e.detail;
            }
        });

        api.addEventListener("ht-image-edited", (e) => {
            const { folder, filename } = e.detail;
            if (folder === this.datasetState.currentFolder) {
                this.datasetState.generatingEdits.delete(filename);
                
                const file = this.datasetState.files.find(f => f.filename === filename);
                if (file) {
                    file.has_temp = true;
                    file.mtime = Date.now();
                    
                    if (this.datasetState.currentFile === filename) {
                        this.updateViewerState(file);
                    }
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
            }
        });

        api.addEventListener("status", (e) => {
            if (e.detail?.exec_info?.queue_remaining === 0 && this.datasetState.generatingEdits.size > 0) {
                this.datasetState.generatingEdits.forEach(filename => {
                    const file = this.datasetState.files.find(f => f.filename === filename);
                    if (file) {
                        file.has_temp = true; 
                        file.mtime = Date.now();
                    }
                });
                
                this.datasetState.generatingEdits.clear();
                
                if (this.datasetState.currentFile) {
                    const currentFile = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                    if (currentFile) this.updateViewerState(currentFile);
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
            }
        });

        this.btnZoomFit.addEventListener('click', () => this.zoomFit());
        
        this.btnZoom100.addEventListener('click', () => { 
            this.scale = 1; 
            const vWidth = this.viewer.clientWidth || 768;
            const vHeight = this.viewer.clientHeight || 724;
            
            this.panX = (vWidth - this.mainImg.naturalWidth) / 2;
            this.panY = (vHeight - this.mainImg.naturalHeight) / 2;
            this.updateTransform(); 
        });

        this.btnUseOrig.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            const prevText = this.btnUseOrig.innerHTML;
            this.btnUseOrig.innerHTML = "...";
            try {
                const res = await fetch('/handytools/captioner/preview_original', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder, filename: this.datasetState.currentFile })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                const file = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                if (file) {
                    file.has_temp = true;
                    file.mtime = Date.now();
                    this.updateViewerState(file);
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
            } catch(e) { console.error(e); }
            finally { this.btnUseOrig.innerHTML = prevText; }
        });
        
        this.btnCrop.addEventListener('click', () => {
            if (!this.datasetState.currentFile || this.datasetState.files.find(f => f.filename === this.datasetState.currentFile)?.is_missing) return;
            this.isCropMode = !this.isCropMode;
            this.btnCrop.classList.toggle('active', this.isCropMode);
            this.cropBox.style.display = this.isCropMode ? 'block' : 'none';
            if (this.isCropMode) {
                this.cropState = { x: 0, y: 0, w: this.mainImg.naturalWidth, h: this.mainImg.naturalHeight };
                this.renderCropBox();
            }
        });

        this.btnCropCancel.addEventListener('click', () => {
            this.isCropMode = false;
            this.btnCrop.classList.remove('active');
            this.cropBox.style.display = 'none';
        });

        this.btnCropAccept.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            
            try {
                const res = await fetch('/handytools/captioner/crop_image', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: this.datasetState.currentFolder,
                        filename: this.datasetState.currentFile,
                        x: this.cropState.x, y: this.cropState.y,
                        w: this.cropState.w, h: this.cropState.h,
                        use_original: this.btnUseOrig.classList.contains('active')
                    })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                
                this.isCropMode = false;
                this.btnCrop.classList.remove('active');
                this.cropBox.style.display = 'none';
                
                const file = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                if (file) {
                    file.has_temp = true;
                    file.mtime = Date.now();
                    this.updateViewerState(file);
                }
                this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
            } catch (err) { console.error(err); }
        });

        this.btnResize.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            const prevText = this.btnResize.innerHTML;
            this.btnResize.innerHTML = "...";
            try {
                const response = await fetch('/handytools/captioner/auto_resize', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        folder: this.datasetState.currentFolder, 
                        filename: this.datasetState.currentFile, 
                        scope: "current", 
                        use_original: this.btnUseOrig.classList.contains('active') 
                    })
                });
                const data = await response.json();
                
                if (data.success && data.new_dims) {
                    const file = this.datasetState.files.find(f => f.filename === this.datasetState.currentFile);
                    if (file) {
                        file.has_temp = true;
                        file.mtime = Date.now();
                        this.updateViewerState(file);
                    }
                    this.container.dispatchEvent(new CustomEvent('refresh-gallery'));
                }
            } catch (err) { console.error(err); } 
            finally { this.btnResize.innerHTML = prevText; }
        });

        this.viewer.addEventListener('wheel', (e) => {
            if (!this.datasetState.currentFile || this.imgContainer.style.display === 'none') return;
            e.preventDefault();
            
            const { vx, vy } = this.getViewerMouse(e);

            const zoomSpeed = 0.1;
            const newScale = e.deltaY < 0 ? this.scale + zoomSpeed : Math.max(0.1, this.scale - zoomSpeed);
            const scaleRatio = newScale / this.scale;
            
            this.panX = vx - (vx - this.panX) * scaleRatio;
            this.panY = vy - (vy - this.panY) * scaleRatio;
            this.scale = newScale;
            this.updateTransform();
        });

        this.viewer.addEventListener('mousedown', (e) => {
            if (!this.datasetState.currentFile || this.imgContainer.style.display === 'none') return;
            if (e.target.closest('.ht-crop-actions')) return; 

            e.preventDefault(); 
            const { vx, vy } = this.getViewerMouse(e);
            
            if (e.button === 1 || (!this.isCropMode || e.shiftKey || e.altKey)) {
                if (e.button !== 0 && e.button !== 1) return; 
                this.isDragging = true;
                this.dragAction = 'pan';
                this.dragStart = { vx: vx, vy: vy, px: this.panX, py: this.panY };
            } else if (e.button === 0) {
                this.isDragging = true;
                
                const ix = (vx - this.panX) / this.scale;
                const iy = (vy - this.panY) / this.scale;

                this.dragStart = { cx: e.clientX, cy: e.clientY, ix: ix, iy: iy, origCrop: { ...this.cropState }, px: this.panX, py: this.panY };

                if (e.target.classList.contains('ht-crop-handle')) {
                    this.dragAction = e.target.getAttribute('data-handle');
                } else if (e.target === this.cropBox || e.target.closest('#ht-crop-box')) {
                    this.dragAction = 'move';
                } else {
                    this.dragAction = 'draw';
                    this.cropState = { x: ix, y: iy, w: 0, h: 0 };
                    this.renderCropBox();
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();

            const { vx, vy } = this.getViewerMouse(e);

            if (this.dragAction === 'pan') {
                this.panX = this.dragStart.px + (vx - this.dragStart.vx);
                this.panY = this.dragStart.py + (vy - this.dragStart.vy);
                this.updateTransform();
                return;
            }

            const currentImgX = (vx - this.panX) / this.scale;
            const currentImgY = (vy - this.panY) / this.scale;
            
            let nx = this.dragStart.origCrop.x;
            let ny = this.dragStart.origCrop.y;
            let nw = this.dragStart.origCrop.w;
            let nh = this.dragStart.origCrop.h;
            
            const origR = nx + nw;
            const origB = ny + nh;

            if (this.dragAction === 'draw') {
                nx = Math.min(this.dragStart.ix, currentImgX);
                ny = Math.min(this.dragStart.iy, currentImgY);
                nw = Math.abs(currentImgX - this.dragStart.ix);
                nh = Math.abs(currentImgY - this.dragStart.iy);
            } else if (this.dragAction === 'move') {
                nx += (currentImgX - this.dragStart.ix);
                ny += (currentImgY - this.dragStart.iy);
            } else if (this.dragAction === 'se') {
                nw = currentImgX - nx;
                nh = currentImgY - ny;
            } else if (this.dragAction === 'nw') {
                nw = origR - currentImgX;
                nh = origB - currentImgY;
            } else if (this.dragAction === 'ne') {
                nw = currentImgX - nx;
                nh = origB - currentImgY;
            } else if (this.dragAction === 'sw') {
                nw = origR - currentImgX;
                nh = currentImgY - ny;
            }

            if (this.dragAction !== 'draw' && this.dragAction !== 'move' && this.dragAction !== 'pan') {
                if (nw < 10) nw = 10;
                if (nh < 10) nh = 10;
                
                if (this.snapCheck.checked) {
                    const snap = 32;
                    nw = Math.max(snap, Math.round(nw / snap) * snap);
                    nh = Math.max(snap, Math.round(nh / snap) * snap);
                }
                
                if (this.dragAction === 'nw') {
                    nx = origR - nw;
                    ny = origB - nh;
                } else if (this.dragAction === 'ne') {
                    ny = origB - nh;
                } else if (this.dragAction === 'sw') {
                    nx = origR - nw;
                }
                
            } else if (this.dragAction === 'draw' && this.snapCheck.checked) {
                const snap = 32;
                nw = Math.max(snap, Math.round(nw / snap) * snap);
                nh = Math.max(snap, Math.round(nh / snap) * snap);
                
                if (currentImgX < this.dragStart.ix) nx = this.dragStart.ix - nw;
                if (currentImgY < this.dragStart.iy) ny = this.dragStart.iy - nh;
            }

            const maxW = this.mainImg.naturalWidth;
            const maxH = this.mainImg.naturalHeight;
            
            if (nw < 10) nw = 10;
            if (nh < 10) nh = 10;
            
            if (nx < 0) { nx = 0; if (this.dragAction !== 'move' && this.dragAction !== 'draw') nw = origR; }
            if (ny < 0) { ny = 0; if (this.dragAction !== 'move' && this.dragAction !== 'draw') nh = origB; }
            
            if (nx + nw > maxW) {
                if (this.dragAction === 'move') nx = maxW - nw;
                else nw = maxW - nx;
            }
            if (ny + nh > maxH) {
                if (this.dragAction === 'move') ny = maxH - nh;
                else nh = maxH - ny;
            }

            this.cropState = { x: nx, y: ny, w: nw, h: nh };
            this.renderCropBox();
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging && this.dragAction === 'draw') {
                if (this.cropState.w < 10 || this.cropState.h < 10) {
                    this.cropState.w = Math.min(256, this.mainImg.naturalWidth);
                    this.cropState.h = Math.min(256, this.mainImg.naturalHeight);
                    
                    if (this.snapCheck.checked) {
                        const snap = 32;
                        this.cropState.w = Math.max(snap, Math.round(this.cropState.w / snap) * snap);
                        this.cropState.h = Math.max(snap, Math.round(this.cropState.h / snap) * snap);
                    }
                    this.renderCropBox();
                }
            }
            this.isDragging = false; 
            this.dragAction = null; 
        });
    }

    loadImage(file, asPreviewTemp = false) {
        this.isCropMode = false;
        this.btnCrop.classList.remove('active');
        this.cropBox.style.display = 'none';

        if (!asPreviewTemp) {
            this.btnUseOrig.disabled = !file.has_backup;
        }
        
        if (file.is_missing) {
            this.imgContainer.style.display = 'none';
            this.noImgTxt.style.display = 'block';
            this.noImgTxt.textContent = "Image File Missing";
            this.dimsEl.textContent = "Missing";
            this.nameEl.textContent = file.filename;
            
            this.viewer.dispatchEvent(new CustomEvent('image-changed'));
            return;
        }

        const folder = encodeURIComponent(this.datasetState.resolvedSourceFolder);
        const mtime = file.mtime || Date.now();
        let queryParams = `t=${mtime}`;
        
        if (asPreviewTemp) {
            queryParams += "&temp=true";
        }
        
        this.mainImg.onload = () => {
            this.imgContainer.style.width = this.mainImg.naturalWidth + 'px';
            this.imgContainer.style.height = this.mainImg.naturalHeight + 'px';
            this.imgContainer.style.display = 'block';
            this.noImgTxt.style.display = 'none';
            this.zoomFit();
            
            this.nameEl.textContent = file.filename;
            if (!this.hasUnsavedEdit) {
                this.dimsEl.textContent = `${this.mainImg.naturalWidth} × ${this.mainImg.naturalHeight}`;
            }

            this.viewer.dispatchEvent(new CustomEvent('image-changed'));
        };
        
        this.mainImg.src = `/handytools/captioner/get_image?folder=${folder}&filename=${encodeURIComponent(file.filename)}&${queryParams}`;
    }

    zoomFit() {
        const vWidth = this.viewer.clientWidth || 768; 
        const vHeight = this.viewer.clientHeight || 724; 
        
        const scaleX = vWidth / this.mainImg.naturalWidth;
        const scaleY = vHeight / this.mainImg.naturalHeight;
        
        this.scale = Math.min(scaleX, scaleY);
        this.panX = (vWidth - (this.mainImg.naturalWidth * this.scale)) / 2;
        this.panY = (vHeight - (this.mainImg.naturalHeight * this.scale)) / 2;
        this.updateTransform();
    }

    updateTransform() {
        this.imgContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        
        // Output the zoom scale into CSS so the UI overlays can perfectly counter-scale themselves 
        this.imgContainer.style.setProperty('--viewer-zoom', this.scale);
        
        // Dynamically thin out the crop box border so it stays exactly 1px thick on the screen
        this.cropBox.style.borderWidth = `${1 / this.scale}px`;
    }

    renderCropBox() {
        this.cropBox.style.left = `${this.cropState.x}px`;
        this.cropBox.style.top = `${this.cropState.y}px`;
        this.cropBox.style.width = `${this.cropState.w}px`;
        this.cropBox.style.height = `${this.cropState.h}px`;

        const rw = Math.round(this.cropState.w);
        const rh = Math.round(this.cropState.h);
        
        const ratios = [
            { label: '16:9', val: 16/9 }, { label: '9:16', val: 9/16 },
            { label: '4:3', val: 4/3 }, { label: '3:4', val: 3/4 },
            { label: '2:1', val: 2/1 }, { label: '1:2', val: 1/2 },
            { label: '3:2', val: 3/2 }, { label: '2:3', val: 2/3 }
        ];
        
        let arStr = "";
        let matchType = "none";
        
        if (rw === rh && rw > 0) {
            arStr = " [1:1]";
            matchType = "perfect";
        } else {
            const currentRatio = rw / rh;
            for (let r of ratios) {
                const diff = Math.abs(currentRatio - r.val);
                if (diff < 0.002) {
                    arStr = ` [${r.label}]`;
                    matchType = "perfect";
                    break;
                } else if (diff < 0.05) {
                    arStr = ` [${r.label}]`;
                    matchType = "approx";
                    break;
                }
            }
        }
        
        this.cropInfo.textContent = `${rw} x ${rh}${arStr}`;
        this.cropInfo.className = `ht-crop-info match-${matchType}`;
    }
}