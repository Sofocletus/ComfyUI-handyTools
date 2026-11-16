import * as Icons from "./videoClipper_icons.js";
import { handleProxyCreation } from "./videoClipper_proxyManager.js";

export function createLeftPanel(ctx) {
    const preventEvents = (e) => e.stopPropagation();

    const leftCol = document.createElement("div");
    leftCol.className = "vc-left-col";

    // ==========================================
    // FRAME 1: PROJECT FRAME
    // ==========================================
    const projectFrame = document.createElement("div");
    projectFrame.className = "vc-frame project-frame";

    const projectTitle = document.createElement("div");
    projectTitle.className = "vc-panel-title";

    const projTitleLeft = document.createElement("div");
    projTitleLeft.style.display = "flex";
    projTitleLeft.style.alignItems = "center";
    projTitleLeft.style.gap = "6px";
    projTitleLeft.innerHTML = `${Icons.ICON_FILM_PROJECT} <span>Project</span>`;

    const iconGroup = document.createElement("div");
    iconGroup.style.display = "flex";
    iconGroup.style.gap = "4px";

    const toolsBtn = document.createElement("button");
    toolsBtn.className = "vc-icon-btn small";
    toolsBtn.innerHTML = Icons.ICON_TOOLS;
    toolsBtn.title = "VRAM Estimator";
    toolsBtn.addEventListener("mousedown", preventEvents);
    toolsBtn.addEventListener("click", () => {
        if (ctx.player && ctx.player.toggleTools) {
            ctx.player.toggleTools();
        }
    });

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "vc-icon-btn small";
    settingsBtn.innerHTML = Icons.ICON_SETTINGS;
    settingsBtn.title = "Settings & Thresholds";
    settingsBtn.addEventListener("mousedown", preventEvents);
    settingsBtn.addEventListener("click", () => {
        if (ctx.player && ctx.player.toggleSettings) {
            ctx.player.toggleSettings();
        }
    });

    const helpBtn = document.createElement("button");
    helpBtn.className = "vc-icon-btn small";
    helpBtn.innerHTML = Icons.ICON_HELP;
    helpBtn.title = "Help & Keyboard Shortcuts";
    helpBtn.addEventListener("mousedown", preventEvents);
    helpBtn.addEventListener("click", () => {
        if (ctx.player && ctx.player.toggleHelp) {
            ctx.player.toggleHelp();
        }
    });

    iconGroup.appendChild(toolsBtn);
    iconGroup.appendChild(settingsBtn);
    iconGroup.appendChild(helpBtn);

    projectTitle.appendChild(projTitleLeft);
    projectTitle.appendChild(iconGroup);
    projectFrame.appendChild(projectTitle);

    const folderRow = document.createElement("div");
    folderRow.className = "vc-row";

    const inputWrapper = document.createElement("div");
    inputWrapper.style.flex = "1";
    inputWrapper.style.display = "flex";
    inputWrapper.style.position = "relative";

    const folderInput = document.createElement("input");
    folderInput.type = "text";
    folderInput.className = "vc-input";
    folderInput.placeholder = "Folder path...";
    folderInput.style.flex = "1";
    folderInput.style.paddingRight = "24px"; 
    folderInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            customDropdown.style.display = "none";
            ctx.loadProject(folderInput.value);
        }
    });
    folderInput.addEventListener("mousedown", preventEvents);
    folderInput.addEventListener("focus", () => folderInput.select());

    const arrowBtn = document.createElement("button");
    arrowBtn.innerHTML = "▼";
    arrowBtn.title = "Recent Projects";
    arrowBtn.style.position = "absolute";
    arrowBtn.style.right = "2px";
    arrowBtn.style.top = "50%";
    arrowBtn.style.transform = "translateY(-50%)";
    arrowBtn.style.background = "none";
    arrowBtn.style.border = "none";
    arrowBtn.style.color = "#888";
    arrowBtn.style.cursor = "pointer";
    arrowBtn.style.fontSize = "9px";
    arrowBtn.style.padding = "6px";
    
    arrowBtn.addEventListener("mouseover", () => arrowBtn.style.color = "#fff");
    arrowBtn.addEventListener("mouseout", () => arrowBtn.style.color = "#888");
    arrowBtn.addEventListener("mousedown", preventEvents);

    const customDropdown = document.createElement("div");
    customDropdown.style.position = "absolute";
    customDropdown.style.top = "100%";
    customDropdown.style.left = "0";
    customDropdown.style.right = "0";
    customDropdown.style.backgroundColor = "#222";
    customDropdown.style.border = "1px solid #444";
    customDropdown.style.borderRadius = "4px";
    customDropdown.style.marginTop = "4px";
    customDropdown.style.maxHeight = "200px";
    customDropdown.style.overflowY = "auto";
    customDropdown.style.zIndex = "100";
    customDropdown.style.display = "none";
    customDropdown.style.boxShadow = "0 4px 8px rgba(0,0,0,0.5)";

    arrowBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = customDropdown.style.display === "none";
        customDropdown.style.display = isHidden ? "block" : "none";
    });

    document.addEventListener("click", (e) => {
        if (inputWrapper.contains(e.target)) return;
        customDropdown.style.display = "none";
    });

    inputWrapper.appendChild(folderInput);
    inputWrapper.appendChild(arrowBtn);
    inputWrapper.appendChild(customDropdown);

    const loadBtn = document.createElement("button");
    loadBtn.className = "vc-btn vc-btn-subtle";
    loadBtn.innerHTML = `${Icons.ICON_REFRESH} Load`;
    loadBtn.title = "Scan and load project folder";
    loadBtn.onclick = () => {
        customDropdown.style.display = "none";
        ctx.loadProject(folderInput.value);
    };

    folderRow.appendChild(inputWrapper);
    folderRow.appendChild(loadBtn);
    projectFrame.appendChild(folderRow);

    const proxyRow = document.createElement("div");
    proxyRow.className = "vc-row";
    proxyRow.style.justifyContent = "space-between";

    const proxyBtn = document.createElement("button");
    proxyBtn.className = "vc-btn vc-btn-subtle";
    proxyBtn.style.flex = "1";
    proxyBtn.style.display = "flex";
    proxyBtn.style.alignItems = "center";
    proxyBtn.style.justifyContent = "space-between";
    proxyBtn.style.padding = "4px 8px";
    proxyBtn.disabled = true;

    const proxyBtnText = document.createElement("span");
    proxyBtnText.innerText = "Create Proxy";
    proxyBtnText.style.flex = "1";
    proxyBtnText.style.textAlign = "left";

    const proxyAllLabel = document.createElement("label");
    proxyAllLabel.style.display = "inline-flex";
    proxyAllLabel.style.alignItems = "center";
    proxyAllLabel.style.gap = "4px";
    proxyAllLabel.style.fontSize = "10px";
    proxyAllLabel.style.cursor = "pointer";
    proxyAllLabel.style.color = "#eee";
    proxyAllLabel.style.marginLeft = "auto";
    proxyAllLabel.style.paddingLeft = "6px";
    proxyAllLabel.style.borderLeft = "1px solid rgba(255, 255, 255, 0.25)";
    proxyAllLabel.title = "Create proxy for all videos in gallery";

    const proxyAllCheck = document.createElement("input");
    proxyAllCheck.type = "checkbox";
    proxyAllCheck.style.margin = "0";
    proxyAllCheck.addEventListener("mousedown", preventEvents);
    proxyAllCheck.addEventListener("click", preventEvents);

    const updateProxyBtnStatus = () => {
        if (ctx.isProxyProcessing) return;

        proxyBtn.style.backgroundColor = "";
        proxyBtn.style.borderColor = "";
        proxyBtn.style.color = "";
        
        const needsWarning = (ctx.state.needsFpsProxy || ctx.state.needsProxyFormat || ctx.state.isHeavy) && !ctx.state.isProxyActive;

        if (proxyAllCheck.checked) {
            if (needsWarning) {
                proxyBtn.className = "vc-btn";
                proxyBtn.style.backgroundColor = "#aa4400";
                proxyBtn.style.borderColor = "#ff8800";
                proxyBtn.style.color = "#fff";
            } else {
                proxyBtn.className = "vc-btn vc-btn-subtle";
            }
            proxyBtn.disabled = false;
            proxyBtnText.innerText = "Create All Proxies";
        } else if (ctx.state.isProxyActive) {
            proxyBtn.className = "vc-btn vc-btn-success";
            proxyBtn.disabled = false;
            proxyBtnText.innerText = "Proxy Active";
        } else if (!ctx.state.isHeavy && !ctx.state.needsProxyFormat && ctx.state.currentFile) {
            proxyBtn.className = "vc-btn vc-btn-subtle";
            proxyBtn.disabled = true;
            proxyBtnText.innerText = "Proxy Not Needed";
        } else {
            proxyBtn.disabled = false;
            if (ctx.state.needsFpsProxy) {
                proxyBtn.className = "vc-btn";
                proxyBtn.style.backgroundColor = "#aa4400"; 
                proxyBtn.style.borderColor = "#ff8800";
                proxyBtn.style.color = "#fff";
                const roundedFps = Math.round(ctx.state.srcFps);
                proxyBtnText.innerText = `Fix FPS (${roundedFps} ➔ 24)`;
            } else {
                proxyBtn.className = "vc-btn";
                proxyBtn.style.backgroundColor = "#aa4400"; 
                proxyBtn.style.borderColor = "#ff8800";
                proxyBtn.style.color = "#fff";
                proxyBtnText.innerText = "Create Proxy";
            }
        }
    };

    proxyAllCheck.addEventListener("change", () => updateProxyBtnStatus());

    proxyAllLabel.appendChild(proxyAllCheck);
    proxyAllLabel.appendChild(document.createTextNode("All"));
    proxyBtn.appendChild(proxyBtnText);
    proxyBtn.appendChild(proxyAllLabel);

    proxyRow.appendChild(proxyBtn);
    projectFrame.appendChild(proxyRow);
    leftCol.appendChild(projectFrame);

    // ==========================================
    // FRAME 2: CLIP CONTROLS FRAME (CLIP SIZE)
    // ==========================================
    const clipFrame = document.createElement("div");
    clipFrame.className = "vc-frame clip-frame";

    const clipTitle = document.createElement("div");
    clipTitle.className = "vc-panel-title";
    clipTitle.style.marginBottom = "4px";

    const clipTitleLeft = document.createElement("div");
    clipTitleLeft.style.display = "flex";
    clipTitleLeft.style.alignItems = "center";
    clipTitleLeft.style.gap = "6px";
    clipTitleLeft.innerHTML = `${Icons.ICON_CROP} <span>Clip</span>`;

    const clipTitleRight = document.createElement("div");
    clipTitleRight.style.display = "flex";
    clipTitleRight.style.alignItems = "center";
    clipTitleRight.style.gap = "4px";

    const clipNumBadge = document.createElement("span");
    clipNumBadge.style.fontFamily = "monospace";
    clipNumBadge.style.fontSize = "11px";
    clipNumBadge.style.color = "#55ff88";
    clipNumBadge.innerText = "000";
    clipNumBadge.style.visibility = "hidden";

    const clipNameInput = document.createElement("input");
    clipNameInput.type = "text";
    clipNameInput.className = "vc-input";
    clipNameInput.placeholder = "Clip";
    clipNameInput.style.width = "115px";
    clipNameInput.style.padding = "2px 4px";
    clipNameInput.style.fontSize = "11px";
    clipNameInput.style.fontWeight = "bold";
    clipNameInput.style.color = "#55ff88";
    clipNameInput.style.textAlign = "right";
    clipNameInput.style.background = "rgba(0,0,0,0.5)";
    clipNameInput.style.border = "1px solid #333";
    clipNameInput.disabled = true;
    clipNameInput.addEventListener("mousedown", preventEvents);
    clipNameInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") clipNameInput.blur();
    });

    clipNameInput.addEventListener("input", (e) => {
        if (ctx.state.selectedClipIndices.length > 0) {
            let val = e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, "");
            clipNameInput.value = val;
            const cleanBase = val.trim() || "Clip";
            
            ctx.state.selectedClipIndices.forEach(idx => {
                if (ctx.state.clips[idx]) ctx.state.clips[idx].baseName = cleanBase;
            });
            
            const primaryCfg = ctx.getActiveSettings();
            if (primaryCfg) {
                const dynId = ctx.getDynamicClipId(primaryCfg);
                clipNumBadge.innerText = dynId.replace(primaryCfg.baseName || cleanBase, '');
            }
            
            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
            if (ctx.timeline && ctx.timeline.renderTimeline) ctx.timeline.renderTimeline();
            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList(); 
            ctx.saveState();
            ctx.saveUiState();
        }
    });

    clipNameInput.addEventListener("blur", (e) => {
        if (!e.target.value.trim()) {
            e.target.value = "Clip";
        }
    });

    clipTitleRight.appendChild(clipNameInput);
    clipTitleRight.appendChild(clipNumBadge);
    
    clipTitle.appendChild(clipTitleLeft);
    clipTitle.appendChild(clipTitleRight);
    clipFrame.appendChild(clipTitle);

    // ==========================================
    // REARRANGED MODE ROW (STRETCH | CROP | LOCK)
    // ==========================================
    const modeRow = document.createElement("div");
    modeRow.className = "vc-row";

    const modeLbl = document.createElement("span");
    modeLbl.className = "vc-label";
    modeLbl.innerText = "Mode:";

    const modeToggle = document.createElement("div");
    modeToggle.className = "vc-mode-toggle";
    modeToggle.style.flex = "0 0 164px";

    const stretchBtn = document.createElement("button");
    stretchBtn.className = "vc-mode-btn";
    stretchBtn.innerText = "Stretch";
    stretchBtn.type = "button";
    stretchBtn.addEventListener("mousedown", preventEvents);

    const cropBtn = document.createElement("button");
    cropBtn.className = "vc-mode-btn active";
    cropBtn.innerText = "Crop";
    cropBtn.type = "button";
    cropBtn.addEventListener("mousedown", preventEvents);

    modeToggle.appendChild(stretchBtn);
    modeToggle.appendChild(cropBtn);

    let isOutputLocked = true;
    const lockSizeLabel = document.createElement("label");
    lockSizeLabel.className = "vc-checkbox-row";
    lockSizeLabel.style.marginLeft = "auto";
    
    const lockSizeCheck = document.createElement("input");
    lockSizeCheck.type = "checkbox";
    lockSizeCheck.checked = true;
    lockSizeCheck.addEventListener("mousedown", preventEvents);
    lockSizeCheck.addEventListener("change", (e) => {
        isOutputLocked = e.target.checked;
        ctx.saveUiState();
    });
    
    lockSizeLabel.appendChild(lockSizeCheck);
    lockSizeLabel.appendChild(document.createTextNode("Fixed Output"));

    modeRow.appendChild(modeLbl);
    modeRow.appendChild(modeToggle);
    modeRow.appendChild(lockSizeLabel);
    clipFrame.appendChild(modeRow);

    const arMpRow = document.createElement("div");
    arMpRow.className = "vc-row";

    const presetLbl = document.createElement("span");
    presetLbl.className = "vc-label";
    presetLbl.style.minWidth = "auto";
    presetLbl.style.marginRight = "4px";
    presetLbl.innerText = "Preset:";

    const arSelect = document.createElement("select");
    arSelect.className = "vc-input";
    arSelect.style.width = "56px";
    arSelect.style.flex = "0";
    arSelect.style.marginLeft = "16px";
    arSelect.addEventListener("mousedown", preventEvents);
    ["16:9", "9:16", "1:1", "4:3", "3:4"].forEach(ar => {
        const opt = document.createElement("option");
        opt.value = ar;
        opt.innerText = ar;
        arSelect.appendChild(opt);
    });

    const mpSelect = document.createElement("select");
    mpSelect.className = "vc-input";
    mpSelect.style.width = "124px";
    mpSelect.style.flex = "0"; 
    mpSelect.addEventListener("mousedown", preventEvents);

    arMpRow.appendChild(presetLbl);
    arMpRow.appendChild(arSelect);
    arMpRow.appendChild(mpSelect);
    clipFrame.appendChild(arMpRow);

    const createSizeRow = (labelText, min, max, defaultVal, withSpacer = false) => {
        const row = document.createElement("div");
        row.className = "vc-row";

        const lbl = document.createElement("span");
        lbl.className = "vc-label";
        lbl.innerText = labelText;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = "32";
        slider.value = defaultVal;
        slider.style.flex = "1";
        slider.addEventListener("mousedown", preventEvents);

        const num = document.createElement("input");
        num.type = "number";
        num.min = min;
        num.max = max;
        num.step = "32";
        num.value = defaultVal;
        num.className = "vc-input vc-input-num";
        num.style.width = "52px";
        num.addEventListener("keydown", preventEvents);
        num.addEventListener("mousedown", preventEvents);

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(num);

        let spacer = null;
        if (withSpacer) {
            spacer = document.createElement("div");
            spacer.style.width = "22px";
            spacer.style.flexShrink = "0";
            row.appendChild(spacer);
        }

        return { row, slider, num, spacer };
    };

    const sizeBlock = document.createElement("div");
    sizeBlock.style.display = "flex";
    sizeBlock.style.gap = "6px";
    sizeBlock.style.alignItems = "stretch";

    const sizeRowsContainer = document.createElement("div");
    sizeRowsContainer.style.display = "flex";
    sizeRowsContainer.style.flexDirection = "column";
    sizeRowsContainer.style.gap = "6px";
    sizeRowsContainer.style.flex = "1";
    sizeRowsContainer.style.minWidth = "0";

    const sizeW = createSizeRow("Size W:", "128", "3840", "960", false);
    const sizeH = createSizeRow("Size H:", "128", "3840", "544", false);
    
    sizeRowsContainer.appendChild(sizeW.row);
    sizeRowsContainer.appendChild(sizeH.row);

    let isArLocked = true;
    const arLockBtn = document.createElement("button");
    arLockBtn.className = "vc-lock-btn locked";
    arLockBtn.innerHTML = Icons.ICON_LINK;
    arLockBtn.title = "Lock Aspect Ratio";
    arLockBtn.style.alignSelf = "stretch";
    arLockBtn.style.minHeight = "48px";
    arLockBtn.addEventListener("mousedown", preventEvents);
    arLockBtn.addEventListener("click", () => {
        isArLocked = !isArLocked;
        arLockBtn.className = `vc-lock-btn ${isArLocked ? "locked" : ""}`;
        arLockBtn.innerHTML = isArLocked ? Icons.ICON_LINK : Icons.ICON_UNLINK;
    });

    sizeBlock.appendChild(sizeRowsContainer);
    sizeBlock.appendChild(arLockBtn);
    clipFrame.appendChild(sizeBlock);

    // ==========================================
    // OFFSET / KEYFRAME INJECTION ROW
    // ==========================================
    const createOffsetRow = (label, withSpacer = false) => {
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
        num.style.width = "44px";
        num.addEventListener("keydown", preventEvents);
        num.addEventListener("mousedown", preventEvents);

        row.appendChild(lbl);
        row.appendChild(slider);
        row.appendChild(num);

        if (withSpacer) {
            const spacer = document.createElement("div");
            spacer.style.width = "22px";
            spacer.style.flexShrink = "0";
            row.appendChild(spacer);
        }

        return { row, slider, num };
    };

    const kfBtns = ctx.keyframeManager ? ctx.keyframeManager.getButtons() : null;

    const ctrlX = createOffsetRow("Shift X:", false);
    if (kfBtns) {
        const kfGroupX = document.createElement("div");
        kfGroupX.style.display = "flex";
        kfGroupX.style.gap = "2px";
        kfGroupX.style.marginLeft = "4px";
        kfGroupX.appendChild(kfBtns.prevBtn);
        kfGroupX.appendChild(kfBtns.toggleBtn);
        kfGroupX.appendChild(kfBtns.nextBtn);
        ctrlX.row.appendChild(kfGroupX);
    }
    clipFrame.appendChild(ctrlX.row);

    const ctrlY = createOffsetRow("Shift Y:", false);
    if (kfBtns) {
        const kfGroupY = document.createElement("div");
        kfGroupY.style.display = "flex";
        kfGroupY.style.gap = "2px";
        kfGroupY.style.marginLeft = "4px";
        kfGroupY.style.width = "76px"; 
        kfGroupY.style.justifyContent = "flex-end";
        kfGroupY.appendChild(kfBtns.interpBtn);
        kfGroupY.appendChild(kfBtns.clearBtn);
        ctrlY.row.appendChild(kfGroupY);
    }
    clipFrame.appendChild(ctrlY.row);

    // ==========================================
    // EXPORT SECTION
    // ==========================================
    const outSizeBlock = document.createElement("div");
    outSizeBlock.style.display = "flex";
    outSizeBlock.style.gap = "6px";
    outSizeBlock.style.alignItems = "stretch";

    const outRowsContainer = document.createElement("div");
    outRowsContainer.style.display = "flex";
    outRowsContainer.style.flexDirection = "column";
    outRowsContainer.style.gap = "6px";
    outRowsContainer.style.flex = "1";
    outRowsContainer.style.minWidth = "0"; 

    const outW = createSizeRow("Output W:", "128", "3840", "960", false);
    const outH = createSizeRow("Output H:", "128", "3840", "544", false);
    outW.slider.title = "Final Export Width (snaps to 32)";
    outH.slider.title = "Final Export Height (snaps to 32)";
    outRowsContainer.appendChild(outW.row);
    outRowsContainer.appendChild(outH.row);

    let isOutArLocked = true;
    const outArLockBtn = document.createElement("button");
    outArLockBtn.className = "vc-lock-btn locked";
    outArLockBtn.innerHTML = Icons.ICON_LINK;
    outArLockBtn.title = "Lock Aspect Ratio for Output";
    outArLockBtn.style.alignSelf = "stretch";
    outArLockBtn.style.minHeight = "48px";
    outArLockBtn.addEventListener("mousedown", preventEvents);
    outArLockBtn.addEventListener("click", () => {
        isOutArLocked = !isOutArLocked;
        outArLockBtn.className = `vc-lock-btn ${isOutArLocked ? "locked" : ""}`;
        outArLockBtn.innerHTML = isOutArLocked ? Icons.ICON_LINK : Icons.ICON_UNLINK;
    });

    outSizeBlock.appendChild(outRowsContainer);
    outSizeBlock.appendChild(outArLockBtn);
    clipFrame.appendChild(outSizeBlock);

    const clipboardToolsContainer = document.createElement("div");
    clipboardToolsContainer.style.marginTop = "auto";
    clipboardToolsContainer.style.paddingTop = "6px";
    clipboardToolsContainer.style.borderTop = "1px solid #2a2a2a";
    clipboardToolsContainer.style.display = "flex";
    clipboardToolsContainer.style.flexDirection = "row";
    clipboardToolsContainer.style.alignItems = "center";
    clipboardToolsContainer.style.justifyContent = "space-between";
    clipboardToolsContainer.style.gap = "4px";

    const toggleGroup = document.createElement("div");
    toggleGroup.style.display = "flex";
    toggleGroup.style.gap = "8px";

    const videoExportLabel = document.createElement("label");
    videoExportLabel.className = "vc-checkbox-row";
    const videoExportCheck = document.createElement("input");
    videoExportCheck.type = "checkbox";
    videoExportCheck.checked = true;
    videoExportCheck.addEventListener("mousedown", preventEvents);
    videoExportLabel.appendChild(videoExportCheck);
    videoExportLabel.appendChild(document.createTextNode("Video"));

    const audioExportLabel = document.createElement("label");
    audioExportLabel.className = "vc-checkbox-row";
    const audioExportCheck = document.createElement("input");
    audioExportCheck.type = "checkbox";
    audioExportCheck.checked = true;
    audioExportCheck.addEventListener("mousedown", preventEvents);
    audioExportLabel.appendChild(audioExportCheck);
    audioExportLabel.appendChild(document.createTextNode("Audio"));

    toggleGroup.appendChild(videoExportLabel);
    toggleGroup.appendChild(audioExportLabel);

    const divider = document.createElement("div");
    divider.style.width = "1px";
    divider.style.height = "16px";
    divider.style.backgroundColor = "rgba(255,255,255,0.2)";
    divider.style.margin = "0 2px";

    const toolGroup = document.createElement("div");
    toolGroup.style.display = "flex";
    toolGroup.style.gap = "4px";

    const copyBtn = document.createElement("button");
    copyBtn.className = "vc-btn vc-btn-subtle";
    copyBtn.style.padding = "2px 6px";
    copyBtn.style.fontSize = "10px";
    copyBtn.innerText = "Copy";
    copyBtn.title = "Copy current sizing and crop settings";
    copyBtn.addEventListener("click", () => {
        ctx.copyClipSettings();
        copyBtn.innerText = "Copied!";
        copyBtn.className = "vc-btn vc-btn-success";
        setTimeout(() => {
            copyBtn.innerText = "Copy";
            copyBtn.className = "vc-btn vc-btn-subtle";
        }, 1000);
    });

    const pasteBtn = document.createElement("button");
    pasteBtn.className = "vc-btn vc-btn-subtle";
    pasteBtn.style.padding = "2px 6px";
    pasteBtn.style.fontSize = "10px";
    pasteBtn.innerText = "Paste";
    pasteBtn.title = "Paste settings to active clip(s)";
    pasteBtn.addEventListener("click", () => {
        if (ctx.pasteClipSettings()) {
            pasteBtn.innerText = "Pasted!";
            pasteBtn.className = "vc-btn vc-btn-success";
            setTimeout(() => {
                pasteBtn.innerText = "Paste";
                pasteBtn.className = "vc-btn vc-btn-subtle";
            }, 1000);
        }
    });

    const applyAllBtn = document.createElement("button");
    applyAllBtn.className = "vc-btn vc-btn-subtle";
    applyAllBtn.style.padding = "2px 6px";
    applyAllBtn.style.fontSize = "10px";
    applyAllBtn.innerText = "Apply All";
    applyAllBtn.title = "Overwrite ALL clips in this video with current settings";
    applyAllBtn.addEventListener("click", () => {
        if (confirm("Apply these settings to ALL clips in this video?")) {
            if (ctx.applyToAllClips()) {
                applyAllBtn.innerText = "Applied!";
                applyAllBtn.className = "vc-btn vc-btn-success";
                setTimeout(() => {
                    applyAllBtn.innerText = "Apply All";
                    applyAllBtn.className = "vc-btn vc-btn-subtle";
                }, 1000);
            }
        }
    });

    toolGroup.appendChild(copyBtn);
    toolGroup.appendChild(pasteBtn);
    toolGroup.appendChild(applyAllBtn);

    clipboardToolsContainer.appendChild(toggleGroup);
    clipboardToolsContainer.appendChild(divider);
    clipboardToolsContainer.appendChild(toolGroup);

    clipFrame.appendChild(clipboardToolsContainer);
    leftCol.appendChild(clipFrame);

    // ==========================================
    // LOGIC & SYNCHRONIZATION
    // ==========================================

    const applyToSelected = (updateFn) => {
        if (ctx.state.selectedClipIndices.length > 0) {
            ctx.state.selectedClipIndices.forEach(idx => {
                if (ctx.state.clips[idx]) updateFn(ctx.state.clips[idx]);
            });
        } else {
            updateFn(ctx.state.currentSettings);
        }
    };

    const setMode = (isCrop) => {
        applyToSelected((cfg) => { cfg.cropMode = isCrop; });
        
        if (isCrop) {
            cropBtn.className = "vc-mode-btn active";
            stretchBtn.className = "vc-mode-btn";
        } else {
            cropBtn.className = "vc-mode-btn";
            stretchBtn.className = "vc-mode-btn active";
        }
        
        lockSizeCheck.disabled = !isCrop;
        lockSizeLabel.style.opacity = isCrop ? "1" : "0.5";
        
        outW.slider.disabled = !isCrop;
        outW.num.disabled = !isCrop;
        outH.slider.disabled = !isCrop;
        outH.num.disabled = !isCrop;
        outArLockBtn.disabled = !isCrop;
        outSizeBlock.style.opacity = isCrop ? "1" : "0.5";

        ctx.player.updateCropOverlay();
        if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
        ctx.saveState();
        ctx.saveUiState();
    };

    cropBtn.addEventListener("click", () => setMode(true));
    stretchBtn.addEventListener("click", () => setMode(false));

    const getSelectedRatio = () => {
        const ar = arSelect.value || "16:9";
        const parts = ar.split(":").map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
            return parts[0] / parts[1];
        }
        return 16 / 9;
    };

    const handleSizeChange = (source, rawVal) => {
        let val = parseInt(rawVal, 10);
        if (isNaN(val) || val <= 0) return;
        val = Math.max(32, Math.round(val / 32) * 32);

        applyToSelected((cfg) => {
            if (source === "w") {
                cfg.targetWidth = val;
                if (isArLocked) {
                    const ratio = getSelectedRatio();
                    cfg.targetHeight = Math.max(32, Math.round((val / ratio) / 32) * 32);
                }
            } else {
                cfg.targetHeight = val;
                if (isArLocked) {
                    const ratio = getSelectedRatio();
                    cfg.targetWidth = Math.max(32, Math.round((val * ratio) / 32) * 32);
                }
            }
            if (!isOutputLocked) {
                cfg.actualExportW = cfg.targetWidth;
                cfg.actualExportH = cfg.targetHeight;
            }
        });

        syncControlsFromSettings(ctx.getActiveSettings());
        
        ctx.player.updateCropOverlay();
        if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
        if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    };

    sizeW.slider.addEventListener("input", (e) => handleSizeChange("w", e.target.value));
    sizeW.num.addEventListener("change", (e) => handleSizeChange("w", e.target.value));
    sizeH.slider.addEventListener("input", (e) => handleSizeChange("h", e.target.value));
    sizeH.num.addEventListener("change", (e) => handleSizeChange("h", e.target.value));

    const populateMpDropdown = (ar, selectedMp = "0.5") => {
        mpSelect.innerHTML = "";
        const currentAr = ar || arSelect.value || "16:9";
        if (!ctx.RESOLUTIONS[currentAr]) return;

        Object.keys(ctx.RESOLUTIONS[currentAr]).forEach(mp => {
            const dims = ctx.RESOLUTIONS[currentAr][mp];
            const opt = document.createElement("option");
            opt.value = mp;
            opt.innerText = `${mp} MP (${dims[0]}x${dims[1]})`;
            if (mp === selectedMp) opt.selected = true;
            mpSelect.appendChild(opt);
        });
    };

    const updateCropSettingsFromPreset = () => {
        const ar = arSelect.value || "16:9";
        const mp = mpSelect.value || "0.5";

        if (ctx.RESOLUTIONS[ar] && ctx.RESOLUTIONS[ar][mp]) {
            const dims = ctx.RESOLUTIONS[ar][mp];
            
            applyToSelected((cfg) => {
                cfg.ar = ar;
                cfg.mp = mp;
                cfg.targetWidth = dims[0];
                cfg.targetHeight = dims[1];
                // Always update export dimensions when choosing a new AR/MP preset so aspect ratios never mismatch
                cfg.actualExportW = dims[0];
                cfg.actualExportH = dims[1];
                cfg.offsetX = 0.5;
                cfg.offsetY = 0.5;
            });
            
            syncControlsFromSettings(ctx.getActiveSettings());
            ctx.player.updateCropOverlay();
            if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
            ctx.saveState();
            ctx.saveUiState();
        }
    };

    const syncOffset = (type, value) => {
        let clamped = Math.max(0, Math.min(100, Math.round(value)));
        let floatVal = clamped / 100;
        let madeKeyframe = false;

        applyToSelected((cfg) => {
            if (cfg.keyframes && cfg.keyframes.length > 0 && ctx.keyframeManager) {
                ctx.keyframeManager.addOrUpdateKeyframe(cfg, type, floatVal);
                madeKeyframe = true;
            } else {
                if (type === "x") cfg.offsetX = floatVal;
                else cfg.offsetY = floatVal;
            }
        });

        if (type === "x") {
            ctrlX.slider.value = clamped;
            ctrlX.num.value = clamped;
        } else {
            ctrlY.slider.value = clamped;
            ctrlY.num.value = clamped;
        }

        ctx.player.updateCropOverlay();
        if (madeKeyframe && ctx.timeline && ctx.timeline.renderTimeline) {
            ctx.timeline.renderTimeline();
        }
        ctx.saveState();
        ctx.saveUiState();
    };

    ctrlX.slider.addEventListener("input", (e) => syncOffset("x", parseFloat(e.target.value)));
    ctrlX.num.addEventListener("input", (e) => syncOffset("x", parseFloat(e.target.value)));
    ctrlY.slider.addEventListener("input", (e) => syncOffset("y", parseFloat(e.target.value)));
    ctrlY.num.addEventListener("input", (e) => syncOffset("y", parseFloat(e.target.value)));

    videoExportCheck.addEventListener("change", (e) => {
        applyToSelected((cfg) => {
            cfg.includeVideo = e.target.checked;
            if (!e.target.checked) cfg.includeAudio = true;
        });
        syncControlsFromSettings(ctx.getActiveSettings());
        ctx.saveState();
        ctx.saveUiState();
    });

    audioExportCheck.addEventListener("change", (e) => {
        applyToSelected((cfg) => {
            cfg.includeAudio = e.target.checked;
            if (!e.target.checked && !videoExportCheck.checked) cfg.includeVideo = true;
        });
        syncControlsFromSettings(ctx.getActiveSettings());
        ctx.saveState();
        ctx.saveUiState();
    });

    const handleOutputChange = (source, rawVal) => {
        let val = parseInt(rawVal, 10);
        if (isNaN(val) || val <= 0) return;
        val = Math.max(32, Math.round(val / 32) * 32);

        applyToSelected((cfg) => {
            if (source === "w") {
                cfg.actualExportW = val;
                if (isOutArLocked) {
                    const ratio = cfg.targetWidth / cfg.targetHeight;
                    cfg.actualExportH = Math.max(32, Math.round((val / ratio) / 32) * 32);
                }
            } else {
                cfg.actualExportH = val;
                if (isOutArLocked) {
                    const ratio = cfg.targetWidth / cfg.targetHeight;
                    cfg.actualExportW = Math.max(32, Math.round((val * ratio) / 32) * 32);
                }
            }
        });
        
        syncControlsFromSettings(ctx.getActiveSettings());
        if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
        if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
        ctx.saveState();
        ctx.saveUiState();
    };

    outW.slider.addEventListener("input", (e) => handleOutputChange("w", e.target.value));
    outW.num.change?.() || outW.num.addEventListener("change", (e) => handleOutputChange("w", e.target.value));
    outH.slider.addEventListener("input", (e) => handleOutputChange("h", e.target.value));
    outH.num.addEventListener("change", (e) => handleOutputChange("h", e.target.value));

    arSelect.addEventListener("change", () => {
        populateMpDropdown(arSelect.value, "0.5");
        updateCropSettingsFromPreset();
    });
    mpSelect.addEventListener("change", updateCropSettingsFromPreset);

    const syncControlsFromSettings = (cfg) => {
        if (cfg && ctx.state.selectedClipIndices.length > 0) {
            clipNameInput.disabled = false;
            clipNameInput.value = cfg.baseName || "Clip";
            const dynId = ctx.getDynamicClipId(cfg);
            clipNumBadge.innerText = dynId.replace(cfg.baseName || "Clip", '');
            clipNumBadge.style.visibility = "visible";
        } else {
            clipNameInput.disabled = true;
            clipNameInput.value = "";
            clipNumBadge.style.visibility = "hidden";
        }

        arSelect.value = cfg?.ar || "16:9";
        populateMpDropdown(cfg?.ar || "16:9", cfg?.mp);

        const w = cfg?.targetWidth || 960;
        const h = cfg?.targetHeight || 544;
        sizeW.slider.value = `${w}`;
        sizeW.num.value = `${w}`;
        sizeH.slider.value = `${h}`;
        sizeH.num.value = `${h}`;

        const xVal = Math.round((cfg?.offsetX || 0.5) * 100);
        const yVal = Math.round((cfg?.offsetY || 0.5) * 100);
        ctrlX.slider.value = xVal;
        ctrlX.num.value = xVal;
        ctrlY.slider.value = yVal;
        ctrlY.num.value = yVal;

        const isCrop = (cfg?.cropMode !== false);
        if (isCrop) {
            cropBtn.className = "vc-mode-btn active";
            stretchBtn.className = "vc-mode-btn";
        } else {
            cropBtn.className = "vc-mode-btn";
            stretchBtn.className = "vc-mode-btn active";
        }
        
        lockSizeCheck.disabled = !isCrop;
        lockSizeLabel.style.opacity = isCrop ? "1" : "0.5";
        
        outW.slider.disabled = !isCrop;
        outW.num.disabled = !isCrop;
        outH.slider.disabled = !isCrop;
        outH.num.disabled = !isCrop;
        outArLockBtn.disabled = !isCrop;
        outSizeBlock.style.opacity = isCrop ? "1" : "0.5";

        videoExportCheck.checked = cfg?.includeVideo !== false;
        audioExportCheck.checked = cfg?.includeAudio !== false;
        
        outW.slider.value = `${cfg?.actualExportW || cfg?.targetWidth || 960}`;
        outW.num.value = `${cfg?.actualExportW || cfg?.targetWidth || 960}`;
        outH.slider.value = `${cfg?.actualExportH || cfg?.targetHeight || 544}`;
        outH.num.value = `${cfg?.actualExportH || cfg?.targetHeight || 544}`;

        if (ctx.keyframeManager) {
            ctx.keyframeManager.syncUI();
            ctx.keyframeManager.applyInterpolationToUI();
        }

        ctx.player.updateCropOverlay();
        if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
    };

    proxyBtn.addEventListener("click", () => {
        handleProxyCreation(ctx, { proxyBtn, proxyBtnText, proxyAllCheck, updateProxyBtnStatus });
    });

    const triggerProxyCreation = () => { proxyBtn.click(); };

    const nudgeOffset = (dx, dy) => {
        if (dx !== 0) {
            let curX = parseFloat(ctrlX.slider.value);
            syncOffset("x", curX + dx);
        }
        if (dy !== 0) {
            let curY = parseFloat(ctrlY.slider.value);
            syncOffset("y", curY + dy);
        }
    };

    const nudgeSize = (dw, dh) => {
        if (dw !== 0) {
            let curW = parseInt(sizeW.slider.value, 10) || 960;
            handleSizeChange("w", curW + dw);
        }
        if (dh !== 0) {
            let curH = parseInt(sizeH.slider.value, 10) || 544;
            handleSizeChange("h", curH + dh);
        }
    };

    return {
        element: leftCol,
        syncControlsFromSettings,
        setFolderPath: (path) => { folderInput.value = path || ""; },
        setForce24Fps: () => {}, 
        triggerProxyCreation,
        nudgeOffset, 
        nudgeSize,
        updateOffsetSlidersQuietly: (x, y) => {
            const xVal = Math.round(x * 100);
            const yVal = Math.round(y * 100);
            ctrlX.slider.value = xVal;
            ctrlX.num.value = xVal;
            ctrlY.slider.value = yVal;
            ctrlY.num.value = yVal;
        },
        updateRecentProjects: (projects) => {
            customDropdown.innerHTML = "";
            if (!projects || projects.length === 0) {
                const empty = document.createElement("div");
                empty.innerText = "No recent projects";
                empty.style.padding = "6px 8px";
                empty.style.color = "#666";
                empty.style.fontSize = "11px";
                customDropdown.appendChild(empty);
                return;
            }
            projects.forEach(p => {
                const item = document.createElement("div");
                item.innerText = p;
                item.style.padding = "6px 8px";
                item.style.cursor = "pointer";
                item.style.fontSize = "11px";
                item.style.color = "#ccc";
                item.style.borderBottom = "1px solid #333";
                item.style.whiteSpace = "nowrap";
                item.style.overflow = "hidden";
                item.style.textOverflow = "ellipsis";
    
                item.addEventListener("mouseenter", () => { item.style.backgroundColor = "#3a3a3a"; });
                item.addEventListener("mouseleave", () => { item.style.backgroundColor = "transparent"; });
                
                item.addEventListener("click", (e) => {
                    e.stopPropagation();
                    folderInput.value = p;
                    customDropdown.style.display = "none";
                    ctx.loadProject(p);
                });
                customDropdown.appendChild(item);
            });
        },
        setProxyBtnState: (exists) => {
            ctx.state.isProxyActive = exists;
            updateProxyBtnStatus();
        }
    };
}