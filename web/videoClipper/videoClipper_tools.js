import * as Icons from "./videoClipper_icons.js";

export function createToolsOverlay(ctx) {
    const toolsOverlay = document.createElement("div");
    toolsOverlay.className = "vc-settings-overlay"; 
    toolsOverlay.style.display = "none";
    // Letting it inherit the 100% width from .vc-settings-overlay to perfectly fit the 640px player!

    const toolsHeader = document.createElement("div");
    toolsHeader.className = "vc-help-header";
    toolsHeader.style.marginBottom = "16px";
    // Removed the borderBottom divider

    const toolsTitle = document.createElement("span");
    toolsTitle.className = "vc-help-title";
    toolsTitle.style.display = "flex";
    toolsTitle.style.alignItems = "center";
    toolsTitle.style.gap = "8px";
    toolsTitle.innerHTML = `${Icons.ICON_TOOLS} <span>Minimax H3 VRAM Estimator</span>`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "vc-icon-btn small";
    closeBtn.innerHTML = Icons.ICON_CLOSE;
    closeBtn.title = "Close Tools";
    closeBtn.onclick = () => { toolsOverlay.style.display = "none"; };

    toolsHeader.appendChild(toolsTitle);
    toolsHeader.appendChild(closeBtn);
    toolsOverlay.appendChild(toolsHeader);

    // Main 2-column layout container
    const layoutContainer = document.createElement("div");
    layoutContainer.style.display = "flex";
    layoutContainer.style.gap = "24px";
    layoutContainer.style.alignItems = "stretch";

    // ==========================================
    // LEFT COLUMN: Clean Settings
    // ==========================================
    const leftCol = document.createElement("div");
    leftCol.style.flex = "1.2"; // Give left column slightly more width to accommodate the wider dropdown
    leftCol.style.display = "flex";
    leftCol.style.flexDirection = "column";
    leftCol.style.gap = "14px";

    const makeLabel = (text) => {
        const lbl = document.createElement("div");
        lbl.style.fontSize = "11px";
        lbl.style.color = "#ccc"; 
        lbl.style.textTransform = "none"; // Explicitly avoiding uppercase
        lbl.innerText = text;
        return lbl;
    };

    // 1. Base Model Precision
    const modelWrap = document.createElement("div");
    modelWrap.style.display = "flex";
    modelWrap.style.flexDirection = "column";
    modelWrap.style.gap = "6px";
    modelWrap.appendChild(makeLabel("Base Model Precision"));

    const modelSelect = document.createElement("select");
    modelSelect.className = "vc-input vc-settings-input";
    // Increase width by approx 32px by overriding the input boundary
    modelSelect.style.width = "calc(100% + 2px)";
    modelSelect.innerHTML = `
        <option value="66">Full BF16 / FP16 (~66 GB Base)</option>
        <option value="21" selected>minimax_h3_fl2va_pruned_int8_convrot.safetensors (~21 GB Base)</option>
        <option value="11">NF4 / INT4 (~11.3 GB Base)</option>
    `;
    modelWrap.appendChild(modelSelect);
    leftCol.appendChild(modelWrap);

    // 2. Block Offloading
    const offloadWrap = document.createElement("div");
    offloadWrap.style.display = "flex";
    offloadWrap.style.flexDirection = "column";
    offloadWrap.style.gap = "6px";
    offloadWrap.appendChild(makeLabel("Block Offloading (Max 50)"));

    const offloadGroup = document.createElement("div");
    offloadGroup.style.display = "flex";
    offloadGroup.style.gap = "8px";
    offloadGroup.style.alignItems = "center";

    const offloadSlider = document.createElement("input");
    offloadSlider.type = "range";
    offloadSlider.min = "0";
    offloadSlider.max = "50";
    offloadSlider.step = "1";
    offloadSlider.value = "0";
    offloadSlider.style.flex = "1";
    offloadSlider.style.accentColor = "#2196F3";

    const offloadVal = document.createElement("span");
    offloadVal.innerText = "0/50";
    offloadVal.style.color = "#aaa";
    offloadVal.style.fontSize = "11px";
    offloadVal.style.width = "40px";
    offloadVal.style.textAlign = "right";
    offloadVal.style.fontFamily = "monospace";
    
    offloadSlider.addEventListener("input", (e) => {
        offloadVal.innerText = `${e.target.value}/50`;
    });

    offloadGroup.appendChild(offloadSlider);
    offloadGroup.appendChild(offloadVal);
    offloadWrap.appendChild(offloadGroup);
    leftCol.appendChild(offloadWrap);

    // 3. Grad Check + Batch Size (Same Row)
    const row3 = document.createElement("div");
    row3.style.display = "flex";
    row3.style.alignItems = "center";
    row3.style.justifyContent = "space-between";
    row3.style.gap = "4px";

    const gradWrap = document.createElement("label");
    gradWrap.style.display = "flex";
    gradWrap.style.alignItems = "center";
    gradWrap.style.gap = "6px";
    gradWrap.style.cursor = "pointer";

    const gradCheck = document.createElement("input");
    gradCheck.type = "checkbox";
    gradCheck.checked = true;
    gradCheck.style.accentColor = "#2196F3";
    gradCheck.style.margin = "0";
    
    gradWrap.appendChild(gradCheck);
    const gradLbl = makeLabel("Gradient Checkpointing");
    gradLbl.style.cursor = "pointer";
    gradWrap.appendChild(gradLbl);

    const batchWrap = document.createElement("div");
    batchWrap.style.display = "flex";
    batchWrap.style.alignItems = "center";
    batchWrap.style.gap = "8px";
    
    const batchLbl = makeLabel("Batch Size");
    const batchInput = document.createElement("input");
    batchInput.type = "number";
    batchInput.className = "vc-input vc-settings-input-num";
    batchInput.min = "1";
    batchInput.value = "1";
    batchInput.style.width = "48px"; // Reduced width
    
    batchWrap.appendChild(batchLbl);
    batchWrap.appendChild(batchInput);

    row3.appendChild(gradWrap);
    row3.appendChild(batchWrap);
    leftCol.appendChild(row3);

    // 4. Frames + Resolution (Same Row)
    const row4 = document.createElement("div");
    row4.style.display = "flex";
    row4.style.alignItems = "center";
    row4.style.justifyContent = "flex-start";
    row4.style.gap = "16px";

    const framesWrap = document.createElement("div");
    framesWrap.style.display = "flex";
    framesWrap.style.alignItems = "center";
    framesWrap.style.gap = "8px";

    const framesLbl = makeLabel("Frames");
    const framesInput = document.createElement("input");
    framesInput.type = "number";
    framesInput.className = "vc-input vc-settings-input-num";
    framesInput.min = "22";
    framesInput.step = "17";
    framesInput.value = "124";
    framesInput.style.width = "60px"; // Reduced width

    framesWrap.appendChild(framesLbl);
    framesWrap.appendChild(framesInput);

    const resWrap = document.createElement("div");
    resWrap.style.display = "flex";
    resWrap.style.alignItems = "center";
    resWrap.style.gap = "16px";

    const resLbl = makeLabel("Size (WxH)");
    
    const resGroup = document.createElement("div");
    resGroup.style.display = "flex";
    resGroup.style.gap = "2px";
    resGroup.style.alignItems = "center";

    const widthInput = document.createElement("input");
    widthInput.type = "number";
    widthInput.className = "vc-input vc-settings-input-num";
    widthInput.value = "832";
    widthInput.step = "32";
    widthInput.style.width = "60px"; // Reduced width

    const heightInput = document.createElement("input");
    heightInput.type = "number";
    heightInput.className = "vc-input vc-settings-input-num";
    heightInput.value = "480";
    heightInput.step = "32";
    heightInput.style.width = "60px"; // Reduced width

    resGroup.appendChild(widthInput);
    const xSpan = document.createElement("span");
    xSpan.innerText = "x";
    xSpan.style.color = "#666";
    xSpan.style.fontSize = "11px";
    resGroup.appendChild(xSpan);
    resGroup.appendChild(heightInput);

    resWrap.appendChild(resLbl);
    resWrap.appendChild(resGroup);

    row4.appendChild(framesWrap);
    row4.appendChild(resWrap);
    leftCol.appendChild(row4);


    // ==========================================
    // RIGHT COLUMN: Results Display
    // ==========================================
    const rightCol = document.createElement("div");
    rightCol.style.flex = "0.8"; // Slightly smaller flex weight to match the wider left column
    rightCol.style.display = "flex";
    rightCol.style.flexDirection = "column";
    rightCol.style.justifyContent = "center";
    rightCol.style.alignItems = "center";
    rightCol.style.padding = "20px";
    rightCol.style.background = "rgba(0, 0, 0, 0.35)";
    rightCol.style.border = "1px solid rgba(255, 255, 255, 0.08)";
    rightCol.style.borderRadius = "8px";
    rightCol.style.boxShadow = "inset 0 2px 10px rgba(0,0,0,0.5)";
    
    const vramLabel = document.createElement("div");
    vramLabel.innerText = "Estimated VRAM";
    vramLabel.style.fontSize = "12px";
    vramLabel.style.color = "#888";
    vramLabel.style.textTransform = "none";
    vramLabel.style.marginBottom = "12px";

    const vramValue = document.createElement("div");
    vramValue.style.fontSize = "48px";
    vramValue.style.fontWeight = "900";
    vramValue.style.color = "#fff";
    vramValue.style.textShadow = "0 2px 8px rgba(0,0,0,0.8)";
    vramValue.style.lineHeight = "1";

    const vramContext = document.createElement("div");
    vramContext.style.marginTop = "20px";
    vramContext.style.fontSize = "11px";
    vramContext.style.color = "#999";
    vramContext.style.textAlign = "center";
    vramContext.style.lineHeight = "1.4";
    vramContext.innerHTML = "Includes base weights + activations.<br>Assumes LoRA fine-tuning logic.";

    rightCol.appendChild(vramLabel);
    rightCol.appendChild(vramValue);
    rightCol.appendChild(vramContext);

    layoutContainer.appendChild(leftCol);
    layoutContainer.appendChild(rightCol);
    toolsOverlay.appendChild(layoutContainer);

    // ==========================================
    // LOGIC & EVENTS
    // ==========================================
    const calculateVRAM = () => {
        // Evaluate at strict 32px intervals for the math
        const wVal = parseInt(widthInput.value, 10) || 0;
        const hVal = parseInt(heightInput.value, 10) || 0;
        const w = Math.max(32, Math.round(wVal / 32) * 32);
        const h = Math.max(32, Math.round(hVal / 32) * 32);

        const baseVram = parseFloat(modelSelect.value);
        // Minimax H3 has exactly 50 blocks. Divide by 50 to get the percentage offloaded.
        const offloadPercent = parseInt(offloadSlider.value, 10) / 50;
        const gradMultiplier = gradCheck.checked ? 0.3 : 1.0;
        const bsz = parseInt(batchInput.value, 10) || 1;
        
        // Evaluate at strict Minimax frame intervals
        let fVal = parseInt(framesInput.value, 10) || 0;
        if (fVal < 22) fVal = 22;
        const k = Math.round((fVal - 22) / 17);
        const f = 22 + (k * 17);

        // Sequence activation footprint
        const rawActivation = (f * w * h) * 0.000000236;
        
        // Block Offloading reduces the base model footprint stored in VRAM
        const activeBaseVram = baseVram * (1 - offloadPercent);

        // 1.5 GB static overhead for CUDA context and optimizer states (LoRA)
        const fixedOverhead = 1.5;
        
        // Final Estimate
        const totalVram = activeBaseVram + fixedOverhead + (rawActivation * bsz * gradMultiplier);
        
        vramValue.innerText = `${totalVram.toFixed(1)} GB`;

        if (totalVram > 95) vramValue.style.color = "#ff4444"; // Exceeds 96GB/80GB cards
        else if (totalVram > 47) vramValue.style.color = "#ff8800"; // Exceeds 48GB cards
        else if (totalVram > 23.5) vramValue.style.color = "#ffcc00"; // Exceeds 24GB cards (Danger Zone)
        else vramValue.style.color = "#55ff88"; // Fits 24GB safely
    };

    // Force sizes to snap to multiples of 32 visually when the user clicks away
    const enforceMultiples = (e) => {
        const el = e.target;
        let val = parseInt(el.value, 10);
        if (isNaN(val) || val < 32) val = 32;
        val = Math.round(val / 32) * 32;
        el.value = val;
        calculateVRAM();
    };

    // Force frames to snap to 22 + 17k visually when the user clicks away
    const enforceFrames = (e) => {
        const el = e.target;
        let val = parseInt(el.value, 10);
        if (isNaN(val) || val < 22) val = 22;
        else {
            const k = Math.round((val - 22) / 17);
            val = 22 + (k * 17);
        }
        el.value = val;
        calculateVRAM();
    };

    widthInput.addEventListener("blur", enforceMultiples);
    heightInput.addEventListener("blur", enforceMultiples);
    framesInput.addEventListener("blur", enforceFrames);

    [modelSelect, gradCheck, offloadSlider, batchInput, framesInput, widthInput, heightInput].forEach(el => {
        el.addEventListener("input", calculateVRAM);
        el.addEventListener("change", calculateVRAM);
    });

    // API to prepopulate and open
    const openTools = () => {
        if (ctx.state.selectedClipIndices && ctx.state.selectedClipIndices.length > 0) {
            const clip = ctx.state.clips[ctx.state.selectedClipIndices[0]];
            if (clip) {
                framesInput.value = clip.endFrame - clip.startFrame;
                widthInput.value = clip.actualExportW || clip.targetWidth || 960;
                heightInput.value = clip.actualExportH || clip.targetHeight || 544;
            }
        }
        calculateVRAM();
        toolsOverlay.style.display = "flex";
    };

    return {
        element: toolsOverlay,
        openTools,
        closeTools: () => { toolsOverlay.style.display = "none"; }
    };
}