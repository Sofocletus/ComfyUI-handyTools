import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import * as Icons from "./minimaxCaptioner_icons.js";
import { CaptionerViewer } from "./minimaxCaptioner_viewer.js";
import { CaptionerTimeline } from "./minimaxCaptioner_timeline.js";
import { CaptionerGallery } from "./minimaxCaptioner_gallery.js";

app.registerExtension({
    name: "HandyTools.MinimaxH3Captioner",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MinimaxH3Captioner") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                // --- SHARED CONTEXT ---
                const ctx = {
                    api: api,
                    video: document.createElement("video"),
                    state: {
                        currentDir: "", currentFile: "", duration: 0,
                        segments: [], events: [], selection: { type: 'shot', index: 0 },
                        isManualMode: false, hideCaptioned: false, hasUnsavedChanges: false
                    },
                    methods: {}
                };

                const viewer = new CaptionerViewer(ctx);
                const timeline = new CaptionerTimeline(ctx);
                const gallery = new CaptionerGallery(ctx);

                const container = document.createElement("div");
                container.className = "vc-container";
                container.style.cssText = "display:flex; flex-direction:column; width:1400px; background:#000; color:#fff; font-family:sans-serif; border:1px solid #444; border-radius:6px; padding:10px; gap:8px; box-sizing:border-box;";

                // --- 3-COLUMN HORIZONTAL ROW ---
                const colsWrapper = document.createElement("div");
                colsWrapper.className = "vc-cols-wrapper";
                colsWrapper.style.cssText = "display:flex; flex-direction:row; width:100%; gap:12px; align-items:stretch;";

                // --- 1. LEFT COLUMN ---
                const leftCol = document.createElement("div");
                leftCol.className = "vc-col-left";
                leftCol.style.cssText = "width:640px; flex-shrink:0; display:flex; flex-direction:column; gap:8px;";
                leftCol.append(viewer.el, timeline.el);

                // --- 2. MIDDLE COLUMN ---
                const midCol = document.createElement("div");
                midCol.className = "vc-col-mid";
                midCol.style.cssText = "flex:1.2; display:flex; flex-direction:column; gap:8px;";

                const previewHeaderRow = document.createElement("div");
                previewHeaderRow.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
                
                const previewLabel = document.createElement("span");
                previewLabel.className = "vc-label";
                previewLabel.innerText = "Compiled Preview";
                
                const manualToggleLabel = document.createElement("label");
                manualToggleLabel.style.cssText = "font-size:11px; color:#ccc; cursor:pointer; display:flex; align-items:center; gap:4px;";
                const manualCheck = document.createElement("input");
                manualCheck.type = "checkbox";
                manualToggleLabel.append(manualCheck, document.createTextNode("Manual Mode"));
                
                previewHeaderRow.append(previewLabel, manualToggleLabel);

                const previewBox = document.createElement("textarea");
                previewBox.className = "vc-input";
                previewBox.readOnly = true; 
                previewBox.style.cssText = "flex:1; resize:none; background:#333; color:#82deff; border:3px solid #f44336; font-family:monospace; font-size:12px; padding:8px; box-sizing:border-box; min-height:100px;";
                previewBox.addEventListener("keydown", e => e.stopPropagation());
                previewBox.addEventListener("mousedown", e => e.stopPropagation());
                previewBox.addEventListener("input", () => { if (ctx.state.isManualMode) ctx.methods.markUnsaved(); });

                const saveBtn = document.createElement("button");
                saveBtn.className = "vc-btn vc-btn-success";
                saveBtn.style.cssText = "background:#27ae60; color:#fff; font-size:14px; padding:10px 14px; border:1px solid #777; width:100%; font-weight:bold; cursor:pointer; border-radius:4px;";
                saveBtn.innerHTML = `${Icons.ICON_EXPORT} Save Caption`;

                midCol.append(previewHeaderRow, previewBox, saveBtn);

                // --- 3. RIGHT COLUMN ---
                const rightCol = document.createElement("div");
                rightCol.className = "vc-col-right";
                rightCol.style.cssText = "flex:1; display:flex; flex-direction:column; gap:6px;";

                const metaTitle = document.createElement("div");
                metaTitle.className = "vc-panel-title";
                metaTitle.style.cssText = "font-size:11px; font-weight:bold; text-transform:uppercase; color:#82deff; margin-bottom:2px;";
                metaTitle.innerText = "Metadata & Description";
                rightCol.appendChild(metaTitle);

                const metadataInputs = [];
                const createInput = (title) => {
                    const wrap = document.createElement("div");
                    wrap.style.cssText = "display:flex; flex-direction:column; flex:1;";
                    const lbl = document.createElement("span");
                    lbl.className = "vc-label"; lbl.innerText = title;
                    const txt = document.createElement("textarea");
                    txt.className = "vc-input"; txt.style.cssText = "flex:1; resize:none; background:#111; color:#fff; border:1px solid #444; border-radius:4px; padding:6px; outline:none; font-family:sans-serif; font-size:11px; box-sizing:border-box;";
                    txt.addEventListener("keydown", e => e.stopPropagation());
                    txt.addEventListener("mousedown", e => e.stopPropagation());
                    txt.addEventListener("input", () => { if (!ctx.state.isManualMode) { ctx.methods.markUnsaved(); ctx.methods.generateLivePreview(); } });
                    wrap.append(lbl, txt);
                    metadataInputs.push(txt);
                    return { wrap, txt };
                };

                const inputSubject = createInput("Subject Definitions");
                const inputSound = createInput("Overall Soundscape");
                const inputMusic = createInput("Non-Diegetic Music");
                const inputChars = createInput("Characters");
                const inputLoc = createInput("Location");
                const inputLight = createInput("Lighting");

                rightCol.append(inputSubject.wrap, inputSound.wrap, inputMusic.wrap, inputChars.wrap, inputLoc.wrap, inputLight.wrap);

                // --- ASSEMBLE HIERARCHY ---
                colsWrapper.append(leftCol, midCol, rightCol);
                container.append(colsWrapper, gallery.folderBar, gallery.galleryStrip);

                const domWidget = node.addDOMWidget("VideoPlayer", "DOM", container);
                domWidget.computeSize = function() { return [1400, 760]; };

                // --- UI PERSISTENCE METHODS ---
                ctx.methods.saveUIState = async () => {
                    const payload = {
                        currentDir: ctx.state.currentDir,
                        currentFile: ctx.state.currentFile,
                        isManualMode: ctx.state.isManualMode,
                        hideCaptioned: ctx.state.hideCaptioned
                    };
                    try {
                        await api.fetchApi("/handyTools/save_ui_state", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        });
                    } catch (e) { console.warn("Failed to persist UI state", e); }
                };

                ctx.methods.loadUIState = async () => {
                    try {
                        const response = await api.fetchApi("/handyTools/load_ui_state");
                        const res = await response.json();
                        if (res.status === "success" && res.data) {
                            const data = res.data;
                            
                            // Restore hide captioned toggle
                            if (data.hideCaptioned !== undefined) {
                                ctx.state.hideCaptioned = data.hideCaptioned;
                                gallery.toggleHideBtn.innerText = ctx.state.hideCaptioned ? "👁️ Show All" : "👁️ Hide Captioned";
                            }
                            
                            // Restore Manual Mode
                            if (data.isManualMode !== undefined) {
                                manualCheck.checked = data.isManualMode;
                                ctx.methods.applyManualModeUI(data.isManualMode);
                            }
                            
                            // Load Folder and File
                            if (data.currentDir) {
                                ctx.state.currentDir = data.currentDir;
                                gallery.folderInput.value = data.currentDir;
                                if (data.currentFile) ctx.state.currentFile = data.currentFile;
                                await gallery.loadFolderVideos(); // This will auto-select the currentFile
                            }
                        }
                    } catch (e) { console.log("No previous UI state found."); }
                };

                // --- WIRING METHODS ---
                ctx.methods.markUnsaved = () => {
                    ctx.state.hasUnsavedChanges = true;
                    previewBox.style.border = "3px solid #f44336"; 
                    saveBtn.style.backgroundColor = "#c0392b"; 
                    saveBtn.innerHTML = `${Icons.ICON_EXPORT} Save Caption (Unsaved)`;
                };

                ctx.methods.markSaved = () => {
                    ctx.state.hasUnsavedChanges = false;
                    previewBox.style.border = "3px solid #4caf50"; 
                    saveBtn.style.backgroundColor = "#27ae60"; 
                    saveBtn.innerHTML = `${Icons.ICON_EXPORT} Save Caption (Saved)`;
                };

                ctx.methods.resetAll = () => {
                    inputSubject.txt.value = ""; inputSound.txt.value = ""; inputMusic.txt.value = "";
                    inputChars.txt.value = ""; inputLoc.txt.value = ""; inputLight.txt.value = "";
                    if (ctx.state.isManualMode) previewBox.value = "";
                    ctx.state.segments = [{ start: 0, end: ctx.state.duration, text: "", isShotCut: true }];
                    ctx.state.events = [];
                    ctx.state.selection = { type: 'shot', index: 0 };
                    timeline.render(false);
                    ctx.methods.generateLivePreview();
                    ctx.methods.markUnsaved();
                };

                ctx.methods.applyManualModeUI = (isManual) => {
                    ctx.state.isManualMode = isManual;
                    if (isManual) {
                        previewBox.readOnly = false;
                        previewBox.style.background = "#111111"; previewBox.style.color = "#cccccc";
                        metadataInputs.forEach(i => { i.disabled = true; i.style.opacity = "0.8"; });
                    } else {
                        previewBox.readOnly = true;
                        previewBox.style.background = "#333333"; previewBox.style.color = "#82deff";
                        metadataInputs.forEach(i => { i.disabled = false; i.style.opacity = "1"; });
                        ctx.methods.generateLivePreview(); 
                    }
                };

                manualCheck.addEventListener("change", () => {
                    ctx.methods.applyManualModeUI(manualCheck.checked);
                    ctx.methods.markUnsaved();
                    ctx.methods.saveUIState(); // Persist UI change
                });

                ctx.methods.generateLivePreview = () => {
                    if (ctx.state.isManualMode) return;
                    let hasContent = false;
                    let markers = [];
                    
                    ctx.state.segments.forEach(s => { if (s.text && s.text.trim()) hasContent = true; markers.push({ type: 'segment', time: s.start, text: s.text, isShotCut: s.isShotCut }); });
                    ctx.state.events.forEach(e => { if (e.text && e.text.trim()) hasContent = true; markers.push({ type: 'event', time: e.time, text: e.text, isShotCut: false }); });

                    const subVal = inputSubject.txt.value.trim(); const sndVal = inputSound.txt.value.trim();
                    const musVal = inputMusic.txt.value.trim(); const chrVal = inputChars.txt.value.trim();
                    const locVal = inputLoc.txt.value.trim(); const ligVal = inputLight.txt.value.trim();

                    if (subVal || sndVal || musVal || chrVal || locVal || ligVal || ctx.state.segments.length > 1 || ctx.state.events.length > 0) hasContent = true;
                    if (!hasContent) { previewBox.value = ""; return; }

                    markers.sort((a, b) => a.time - b.time);
                    let shotCount = 0; let imdString = "integrated_multimodal_description:";

                    markers.forEach(m => {
                        let part = "";
                        if (m.type === 'segment' && m.isShotCut) { shotCount++; part += `\n[Shot ${shotCount}]`; } 
                        if (m.time > 0) part += ` At ${timeline.formatTime(m.time)}`;
                        if (m.text && m.text.trim()) part += ` ${m.text.trim()}`;
                        imdString += part;
                    });

                    let out = "";
                    if (subVal) out += `subject_definitions: ${subVal}\n\n`;
                    out += imdString + "\n\n";

                    const addMeta = (label, val) => { if (val) out += `${label}: ${val}\n\n`; };
                    addMeta("overall_soundscape", sndVal); addMeta("non_diegetic_music", musVal);
                    addMeta("characters", chrVal); addMeta("location", locVal); addMeta("lighting", ligVal);
                    previewBox.value = out.trim();
                };

                saveBtn.addEventListener("click", async () => {
                    if (!ctx.state.currentFile || !previewBox.value) return;
                    saveBtn.innerText = "Saving...";

                    const statePayload = {
                        manualMode: ctx.state.isManualMode,
                        manualText: ctx.state.isManualMode ? previewBox.value : "",
                        subject: inputSubject.txt.value, soundscape: inputSound.txt.value,
                        music: inputMusic.txt.value, chars: inputChars.txt.value,
                        loc: inputLoc.txt.value, lighting: inputLight.txt.value,
                        segments: ctx.state.segments, events: ctx.state.events
                    };

                    try {
                        const response = await api.fetchApi("/handyTools/save_caption", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ dir_path: ctx.state.currentDir, filename: ctx.state.currentFile, text: previewBox.value, state: statePayload })
                        });
                        const result = await response.json();
                        if (result.status === "success") {
                            ctx.methods.markSaved(); 
                            gallery.markThumbnailSaved(ctx.state.currentFile);
                        } else {
                            saveBtn.innerText = "❌ Error"; saveBtn.style.background = "#f44336";
                        }
                    } catch (err) { saveBtn.innerText = "❌ Failed"; saveBtn.style.background = "#f44336"; }
                });

                ctx.methods.selectVideo = (filename) => {
                    ctx.state.currentFile = filename;
                    const relativePath = ctx.state.currentDir ? `${ctx.state.currentDir}/${filename}` : filename;
                    const fullUrl = api.apiURL(`/handyTools/serve_video?path=${encodeURIComponent(relativePath)}&t=${Date.now()}`);
                    ctx.video.src = fullUrl;
                    timeline.btnPlay.innerHTML = Icons.ICON_PLAY;
                    timeline.isPlaying = false;
                    timeline.drawWaveform(fullUrl);
                    
                    // Persist selected file
                    ctx.methods.saveUIState(); 
                };

                const loadExistingState = async (dir, filename) => {
                    try {
                        const response = await api.fetchApi(`/handyTools/load_caption_state?dir=${encodeURIComponent(dir)}&filename=${encodeURIComponent(filename)}`);
                        const res = await response.json();

                        if (res.status === "success" && res.data) {
                            const state = res.data;
                            manualCheck.checked = !!state.manualMode;
                            ctx.methods.applyManualModeUI(!!state.manualMode);

                            if (state.manualMode) {
                                previewBox.value = state.manualText || "";
                            } else {
                                inputSubject.txt.value = state.subject || ""; inputSound.txt.value = state.soundscape || "";
                                inputMusic.txt.value = state.music || ""; inputChars.txt.value = state.chars || "";
                                inputLoc.txt.value = state.loc || ""; inputLight.txt.value = state.lighting || "";
                            }
                            ctx.state.segments = (state.segments && state.segments.length > 0) ? state.segments : [{ start: 0, end: ctx.state.duration, text: "", isShotCut: true }];
                            ctx.state.events = state.events || [];
                            ctx.state.selection = { type: 'shot', index: 0 };
                            timeline.render(false);
                            if (!ctx.state.isManualMode) ctx.methods.generateLivePreview();
                            ctx.methods.markSaved(); 
                            return;
                        }
                    } catch (err) {}

                    manualCheck.checked = false;
                    ctx.methods.applyManualModeUI(false);
                    inputSubject.txt.value = ""; inputSound.txt.value = ""; inputMusic.txt.value = "";
                    inputChars.txt.value = ""; inputLoc.txt.value = ""; inputLight.txt.value = "";
                    
                    ctx.state.segments = [{ start: 0, end: ctx.state.duration, text: "", isShotCut: true }];
                    ctx.state.events = [];
                    ctx.state.selection = { type: 'shot', index: 0 };
                    timeline.render(false);
                    ctx.methods.generateLivePreview();
                    ctx.methods.markSaved(); 
                };

                ctx.video.addEventListener("timeupdate", () => {
                    if (!ctx.state.duration) return;
                    if(timeline.isPlaying) timeline.updatePlayheadVisual(ctx.video.currentTime);
                });

                ctx.video.addEventListener("ended", () => { timeline.isPlaying = false; timeline.btnPlay.innerHTML = Icons.ICON_PLAY; });
                ctx.video.addEventListener("loadedmetadata", () => {
                    ctx.state.duration = ctx.video.duration || 0;
                    loadExistingState(ctx.state.currentDir, ctx.state.currentFile);
                });

                // INIT SEQUENCE: Load persistent UI state, which handles triggering the gallery load
                ctx.methods.loadUIState().then(() => {
                    setTimeout(ctx.methods.generateLivePreview, 500);
                });
                
                return r;
            };
        }
    }
});