import * as Icons from "./videoClipper_icons.js";

export function createPanels(ctx) {
    const preventEvents = (e) => e.stopPropagation();

    // ==========================================
    // 1. LEFT PANEL (Project & Framing)
    // ==========================================
    const leftPanel = document.createElement("div");
    leftPanel.className = "vc-panel vc-left-panel";

    const projectTitle = document.createElement("div");
    projectTitle.className = "vc-panel-title";
    projectTitle.innerHTML = `${Icons.ICON_EXPORT} Project`;
    leftPanel.appendChild(projectTitle);

    const folderRow = document.createElement("div");
    folderRow.className = "vc-row";

    const folderInput = document.createElement("input");
    folderInput.type = "text";
    folderInput.className = "vc-input";
    folderInput.placeholder = "Folder path (default input/)...";
    folderInput.style.flex = "1";
    folderInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") ctx.gallery.loadFolderVideos(folderInput.value);
    });
    folderInput.addEventListener("mousedown", preventEvents);
    folderInput.addEventListener("change", () => ctx.saveUiState());

    const loadBtn = document.createElement("button");
    loadBtn.className = "vc-btn vc-btn-subtle";
    loadBtn.innerHTML = `${Icons.ICON_REFRESH} Load`;
    loadBtn.title = "Scan and load folder";
    loadBtn.onclick = () => ctx.gallery.loadFolderVideos(folderInput.value);

    folderRow.appendChild(folderInput);
    folderRow.appendChild(loadBtn);
    leftPanel.appendChild(folderRow);

    const proxyRow = document.createElement("div");
    proxyRow.className = "vc-row";

    const proxyBtn = document.createElement("button");
    proxyBtn.className = "vc-btn vc-btn-subtle";
    proxyBtn.style.flex = "1";
    proxyBtn.innerHTML = `${Icons.ICON_PROXY} Create Proxy`;
    proxyBtn.disabled = true;

    proxyRow.appendChild(proxyBtn);
    leftPanel.appendChild(proxyRow);

    const divider = document.createElement("div");
    divider.className = "vc-section-divider";
    leftPanel.appendChild(divider);

    const clipTitle = document.createElement("div");
    clipTitle.className = "vc-panel-title";
    clipTitle.innerHTML = `${Icons.ICON_CROP} Clip Controls`;
    leftPanel.appendChild(clipTitle);

    const clipNameRow = document.createElement("div");
    clipNameRow.className = "vc-row";

    const clipNameLbl = document.createElement("span");
    clipNameLbl.className = "vc-label";
    clipNameLbl.innerText = "Selected:";

    const clipBadge = document.createElement("span");
    clipBadge.className = "vc-clip-badge none";
    clipBadge.innerText = "None";

    clipNameRow.appendChild(clipNameLbl);
    clipNameRow.appendChild(clipBadge);
    leftPanel.appendChild(clipNameRow);

    const arMpRow = document.createElement("div");
    arMpRow.className = "vc-row";

    const arSelect = document.createElement("select");
    arSelect.className = "vc-input";
    arSelect.style.flex = "1";
    arSelect.addEventListener("mousedown", preventEvents);
    ["16:9", "9:16", "1:1", "4:3", "3:4"].forEach(ar => {
        const opt = document.createElement("option");
        opt.value = ar;
        opt.innerText = ar;
        arSelect.appendChild(opt);
    });

    const mpSelect = document.createElement("select");
    mpSelect.className = "vc-input";
    mpSelect.style.flex = "1";
    mpSelect.addEventListener("mousedown", preventEvents);

    arMpRow.appendChild(arSelect);
    arMpRow.appendChild(mpSelect);
    leftPanel.appendChild(arMpRow);

    const sizeRow = document.createElement("div");
    sizeRow.className = "vc-row";

    const sizeLbl = document.createElement("span");
    sizeLbl.className = "vc-label";
    sizeLbl.innerText = "Custom:";

    const widthInput = document.createElement("input");
    widthInput.type = "number";
    widthInput.className = "vc-input vc-input-num";
    widthInput.style.width = "60px";
    widthInput.addEventListener("keydown", preventEvents);
    widthInput.addEventListener("mousedown", preventEvents);

    const xLabel = document.createElement("span");
    xLabel.innerText = "x";
    xLabel.style.color = "#777";

    const heightInput = document.createElement("input");
    heightInput.type = "number";
    heightInput.className = "vc-input vc-input-num";
    heightInput.style.width = "60px";
    heightInput.addEventListener("keydown", preventEvents);
    heightInput.addEventListener("mousedown", preventEvents);

    sizeRow.appendChild(sizeLbl);
    sizeRow.appendChild(widthInput);
    sizeRow.appendChild(xLabel);
    sizeRow.appendChild(heightInput);
    leftPanel.appendChild(sizeRow);

    const createOffsetRow = (label) => {
        const row = document.createElement("div");
        row.className = "vc-row";

        const lbl = document.createElement("span");
        lbl.className = "vc-label";
        lbl.innerText = label;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.value = "50";
        slider.style.flex = "1";
        slider.addEventListener("mousedown", preventEvents);

        const num = document.createElement("input");
        num.type = "number";
        num.min = "0";
        num.max = "100";
        num.value = "50";
        num.className = "vc-input vc-input-num";
        num.style.width = "40px";
        num.addEventListener("keydown", preventEvents);
        num.addEventListener("mousedown", preventEvents);

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(num);
        return { row, slider, num };
    };

    const ctrlX = createOffsetRow("Shift X:");
    const ctrlY = createOffsetRow("Shift Y:");
    leftPanel.appendChild(ctrlX.row);
    leftPanel.appendChild(ctrlY.row);

    const cropModeRow = document.createElement("div");
    cropModeRow.className = "vc-row";

    const cropModeLabel = document.createElement("label");
    cropModeLabel.className = "vc-row";
    cropModeLabel.style.cursor = "pointer";

    const cropModeCheck = document.createElement("input");
    cropModeCheck.type = "checkbox";
    cropModeCheck.checked = true;
    cropModeCheck.addEventListener("mousedown", preventEvents);

    const cropModeText = document.createElement("span");
    cropModeText.className = "vc-label";
    cropModeText.innerText = "Crop Mode (Lock resolution)";

    cropModeLabel.appendChild(cropModeCheck);
    cropModeLabel.appendChild(cropModeText);
    cropModeRow.appendChild(cropModeLabel);
    leftPanel.appendChild(cropModeRow);

    const zoomRow = document.createElement("div");
    zoomRow.className = "vc-row";

    const zoomLbl = document.createElement("span");
    zoomLbl.className = "vc-label";
    zoomLbl.innerText = "Zoom:";

    const scaleSlider = document.createElement("input");
    scaleSlider.type = "range";
    scaleSlider.min = "50";
    scaleSlider.max = "200";
    scaleSlider.value = "100";
    scaleSlider.style.flex = "1";
    scaleSlider.addEventListener("mousedown", preventEvents);

    const scaleInput = document.createElement("input");
    scaleInput.type = "number";
    scaleInput.min = "0.5";
    scaleInput.max = "2.0";
    scaleInput.step = "0.01";
    scaleInput.value = "1.00";
    scaleInput.className = "vc-input vc-input-num";
    scaleInput.style.width = "45px";
    scaleInput.addEventListener("keydown", preventEvents);
    scaleInput.addEventListener("mousedown", preventEvents);

    zoomRow.appendChild(zoomLbl);
    zoomRow.appendChild(scaleSlider);
    zoomRow.appendChild(scaleInput);
    leftPanel.appendChild(zoomRow);

    // ==========================================
    // 2. RIGHT PANEL (Clips List & Export)
    // ==========================================
    const rightPanel = document.createElement("div");
    rightPanel.className = "vc-panel vc-right-panel";

    const exportTitle = document.createElement("div");
    exportTitle.className = "vc-panel-title";
    exportTitle.innerHTML = `${Icons.ICON_EXPORT} Clips & Export`;
    rightPanel.appendChild(exportTitle);

    // 2a. Custom Name: Checkbox + Input on SAME row
    const customNameRow = document.createElement("div");
    customNameRow.className = "vc-row";

    const customNameLabel = document.createElement("label");
    customNameLabel.className = "vc-row";
    customNameLabel.style.cursor = "pointer";

    const customNameCheck = document.createElement("input");
    customNameCheck.type = "checkbox";
    customNameCheck.addEventListener("mousedown", preventEvents);

    const customNameText = document.createElement("span");
    customNameText.className = "vc-label";
    customNameText.style.minWidth = "auto";
    customNameText.style.whiteSpace = "nowrap";
    customNameText.innerText = "Custom Name:";

    customNameLabel.appendChild(customNameCheck);
    customNameLabel.appendChild(customNameText);

    const customNameInput = document.createElement("input");
    customNameInput.type = "text";
    customNameInput.className = "vc-input";
    customNameInput.placeholder = "Export prefix...";
    customNameInput.style.flex = "1";
    customNameInput.disabled = true;
    customNameInput.style.opacity = "0.5";
    customNameInput.addEventListener("keydown", preventEvents);
    customNameInput.addEventListener("mousedown", preventEvents);

    customNameCheck.addEventListener("change", (e) => {
        customNameInput.disabled = !e.target.checked;
        customNameInput.style.opacity = e.target.checked ? "1" : "0.5";
        if (e.target.checked) customNameInput.focus();
        ctx.saveUiState();
    });
    customNameInput.addEventListener("input", () => ctx.saveUiState());

    customNameRow.appendChild(customNameLabel);
    customNameRow.appendChild(customNameInput);
    rightPanel.appendChild(customNameRow);

    // 2b. Clip List Header with Count & Batch Select Icons
    const clipListHeader = document.createElement("div");
    clipListHeader.className = "vc-clip-list-header";

    const clipListTitle = document.createElement("div");
    clipListTitle.className = "vc-clip-list-title";
    clipListTitle.innerHTML = `Clips <span class="vc-clip-list-count" id="vc-clip-count">0</span>`;

    const batchGroup = document.createElement("div");
    batchGroup.style.display = "flex";
    batchGroup.style.gap = "4px";

    const selectAllBtn = document.createElement("button");
    selectAllBtn.className = "vc-icon-btn small";
    selectAllBtn.innerHTML = Icons.ICON_SELECT_ALL;
    selectAllBtn.title = "Select All";
    selectAllBtn.addEventListener("click", () => {
        ctx.state.clips.forEach(c => { c.selectedForExport = true; });
        renderClipList();
        ctx.saveUiState();
    });

    const selectNoneBtn = document.createElement("button");
    selectNoneBtn.className = "vc-icon-btn small";
    selectNoneBtn.innerHTML = Icons.ICON_SELECT_NONE;
    selectNoneBtn.title = "Select None";
    selectNoneBtn.addEventListener("click", () => {
        ctx.state.clips.forEach(c => { c.selectedForExport = false; });
        renderClipList();
        ctx.saveUiState();
    });

    const invertSelectBtn = document.createElement("button");
    invertSelectBtn.className = "vc-icon-btn small";
    invertSelectBtn.innerHTML = Icons.ICON_INVERT;
    invertSelectBtn.title = "Invert Selection";
    invertSelectBtn.addEventListener("click", () => {
        ctx.state.clips.forEach(c => {
            c.selectedForExport = c.selectedForExport === false ? true : false;
        });
        renderClipList();
        ctx.saveUiState();
    });

    batchGroup.appendChild(selectAllBtn);
    batchGroup.appendChild(selectNoneBtn);
    batchGroup.appendChild(invertSelectBtn);

    clipListHeader.appendChild(clipListTitle);
    clipListHeader.appendChild(batchGroup);
    rightPanel.appendChild(clipListHeader);

    // 2c. Scrollable 32px Clip Items Container
    const clipListContainer = document.createElement("div");
    clipListContainer.className = "vc-clip-list";
    rightPanel.appendChild(clipListContainer);

    // 2d. Bottom Export Section
    const exportBottom = document.createElement("div");
    exportBottom.className = "vc-export-bottom";

    const exportBtn = document.createElement("button");
    exportBtn.className = "vc-btn vc-export-btn";
    exportBtn.innerHTML = `${Icons.ICON_EXPORT} Export Clips`;

    const exportOptionsCol = document.createElement("div");
    exportOptionsCol.className = "vc-export-options-col";

    const folderBySizeLabel = document.createElement("label");
    folderBySizeLabel.className = "vc-checkbox-row";
    const saveBySizeCheck = document.createElement("input");
    saveBySizeCheck.type = "checkbox";
    saveBySizeCheck.addEventListener("mousedown", preventEvents);
    saveBySizeCheck.addEventListener("change", () => ctx.saveUiState());
    folderBySizeLabel.appendChild(saveBySizeCheck);
    folderBySizeLabel.appendChild(document.createTextNode("Folder by resolution"));

    const exportSelectedLabel = document.createElement("label");
    exportSelectedLabel.className = "vc-checkbox-row";
    const exportSelectedCheck = document.createElement("input");
    exportSelectedCheck.type = "checkbox";
    exportSelectedCheck.addEventListener("mousedown", preventEvents);
    exportSelectedCheck.addEventListener("change", () => ctx.saveUiState());
    exportSelectedLabel.appendChild(exportSelectedCheck);
    exportSelectedLabel.appendChild(document.createTextNode("Export Selected"));

    exportOptionsCol.appendChild(folderBySizeLabel);
    exportOptionsCol.appendChild(exportSelectedLabel);

    exportBottom.appendChild(exportBtn);
    exportBottom.appendChild(exportOptionsCol);
    rightPanel.appendChild(exportBottom);

    // ==========================================
    // 3. CLIP LIST RENDERING & THUMBNAILS
    // ==========================================
    const renderClipList = () => {
        clipListContainer.innerHTML = "";
        const countBadge = clipListHeader.querySelector("#vc-clip-count");
        if (countBadge) countBadge.innerText = `${ctx.state.clips.length}`;

        if (ctx.state.clips.length === 0) {
            clipListContainer.innerHTML = `<span style="color:#666; font-size:11px; margin:auto; padding:12px 0;">No clips added</span>`;
            return;
        }

        ctx.state.clips.forEach((clip, index) => {
            const isActive = ctx.state.selectedClipIndex === index;
            const clipFrames = clip.endFrame - clip.startFrame;
            const expW = clip.actualExportW || clip.targetWidth || 960;
            const expH = clip.actualExportH || clip.targetHeight || 544;

            const item = document.createElement("div");
            item.className = `vc-clip-item ${isActive ? "active" : ""}`;

            const thumbImg = document.createElement("img");
            thumbImg.className = "vc-clip-item-thumb";
            if (clip.thumbData) {
                thumbImg.src = clip.thumbData;
            } else {
                thumbImg.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='42' height='24' viewBox='0 0 42 24'%3E%3Crect width='42' height='24' fill='%23111'/%3E%3C/svg%3E";
                ctx.queueClipThumbnail(clip, thumbImg);
            }

            const details = document.createElement("div");
            details.className = "vc-clip-item-details";

            const nameSpan = document.createElement("div");
            nameSpan.className = "vc-clip-item-name";
            nameSpan.innerText = clip.id;

            const metaSpan = document.createElement("div");
            metaSpan.className = "vc-clip-item-meta";
            metaSpan.innerText = `${expW}x${expH} • ${clipFrames}f`;

            details.appendChild(nameSpan);
            details.appendChild(metaSpan);

            const check = document.createElement("input");
            check.type = "checkbox";
            check.className = "vc-clip-item-check";
            check.checked = clip.selectedForExport !== false;
            check.addEventListener("mousedown", preventEvents);
            check.addEventListener("click", preventEvents);
            check.addEventListener("change", (e) => {
                clip.selectedForExport = e.target.checked;
                ctx.saveUiState();
            });

            // Clicking row navigates directly to clip start & activates it
            item.addEventListener("click", () => {
                ctx.state.selectedClipIndex = index;
                const targetTime = ctx.frameToTime(clip.startFrame);
                ctx.player.seekVideo(targetTime);
                ctx.timeline.updatePlayhead(targetTime);
                syncControlsFromSettings(clip);
                ctx.timeline.renderTimeline();
                renderClipList();
                ctx.saveUiState();
            });

            item.appendChild(thumbImg);
            item.appendChild(details);
            item.appendChild(check);
            clipListContainer.appendChild(item);
        });
    };

    // ==========================================
    // 4. SYNCHRONIZATION & EXPORT
    // ==========================================
    const populateMpDropdown = (ar, selectedMp = "0.5") => {
        mpSelect.innerHTML = "";
        const currentAr = ar || arSelect.value || "16:9";
        if (!ctx.RESOLUTIONS[currentAr]) return;

        Object.keys(ctx.RESOLUTIONS[currentAr]).forEach(mp => {
            const opt = document.createElement("option");
            opt.value = mp;
            opt.innerText = `${mp} MP`;
            if (mp === selectedMp) opt.selected = true;
            mpSelect.appendChild(opt);
        });
    };

    const updateCropSettingsFromPreset = () => {
        const cfg = ctx.getActiveSettings();
        const ar = arSelect.value || "16:9";
        const mp = mpSelect.value || "0.5";

        if (ctx.RESOLUTIONS[ar] && ctx.RESOLUTIONS[ar][mp]) {
            const dims = ctx.RESOLUTIONS[ar][mp];
            cfg.ar = ar;
            cfg.mp = mp;
            cfg.targetWidth = dims[0];
            cfg.targetHeight = dims[1];
            widthInput.value = cfg.targetWidth;
            heightInput.value = cfg.targetHeight;
            cfg.offsetX = 0.5;
            cfg.offsetY = 0.5;
            ctrlX.slider.value = 50;
            ctrlX.num.value = 50;
            ctrlY.slider.value = 50;
            ctrlY.num.value = 50;
            ctx.player.updateCropOverlay();
            renderClipList();
            ctx.saveState();
            ctx.saveUiState();
        }
    };

    const handleCustomSizeChange = () => {
        const cfg = ctx.getActiveSettings();
        const w = parseInt(widthInput.value, 10);
        const h = parseInt(heightInput.value, 10);
        if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
            cfg.targetWidth = w;
            cfg.targetHeight = h;
            ctx.player.updateCropOverlay();
            renderClipList();
            ctx.saveState();
            ctx.saveUiState();
        }
    };

    const syncOffset = (type, value) => {
        const cfg = ctx.getActiveSettings();
        let clamped = Math.max(0, Math.min(100, Math.round(value)));
        if (isNaN(clamped)) clamped = 50;

        if (type === "x") {
            ctrlX.slider.value = clamped;
            ctrlX.num.value = clamped;
            cfg.offsetX = clamped / 100;
        } else {
            ctrlY.slider.value = clamped;
            ctrlY.num.value = clamped;
            cfg.offsetY = clamped / 100;
        }
        ctx.player.updateCropOverlay();
        ctx.saveState();
        ctx.saveUiState();
    };

    ctrlX.slider.addEventListener("input", (e) => syncOffset("x", parseFloat(e.target.value)));
    ctrlX.num.addEventListener("input", (e) => syncOffset("x", parseFloat(e.target.value)));
    ctrlY.slider.addEventListener("input", (e) => syncOffset("y", parseFloat(e.target.value)));
    ctrlY.num.addEventListener("input", (e) => syncOffset("y", parseFloat(e.target.value)));

    cropModeCheck.addEventListener("change", (e) => {
        const cfg = ctx.getActiveSettings();
        cfg.cropMode = e.target.checked;
        ctx.player.updateCropOverlay();
        ctx.saveState();
        ctx.saveUiState();
    });

    scaleSlider.addEventListener("input", (e) => {
        const cfg = ctx.getActiveSettings();
        cfg.cropScale = parseInt(e.target.value, 10) / 100;
        scaleInput.value = cfg.cropScale.toFixed(2);
        ctx.player.updateCropOverlay();
        renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    });

    scaleInput.addEventListener("input", (e) => {
        const cfg = ctx.getActiveSettings();
        let val = parseFloat(e.target.value);
        if (isNaN(val)) return;
        val = Math.max(0.5, Math.min(2.0, val));
        cfg.cropScale = val;
        scaleSlider.value = Math.round(val * 100);
        ctx.player.updateCropOverlay();
        renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    });

    arSelect.addEventListener("change", () => {
        populateMpDropdown(arSelect.value, "0.5");
        updateCropSettingsFromPreset();
    });
    mpSelect.addEventListener("change", updateCropSettingsFromPreset);
    widthInput.addEventListener("input", handleCustomSizeChange);
    heightInput.addEventListener("input", handleCustomSizeChange);

    const syncControlsFromSettings = (cfg) => {
        if (cfg && cfg.id) {
            clipBadge.innerText = cfg.id;
            clipBadge.className = "vc-clip-badge";
        } else {
            clipBadge.innerText = "None";
            clipBadge.className = "vc-clip-badge none";
        }

        arSelect.value = cfg.ar || "16:9";
        populateMpDropdown(cfg.ar, cfg.mp);
        widthInput.value = cfg.targetWidth;
        heightInput.value = cfg.targetHeight;

        const xVal = Math.round(cfg.offsetX * 100);
        const yVal = Math.round(cfg.offsetY * 100);
        ctrlX.slider.value = xVal;
        ctrlX.num.value = xVal;
        ctrlY.slider.value = yVal;
        ctrlY.num.value = yVal;

        cropModeCheck.checked = !!cfg.cropMode;
        scaleSlider.value = Math.round(cfg.cropScale * 100);
        scaleInput.value = cfg.cropScale.toFixed(2);

        ctx.player.updateCropOverlay();
    };

    // Proxy Button Action
    proxyBtn.addEventListener("click", async () => {
        if (!ctx.state.currentFile) return;

        if (ctx.state.isProxyActive) {
            ctx.state.isProxyActive = false;
            proxyBtn.className = "vc-btn vc-btn-subtle";
            proxyBtn.innerHTML = `${Icons.ICON_PROXY} Create Proxy`;
            ctx.player.setVideoSource(false);
            ctx.saveUiState();
            return;
        }

        const res = await ctx.api.fetchApi(`/video_clipper/check_proxy?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(ctx.state.currentFile)}`);
        const check = await res.json();
        if (check.exists) {
            ctx.state.isProxyActive = true;
            proxyBtn.className = "vc-btn vc-btn-success";
            proxyBtn.innerHTML = `${Icons.ICON_PROXY} Proxy Active`;
            ctx.player.setVideoSource(true);
            ctx.saveUiState();
            return;
        }

        proxyBtn.disabled = true;
        proxyBtn.innerHTML = `⏳ Generating...`;

        try {
            const genRes = await ctx.api.fetchApi("/video_clipper/create_proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ directory: ctx.state.currentDir, filename: ctx.state.currentFile })
            });
            const result = await genRes.json();
            if (result.status === "success") {
                ctx.state.isProxyActive = true;
                proxyBtn.className = "vc-btn vc-btn-success";
                proxyBtn.innerHTML = `${Icons.ICON_PROXY} Proxy Active`;
                ctx.player.setVideoSource(true);
                ctx.saveUiState();
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            proxyBtn.className = "vc-btn vc-btn-danger";
            proxyBtn.innerHTML = `Failed`;
            setTimeout(() => {
                proxyBtn.className = "vc-btn vc-btn-subtle";
                proxyBtn.innerHTML = `${Icons.ICON_PROXY} Create Proxy`;
            }, 3000);
        } finally {
            proxyBtn.disabled = false;
        }
    });

    // Export Button Handler
    exportBtn.addEventListener("click", async () => {
        if (!ctx.state.currentFile || ctx.state.clips.length === 0) return;

        let clipsToExport = ctx.state.clips;
        if (exportSelectedCheck.checked) {
            clipsToExport = ctx.state.clips.filter(c => c.selectedForExport !== false);
            if (clipsToExport.length === 0) {
                exportBtn.innerText = "⚠ No Clips Selected";
                setTimeout(() => { exportBtn.innerHTML = `${Icons.ICON_EXPORT} Export Clips`; }, 2000);
                return;
            }
        }

        exportBtn.innerHTML = `⏳ Exporting (${clipsToExport.length})...`;
        exportBtn.disabled = true;
        ctx.saveState();

        try {
            const response = await ctx.api.fetchApi("/video_clipper/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    directory: ctx.state.currentDir,
                    filename: ctx.state.currentFile,
                    use_custom_name: customNameCheck.checked,
                    custom_name: customNameInput.value,
                    save_by_size: saveBySizeCheck.checked,
                    fps: ctx.state.targetFps,
                    clips: clipsToExport.map(c => ({
                        id: c.id,
                        startTime: ctx.frameToTime(c.startFrame),
                        endTime: ctx.frameToTime(c.endFrame),
                        target_width: c.targetWidth || 960,
                        target_height: c.targetHeight || 544,
                        crop_mode: !!c.cropMode,
                        crop_scale: c.cropScale || 1.0,
                        actual_export_w: c.actualExportW || c.targetWidth || 960,
                        actual_export_h: c.actualExportH || c.targetHeight || 544,
                        offset_x: c.offsetX !== undefined ? c.offsetX : 0.5,
                        offset_y: c.offsetY !== undefined ? c.offsetY : 0.5
                    }))
                })
            });

            const result = await response.json();
            if (result.status === "success") {
                exportBtn.innerHTML = `✔ Exported ${clipsToExport.length}`;
                setTimeout(() => {
                    exportBtn.innerHTML = `${Icons.ICON_EXPORT} Export Clips`;
                    exportBtn.disabled = false;
                }, 3000);
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            exportBtn.innerHTML = `✖ Export Failed`;
            setTimeout(() => {
                exportBtn.innerHTML = `${Icons.ICON_EXPORT} Export Clips`;
                exportBtn.disabled = false;
            }, 3000);
        }
    });

    return {
        leftPanel,
        rightPanel,
        syncControlsFromSettings,
        renderClipList,
        setActualSizeText: (text) => {},
        setFolderPath: (path) => { folderInput.value = path || ""; },
        getExportOptions: () => ({
            use_custom_name: customNameCheck.checked,
            custom_name: customNameInput.value,
            save_by_size: saveBySizeCheck.checked,
            export_selected: exportSelectedCheck.checked
        }),
        setExportOptions: (opts) => {
            if (!opts) return;
            customNameCheck.checked = !!opts.use_custom_name;
            customNameInput.value = opts.custom_name || "";
            customNameInput.disabled = !customNameCheck.checked;
            customNameInput.style.opacity = customNameCheck.checked ? "1" : "0.5";
            saveBySizeCheck.checked = !!opts.save_by_size;
            exportSelectedCheck.checked = !!opts.export_selected;
        },
        setProxyBtnState: (exists) => {
            proxyBtn.disabled = false;
            if (exists) {
                ctx.state.isProxyActive = true;
                proxyBtn.className = "vc-btn vc-btn-success";
                proxyBtn.innerHTML = `${Icons.ICON_PROXY} Proxy Active`;
            } else {
                ctx.state.isProxyActive = false;
                proxyBtn.className = "vc-btn vc-btn-subtle";
                proxyBtn.innerHTML = `${Icons.ICON_PROXY} Create Proxy`;
            }
        }
    };
}