import { ICON_ARROW_UP, ICON_ARROW_DOWN } from "./icons.js";

export class ToolsPanelManager {
    constructor(container, datasetState, galleryManager, viewerEl, loadBtn, showPrompt, showConfirm) {
        this.container = container;
        this.datasetState = datasetState;
        this.galleryManager = galleryManager;
        this.viewerEl = viewerEl;
        this.loadBtn = loadBtn;
        this.showPrompt = showPrompt;
        this.showConfirm = showConfirm || (async (container, msg) => window.confirm(msg.replace(/<[^>]*>?/gm, '')));
        
        this.tagsSortMode = 'count';
        this.tagsSortInvert = false;
        
        this.dsPresets = {};
        this.resizePresets = {};

        this.initTabs();
        this.initProjectSettings();
        this.initPresets(); 
        this.initCreateDataset();
        this.initRenameTool();
        this.initBatchResize();
        this.initSearchReplace();
        this.initTags();
        this.initVLM();
        this.initCaptionActions(); 
    }

    initTabs() {
        const tabBtns = this.container.querySelectorAll('.ht-tab-btn');
        const tabPanes = this.container.querySelectorAll('.ht-tab-pane');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-tab');
                this.container.querySelector('#' + targetId).classList.add('active');
            });
        });
    }

    initProjectSettings() {
        const btnCleanup = this.container.querySelector('#ht-btn-cleanup');
        const btnApplySource = this.container.querySelector('#ht-btn-apply-source');
        const inputSource = this.container.querySelector('#ht-setting-source');
        const btnCreateBackup = this.container.querySelector('#ht-btn-create-backup');
        const btnLoadBackup = this.container.querySelector('#ht-btn-load-backup');
        const backupSelect = this.container.querySelector('#ht-backup-select');

        this.galleryManager.fetchBackups = async () => {
            if (!this.datasetState.currentFolder) return;
            try {
                const res = await fetch('/handytools/captioner/get_backups', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder })
                });
                const data = await res.json();
                backupSelect.innerHTML = '<option value="">-- Select Backup --</option>';
                if (data.backups) {
                    data.backups.forEach(b => {
                        const opt = document.createElement('option'); opt.value = b; opt.textContent = b; backupSelect.appendChild(opt);
                    });
                }
            } catch(e) { console.error(e); }
        };

        btnCleanup.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            const confirmRes = await this.showConfirm(this.container, "Remove all missing images from the project data? This cannot be undone.");
            if (confirmRes) {
                await fetch('/handytools/captioner/cleanup_orphans', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder })
                });
                this.loadBtn.click(); 
            }
        });
        
        btnApplySource.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) { await this.showPrompt("Please load a project folder first.", true); return; }
            const newSource = inputSource.value.trim() || "_source";
            btnApplySource.textContent = "Saving...";
            await fetch('/handytools/captioner/update_source', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: this.datasetState.currentFolder, image_source: newSource })
            });
            this.loadBtn.click(); 
            setTimeout(() => btnApplySource.textContent = "Apply", 500);
        });

        btnCreateBackup.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            btnCreateBackup.disabled = true;
            await fetch('/handytools/captioner/create_backup', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: this.datasetState.currentFolder })
            });
            await this.galleryManager.fetchBackups();
            setTimeout(() => btnCreateBackup.disabled = false, 500);
        });

        btnLoadBackup.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            if (!backupSelect.value) { await this.showPrompt("Please select a backup to load.", true); return; }
            const warningMsg = `<b>WARNING:</b> You are about to overwrite your current dataset JSON with <b>${backupSelect.value}</b>.<br><br>Any unsaved changes, new tags, or new image scans since this backup was made will be permanently lost.<br><br>Continue?`;
            const confirmRes = await this.showConfirm(this.container, warningMsg);
            if (confirmRes) {
                await fetch('/handytools/captioner/restore_backup', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder, backup_name: backupSelect.value })
                });
                this.loadBtn.click(); 
            }
        });
    }

    async initPresets() {
        this.dsPresetSelect = this.container.querySelector('#ht-ds-preset-select');
        this.dsName = this.container.querySelector('#ht-ds-name');
        this.dsSizes = this.container.querySelector('#ht-ds-sizes');
        const dsPresetSave = this.container.querySelector('#ht-ds-preset-save');
        const dsPresetDel = this.container.querySelector('#ht-ds-preset-del');

        try {
            const res = await fetch('/handytools/captioner/get_presets');
            this.dsPresets = await res.json();
        } catch(e) {
            console.error("Failed to load presets from backend.", e);
        }

        this.renderDsPresets();

        this.dsPresetSelect.addEventListener('change', () => {
            const val = this.dsPresetSelect.value;
            if (this.dsPresets[val]) {
                this.dsName.value = this.dsPresets[val].name || '';
                this.dsSizes.value = this.dsPresets[val].sizes || '';
            }
        });

        dsPresetSave.addEventListener('click', async () => {
            const name = await this.showPrompt("Enter a name for this preset:");
            if (name && name.trim() !== "") {
                const safeName = name.trim();
                this.dsPresets[safeName] = {
                    name: this.dsName.value,
                    sizes: this.dsSizes.value
                };
                this.renderDsPresets();
                this.dsPresetSelect.value = safeName;
                await this.savePresetsBackend();
            }
        });

        dsPresetDel.addEventListener('click', async () => {
            const val = this.dsPresetSelect.value;
            if (!val) {
                await this.showPrompt("Please select a preset to delete first.", true);
                return;
            }
            if (confirm(`Delete preset "${val}"?`)) {
                delete this.dsPresets[val];
                this.renderDsPresets();
                this.dsPresetSelect.value = "";
                this.dsName.value = "";
                this.dsSizes.value = "";
                await this.savePresetsBackend();
            }
        });
    }

    renderDsPresets() {
        const currentVal = this.dsPresetSelect.value;
        this.dsPresetSelect.innerHTML = '<option value="">-- Presets --</option>';
        for (const key of Object.keys(this.dsPresets).sort()) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            this.dsPresetSelect.appendChild(opt);
        }
        if (this.dsPresets[currentVal]) this.dsPresetSelect.value = currentVal;
    }

    async savePresetsBackend() {
        try {
            await fetch('/handytools/captioner/update_presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.dsPresets)
            });
        } catch(err) {
            console.error("Failed to save presets to server:", err);
        }
    }

    initCreateDataset() {
        const dsName = this.container.querySelector('#ht-ds-name');
        const dsSizes = this.container.querySelector('#ht-ds-sizes');
        const dsCreateBtn = this.container.querySelector('#ht-ds-create');
        const dsScope = this.container.querySelector('#ht-ds-scope');
        
        const dsCapBtns = this.container.querySelectorAll('.ht-ds-cap-btn');
        dsCapBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                if (this.container.querySelectorAll('.ht-ds-cap-btn.active').length === 0) {
                    btn.classList.add('active');
                }
            });
        });

        dsCreateBtn.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            const nameVal = dsName.value.trim();
            if (!nameVal) {
                await this.showPrompt("Please enter a dataset name.", true);
                return;
            }
            
            const activeCaps = Array.from(this.container.querySelectorAll('.ht-ds-cap-btn.active'))
                                    .map(b => parseInt(b.getAttribute('data-index')));
            
            const scopeVal = dsScope.value;
            const selectedArr = Array.from(this.datasetState.selectedFiles);

            if (scopeVal === 'selected' && selectedArr.length === 0) {
                await this.showPrompt("No images are selected in the gallery.", true);
                return;
            }
            
            const prevText = dsCreateBtn.textContent;
            dsCreateBtn.textContent = "Processing...";
            
            try {
                const response = await fetch('/handytools/captioner/create_dataset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        folder: this.datasetState.currentFolder, 
                        name: nameVal,
                        sizes: dsSizes.value,
                        captionIndices: activeCaps,
                        scope: scopeVal,
                        selectedFiles: selectedArr
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                await this.showPrompt(`Dataset created! Processed ${data.processed_count} image(s).`, true);
                
            } catch (err) {
                console.error("Create dataset failed:", err);
                await this.showPrompt("Dataset creation failed.", true);
            } finally {
                setTimeout(() => dsCreateBtn.textContent = prevText, 500);
            }
        });
    }

    initRenameTool() {
        const btnRename = this.container.querySelector('#ht-rename-btn');
        const inputBase = this.container.querySelector('#ht-rename-base');
        const selDigits = this.container.querySelector('#ht-rename-digits');
        const selSort = this.container.querySelector('#ht-rename-sort');
        const selScope = this.container.querySelector('#ht-rename-scope');

        btnRename.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            
            const baseName = inputBase.value.trim();
            if (!baseName) {
                await this.showPrompt("Please enter a base name for renaming.", true);
                return;
            }

            const scopeVal = selScope.value;
            const selectedArr = Array.from(this.datasetState.selectedFiles);

            if (scopeVal === 'selected' && selectedArr.length === 0) {
                await this.showPrompt("No images are selected.", true);
                return;
            }

            const confirmRes = await this.showConfirm(this.container, `Rename ${scopeVal === 'selected' ? 'selected' : 'all'} files to "<b>${baseName}_XXX</b>"?<br><br>Original filenames will be saved in the project data.`);
            if (!confirmRes) return;

            const prevText = btnRename.textContent;
            btnRename.textContent = "Renaming...";
            btnRename.disabled = true;

            try {
                const response = await fetch('/handytools/captioner/batch_rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: this.datasetState.currentFolder,
                        baseName: baseName,
                        digits: selDigits.value,
                        sortOrder: selSort.value,
                        scope: scopeVal,
                        selectedFiles: selectedArr
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);

                await this.showPrompt(`Successfully renamed ${data.renamed_count} file(s).`, true);
                
                this.datasetState.currentFile = null;
                this.datasetState.selectedFiles.clear();
                this.loadBtn.click();
            } catch (err) {
                console.error("Batch rename failed:", err);
                await this.showPrompt("Failed to rename files.", true);
            } finally {
                btnRename.textContent = prevText;
                btnRename.disabled = false;
            }
        });
    }

    async initBatchResize() {
        const btnResize = this.container.querySelector('#ht-batch-resize-btn');
        const inputSize = this.container.querySelector('#ht-batch-resize-size');
        const selScope = this.container.querySelector('#ht-batch-resize-scope');
        
        const presetSelect = this.container.querySelector('#ht-batch-resize-preset');
        const presetText = this.container.querySelector('#ht-batch-resize-preset-text');
        const modeRadios = this.container.querySelectorAll('input[name="ht-resize-mode"]');

        const updateTextState = () => {
            const activeModeEl = this.container.querySelector('input[name="ht-resize-mode"]:checked');
            const activeMode = activeModeEl ? activeModeEl.value : 'longest_edge';
            
            if (activeMode === 'custom') {
                presetText.readOnly = false;
                presetText.style.borderColor = '#82deff';
                presetText.style.background = '#1a1a1a';
                presetSelect.disabled = true;
                inputSize.disabled = true;
            } else if (activeMode === 'preset') {
                presetText.readOnly = true;
                presetText.style.borderColor = '#444';
                presetText.style.background = '#111';
                presetSelect.disabled = false;
                inputSize.disabled = true;
                presetSelect.dispatchEvent(new Event('change')); // Trigger text update
            } else {
                presetText.readOnly = true;
                presetText.style.borderColor = '#444';
                presetText.style.background = '#111';
                presetSelect.disabled = true;
                inputSize.disabled = false;
            }
        };

        modeRadios.forEach(radio => radio.addEventListener('change', updateTextState));

        try {
            const res = await fetch('/handytools/captioner/get_image_sizes');
            this.resizePresets = await res.json();
            
            presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
            for (const key of Object.keys(this.resizePresets).sort()) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = key;
                presetSelect.appendChild(opt);
            }
        } catch(e) {
            presetSelect.innerHTML = '<option value="">Error loading</option>';
            console.error("Failed to load imageSizes.json:", e);
        }

        presetSelect.addEventListener('change', () => {
            const val = presetSelect.value;
            if (this.resizePresets[val] && this.resizePresets[val].sizes) {
                presetText.value = this.resizePresets[val].sizes;
            } else {
                presetText.value = "";
            }
        });

        if (!btnResize) return;

        btnResize.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            
            const activeModeEl = this.container.querySelector('input[name="ht-resize-mode"]:checked');
            const modeVal = activeModeEl ? activeModeEl.value : 'longest_edge';
            
            const sizeVal = parseInt(inputSize.value);
            const presetSizes = presetText.value.trim();
            const scopeVal = selScope.value;
            const selectedArr = Array.from(this.datasetState.selectedFiles);

            if (modeVal === 'longest_edge' && (isNaN(sizeVal) || sizeVal <= 0)) {
                await this.showPrompt("Please enter a valid size greater than 0.", true);
                return;
            }
            
            if ((modeVal === 'preset' || modeVal === 'custom') && !presetSizes) {
                await this.showPrompt("Please select a valid preset or provide target sizes.", true);
                return;
            }

            if (scopeVal === 'selected' && selectedArr.length === 0) {
                await this.showPrompt("No images are selected.", true);
                return;
            }

            const msg = (modeVal === 'preset' || modeVal === 'custom') 
                ? `Match ${scopeVal === 'selected' ? 'selected' : 'all'} images to the nearest target size?`
                : `Resize ${scopeVal === 'selected' ? 'selected' : 'all'} images so their longest edge is ${sizeVal}px?`;
                
            const confirmRes = await this.showConfirm(this.container, `${msg}<br><br>Original images will be safely backed up.`);
            if (!confirmRes) return;

            const prevText = btnResize.textContent;
            btnResize.textContent = "Resizing...";
            btnResize.disabled = true;

            try {
                const response = await fetch('/handytools/captioner/batch_resize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder: this.datasetState.currentFolder,
                        mode: modeVal === 'custom' ? 'preset' : modeVal, // Send custom as preset to backend
                        size: sizeVal,
                        preset_sizes: presetSizes,
                        scope: scopeVal,
                        selectedFiles: selectedArr
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);

                await this.showPrompt(`Successfully resized ${data.processed_count} image(s).`, true);
                this.loadBtn.click();
            } catch (err) {
                console.error("Batch resize failed:", err);
                await this.showPrompt("Failed to resize images.", true);
            } finally {
                btnResize.textContent = prevText;
                btnResize.disabled = false;
            }
        });
    }

    initSearchReplace() {
        const srFind = this.container.querySelector('#ht-sr-find');
        const srReplace = this.container.querySelector('#ht-sr-replace');
        const srScope = this.container.querySelector('#ht-sr-scope');
        const srBtn = this.container.querySelector('#ht-sr-btn');
        const captionInput = this.container.querySelector('#ht-caption-input');

        srBtn.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            const findText = srFind.value;
            if (!findText) return;
            
            const scopeVal = srScope.value;
            const selectedArr = Array.from(this.datasetState.selectedFiles);
            
            if (scopeVal === "current" && !this.datasetState.currentFile) {
                await this.showPrompt("No image selected. Open an image first.", true);
                return;
            }
            if (scopeVal === 'selected' && selectedArr.length === 0) {
                await this.showPrompt("No images are selected in the gallery.", true);
                return;
            }
            
            const prevText = srBtn.textContent;
            srBtn.textContent = "Working...";
            
            try {
                const response = await fetch('/handytools/captioner/search_replace', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        folder: this.datasetState.currentFolder, 
                        filename: this.datasetState.currentFile,
                        find: findText,
                        replace: srReplace.value,
                        scope: scopeVal,
                        selectedFiles: selectedArr,
                        captionIndex: this.datasetState.settings.currentCaptionIndex
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                
                const activeCapKey = `caption${this.datasetState.settings.currentCaptionIndex}`;

                data.updated.forEach(update => {
                    if (this.datasetState.data[update.filename]) {
                        this.datasetState.data[update.filename][activeCapKey] = update.caption;
                    }
                });
                
                if (this.datasetState.currentFile && this.datasetState.data[this.datasetState.currentFile]) {
                    captionInput.value = this.datasetState.data[this.datasetState.currentFile][activeCapKey] || "";
                    captionInput.dispatchEvent(new Event('input'));
                }
                
                this.galleryManager.renderFiles();
                
            } catch (err) {
                console.error("Search/Replace failed:", err);
                await this.showPrompt("Search and replace failed.", true);
            } finally {
                setTimeout(() => srBtn.textContent = prevText, 500);
            }
        });
    }

    initTags() {
        this.tagInput = this.container.querySelector('#ht-tag-input');
        this.tagAutocomplete = this.container.querySelector('#ht-tag-autocomplete');
        this.tagsContainer = this.container.querySelector('#ht-tags-container');
        this.allTagsContainer = this.container.querySelector('#ht-all-tags-container');

        const btnSortAlpha = this.container.querySelector('#ht-tag-sort-alpha');
        const btnSortCount = this.container.querySelector('#ht-tag-sort-count');
        const btnSortDir = this.container.querySelector('#ht-tag-sort-dir');
        const tagAddBtn = this.container.querySelector('#ht-tag-add-btn');

        const updateSortUI = () => {
            btnSortAlpha.classList.toggle('active', this.tagsSortMode === 'alpha');
            btnSortCount.classList.toggle('active', this.tagsSortMode === 'count');
            
            const isAscending = (this.tagsSortMode === 'alpha' && !this.tagsSortInvert) || (this.tagsSortMode === 'count' && this.tagsSortInvert);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = isAscending 
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>` 
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;
            btnSortDir.innerHTML = tempDiv.innerHTML;
        };

        btnSortAlpha.addEventListener('click', (e) => { e.stopPropagation(); this.tagsSortMode = 'alpha'; updateSortUI(); this.renderTags(); });
        btnSortCount.addEventListener('click', (e) => { e.stopPropagation(); this.tagsSortMode = 'count'; updateSortUI(); this.renderTags(); });
        btnSortDir.addEventListener('click', (e) => { e.stopPropagation(); this.tagsSortInvert = !this.tagsSortInvert; updateSortUI(); this.renderTags(); });
        updateSortUI();


        this.viewerEl.addEventListener('image-changed', () => this.renderTags());

        this.autocompleteIndex = -1;
        this.autocompleteItems = [];
        this.isDeleting = false;

        const updateAutocompleteSelection = () => {
            const itemsList = this.tagAutocomplete.querySelectorAll('.ht-autocomplete-item');
            itemsList.forEach((el, idx) => {
                if (idx === this.autocompleteIndex) {
                    el.classList.add('selected');
                    el.scrollIntoView({ block: 'nearest' });
                    this.tagInput.value = this.autocompleteItems[idx];
                    this.tagInput.setSelectionRange(this.tagInput.value.length, this.tagInput.value.length);
                } else {
                    el.classList.remove('selected');
                }
            });
        };

        this.tagInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                this.isDeleting = true;
            } else {
                this.isDeleting = false;
            }

            if (this.tagAutocomplete.style.display === 'block' && this.autocompleteItems.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.autocompleteIndex = (this.autocompleteIndex + 1) % this.autocompleteItems.length;
                    updateAutocompleteSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.autocompleteIndex = this.autocompleteIndex - 1;
                    if (this.autocompleteIndex < 0) this.autocompleteIndex = this.autocompleteItems.length - 1;
                    updateAutocompleteSelection();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const rawVal = this.tagInput.value;
                    const newTags = rawVal.split(',').map(t => t.trim()).filter(t => t !== "");
                    if (newTags.length > 0) {
                        this.tagInput.value = "";
                        this.tagAutocomplete.style.display = 'none';
                        for (const t of newTags) {
                            await this.addTag(t);
                        }
                    }
                } else if (e.key === 'Escape') {
                    this.tagAutocomplete.style.display = 'none';
                }
            } else {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const rawVal = this.tagInput.value;
                    const newTags = rawVal.split(',').map(t => t.trim()).filter(t => t !== "");
                    if (newTags.length > 0) {
                        this.tagInput.value = "";
                        for (const t of newTags) {
                            await this.addTag(t);
                        }
                    }
                }
            }
        });

        this.tagInput.addEventListener('input', (e) => {
            let val = this.tagInput.value;
            let typedVal = val;
            
            if (this.tagInput.selectionStart < val.length) {
                typedVal = val.substring(0, this.tagInput.selectionStart);
            }
            
            const lowerTyped = typedVal.toLowerCase();
            this.tagAutocomplete.innerHTML = '';
            
            if (!lowerTyped) {
                this.tagAutocomplete.style.display = 'none';
                return;
            }
            
            const globalTagsMap = this.datasetState.data["__global_tags__"] || {};
            const allTags = Object.keys(globalTagsMap);
            
            const bestMatch = allTags.find(t => t.toLowerCase().startsWith(lowerTyped));
            
            if (bestMatch && !this.isDeleting) {
                const originalPrefix = this.tagInput.value.substring(0, this.tagInput.selectionStart);
                this.tagInput.value = originalPrefix + bestMatch.substring(lowerTyped.length);
                this.tagInput.setSelectionRange(lowerTyped.length, bestMatch.length);
            }
            
            let matches = allTags.filter(t => t.toLowerCase().startsWith(lowerTyped));
            if (bestMatch && !this.isDeleting) {
                matches = matches.filter(t => t !== bestMatch);
            }
            
            if (matches.length === 0) {
                this.tagAutocomplete.style.display = 'none';
                return;
            }
            
            this.autocompleteItems = matches.slice(0, 50); 
            this.autocompleteIndex = -1;
            
            this.autocompleteItems.forEach((tag, idx) => {
                const div = document.createElement('div');
                div.className = 'ht-autocomplete-item';
                div.textContent = tag;
                div.style.display = 'block'; 
                
                div.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    this.addTag(tag);
                    this.tagInput.value = "";
                    this.tagAutocomplete.style.display = 'none';
                });
                this.tagAutocomplete.appendChild(div);
            });
            
            this.tagAutocomplete.style.display = 'block';
        });

        this.tagInput.addEventListener('blur', () => {
            this.tagAutocomplete.style.display = 'none';
        });

        this.tagInput.addEventListener('focus', () => {
            this.tagInput.dispatchEvent(new Event('input'));
        });
        
        tagAddBtn.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
            const currentData = this.datasetState.data[this.datasetState.currentFile];
            if (!currentData || !currentData.tags || currentData.tags.length === 0) {
                await this.showPrompt("No tags available to add.", true);
                return;
            }
            
            const prevText = tagAddBtn.textContent;
            tagAddBtn.textContent = "Added!";
            await this.appendTagsToCaption(currentData.tags);
            setTimeout(() => tagAddBtn.textContent = prevText, 1000);
        });
    }

    async appendTagsToCaption(tagsArray) {
        if (!this.datasetState.currentFolder || !this.datasetState.currentFile) return;
        const currentData = this.datasetState.data[this.datasetState.currentFile];
        if (!currentData) return;
        
        const targetIdx = this.datasetState.settings.currentCaptionIndex;
        const captionInput = this.container.querySelector('#ht-caption-input');
        
        const tagsToAppend = tagsArray.join(", ");
        const currentCap = captionInput.value + tagsToAppend;
        
        const capKey = `caption${targetIdx}`;
        currentData[capKey] = currentCap;
        
        try {
            await fetch('/handytools/captioner/save_caption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    folder: this.datasetState.currentFolder, 
                    filename: this.datasetState.currentFile, 
                    caption: currentCap,
                    captionIndex: targetIdx
                })
            });
            
            captionInput.value = currentCap;
            captionInput.dispatchEvent(new Event('input')); 
            this.galleryManager.renderFiles();
        } catch (err) {
            console.error("Failed to append tags:", err);
        }
    }

    getStringColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);
        const s = 50 + (Math.abs(hash) % 31);
        const l = 50 + (Math.abs(hash >> 2) % 31); 
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    renderTags() {
        this.tagsContainer.innerHTML = '';
        this.allTagsContainer.innerHTML = '';
        
        const globalTagsMap = this.datasetState.data["__global_tags__"] || {};
        let allTagsArray = Object.keys(globalTagsMap).map(tag => ({
            tag: tag,
            count: globalTagsMap[tag]
        }));

        allTagsArray.sort((a, b) => {
            let result = 0;
            if (this.tagsSortMode === 'alpha') {
                result = a.tag.localeCompare(b.tag);
            } else if (this.tagsSortMode === 'count') {
                result = b.count - a.count;
            }
            return this.tagsSortInvert ? -result : result;
        });

        allTagsArray.forEach(item => {
            const pill = document.createElement('div');
            pill.className = 'ht-tag-pill ht-all-tags-pill';
            pill.style.backgroundColor = this.getStringColor(item.tag);
            
            pill.innerHTML = `<span>${item.tag}</span><span class="ht-tag-count">${item.count}</span>`;
            pill.addEventListener('click', () => this.addTag(item.tag));
            this.allTagsContainer.appendChild(pill);
        });

        if (!this.datasetState.currentFile) return;
        const currentData = this.datasetState.data[this.datasetState.currentFile];
        if (!currentData) return;

        const tags = currentData.tags || [];
        
        tags.forEach(tag => {
            const pill = document.createElement('div');
            pill.className = 'ht-tag-pill';
            pill.style.backgroundColor = this.getStringColor(tag);
            
            pill.innerHTML = `<span class="ht-tag-text" title="Click to copy to active caption">${tag}</span><span class="ht-tag-del" title="Remove tag">✖</span>`;
            
            pill.querySelector('.ht-tag-text').addEventListener('click', (e) => {
                e.stopPropagation();
                this.appendTagsToCaption([tag]);
            });
            
            pill.querySelector('.ht-tag-del').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTag(tag);
            });
            
            this.tagsContainer.appendChild(pill);
        });
    }

    async addTag(tag) {
        if (!this.datasetState.currentFolder || !this.datasetState.currentFile) {
            await this.showPrompt("Select an image first to add tags.", true);
            return;
        }

        const currentData = this.datasetState.data[this.datasetState.currentFile];
        if (!currentData.tags) currentData.tags = [];
        
        if (!currentData.tags.includes(tag)) {
            currentData.tags.push(tag);
            
            if (!this.datasetState.data["__global_tags__"]) {
                this.datasetState.data["__global_tags__"] = {};
            }
            const gTags = this.datasetState.data["__global_tags__"];
            gTags[tag] = (gTags[tag] || 0) + 1;

            this.renderTags();
            this.container.dispatchEvent(new CustomEvent('global-tags-changed'));
            await this.saveTagsBackend();
        }
    }

    async removeTag(tag) {
        if (!this.datasetState.currentFile) return;
        const currentData = this.datasetState.data[this.datasetState.currentFile];
        if (currentData && currentData.tags) {
            currentData.tags = currentData.tags.filter(t => t !== tag);
            
            const gTags = this.datasetState.data["__global_tags__"];
            if (gTags && gTags[tag]) {
                gTags[tag] -= 1;
                if (gTags[tag] <= 0) delete gTags[tag];
            }

            this.renderTags();
            this.container.dispatchEvent(new CustomEvent('global-tags-changed'));
            await this.saveTagsBackend();
        }
    }

    async saveTagsBackend() {
        try {
            await fetch('/handytools/captioner/update_tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    folder: this.datasetState.currentFolder, 
                    filename: this.datasetState.currentFile,
                    tags: this.datasetState.data[this.datasetState.currentFile].tags
                })
            });
        } catch (err) {
            console.error("Failed to save tags:", err);
        }
    }
    
    initVLM() {
        const runBtn = this.container.querySelector('#ht-vlm-run-btn');
        const scopeEl = this.container.querySelector('#ht-vlm-scope');
        const presetEl = this.container.querySelector('#ht-vlm-preset');
        const triggerEl = this.container.querySelector('#ht-vlm-trigger');
        const styleEl = this.container.querySelector('#ht-vlm-style');
        const appendEl = this.container.querySelector('#ht-vlm-append');

        runBtn.addEventListener('click', async () => {
            if (!this.datasetState.currentFolder) return;
            
            const scopeVal = scopeEl.value;
            const selectedArr = Array.from(this.datasetState.selectedFiles);
            
            if (scopeVal === "current" && !this.datasetState.currentFile) {
                await this.showPrompt("No image selected.", true);
                return;
            }
            if (scopeVal === 'selected' && selectedArr.length === 0) {
                await this.showPrompt("No images are selected.", true);
                return;
            }

            const prevText = runBtn.textContent;
            runBtn.textContent = "Queuing...";
            
            try {
                const response = await fetch('/handytools/captioner/run_vlm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        folder: this.datasetState.currentFolder, 
                        filename: this.datasetState.currentFile,
                        scope: scopeVal,
                        selectedFiles: selectedArr,
                        caption_index: this.datasetState.settings.currentCaptionIndex,
                        preset: presetEl.value,
                        trigger_word: triggerEl.value,
                        style_focus: styleEl.checked,
                        manual_append: appendEl.value
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                
                if (data.queued_files) {
                    for (const [pid, fname] of Object.entries(data.queued_files)) {
                        if (!this.datasetState.vlmFinishedRecently.has(fname)) {
                            this.datasetState.vlmQueue.set(pid, fname);
                        }
                    }
                    this.datasetState.vlmFinishedRecently.clear(); 
                    this.galleryManager.renderFiles();
                }
                
            } catch (err) {
                console.error("VLM Error:", err);
                await this.showPrompt("Failed to queue VLM generation.", true);
            } finally {
                setTimeout(() => runBtn.textContent = prevText, 500);
            }
        });
    }

    initCaptionActions() {
        const discardBtn = this.container.querySelector('#ht-discard-cap-btn');
        const captionInput = this.container.querySelector('#ht-caption-input');
        const saveBtn = this.container.querySelector('#ht-save-btn');
        
        discardBtn.addEventListener('click', async () => {
            const currentFile = this.datasetState.currentFile;
            if (!currentFile || !this.datasetState.currentFolder) return;
            
            const activeCapKey = `caption${this.datasetState.settings.currentCaptionIndex}`;
            
            const originalCaption = this.datasetState.data[currentFile]?.[activeCapKey] || "";
            captionInput.value = originalCaption;
            
            if (this.datasetState.tempCaptions && this.datasetState.tempCaptions[currentFile]) {
                delete this.datasetState.tempCaptions[currentFile][activeCapKey];
            }
            
            captionInput.classList.remove('ht-unsaved');
            saveBtn.classList.remove('ht-unsaved-btn');
            discardBtn.classList.add('ht-hidden');

            try {
                await fetch('/handytools/captioner/discard_temp_caption', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        folder: this.datasetState.currentFolder, 
                        filename: currentFile
                    })
                });
            } catch (err) {
                console.error("Failed to discard temp caption on backend:", err);
            }
        });
    }
}