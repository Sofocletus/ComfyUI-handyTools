import * as Icons from "./videoClipper_icons.js";

export function createRightPanel(ctx) {
    const preventEvents = (e) => e.stopPropagation();

    const rightPanel = document.createElement("div");
    rightPanel.className = "vc-panel vc-right-panel";

    // --- HEADER ROW: "Export" on left, "[count] Clips" on right ---
    const exportTitle = document.createElement("div");
    exportTitle.className = "vc-panel-title";
    exportTitle.style.justifyContent = "space-between";
    exportTitle.style.alignItems = "center";
    exportTitle.style.borderBottom = "none";
    exportTitle.style.paddingBottom = "2px";
    exportTitle.style.marginBottom = "2px";

    const titleLeft = document.createElement("div");
    titleLeft.style.display = "flex";
    titleLeft.style.alignItems = "center";
    titleLeft.style.gap = "6px";
    titleLeft.innerHTML = `${Icons.ICON_EXPORT} <span>Export</span>`;

    const clipListTitle = document.createElement("div");
    clipListTitle.className = "vc-clip-list-title";
    clipListTitle.style.fontSize = "11px";
    clipListTitle.innerHTML = `<span class="vc-clip-list-count" id="vc-clip-count">0</span> Clips`;

    exportTitle.appendChild(titleLeft);
    exportTitle.appendChild(clipListTitle);
    rightPanel.appendChild(exportTitle);

    // --- TOP BAR: Custom Name Input (left) + 3 List Selection Buttons (right) ---
    const topControlsRow = document.createElement("div");
    topControlsRow.className = "vc-row";
    topControlsRow.style.gap = "6px";
    topControlsRow.style.alignItems = "center";

    const customNameInput = document.createElement("input");
    customNameInput.type = "text";
    customNameInput.className = "vc-input";
    customNameInput.placeholder = "Custom Name";
    customNameInput.style.flex = "1";
    customNameInput.style.minWidth = "0";
    customNameInput.addEventListener("keydown", preventEvents);
    customNameInput.addEventListener("mousedown", preventEvents);

    customNameInput.addEventListener("input", () => {
        ctx.saveUiState();
        renderClipList();
    });

    const batchGroup = document.createElement("div");
    batchGroup.style.display = "flex";
    batchGroup.style.gap = "4px";
    batchGroup.style.flexShrink = "0";

    const selectAllBtn = document.createElement("button");
    selectAllBtn.className = "vc-icon-btn small";
    selectAllBtn.innerHTML = Icons.ICON_SELECT_ALL;
    selectAllBtn.title = "Mark all for export";
    selectAllBtn.addEventListener("click", () => {
        ctx.state.clips.forEach(c => { c.selectedForExport = true; });
        renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    });

    const selectNoneBtn = document.createElement("button");
    selectNoneBtn.className = "vc-icon-btn small";
    selectNoneBtn.innerHTML = Icons.ICON_SELECT_NONE;
    selectNoneBtn.title = "Mark none for export";
    selectNoneBtn.addEventListener("click", () => {
        ctx.state.clips.forEach(c => { c.selectedForExport = false; });
        renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    });

    const invertSelectBtn = document.createElement("button");
    invertSelectBtn.className = "vc-icon-btn small";
    invertSelectBtn.innerHTML = Icons.ICON_INVERT;
    invertSelectBtn.title = "Invert Export Marks";
    invertSelectBtn.addEventListener("click", () => {
        ctx.state.clips.forEach(c => {
            c.selectedForExport = c.selectedForExport === false ? true : false;
        });
        renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    });

    batchGroup.appendChild(selectAllBtn);
    batchGroup.appendChild(selectNoneBtn);
    batchGroup.appendChild(invertSelectBtn);

    topControlsRow.appendChild(customNameInput);
    topControlsRow.appendChild(batchGroup);
    rightPanel.appendChild(topControlsRow);

    // --- CLIP LIST ---
    const clipListContainer = document.createElement("div");
    clipListContainer.className = "vc-clip-list";
    clipListContainer.style.marginBottom = "0px";
    rightPanel.appendChild(clipListContainer);

    // --- TWO-COLUMN CONTROLS: Left = Export Btn | Right = Folder by resolution & All in Gallery ---
    const exportBottom = document.createElement("div");
    exportBottom.className = "vc-export-bottom";
    exportBottom.style.display = "flex";
    exportBottom.style.flexDirection = "row";
    exportBottom.style.alignItems = "center";
    exportBottom.style.gap = "8px";
    exportBottom.style.borderTop = "none";
    exportBottom.style.paddingTop = "4px";
    exportBottom.style.marginTop = "2px";

    const exportBtn = document.createElement("button");
    exportBtn.className = "vc-btn vc-export-btn";
    exportBtn.style.flex = "1";
    exportBtn.style.height = "28px";
    exportBtn.style.minHeight = "28px";
    exportBtn.style.padding = "2px 8px";
    exportBtn.innerHTML = `${Icons.ICON_EXPORT} Export 0 Clips`;

    const exportOptionsCol = document.createElement("div");
    exportOptionsCol.className = "vc-export-options-col";
    exportOptionsCol.style.display = "flex";
    exportOptionsCol.style.flexDirection = "column";
    exportOptionsCol.style.justifyContent = "center";
    exportOptionsCol.style.gap = "4px";

    const folderBySizeLabel = document.createElement("label");
    folderBySizeLabel.className = "vc-checkbox-row";
    folderBySizeLabel.style.margin = "0";
    const saveBySizeCheck = document.createElement("input");
    saveBySizeCheck.type = "checkbox";
    saveBySizeCheck.addEventListener("mousedown", preventEvents);
    saveBySizeCheck.addEventListener("change", () => ctx.saveUiState());
    folderBySizeLabel.appendChild(saveBySizeCheck);
    folderBySizeLabel.appendChild(document.createTextNode("Folder by resolution"));

    const allInGalleryLabel = document.createElement("label");
    allInGalleryLabel.className = "vc-checkbox-row";
    allInGalleryLabel.style.margin = "0";
    const allInGalleryCheck = document.createElement("input");
    allInGalleryCheck.type = "checkbox";
    allInGalleryCheck.addEventListener("mousedown", preventEvents);
    allInGalleryCheck.addEventListener("change", () => {
        ctx.saveUiState();
        updateExportButtonCount();
    });
    allInGalleryLabel.appendChild(allInGalleryCheck);
    allInGalleryLabel.appendChild(document.createTextNode("All in Gallery"));

    exportOptionsCol.appendChild(folderBySizeLabel);
    exportOptionsCol.appendChild(allInGalleryLabel);

    exportBottom.appendChild(exportBtn);
    exportBottom.appendChild(exportOptionsCol);
    rightPanel.appendChild(exportBottom);

    // --- COLLAPSIBLE CUSTOM OUTPUT SIZE DRAWER ---
    const customSizesSection = document.createElement("div");
    customSizesSection.style.marginTop = "4px";
    customSizesSection.style.display = "flex";
    customSizesSection.style.flexDirection = "column";
    customSizesSection.style.gap = "6px";

    let isCustomSizesExpanded = false;

    const customSizesToggleBtn = document.createElement("button");
    customSizesToggleBtn.className = "vc-btn";
    customSizesToggleBtn.style.width = "100%";
    customSizesToggleBtn.style.justifyContent = "space-between";
    customSizesToggleBtn.style.padding = "4px 8px";
    customSizesToggleBtn.style.fontSize = "11px";
    customSizesToggleBtn.style.fontWeight = "600";
    customSizesToggleBtn.style.transition = "background 0.15s, border-color 0.15s, color 0.15s";

    const customSizesDrawer = document.createElement("div");
    customSizesDrawer.style.display = "none";
    customSizesDrawer.style.flexDirection = "column";
    customSizesDrawer.style.background = "rgba(0, 0, 0, 0.28)";
    customSizesDrawer.style.border = "1px solid rgba(255, 255, 255, 0.08)";
    customSizesDrawer.style.borderRadius = "4px";
    customSizesDrawer.style.padding = "6px";
    customSizesDrawer.style.gap = "6px";

    const customSizesColumns = document.createElement("div");
    customSizesColumns.style.display = "flex";
    customSizesColumns.style.gap = "8px";
    customSizesColumns.style.alignItems = "stretch";

    // Left Column: Detected Clip Resolutions in Video
    const detectedCol = document.createElement("div");
    detectedCol.style.flex = "0 0 42%";
    detectedCol.style.display = "flex";
    detectedCol.style.flexDirection = "column";
    detectedCol.style.gap = "3px";
    detectedCol.style.borderRight = "1px solid rgba(255, 255, 255, 0.08)";
    detectedCol.style.paddingRight = "6px";

    const detectedHeader = document.createElement("div");
    detectedHeader.style.fontSize = "9px";
    detectedHeader.style.fontWeight = "bold";
    detectedHeader.style.color = "#888";
    detectedHeader.style.textTransform = "uppercase";
    detectedHeader.style.letterSpacing = "0.4px";
    detectedHeader.innerText = "Video Clip Sizes";

    const detectedList = document.createElement("div");
    detectedList.style.display = "flex";
    detectedList.style.flexDirection = "column";
    detectedList.style.gap = "2px";
    detectedList.style.fontSize = "10px";
    detectedList.style.fontFamily = "monospace";
    detectedList.style.color = "#bbb";
    detectedList.style.overflowY = "auto";
    detectedList.style.maxHeight = "76px";

    detectedCol.appendChild(detectedHeader);
    detectedCol.appendChild(detectedList);

    // Right Column: Target Sizes Input + Hint
    const targetCol = document.createElement("div");
    targetCol.style.flex = "1";
    targetCol.style.display = "flex";
    targetCol.style.flexDirection = "column";
    targetCol.style.gap = "4px";

    const bucketsInput = document.createElement("textarea");
    bucketsInput.className = "vc-input";
    bucketsInput.rows = 3;
    bucketsInput.value = "";
    bucketsInput.placeholder = "Write custom sizes as WxH\n512x288, 384x384, 288x512";
    bucketsInput.title = "Comma-separated target resolutions (multiples of 32)";
    bucketsInput.style.fontSize = "10px";
    bucketsInput.style.fontFamily = "monospace";
    bucketsInput.style.resize = "vertical";
    bucketsInput.style.minHeight = "52px";
    bucketsInput.style.padding = "4px 6px";
    bucketsInput.style.lineHeight = "1.35";
    bucketsInput.addEventListener("keydown", preventEvents);
    bucketsInput.addEventListener("mousedown", preventEvents);
    bucketsInput.addEventListener("input", () => ctx.saveUiState());

    targetCol.appendChild(bucketsInput);

    customSizesColumns.appendChild(detectedCol);
    customSizesColumns.appendChild(targetCol);

    // Bottom of Custom Sizes Panel: Apply custom sizes checkbox (default OFF)
    const applyCustomLabel = document.createElement("label");
    applyCustomLabel.className = "vc-checkbox-row";
    applyCustomLabel.style.margin = "0";
    applyCustomLabel.style.paddingTop = "2px";
    applyCustomLabel.style.fontSize = "10px";
    const applyCustomCheck = document.createElement("input");
    applyCustomCheck.type = "checkbox";
    applyCustomCheck.checked = false;
    applyCustomCheck.addEventListener("mousedown", preventEvents);
    applyCustomLabel.appendChild(applyCustomCheck);
    applyCustomLabel.appendChild(document.createTextNode("Apply custom sizes"));

    customSizesDrawer.appendChild(customSizesColumns);
    customSizesDrawer.appendChild(applyCustomLabel);

    const updateCustomSizesButtonVisuals = () => {
        const enabled = applyCustomCheck.checked;
        const arrow = isCustomSizesExpanded ? "▾" : "▸";
        customSizesToggleBtn.innerHTML = `<span>Custom Output Size${enabled ? " (ON)" : ""}</span><span>${arrow}</span>`;
        if (enabled) {
            customSizesToggleBtn.style.background = "#1e4d2b";
            customSizesToggleBtn.style.borderColor = "#3ea85c";
            customSizesToggleBtn.style.color = "#8affaa";
        } else {
            customSizesToggleBtn.style.background = "#2a2a2a";
            customSizesToggleBtn.style.borderColor = "#444";
            customSizesToggleBtn.style.color = "#aaa";
        }
    };

    const refreshDetectedResolutions = () => {
        detectedList.innerHTML = "";
        if (!ctx.state.clips || ctx.state.clips.length === 0) {
            detectedList.innerHTML = `<span style="color:#666; font-family:sans-serif;">No clips</span>`;
            return;
        }
        const counts = new Map();
        ctx.state.clips.forEach(c => {
            if (c.includeVideo === false) return;
            const w = c.actualExportW || c.targetWidth || 960;
            const h = c.actualExportH || c.targetHeight || 544;
            const key = `${w}x${h}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        if (counts.size === 0) {
            detectedList.innerHTML = `<span style="color:#666; font-family:sans-serif;">Audio only</span>`;
            return;
        }

        counts.forEach((count, res) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.innerHTML = `<span>${res}</span><span style="color:#777;">(${count})</span>`;
            detectedList.appendChild(row);
        });
    };

    customSizesToggleBtn.addEventListener("click", () => {
        isCustomSizesExpanded = !isCustomSizesExpanded;
        customSizesDrawer.style.display = isCustomSizesExpanded ? "flex" : "none";
        if (isCustomSizesExpanded) refreshDetectedResolutions();
        updateCustomSizesButtonVisuals();
    });

    applyCustomCheck.addEventListener("change", () => {
        updateCustomSizesButtonVisuals();
        ctx.saveUiState();
    });

    updateCustomSizesButtonVisuals();

    customSizesSection.appendChild(customSizesToggleBtn);
    customSizesSection.appendChild(customSizesDrawer);
    rightPanel.appendChild(customSizesSection);

    // --- DYNAMIC EXPORT COUNT UPDATER ---
    let countUpdateSeq = 0;

    const formatExportLabel = (count) => {
        const noun = count === 1 ? "Clip" : "Clips";
        return `${Icons.ICON_EXPORT} Export ${count} ${noun}`;
    };

    const updateExportButtonCount = async () => {
        if (ctx.isExporting) return;

        const currentSelectedCount = (ctx.state.clips || []).filter(c => c.selectedForExport !== false).length;

        if (!allInGalleryCheck.checked) {
            exportBtn.innerHTML = formatExportLabel(currentSelectedCount);
            return;
        }

        const seq = ++countUpdateSeq;
        try {
            const activeGalleryVideos = ctx.gallery && ctx.gallery.getExportableVideos
                ? ctx.gallery.getExportableVideos()
                : [];

            if (activeGalleryVideos.length === 0) {
                if (seq === countUpdateSeq && !ctx.isExporting) {
                    exportBtn.innerHTML = formatExportLabel(0);
                }
                return;
            }

            const listRes = await ctx.api.fetchApi(`/video_clipper/video_list?dir=${encodeURIComponent(ctx.state.currentDir)}`);
            const listData = await listRes.json();
            if (seq !== countUpdateSeq || ctx.isExporting) return;

            const videosWithState = (listData.states || []).filter(vidName => activeGalleryVideos.includes(vidName));
            let total = 0;

            for (const vidName of videosWithState) {
                if (vidName === ctx.state.currentFile) {
                    total += currentSelectedCount;
                } else {
                    const stateRes = await ctx.api.fetchApi(`/video_clipper/load_state?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(vidName)}`);
                    const stateData = await stateRes.json();
                    if (seq !== countUpdateSeq || ctx.isExporting) return;
                    const vidClips = (stateData.clips || []).filter(c => c.selectedForExport !== false);
                    total += vidClips.length;
                }
            }

            if (seq === countUpdateSeq && !ctx.isExporting) {
                exportBtn.innerHTML = formatExportLabel(total);
            }
        } catch (err) {
            if (seq === countUpdateSeq && !ctx.isExporting) {
                exportBtn.innerHTML = formatExportLabel(currentSelectedCount);
            }
        }
    };

    let lastClickedIndex = -1;

    const renderClipList = () => {
        clipListContainer.innerHTML = "";
        const countBadge = exportTitle.querySelector("#vc-clip-count");
        if (countBadge) countBadge.innerText = `${ctx.state.clips.length}`;

        refreshDetectedResolutions();
        updateExportButtonCount();

        if (ctx.state.clips.length === 0) {
            clipListContainer.innerHTML = `<span style="color:#666; font-size:11px; margin:auto; padding:12px 0;">No clips added</span>`;
            return;
        }

        const customVal = customNameInput.value.trim();
        const baseSourceName = ctx.state.currentFile ? ctx.state.currentFile.replace(/\.[^/.]+$/, "") : "Video";
        const prefix = customVal ? customVal : baseSourceName;

        ctx.state.clips.forEach((clip, index) => {
            const isActive = ctx.state.selectedClipIndices.includes(index);
            const clipFrames = clip.endFrame - clip.startFrame;
            const expW = clip.actualExportW || clip.targetWidth || 960;
            const expH = clip.actualExportH || clip.targetHeight || 544;
            const dynId = ctx.getDynamicClipId(clip);
            const ext = clip.includeVideo === false ? ".wav" : ".mp4";
            const finalFilename = `${prefix}_${dynId}${ext}`;

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
            nameSpan.style.display = "flex";
            nameSpan.style.justifyContent = "space-between";
            nameSpan.style.alignItems = "baseline";

            const nameText = document.createElement("span");
            nameText.innerText = dynId;

            const metaText = document.createElement("span");
            metaText.style.fontSize = "9px";
            metaText.style.color = "#888";
            metaText.style.fontFamily = "monospace";
            metaText.style.fontWeight = "normal";
            metaText.style.marginLeft = "6px";
            metaText.innerText = `${expW}x${expH} • ${clipFrames}f`;

            nameSpan.appendChild(nameText);
            nameSpan.appendChild(metaText);

            const fileSpan = document.createElement("div");
            fileSpan.className = "vc-clip-item-meta";
            fileSpan.style.whiteSpace = "nowrap";
            fileSpan.style.overflow = "hidden";
            fileSpan.style.textOverflow = "ellipsis";
            fileSpan.innerText = finalFilename;

            details.appendChild(nameSpan);
            details.appendChild(fileSpan);

            const check = document.createElement("input");
            check.type = "checkbox";
            check.className = "vc-clip-item-check";
            check.checked = clip.selectedForExport !== false;
            check.addEventListener("mousedown", preventEvents);
            check.addEventListener("click", preventEvents);
            check.addEventListener("change", (e) => {
                clip.selectedForExport = e.target.checked;
                updateExportButtonCount();
                ctx.saveState();
                ctx.saveUiState();
            });

            item.addEventListener("click", (e) => {
                const targetTime = ctx.frameToTime(clip.startFrame);

                if (e.shiftKey && lastClickedIndex !== -1) {
                    const start = Math.min(lastClickedIndex, index);
                    const end = Math.max(lastClickedIndex, index);
                    ctx.state.selectedClipIndices = [];
                    for (let i = start; i <= end; i++) {
                        ctx.state.selectedClipIndices.push(i);
                    }
                } else if (e.ctrlKey || e.metaKey) {
                    const existingIdx = ctx.state.selectedClipIndices.indexOf(index);
                    if (existingIdx > -1) {
                        ctx.state.selectedClipIndices.splice(existingIdx, 1);
                    } else {
                        ctx.state.selectedClipIndices.push(index);
                    }
                    lastClickedIndex = index;
                } else {
                    ctx.state.selectedClipIndices = [index];
                    lastClickedIndex = index;
                }

                if (ctx.state.selectedClipIndices.length > 0) {
                    ctx.player.seekVideo(targetTime);
                    ctx.timeline.updatePlayhead(targetTime);
                    ctx.leftPanel.syncControlsFromSettings(ctx.getActiveSettings());
                } else {
                    ctx.leftPanel.syncControlsFromSettings(ctx.state.currentSettings);
                }

                ctx.timeline.renderTimeline();
                if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                renderClipList();
                ctx.saveState();
                ctx.saveUiState();
            });

            item.appendChild(thumbImg);
            item.appendChild(details);
            item.appendChild(check);
            clipListContainer.appendChild(item);
        });
    };

    const resetExportBtnLabel = () => {
        updateExportButtonCount();
    };

    exportBtn.addEventListener("click", async () => {
        // ==========================================
        // CANCELLATION HANDLER
        // ==========================================
        if (ctx.isExporting) {
            if (ctx.exportAbortController) {
                ctx.exportAbortController.abort();
            }
            if (ctx.exportTaskId) {
                ctx.api.fetchApi("/video_clipper/cancel_task", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ task_id: ctx.exportTaskId })
                }).catch(() => {});
            }
            ctx.isExporting = false;
            exportBtn.innerHTML = `✖ Cancelling...`;
            exportBtn.className = "vc-btn vc-export-btn vc-btn-subtle";
            return;
        }

        const getTaskId = () => 'task_' + Math.random().toString(36).substring(2, 11) + Date.now();
        const customNameVal = customNameInput.value.trim();
        const hasCustomName = customNameVal.length > 0;

        // ==========================================
        // ALL IN GALLERY EXPORT
        // ==========================================
        if (allInGalleryCheck.checked) {
            try {
                const listRes = await ctx.api.fetchApi(`/video_clipper/video_list?dir=${encodeURIComponent(ctx.state.currentDir)}`);
                const listData = await listRes.json();

                const activeGalleryVideos = ctx.gallery && ctx.gallery.getExportableVideos ? ctx.gallery.getExportableVideos() : [];

                if (activeGalleryVideos.length === 0) {
                    exportBtn.innerText = "⚠ No Checked Videos";
                    setTimeout(resetExportBtnLabel, 2000);
                    return;
                }

                const videosWithState = (listData.states || []).filter(vidName => activeGalleryVideos.includes(vidName));

                if (videosWithState.length === 0) {
                    exportBtn.innerText = "⚠ No Clips Found";
                    setTimeout(resetExportBtnLabel, 2000);
                    return;
                }

                ctx.isExporting = true;
                ctx.exportAbortController = new AbortController();
                exportBtn.className = "vc-btn vc-export-btn vc-btn-danger";

                await ctx.saveState();

                let totalExportedCount = 0;
                let wasAborted = false;

                for (let i = 0; i < videosWithState.length; i++) {
                    if (!ctx.isExporting) { wasAborted = true; break; }

                    const vidName = videosWithState[i];

                    let vidClips = [];
                    if (vidName === ctx.state.currentFile) {
                        vidClips = ctx.state.clips;
                    } else {
                        const stateRes = await ctx.api.fetchApi(`/video_clipper/load_state?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(vidName)}`);
                        const stateData = await stateRes.json();
                        vidClips = stateData.clips || [];
                    }

                    // Always export only checked/selected clips
                    vidClips = vidClips.filter(c => c.selectedForExport !== false);

                    if (vidClips.length === 0) continue;

                    for (let j = 0; j < vidClips.length; j++) {
                        if (!ctx.isExporting) { wasAborted = true; break; }

                        ctx.exportTaskId = getTaskId();
                        const c = vidClips[j];

                        exportBtn.innerHTML = `<div style="line-height: 1.15; font-size: 10px;">Vid ${i + 1}/${videosWithState.length} • Clip ${j + 1}/${vidClips.length} (Cancel)</div>`;

                        try {
                            const response = await ctx.api.fetchApi("/video_clipper/export", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "X-Task-ID": ctx.exportTaskId
                                },
                                body: JSON.stringify({
                                    directory: ctx.state.currentDir,
                                    filename: vidName,
                                    use_custom_name: hasCustomName,
                                    custom_name: customNameVal,
                                    save_by_size: saveBySizeCheck.checked,
                                    training_resize_enabled: applyCustomCheck.checked,
                                    training_buckets: bucketsInput.value,
                                    force_24fps: ctx.state.force24Fps !== false,
                                    fps: ctx.state.targetFps,
                                    encoder: ctx.state.appSettings.exportEncoder || "h264",
                                    crf: ctx.state.appSettings.exportCrf !== undefined ? ctx.state.appSettings.exportCrf : 17,
                                    clips: [{
                                        id: ctx.getDynamicClipId(c, vidClips),
                                        startTime: ctx.frameToTime(c.startFrame),
                                        endTime: ctx.frameToTime(c.endFrame),
                                        startFrame: c.startFrame,
                                        endFrame: c.endFrame,
                                        keyframes: c.keyframes || [],
                                        interpMode: c.interpMode || "linear",
                                        target_width: c.targetWidth || 960,
                                        target_height: c.targetHeight || 544,
                                        crop_mode: c.cropMode !== false,
                                        actual_export_w: c.actualExportW || c.targetWidth || 960,
                                        actual_export_h: c.actualExportH || c.targetHeight || 544,
                                        offset_x: c.offsetX !== undefined ? c.offsetX : 0.5,
                                        offset_y: c.offsetY !== undefined ? c.offsetY : 0.5,
                                        rotation: c.rotation || 0,
                                        include_video: c.includeVideo !== false,
                                        include_audio: c.includeAudio !== false
                                    }]
                                }),
                                signal: ctx.exportAbortController.signal
                            });

                            const result = await response.json();
                            if (result.status !== "success") {
                                throw new Error(result.message);
                            }
                            totalExportedCount++;
                        } catch (err) {
                            if (err.name === 'AbortError') { wasAborted = true; break; }
                            throw err;
                        }
                    }
                    if (wasAborted) break;
                }

                ctx.isExporting = false;
                exportBtn.className = "vc-btn vc-export-btn";

                if (wasAborted) {
                    exportBtn.innerHTML = `⚠ Export Cancelled`;
                } else {
                    exportBtn.innerHTML = `✔ Exported ${totalExportedCount} Total`;
                }

                setTimeout(resetExportBtnLabel, 3000);
            } catch (err) {
                ctx.isExporting = false;
                exportBtn.className = "vc-btn vc-export-btn";
                exportBtn.innerHTML = `✖ Gallery Export Failed`;
                setTimeout(resetExportBtnLabel, 3000);
            }
            return;
        }

        // ==========================================
        // SINGLE FILE EXPORT
        // ==========================================
        if (!ctx.state.currentFile || ctx.state.clips.length === 0) return;

        // Always export only checked/selected clips
        const clipsToExport = ctx.state.clips.filter(c => c.selectedForExport !== false);
        if (clipsToExport.length === 0) {
            exportBtn.innerText = "⚠ No Clips Selected";
            setTimeout(resetExportBtnLabel, 2000);
            return;
        }

        ctx.isExporting = true;
        ctx.exportAbortController = new AbortController();
        exportBtn.className = "vc-btn vc-export-btn vc-btn-danger";
        await ctx.saveState();

        try {
            let wasAborted = false;

            for (let i = 0; i < clipsToExport.length; i++) {
                if (!ctx.isExporting) { wasAborted = true; break; }

                ctx.exportTaskId = getTaskId();
                const c = clipsToExport[i];

                exportBtn.innerHTML = `<div style="line-height: 1.15; font-size: 10px;">Exporting ${i + 1}/${clipsToExport.length} (Click to Cancel)</div>`;

                try {
                    const response = await ctx.api.fetchApi("/video_clipper/export", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Task-ID": ctx.exportTaskId
                        },
                        body: JSON.stringify({
                            directory: ctx.state.currentDir,
                            filename: ctx.state.currentFile,
                            use_custom_name: hasCustomName,
                            custom_name: customNameVal,
                            save_by_size: saveBySizeCheck.checked,
                            training_resize_enabled: applyCustomCheck.checked,
                            training_buckets: bucketsInput.value,
                            force_24fps: ctx.state.force24Fps !== false,
                            fps: ctx.state.targetFps,
                            encoder: ctx.state.appSettings.exportEncoder || "h264",
                            crf: ctx.state.appSettings.exportCrf !== undefined ? ctx.state.appSettings.exportCrf : 17,
                            clips: [{
                                id: ctx.getDynamicClipId(c),
                                startTime: ctx.frameToTime(c.startFrame),
                                endTime: ctx.frameToTime(c.endFrame),
                                startFrame: c.startFrame,
                                endFrame: c.endFrame,
                                keyframes: c.keyframes || [],
                                interpMode: c.interpMode || "linear",
                                target_width: c.targetWidth || 960,
                                target_height: c.targetHeight || 544,
                                crop_mode: c.cropMode !== false,
                                actual_export_w: c.actualExportW || c.targetWidth || 960,
                                actual_export_h: c.actualExportH || c.targetHeight || 544,
                                offset_x: c.offsetX !== undefined ? c.offsetX : 0.5,
                                offset_y: c.offsetY !== undefined ? c.offsetY : 0.5,
                                rotation: c.rotation || 0,
                                include_video: c.includeVideo !== false,
                                include_audio: c.includeAudio !== false
                            }]
                        }),
                        signal: ctx.exportAbortController.signal
                    });

                    const result = await response.json();
                    if (result.status !== "success") {
                        throw new Error(result.message);
                    }
                } catch (err) {
                    if (err.name === 'AbortError') { wasAborted = true; break; }
                    throw err;
                }
            }

            exportBtn.className = "vc-btn vc-export-btn";
            if (wasAborted) {
                exportBtn.innerHTML = `⚠ Export Cancelled`;
            } else {
                exportBtn.innerHTML = `✔ Exported ${clipsToExport.length}`;
            }
            setTimeout(resetExportBtnLabel, 3000);

        } catch (err) {
            exportBtn.className = "vc-btn vc-export-btn";
            exportBtn.innerHTML = `✖ Export Failed`;
            setTimeout(resetExportBtnLabel, 3000);
        } finally {
            ctx.isExporting = false;
        }
    });

    return {
        element: rightPanel,
        renderClipList,
        updateExportButtonCount,
        getExportOptions: () => ({
            use_custom_name: customNameInput.value.trim().length > 0,
            custom_name: customNameInput.value,
            save_by_size: saveBySizeCheck.checked,
            all_in_gallery: allInGalleryCheck.checked,
            training_resize_enabled: applyCustomCheck.checked,
            training_buckets: bucketsInput.value
        }),
        setExportOptions: (opts) => {
            if (!opts) return;
            customNameInput.value = opts.custom_name || "";
            saveBySizeCheck.checked = !!opts.save_by_size;
            allInGalleryCheck.checked = !!opts.all_in_gallery;
            applyCustomCheck.checked = !!opts.training_resize_enabled;
            bucketsInput.value = opts.training_buckets || "";
            updateCustomSizesButtonVisuals();
            updateExportButtonCount();
        }
    };
}