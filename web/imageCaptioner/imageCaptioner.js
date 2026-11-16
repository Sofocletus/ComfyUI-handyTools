import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { GalleryManager } from "./gallery.js";
import { ToolsPanelManager } from "./toolsPanel.js"; 
import { ViewerManager } from "./viewer.js";
import { getCaptionerHTML } from "./template.js";
import { showPrompt, showConfirm } from "./utils.js";

const link = document.createElement('link');
link.rel = 'stylesheet';
link.type = 'text/css';
link.href = '/extensions/ComfyUI-handyTools/imageCaptioner/styles.css';
document.head.appendChild(link);

app.registerExtension({
    name: "handyTools.ImageCaptioner",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "HandyToolImageCaptioner") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                const datasetState = {
                    currentFolder: "",
                    resolvedSourceFolder: "",
                    currentFile: null,
                    fileToRestore: null,
                    data: {},
                    files: [], 
                    selectedFiles: new Set(),
                    vlmQueue: new Map(),
                    vlmProcessing: new Set(),
                    vlmFinishedRecently: new Set(),
                    generatingEdits: new Set(), 
                    bypassCreateWarning: false, 
                    settings: {
                        sortMode: 'alpha',
                        sortInvert: false, 
                        twoColumns: false,
                        filters: {
                            search: false,
                            tags: false,
                            flagged: false,
                            captioned: false,
                            missing: false,
                            invert: false
                        },
                        searchQuery: '',
                        searchTags: [],
                        currentCaptionIndex: 1
                    }
                };
                
                const container = document.createElement("div");
                container.className = "ht-captioner-container";
                container.tabIndex = 0; 
                
                container.innerHTML = getCaptionerHTML();

                // Global element references
                const galleryEl = container.querySelector('#ht-gallery');
                const viewerEl = container.querySelector('#ht-viewer');
                const folderInput = container.querySelector('#ht-folder-input');
                const loadBtn = container.querySelector('#ht-load-btn');
                const captionInput = container.querySelector('#ht-caption-input');
                const saveBtn = container.querySelector('#ht-save-btn');

                // Initialize Sub-Managers
                const galleryManager = new GalleryManager(container, galleryEl, viewerEl, captionInput, saveBtn, loadBtn, datasetState, showPrompt, showConfirm);
                const toolsPanelManager = new ToolsPanelManager(container, datasetState, galleryManager, viewerEl, loadBtn, (msg, alert) => showPrompt(container, msg, alert));
                const viewerManager = new ViewerManager(container, datasetState, loadBtn, (msg, alert) => showPrompt(container, msg, alert));

                // --- UI PERSISTENCE ---
                const saveUIState = () => {
                    if (!datasetState.currentFolder) return;
                    fetch('/handytools/captioner/save_state', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            currentFolder: datasetState.currentFolder,
                            currentFile: datasetState.currentFile
                        })
                    }).catch(err => console.error(err));
                };

                container.addEventListener('file-selected', () => saveUIState());
                
                container.addEventListener('refresh-gallery', () => {
                    galleryManager.renderFiles();
                });

                // --- DATASET WARNING INTERCEPT (Event Capture) ---
                const createBtn = container.querySelector('#ht-ds-create');
                createBtn.addEventListener('click', (e) => {
                    const hasPending = datasetState.files.some(f => f.has_temp) || datasetState.generatingEdits.size > 0;
                    if (hasPending && !datasetState.bypassCreateWarning) {
                        e.preventDefault();
                        e.stopPropagation(); // Stops the actual creation logic from firing!
                        
                        showConfirm(container, "There are unfinished or generating edits. Creating a dataset now will exclude them. Discard all temporary edits and continue?", async (confirmed) => {
                            if (confirmed) {
                                await fetch('/handytools/captioner/discard_all_edits', {
                                    method: 'POST', headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({folder: datasetState.currentFolder})
                                });
                                
                                datasetState.generatingEdits.clear();
                                datasetState.files.forEach(f => f.has_temp = false);
                                
                                if (datasetState.currentFile) {
                                    const file = datasetState.files.find(f => f.filename === datasetState.currentFile);
                                    if (file) viewerManager.updateViewerState(file);
                                }
                                
                                // Temporarily bypass the block and re-click programmatically to trigger actual creation
                                datasetState.bypassCreateWarning = true;
                                createBtn.click();
                                datasetState.bypassCreateWarning = false;
                            }
                        });
                    }
                }, true); // TRUE = Capture Phase (Intercepts before standard click handlers!)


                // --- NATIVE WEBSOCKET LISTENERS FOR WORKFLOW TRACKING ---
                api.addEventListener("ht-caption-updated", (event) => {
                    const payload = event.detail;
                    if (payload.folder === datasetState.currentFolder) {
                        datasetState.vlmFinishedRecently.add(payload.filename);

                        if (!datasetState.data[payload.filename]) datasetState.data[payload.filename] = {};
                        const activeCapKey = `caption${payload.captionIndex}`;
                        datasetState.data[payload.filename][activeCapKey] = payload.caption;
                        
                        if (datasetState.currentFile === payload.filename && datasetState.settings.currentCaptionIndex === payload.captionIndex) {
                            captionInput.value = payload.caption;
                            captionInput.classList.remove('ht-unsaved');
                            saveBtn.classList.remove('ht-unsaved-btn');
                        }
                        
                        datasetState.vlmProcessing.delete(payload.filename);
                        const pidsToDelete = [];
                        datasetState.vlmQueue.forEach((fname, pid) => {
                            if (fname === payload.filename) pidsToDelete.push(pid);
                        });
                        pidsToDelete.forEach(pid => datasetState.vlmQueue.delete(pid));
                        
                        galleryManager.renderFiles();
                    }
                });

                // NEW: Handle Temporary Captions generated by generic API endpoint
                api.addEventListener("ht-caption-temp-ready", (event) => {
                    const data = event.detail;
                    
                    if (!datasetState.tempCaptions) datasetState.tempCaptions = {};
                    if (!datasetState.tempCaptions[data.filename]) datasetState.tempCaptions[data.filename] = {};
                    
                    datasetState.tempCaptions[data.filename][`caption${data.captionIndex}`] = data.caption;
                    
                    datasetState.vlmProcessing.delete(data.filename);
                    const pidsToDelete = [];
                    datasetState.vlmQueue.forEach((fname, pid) => {
                        if (fname === data.filename) pidsToDelete.push(pid);
                    });
                    pidsToDelete.forEach(pid => datasetState.vlmQueue.delete(pid));

                    if (datasetState.currentFile === data.filename && datasetState.settings.currentCaptionIndex === data.captionIndex) {
                        const discardBtn = document.querySelector('#ht-discard-cap-btn');
                        
                        if (captionInput) {
                            captionInput.value = data.caption;
                            captionInput.classList.add('ht-unsaved');
                            saveBtn.classList.add('ht-unsaved-btn');
                            if (discardBtn) discardBtn.classList.remove('ht-hidden'); 
                        }
                    }
                    
                    galleryManager.renderFiles();
                });

                api.addEventListener("executing", (e) => {
                    if (e.detail && e.detail.prompt_id) {
                        const pid = e.detail.prompt_id;
                        if (datasetState.vlmQueue.has(pid)) {
                            const filename = datasetState.vlmQueue.get(pid);
                            datasetState.vlmProcessing.add(filename);
                            galleryManager.renderFiles();
                        }
                    }
                });

                api.addEventListener("status", (e) => {
                    if (e.detail && e.detail.exec_info && e.detail.exec_info.queue_remaining === 0) {
                        if (datasetState.vlmQueue.size > 0 || datasetState.vlmProcessing.size > 0) {
                            datasetState.vlmQueue.clear();
                            datasetState.vlmProcessing.clear();
                            galleryManager.renderFiles();
                        }
                    }
                });

                // --- DATASET NETWORK OPERATIONS ---
                folderInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') loadBtn.click();
                });

                galleryEl.addEventListener('upload-complete', () => loadBtn.click());

                loadBtn.addEventListener('click', async () => {
                    datasetState.currentFolder = folderInput.value.trim();
                    if (!datasetState.currentFolder) return;
                    
                    if (datasetState.currentFile && !datasetState.fileToRestore) {
                        datasetState.fileToRestore = datasetState.currentFile;
                    }
                    
                    loadBtn.textContent = "Loading...";
                    try {
                        const response = await fetch('/handytools/captioner/load_project', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ folder: datasetState.currentFolder })
                        });
                        const data = await response.json();
                        
                        if (data.error) {
                            await showPrompt(container, data.error, true);
                            return;
                        }

                        datasetState.data = data.dataset;
                        datasetState.files = data.files; 
                        datasetState.resolvedSourceFolder = data.source_folder;
                        datasetState.settings.searchTags = []; 
                        
                        // NEW: Restore active temporary captions state into UI memory
                        datasetState.tempCaptions = data.temp_captions || {};
                        
                        const currentSource = datasetState.data["__settings__"]?.image_source || "_source";
                        container.querySelector('#ht-setting-source').value = currentSource;
                        
                        datasetState.selectedFiles.clear();
                        if (!datasetState.data["__selections__"]) datasetState.data["__selections__"] = {};
                        
                        galleryManager.renderSelPresets();
                        galleryManager.fetchBackups();
                        galleryManager.renderFiles();
                        toolsPanelManager.renderTags();
                        container.dispatchEvent(new CustomEvent('global-tags-changed'));
                        
                        saveUIState();

                        if (datasetState.fileToRestore) {
                            setTimeout(() => {
                                const items = Array.from(galleryEl.querySelectorAll('.ht-gallery-item'));
                                const target = items.find(item => {
                                    const img = item.querySelector('img');
                                    if (!img) return false;
                                    return img.getAttribute('data-filename') === datasetState.fileToRestore;
                                });
                                if (target) {
                                    target.click();
                                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                                datasetState.fileToRestore = null;
                            }, 50);
                        }
                    } catch (err) {
                        console.error("Failed to load project:", err);
                    } finally {
                        loadBtn.textContent = "Start";
                    }
                });

                saveBtn.addEventListener('click', async () => {
                    if (!datasetState.currentFolder || !datasetState.currentFile) return;
                    
                    const caption = captionInput.value;
                    const prevText = saveBtn.textContent;
                    saveBtn.textContent = "Saving...";
                    
                    try {
                        await fetch('/handytools/captioner/save_caption', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                folder: datasetState.currentFolder, 
                                filename: datasetState.currentFile, 
                                caption: caption,
                                captionIndex: datasetState.settings.currentCaptionIndex
                            })
                        });
                        
                        if (!datasetState.data[datasetState.currentFile]) datasetState.data[datasetState.currentFile] = {};
                        
                        const activeCapKey = `caption${datasetState.settings.currentCaptionIndex}`;
                        datasetState.data[datasetState.currentFile][activeCapKey] = caption;
                        
                        // NEW: Clean up memory so Discard button disappears
                        if (datasetState.tempCaptions && datasetState.tempCaptions[datasetState.currentFile]) {
                            delete datasetState.tempCaptions[datasetState.currentFile][activeCapKey];
                        }
                        const discardBtn = container.querySelector('#ht-discard-cap-btn');
                        if (discardBtn) discardBtn.classList.add('ht-hidden');
                        
                        captionInput.classList.remove('ht-unsaved');
                        saveBtn.classList.remove('ht-unsaved-btn');
                        
                        galleryManager.renderFiles();
                        toolsPanelManager.renderTags();
                    } catch (err) {
                        console.error("Failed to save caption:", err);
                    } finally {
                        setTimeout(() => saveBtn.textContent = prevText, 500);
                    }
                });
                
                viewerEl.addEventListener('image-changed', () => {
                    captionInput.classList.remove('ht-unsaved');
                    saveBtn.classList.remove('ht-unsaved-btn');
                });

                const widget = this.addDOMWidget("CaptionerUI", "div", container, {
                    serialize: false,
                    hideOnZoom: false
                });
                
                fetch('/handytools/captioner/load_state')
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.currentFolder) {
                            folderInput.value = data.currentFolder;
                            datasetState.fileToRestore = data.currentFile;
                            loadBtn.click();
                        }
                    }).catch(err => console.error("No previous state found."));

                widget.computeSize = function() { return [1608, 768]; };
                this.setSize([1628, 808]); 
                this.setDirtyCanvas(true, true);

                return r;
            };
        }
    }
});