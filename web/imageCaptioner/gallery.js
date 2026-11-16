import {
    ICON_FLAG, ICON_CLOCK, ICON_LOADER, ICON_SORT, ICON_GRID, ICON_LIST,
    ICON_REFRESH, ICON_TRASH, ICON_PLUS, ICON_SORT_A_UP, ICON_SORT_A_DOWN,
    ICON_SORT_CLOCK_UP, ICON_SORT_CLOCK_DOWN, ICON_SORT_W_UP, ICON_SORT_W_DOWN,
    ICON_SORT_H_UP, ICON_SORT_H_DOWN, ICON_ARROW_UP, ICON_ARROW_DOWN,
    ICON_FILTER, ICON_SEARCH, ICON_TAG, ICON_TEXT, ICON_INVERT,
    ICON_CHECK_SQUARE, ICON_SELECT_ALL, ICON_SELECT_NONE, ICON_SETTINGS, ICON_MISSING
} from "./icons.js";

export class GalleryManager {
    constructor(container, galleryElement, viewerElement, captionInput, saveBtn, loadBtn, datasetState, showPrompt, showConfirm) {
        this.container = container;
        this.gallery = galleryElement;
        this.viewer = viewerElement;
        this.captionInput = captionInput;
        this.saveBtn = saveBtn;
        this.loadBtn = loadBtn;
        this.datasetState = datasetState;
        this.showPrompt = showPrompt;
        this.showConfirm = showConfirm;
        
        this.observer = this.setupObserver();
        this.currentDisplayFiles = [];
        this.searchTagSortMode = 'count';
        this.searchTagSortInvert = false;

        this.initDragAndDrop();
        this.initContextMenu();
        this.initCaptionTabs();
        this.initToolbar();
        this.initSelectionMenu();
        this.initSearchMenu();
    }

    setupObserver() {
        return new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target.querySelector('img');
                    if (img && !img.src) {
                        const filename = img.getAttribute('data-filename');
                        const folder = encodeURIComponent(this.datasetState.resolvedSourceFolder);
                        const fileData = this.datasetState.files.find(f => f.filename === filename);
                        const mtime = fileData ? fileData.mtime : Date.now();
                        
                        let queryParams = `t=${mtime}`;
                        
                        if (fileData && fileData.has_temp) {
                            queryParams += "&temp=true";
                        }
                        
                        img.src = `/handytools/captioner/get_image?folder=${folder}&filename=${encodeURIComponent(filename)}&${queryParams}`;
                    }
                    this.observer.unobserve(entry.target);
                }
            });
        }, { root: this.gallery, rootMargin: "100px" });
    }

    renderFiles() {
        this.gallery.innerHTML = '';

        if (this.datasetState.files.length === 0 && this.datasetState.currentFolder) {
            this.gallery.innerHTML = '<div class="ht-empty-gallery-msg">Source folder is empty.<br>Copy images into the source folder or drag & drop them here to begin.</div>';
            return;
        }
        
        const activeCapKey = `caption${this.datasetState.settings.currentCaptionIndex}`;
        const filters = this.datasetState.settings.filters;
        const query = (this.datasetState.settings.searchQuery || "").toLowerCase();
        const sTags = this.datasetState.settings.searchTags || [];

        let displayFiles = this.datasetState.files.filter(f => {
            const data = this.datasetState.data[f.filename] || {};
            const text = data[activeCapKey] || "";
            const fileTags = data.tags || [];
            const isFlagged = data.flagged || false;
            const isCaptioned = text.trim() !== "";
            const isMissing = f.is_missing || false;
            
            let passes = true;
            if (filters.search && query && !text.toLowerCase().includes(query)) passes = false;
            if (filters.tags && sTags.length > 0 && !sTags.every(t => fileTags.includes(t))) passes = false;
            if (filters.flagged && isFlagged) passes = false;
            if (filters.captioned && isCaptioned) passes = false;
            if (filters.missing && isMissing) passes = false;
            if (filters.invert) passes = !passes;

            return passes;
        });

        if (displayFiles.length === 0 && this.datasetState.currentFolder) {
            this.gallery.innerHTML = '<div class="ht-empty-gallery-msg">No images match the current filters.</div>';
            return;
        }

        displayFiles.sort((a, b) => {
            let result = 0;
            const sortMode = this.datasetState.settings.sortMode;
            if (sortMode === 'alpha') {
                result = a.filename.localeCompare(b.filename);
            } else if (sortMode === 'new') {
                result = b.mtime - a.mtime;
            } else if (sortMode === 'width' || sortMode === 'height') {
                const valA = this.datasetState.data[a.filename]?.size?.[sortMode] || 0;
                const valB = this.datasetState.data[b.filename]?.size?.[sortMode] || 0;
                result = valB - valA; 
            }
            return this.datasetState.settings.sortInvert ? -result : result;
        });

        this.currentDisplayFiles = displayFiles;
        const queuedFilenames = Array.from(this.datasetState.vlmQueue.values());

        displayFiles.forEach(file => {
            const data = this.datasetState.data[file.filename] || {};
            const item = document.createElement('div');
            item.className = 'ht-gallery-item';
            
            const isGeneratingEdit = this.datasetState.generatingEdits && this.datasetState.generatingEdits.has(file.filename);
            const hasTemp = file.has_temp;

            if (file.filename === this.datasetState.currentFile) item.classList.add('active');
            if (data.flagged) item.classList.add('flagged');
            
            if (isGeneratingEdit) item.classList.add('generating');
            else if (hasTemp) item.classList.add('has-temp');
            
            const img = document.createElement('img');
            if (file.is_missing) {
                item.classList.add('missing');
                item.setAttribute('data-missing-text', `${file.filename}\nis missing`);
                img.style.display = 'none';
            } else {
                img.setAttribute('data-filename', file.filename);
            }
            
            const selEl = document.createElement('input');
            selEl.type = 'checkbox';
            selEl.className = 'ht-gallery-sel';
            selEl.checked = this.datasetState.selectedFiles.has(file.filename);
            
            selEl.addEventListener('click', (e) => {
                e.stopPropagation(); 
                if (selEl.checked) this.datasetState.selectedFiles.add(file.filename);
                else this.datasetState.selectedFiles.delete(file.filename);
                this.gallery.dispatchEvent(new CustomEvent('selection-changed', { bubbles: true }));
            });

            const flagEl = document.createElement('div');
            flagEl.className = `ht-gallery-flag ${data.flagged ? 'active' : ''}`;
            flagEl.innerHTML = ICON_FLAG;
            flagEl.title = "Toggle Flag";
            
            flagEl.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newFlagState = !data.flagged;
                data.flagged = newFlagState;
                flagEl.classList.toggle('active', newFlagState);
                item.classList.toggle('flagged', newFlagState);
                
                await fetch('/handytools/captioner/toggle_flag', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder, filename: file.filename, flagged: newFlagState })
                });
                
                if (this.datasetState.settings.filters.flagged || this.datasetState.settings.filters.invert) this.renderFiles();
            });

            const isCaptioned = (data[activeCapKey] || "").trim() !== "";
            const status = document.createElement('div');
            status.className = `status ${isCaptioned ? 'has-caption' : ''}`;

            const nameEl = document.createElement('div');
            nameEl.className = 'ht-gallery-filename';
            nameEl.textContent = file.filename;
            nameEl.title = file.filename; 
            
            item.appendChild(selEl);
            item.appendChild(img);
            item.appendChild(flagEl);
            item.appendChild(status);
            item.appendChild(nameEl);
            
            if (this.datasetState.vlmProcessing.has(file.filename)) {
                const overlay = document.createElement('div');
                overlay.className = 'ht-vlm-overlay';
                overlay.innerHTML = `<div class="ht-spin-svg">${ICON_LOADER}</div> <span style="font-size:9px; font-weight:bold; margin-left:4px;">VLM</span>`;
                item.appendChild(overlay);
            } else if (queuedFilenames.includes(file.filename)) {
                const overlay = document.createElement('div');
                overlay.className = 'ht-vlm-overlay';
                overlay.innerHTML = `${ICON_CLOCK} <span style="font-size:9px; font-weight:bold; margin-left:4px;">VLM</span>`;
                item.appendChild(overlay);
            }

            if (isGeneratingEdit) {
                const genOverlay = document.createElement('div');
                genOverlay.style.cssText = "position:absolute; top:4px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#b142ff; font-size:9px; padding:2px 6px; border-radius:4px; z-index:10; font-weight:bold; pointer-events:none;";
                genOverlay.textContent = "GENERATING";
                item.appendChild(genOverlay);
            } else if (hasTemp) {
                const tempOverlay = document.createElement('div');
                tempOverlay.style.cssText = "position:absolute; top:4px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#e6c300; font-size:9px; padding:2px 6px; border-radius:4px; z-index:10; font-weight:bold; pointer-events:none;";
                tempOverlay.textContent = "UNSAVED";
                item.appendChild(tempOverlay);
            }
            
            item.addEventListener('click', () => this.onItemClick(item, file));
            item.addEventListener('contextmenu', () => this.onItemClick(item, file));
            
            this.gallery.appendChild(item);
            this.observer.observe(item);
        });
    }

    onItemClick(element, file) {
        this.gallery.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        
        this.datasetState.currentFile = file.filename;
        const activeCapKey = `caption${this.datasetState.settings.currentCaptionIndex}`;
        
        let capText = this.datasetState.data[file.filename]?.[activeCapKey] || "";
        
        // Prioritize loading temp captions if they exist
        if (this.datasetState.tempCaptions && 
            this.datasetState.tempCaptions[file.filename] && 
            this.datasetState.tempCaptions[file.filename][activeCapKey] !== undefined) {
            capText = this.datasetState.tempCaptions[file.filename][activeCapKey];
        }

        this.captionInput.value = capText;
        this.captionInput.dispatchEvent(new Event('input')); 

        this.viewer.dispatchEvent(new CustomEvent('viewer-load-image', { detail: { file: file } }));
        this.gallery.dispatchEvent(new CustomEvent('file-selected', { bubbles: true }));
    }

    navigateGallery(direction) {
        if (!this.datasetState.currentFile || this.currentDisplayFiles.length === 0) return;
        
        const currentIndex = this.currentDisplayFiles.findIndex(f => f.filename === this.datasetState.currentFile);
        if (currentIndex === -1) return;

        let newIndex = currentIndex + direction;
        
        if (newIndex < 0) newIndex = this.currentDisplayFiles.length - 1;
        if (newIndex >= this.currentDisplayFiles.length) newIndex = 0;

        const newFile = this.currentDisplayFiles[newIndex];
        
        const items = Array.from(this.gallery.querySelectorAll('.ht-gallery-item'));
        const targetItem = items.find(el => {
            const nameEl = el.querySelector('.ht-gallery-filename');
            return nameEl && nameEl.textContent === newFile.filename;
        });

        if (targetItem) {
            this.onItemClick(targetItem, newFile);
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    initToolbar() {
        const btnSort = this.container.querySelector('#ht-btn-sort');
        const sortMenu = this.container.querySelector('#ht-sort-menu');
        const btnSelect = this.container.querySelector('#ht-btn-select');
        const selMenu = this.container.querySelector('#ht-selection-menu');
        const btnFilter = this.container.querySelector('#ht-btn-filter');
        const searchMenu = this.container.querySelector('#ht-search-menu');
        
        btnSort.addEventListener('click', () => {
            sortMenu.classList.toggle('ht-hidden');
            searchMenu.classList.add('ht-hidden'); selMenu.classList.add('ht-hidden');
        });
        
        btnSelect.addEventListener('click', () => {
            selMenu.classList.toggle('ht-hidden');
            searchMenu.classList.add('ht-hidden'); sortMenu.classList.add('ht-hidden');
        });
        
        btnFilter.addEventListener('click', () => {
            searchMenu.classList.toggle('ht-hidden');
            sortMenu.classList.add('ht-hidden'); selMenu.classList.add('ht-hidden');
            if (!searchMenu.classList.contains('ht-hidden')) this.renderSearchPanelTags(); 
        });
        
        document.addEventListener('click', (e) => {
            if (!btnSort.contains(e.target) && !sortMenu.contains(e.target)) sortMenu.classList.add('ht-hidden');
            if (!btnSelect.contains(e.target) && !selMenu.contains(e.target)) selMenu.classList.add('ht-hidden');
            if (!btnFilter.contains(e.target) && !searchMenu.contains(e.target)) searchMenu.classList.add('ht-hidden');
        });

        const btnToggleColumns = this.container.querySelector('#ht-btn-toggle-columns');
        btnToggleColumns.addEventListener('click', () => {
            this.datasetState.settings.twoColumns = !this.datasetState.settings.twoColumns;
            btnToggleColumns.classList.toggle('active', this.datasetState.settings.twoColumns);
            btnToggleColumns.innerHTML = this.datasetState.settings.twoColumns ? ICON_LIST : ICON_GRID;
            this.gallery.classList.toggle('two-columns', this.datasetState.settings.twoColumns);
        });

        this.container.querySelector('#ht-btn-refresh').addEventListener('click', () => this.loadBtn.click());
        this.container.querySelector('#ht-btn-delete').addEventListener('click', () => this.executeDelete());

        const galSortBtns = this.container.querySelectorAll('.gal-sort-opt');
        const updateGalSortUI = () => {
            galSortBtns.forEach(btn => {
                const m = btn.getAttribute('data-mode');
                const inv = btn.getAttribute('data-inv') === 'true';
                if (this.datasetState.settings.sortMode === m && this.datasetState.settings.sortInvert === inv) {
                    btn.classList.add('active');
                    btnSort.innerHTML = btn.innerHTML;
                } else {
                    btn.classList.remove('active');
                }
            });
        };
        updateGalSortUI();

        galSortBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.datasetState.settings.sortMode = btn.getAttribute('data-mode');
                this.datasetState.settings.sortInvert = btn.getAttribute('data-inv') === 'true';
                updateGalSortUI();
                this.renderFiles();
            });
        });
    }

    initContextMenu() {
        const ctxMenu = this.container.querySelector('#ht-gallery-ctx-menu');
        
        this.gallery.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = this.container.getBoundingClientRect();
            ctxMenu.style.left = `${e.clientX - rect.left}px`;
            ctxMenu.style.top = `${e.clientY - rect.top}px`;
            ctxMenu.classList.remove('ht-hidden');
        });

        this.gallery.addEventListener('click', () => ctxMenu.classList.add('ht-hidden'));
        document.addEventListener('click', (e) => {
            if (!ctxMenu.contains(e.target)) ctxMenu.classList.add('ht-hidden');
        });

        this.container.querySelector('#ht-ctx-sel-all').addEventListener('click', () => { this.execSelectAll(); ctxMenu.classList.add('ht-hidden'); });
        this.container.querySelector('#ht-ctx-sel-none').addEventListener('click', () => { this.execSelectNone(); ctxMenu.classList.add('ht-hidden'); });
        this.container.querySelector('#ht-ctx-sel-inv').addEventListener('click', () => { this.execSelectInvert(); ctxMenu.classList.add('ht-hidden'); });
        this.container.querySelector('#ht-ctx-delete').addEventListener('click', () => { this.executeDelete(); ctxMenu.classList.add('ht-hidden'); });
    }

    initCaptionTabs() {
        const capBtns = this.container.querySelectorAll('.ht-cap-btn');
        
        const checkUnsavedChanges = () => {
            if (!this.datasetState.currentFile) return;
            const activeCapKey = `caption${this.datasetState.settings.currentCaptionIndex}`;
            
            const savedCaption = this.datasetState.data[this.datasetState.currentFile]?.[activeCapKey] || "";
            const isTemp = this.datasetState.tempCaptions && 
                           this.datasetState.tempCaptions[this.datasetState.currentFile] && 
                           this.datasetState.tempCaptions[this.datasetState.currentFile][activeCapKey] !== undefined;
                           
            const discardBtn = this.container.querySelector('#ht-discard-cap-btn');

            if (this.captionInput.value !== savedCaption || isTemp) {
                this.captionInput.classList.add('ht-unsaved');
                this.saveBtn.classList.add('ht-unsaved-btn');
                if (isTemp && discardBtn) discardBtn.classList.remove('ht-hidden');
            } else {
                this.captionInput.classList.remove('ht-unsaved');
                this.saveBtn.classList.remove('ht-unsaved-btn');
                if (discardBtn) discardBtn.classList.add('ht-hidden');
            }
        };

        capBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                capBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.datasetState.settings.currentCaptionIndex = parseInt(btn.getAttribute('data-index'));
                
                if (this.datasetState.currentFile) {
                    const activeCapKey = `caption${this.datasetState.settings.currentCaptionIndex}`;
                    let textToLoad = this.datasetState.data[this.datasetState.currentFile]?.[activeCapKey] || "";
                    
                    if (this.datasetState.tempCaptions && 
                        this.datasetState.tempCaptions[this.datasetState.currentFile] && 
                        this.datasetState.tempCaptions[this.datasetState.currentFile][activeCapKey] !== undefined) {
                        textToLoad = this.datasetState.tempCaptions[this.datasetState.currentFile][activeCapKey];
                    }
                    
                    this.captionInput.value = textToLoad;
                    checkUnsavedChanges();
                }
                this.renderFiles();
            });
        });

        this.captionInput.addEventListener('input', checkUnsavedChanges);
        
        const btnPrev = this.container.querySelector('#ht-nav-prev');
        const btnNext = this.container.querySelector('#ht-nav-next');
        
        btnPrev.addEventListener('click', () => this.navigateGallery(-1));
        btnNext.addEventListener('click', () => this.navigateGallery(1));
        
        this.container.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
            
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                this.navigateGallery(-1);
            } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                e.preventDefault();
                this.navigateGallery(1);
            }
        });
    }

    initSelectionMenu() {
        const selSelect = this.container.querySelector('#ht-sel-preset-select');
        
        this.execSelectAll = () => { this.currentDisplayFiles.forEach(f => this.datasetState.selectedFiles.add(f.filename)); selSelect.value = ""; this.renderFiles(); };
        this.execSelectNone = () => { this.datasetState.selectedFiles.clear(); selSelect.value = ""; this.renderFiles(); };
        this.execSelectInvert = () => {
            this.currentDisplayFiles.forEach(f => {
                if (this.datasetState.selectedFiles.has(f.filename)) this.datasetState.selectedFiles.delete(f.filename);
                else this.datasetState.selectedFiles.add(f.filename);
            });
            selSelect.value = ""; this.renderFiles();
        };

        this.container.querySelector('#ht-sel-all').addEventListener('click', this.execSelectAll);
        this.container.querySelector('#ht-sel-none').addEventListener('click', this.execSelectNone);
        this.container.querySelector('#ht-sel-inv').addEventListener('click', this.execSelectInvert);

        this.gallery.addEventListener('selection-changed', () => { selSelect.value = ""; });

        const renderPresets = () => {
            const currentVal = selSelect.value;
            selSelect.innerHTML = '<option value="">-- Sets --</option>';
            const sets = this.datasetState.data["__selections__"] || {};
            Object.keys(sets).sort().forEach(k => {
                const opt = document.createElement('option'); opt.value = k; opt.textContent = k; selSelect.appendChild(opt);
            });
            if (sets[currentVal]) selSelect.value = currentVal;
        };

        const saveBackend = async () => {
            await fetch('/handytools/captioner/update_selections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: this.datasetState.currentFolder, selections: this.datasetState.data["__selections__"] || {} })
            });
        };

        selSelect.addEventListener('change', () => {
            if (selSelect.value && this.datasetState.data["__selections__"][selSelect.value]) {
                this.datasetState.selectedFiles = new Set(this.datasetState.data["__selections__"][selSelect.value]);
                this.renderFiles();
            }
        });

        this.container.querySelector('#ht-sel-preset-save').addEventListener('click', async () => {
            if (this.datasetState.selectedFiles.size === 0) { await this.showPrompt(this.container, "No images are currently selected.", true); return; }
            const name = await this.showPrompt(this.container, "Enter a name for this Selection Set:");
            if (name && name.trim()) {
                if (!this.datasetState.data["__selections__"]) this.datasetState.data["__selections__"] = {};
                this.datasetState.data["__selections__"][name.trim()] = Array.from(this.datasetState.selectedFiles);
                renderPresets(); selSelect.value = name.trim(); await saveBackend();
            }
        });

        this.container.querySelector('#ht-sel-preset-del').addEventListener('click', async () => {
            if (!selSelect.value) { await this.showPrompt(this.container, "Choose a selection set from the dropdown to delete.", true); return; }
            delete this.datasetState.data["__selections__"][selSelect.value];
            renderPresets(); selSelect.value = ""; await saveBackend();
        });
        
        this.renderSelPresets = renderPresets;
    }

    initSearchMenu() {
        const btnFilter = this.container.querySelector('#ht-btn-filter');
        
        const updateFilterBtnState = () => {
            const f = this.datasetState.settings.filters;
            btnFilter.classList.toggle('active', f.search || f.tags || f.flagged || f.captioned || f.missing || f.invert);
        };

        const toggleFilter = (key, btnId) => {
            this.datasetState.settings.filters[key] = !this.datasetState.settings.filters[key];
            this.container.querySelector('#' + btnId).classList.toggle('active', this.datasetState.settings.filters[key]);
            updateFilterBtnState();
            this.renderFiles();
        };
        
        this.container.querySelector('#ht-filter-search').addEventListener('click', () => toggleFilter('search', 'ht-filter-search'));
        this.container.querySelector('#ht-filter-tags').addEventListener('click', () => toggleFilter('tags', 'ht-filter-tags'));
        this.container.querySelector('#ht-filter-flagged').addEventListener('click', () => toggleFilter('flagged', 'ht-filter-flagged'));
        this.container.querySelector('#ht-filter-captioned').addEventListener('click', () => toggleFilter('captioned', 'ht-filter-captioned'));
        this.container.querySelector('#ht-filter-missing').addEventListener('click', () => toggleFilter('missing', 'ht-filter-missing'));
        this.container.querySelector('#ht-filter-invert').addEventListener('click', () => toggleFilter('invert', 'ht-filter-invert'));

        this.container.querySelector('#ht-search-input').addEventListener('input', (e) => {
            this.datasetState.settings.searchQuery = e.target.value;
            if (this.datasetState.settings.filters.search) this.renderFiles();
        });

        const getStringColor = (str) => {
            let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
            const h = Math.abs(hash % 360), s = 50 + (Math.abs(hash) % 31), l = 50 + (Math.abs(hash >> 2) % 31); 
            return `hsl(${h}, ${s}%, ${l}%)`;
        };

        this.renderSearchPanelTags = () => {
            const selectedContainer = this.container.querySelector('#ht-search-tags-selected');
            const listContainer = this.container.querySelector('#ht-search-tags-list');
            selectedContainer.innerHTML = ''; listContainer.innerHTML = '';

            const globalTagsMap = this.datasetState.data["__global_tags__"] || {};
            
            this.datasetState.settings.searchTags.forEach(tag => {
                const pill = document.createElement('div'); pill.className = 'ht-tag-pill'; pill.style.backgroundColor = getStringColor(tag);
                pill.innerHTML = `<span>${tag}</span><span class="ht-tag-del">✖</span>`;
                pill.querySelector('.ht-tag-del').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.datasetState.settings.searchTags = this.datasetState.settings.searchTags.filter(t => t !== tag);
                    this.renderSearchPanelTags();
                    if (this.datasetState.settings.filters.tags) this.renderFiles();
                });
                selectedContainer.appendChild(pill);
            });

            let allTagsArray = Object.keys(globalTagsMap).filter(tag => !this.datasetState.settings.searchTags.includes(tag)).map(tag => ({ tag, count: globalTagsMap[tag] }));
            allTagsArray.sort((a, b) => {
                let result = this.searchTagSortMode === 'alpha' ? a.tag.localeCompare(b.tag) : b.count - a.count;
                return this.searchTagSortInvert ? -result : result;
            });

            allTagsArray.forEach(item => {
                const pill = document.createElement('div'); pill.className = 'ht-tag-pill ht-all-tags-pill'; pill.style.backgroundColor = getStringColor(item.tag);
                pill.innerHTML = `<span>${item.tag}</span><span class="ht-tag-count">${item.count}</span>`;
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.datasetState.settings.searchTags.push(item.tag);
                    this.renderSearchPanelTags();
                    if (this.datasetState.settings.filters.tags) this.renderFiles();
                });
                listContainer.appendChild(pill);
            });
        };

        this.container.addEventListener('global-tags-changed', () => this.renderSearchPanelTags());

        const btnSearchSortAlpha = this.container.querySelector('#ht-search-sort-alpha');
        const btnSearchSortCount = this.container.querySelector('#ht-search-sort-count');
        const btnSearchSortDir = this.container.querySelector('#ht-search-sort-dir');

        const updateSearchSortUI = () => {
            btnSearchSortAlpha.classList.toggle('active', this.searchTagSortMode === 'alpha');
            btnSearchSortCount.classList.toggle('active', this.searchTagSortMode === 'count');
            const isAscending = (this.searchTagSortMode === 'alpha' && !this.searchTagSortInvert) || (this.searchTagSortMode === 'count' && this.searchTagSortInvert);
            btnSearchSortDir.innerHTML = isAscending ? ICON_ARROW_UP : ICON_ARROW_DOWN;
        };

        btnSearchSortAlpha.addEventListener('click', (e) => { e.stopPropagation(); this.searchTagSortMode = 'alpha'; updateSearchSortUI(); this.renderSearchPanelTags(); });
        btnSearchSortCount.addEventListener('click', (e) => { e.stopPropagation(); this.searchTagSortMode = 'count'; updateSearchSortUI(); this.renderSearchPanelTags(); });
        btnSearchSortDir.addEventListener('click', (e) => { e.stopPropagation(); this.searchTagSortInvert = !this.searchTagSortInvert; updateSearchSortUI(); this.renderSearchPanelTags(); });
        updateSearchSortUI();
    }

    initDragAndDrop() {
        this.gallery.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); if (this.datasetState.currentFolder) this.gallery.classList.add('ht-drag-over'); });
        this.gallery.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); if (this.datasetState.currentFolder) this.gallery.classList.add('ht-drag-over'); });
        this.gallery.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); if (!this.gallery.contains(e.relatedTarget)) this.gallery.classList.remove('ht-drag-over'); });
        this.gallery.addEventListener('drop', async (e) => {
            e.preventDefault(); e.stopPropagation(); this.gallery.classList.remove('ht-drag-over');
            if (!this.datasetState.currentFolder) return;

            const files = e.dataTransfer.files;
            if (files.length === 0) return;

            const formData = new FormData();
            formData.append("folder", this.datasetState.currentFolder);
            
            const validExts = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'text/plain'];
            let hasValidFile = false;
            
            for (let i = 0; i < files.length; i++) {
                if (validExts.includes(files[i].type) || files[i].name.match(/\.(png|jpg|jpeg|webp|bmp|txt)$/i)) {
                    formData.append("images[]", files[i]);
                    hasValidFile = true;
                }
            }

            if (!hasValidFile) return;

            this.gallery.innerHTML = '<div class="ht-empty-gallery-msg" style="color:#82deff;">Uploading files...</div>';

            try {
                const response = await fetch('/handytools/captioner/upload_images', { method: 'POST', body: formData });
                const data = await response.json();
                if (data.success) this.gallery.dispatchEvent(new CustomEvent('upload-complete', { bubbles: true }));
            } catch (err) {
                console.error("Upload failed", err);
                this.renderFiles(); 
            }
        });
    }

    async executeDelete() {
        if (!this.datasetState.currentFolder || !this.datasetState.currentFile) {
            await this.showPrompt(this.container, "No image selected to delete.", true);
            return;
        }

        const confirmRes = await this.showConfirm(this.container, `Move <b>${this.datasetState.currentFile}</b> to trash?`);
        if (confirmRes) {
            try {
                const response = await fetch('/handytools/captioner/delete_image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folder: this.datasetState.currentFolder, filename: this.datasetState.currentFile })
                });
                
                const data = await response.json();
                if (data.error) throw new Error(data.error);

                if (this.datasetState.data[this.datasetState.currentFile]) {
                    const tags = this.datasetState.data[this.datasetState.currentFile].tags || [];
                    tags.forEach(t => {
                        if (this.datasetState.data["__global_tags__"] && this.datasetState.data["__global_tags__"][t]) {
                            this.datasetState.data["__global_tags__"][t]--;
                            if (this.datasetState.data["__global_tags__"][t] <= 0) delete this.datasetState.data["__global_tags__"][t];
                        }
                    });
                    delete this.datasetState.data[this.datasetState.currentFile];
                }

                this.datasetState.files = this.datasetState.files.filter(f => f.filename !== this.datasetState.currentFile);
                this.datasetState.selectedFiles.delete(this.datasetState.currentFile);
                
                // Clear any temp captions for the deleted file
                if (this.datasetState.tempCaptions && this.datasetState.tempCaptions[this.datasetState.currentFile]) {
                    delete this.datasetState.tempCaptions[this.datasetState.currentFile];
                }

                this.datasetState.currentFile = null;
                
                this.viewer.querySelector('#ht-img-container').style.display = 'none';
                const noImgTxt = this.viewer.querySelector('#ht-no-image-text');
                noImgTxt.style.display = 'block'; noImgTxt.textContent = "No Image Selected";
                this.container.querySelector('#ht-viewer-name').textContent = "";
                this.container.querySelector('#ht-viewer-dims').textContent = "";
                
                this.captionInput.value = "";
                this.captionInput.classList.remove('ht-unsaved');
                this.saveBtn.classList.remove('ht-unsaved-btn');
                
                this.renderFiles();
                this.container.dispatchEvent(new CustomEvent('global-tags-changed'));
            } catch (err) {
                console.error("Delete failed:", err);
            }
        }
    }
}