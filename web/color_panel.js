export class ColorPanel {
    constructor(container, stateManager) {
        this.stateManager = stateManager;
        this.container = container;
        this.colorMode = 'basic';
        this._buildUI();
    }

    _buildUI() {
        const svgSave = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>`;
        const svgDel = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        const svgCheck = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        const svgCancel = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

        this.wrapper = document.createElement("div");
        this.wrapper.style.cssText = "display: flex; flex-direction: column; gap: 10px; width: 100%;";

        // --- PRESETS BAR ---
        const presetContainer = document.createElement("div");
        presetContainer.style.cssText = "display: flex; gap: 4px; margin-bottom: -5px; background: #1a1a1a; padding: 4px; border-radius: 4px; border: 1px solid #333; align-items: center;";

        const presetDropdown = document.createElement("select");
        presetDropdown.style.cssText = "flex: 1; background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;";
        
        const presetNameInput = document.createElement("input");
        presetNameInput.type = "text";
        presetNameInput.placeholder = "Preset Name...";
        presetNameInput.style.cssText = "flex: 1; background: #111; color: #82deff; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px; display: none;";

        const pBtnStyle = "background: #222; border: 1px solid #444; color: #aaa; padding: 4px 6px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center;";

        const btnSave = document.createElement("button"); btnSave.innerHTML = svgSave; btnSave.style.cssText = pBtnStyle; btnSave.title = "Save New Preset";
        const btnDel = document.createElement("button"); btnDel.innerHTML = svgDel; btnDel.style.cssText = pBtnStyle; btnDel.title = "Delete Preset";
        const btnConfirm = document.createElement("button"); btnConfirm.innerHTML = svgCheck; btnConfirm.style.cssText = pBtnStyle + "display: none; color: #4CAF50;"; btnConfirm.title = "Confirm Save";
        const btnCancel = document.createElement("button"); btnCancel.innerHTML = svgCancel; btnCancel.style.cssText = pBtnStyle + "display: none; color: #F44336;"; btnCancel.title = "Cancel";

        presetContainer.appendChild(presetDropdown);
        presetContainer.appendChild(presetNameInput);
        presetContainer.appendChild(btnSave);
        presetContainer.appendChild(btnDel);
        presetContainer.appendChild(btnConfirm);
        presetContainer.appendChild(btnCancel);

        let presetsData = {};
        const updateDropdown = () => {
            presetDropdown.innerHTML = "";
            const defaultOpt = document.createElement("option");
            defaultOpt.value = ""; defaultOpt.innerText = "Load preset...";
            defaultOpt.disabled = true; defaultOpt.selected = true;
            presetDropdown.appendChild(defaultOpt);
            
            Object.keys(presetsData).forEach(name => {
                const opt = document.createElement("option");
                opt.value = name; opt.innerText = name;
                presetDropdown.appendChild(opt);
            });
        };

        const fetchPresets = async () => {
            try {
                const res = await fetch('/handytools/get_presets');
                presetsData = await res.json();
                updateDropdown();
            } catch (e) { console.error("Failed to load presets", e); }
        };
        fetchPresets();

        const toggleSaveMode = (isSaving) => {
            presetDropdown.style.display = isSaving ? "none" : "block";
            btnSave.style.display = isSaving ? "none" : "flex";
            btnDel.style.display = isSaving ? "none" : "flex";
            presetNameInput.style.display = isSaving ? "block" : "none";
            btnConfirm.style.display = isSaving ? "flex" : "none";
            btnCancel.style.display = isSaving ? "flex" : "none";
            if(isSaving) { presetNameInput.value = ""; presetNameInput.focus(); }
        };

        btnSave.onclick = () => toggleSaveMode(true);
        btnCancel.onclick = () => toggleSaveMode(false);
        
        presetDropdown.onchange = (e) => {
            const name = e.target.value;
            if (name && presetsData[name]) {
                const clip = this.stateManager.getSelectedClip();
                if (clip) {
                    const currentEnable = clip.color?.enabled !== false;
                    const newColor = { ...presetsData[name], enabled: currentEnable };
                    this.stateManager.updateClip(clip.id, { color: newColor });
                }
                presetDropdown.value = "";
            }
        };

        btnConfirm.onclick = async () => {
            const name = presetNameInput.value.trim();
            if (!name) return toggleSaveMode(false);
            
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                const c = clip.color || {};
                presetsData[name] = {
                    opacity: c.opacity !== undefined ? c.opacity : 1.0,
                    contrast: c.contrast !== undefined ? c.contrast : 1.0,
                    saturation: c.saturation !== undefined ? c.saturation : 1.0,
                    brightness: c.brightness !== undefined ? c.brightness : 1.0,
                    tint: c.tint || {r:1,g:1,b:1}, shadows: c.shadows || {r:1,g:1,b:1},
                    midtones: c.midtones || {r:1,g:1,b:1}, highlights: c.highlights || {r:1,g:1,b:1}
                };
                updateDropdown();
                await fetch('/handytools/save_presets', { method: 'POST', body: JSON.stringify(presetsData) });
            }
            toggleSaveMode(false);
        };

        btnDel.onclick = async () => {
            const name = presetDropdown.value;
            if (!name) {
                const pList = Object.keys(presetsData).join("\n");
                const toDel = prompt(`Type the exact name of the preset to delete:\n\n${pList}`);
                if (toDel && presetsData[toDel]) {
                    delete presetsData[toDel]; updateDropdown();
                    await fetch('/handytools/save_presets', { method: 'POST', body: JSON.stringify(presetsData) });
                }
            }
        };

        this.wrapper.appendChild(presetContainer);
        
        // --- COLOR TOOLBAR ---
        const colorToolbar = document.createElement("div");
        colorToolbar.style.cssText = "display: flex; align-items: center; background: #1a1a1a; padding: 4px; border-radius: 4px; border: 1px solid #333; gap: 4px;";
        
        const makeModeBtn = (modeId, label) => {
            const b = document.createElement("button");
            b.innerText = label;
            b.style.cssText = "background: transparent; color: #aaa; border: none; padding: 4px 8px; font-size: 11px; cursor: pointer; border-radius: 3px; font-weight: bold;";
            b.onclick = () => { this.colorMode = modeId; this._updateColorModeUI(); };
            return b;
        };
        this.basicModeBtn = makeModeBtn("basic", "Basic");
        this.advancedModeBtn = makeModeBtn("advanced", "Advanced");
        
        const toolbarSpacer = document.createElement("div"); toolbarSpacer.style.flex = "1";
        
        this.resetColorBtn = document.createElement("button");
        this.resetColorBtn.innerText = "Reset";
        this.resetColorBtn.style.cssText = "background: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; font-size: 10px; cursor: pointer; border-radius: 3px;";
        this.resetColorBtn.onclick = () => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                const isEnabled = this.colorEnabledCheckbox.checked;
                this.stateManager.updateClip(clip.id, { color: { enabled: isEnabled } });
            }
        };

        const enableLbl = document.createElement("label");
        enableLbl.title = "Enable/Disable Color Correction";
        enableLbl.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; margin-left: 4px;";
        this.colorEnabledCheckbox = document.createElement("input");
        this.colorEnabledCheckbox.type = "checkbox";
        this.colorEnabledCheckbox.checked = true;
        this.colorEnabledCheckbox.onchange = (e) => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                const c = clip.color || {};
                this.stateManager.updateClip(clip.id, { color: { ...c, enabled: e.target.checked } });
            }
        };
        enableLbl.appendChild(this.colorEnabledCheckbox);

        colorToolbar.appendChild(this.basicModeBtn);
        colorToolbar.appendChild(this.advancedModeBtn);
        colorToolbar.appendChild(toolbarSpacer);
        colorToolbar.appendChild(this.resetColorBtn);
        colorToolbar.appendChild(enableLbl);
        this.wrapper.appendChild(colorToolbar);

        // --- CONTROLS WRAPPER ---
        this.colorControlsWrapper = document.createElement("div");
        this.colorControlsWrapper.style.cssText = "display: flex; flex-direction: column; gap: 10px; transition: opacity 0.2s;";

        const buildColorWheelWidget = (titleText, propertyKey, isGrouped = false) => {
            const box = document.createElement("div");
            box.style.cssText = isGrouped 
                ? "display: flex; flex-direction: column; gap: 6px; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #333;"
                : "display: flex; flex-direction: column; gap: 6px; background: #161616; padding: 8px; border: 1px solid #333; border-radius: 6px; align-items: center;";
            
            const lbl = document.createElement("span");
            lbl.innerText = titleText;
            lbl.style.cssText = "font-size: 11px; color: #aaa; align-self: flex-start; font-weight: bold;";
            box.appendChild(lbl);

            const innerRow = document.createElement("div");
            innerRow.style.cssText = "display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center;";

            const canvas = document.createElement("canvas");
            canvas.width = 90; canvas.height = 90;
            canvas.style.cssText = "cursor: crosshair; border-radius: 50%; background: #222; border: 1px solid #444; flex-shrink: 0;";
            
            const ctx = canvas.getContext("2d");
            const drawWheel = (nx = 0.5, ny = 0.5) => {
                ctx.clearRect(0, 0, 90, 90);
                const rad = 45;
                for (let angle = 0; angle < 360; angle += 2) {
                    const sa = (angle - 2) * Math.PI / 180;
                    const ea = angle * Math.PI / 180;
                    ctx.beginPath();
                    ctx.moveTo(rad, rad);
                    ctx.arc(rad, rad, rad, sa, ea);
                    ctx.closePath();
                    const grad = ctx.createRadialGradient(rad, rad, 0, rad, rad, rad);
                    grad.addColorStop(0, "rgba(255,255,255,1)");
                    grad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
                    ctx.fillStyle = grad;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(nx * 90, ny * 90, 5, 0, Math.PI * 2);
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
            };
            drawWheel(0.5, 0.5);

            const rgbCol = document.createElement("div");
            rgbCol.style.cssText = "display: flex; flex-direction: column; gap: 4px; flex: 1;";

            const makeRgbInput = (channelLabel, colorColor) => {
                const rRow = document.createElement("div");
                rRow.style.cssText = "display: flex; align-items: center; justify-content: flex-end; gap: 6px;";
                const rLbl = document.createElement("span");
                rLbl.innerText = channelLabel;
                rLbl.style.cssText = `font-size: 10px; color: ${colorColor}; font-weight: bold;`;
                
                const rInp = document.createElement("input");
                rInp.type = "number"; rInp.step = "0.01"; rInp.value = "1.0";
                rInp.style.cssText = "width: 62px; background: #111; color: #82deff; border: 1px solid #444; border-radius: 3px; padding: 2px; font-family: monospace; text-align: center; font-size: 10px; box-sizing: border-box;";
                rRow.appendChild(rLbl); rRow.appendChild(rInp);
                return { row: rRow, input: rInp };
            };

            const rField = makeRgbInput("R", "#ff5555");
            const gField = makeRgbInput("G", "#55ff55");
            const bField = makeRgbInput("B", "#5555ff");

            rgbCol.appendChild(rField.row); rgbCol.appendChild(gField.row); rgbCol.appendChild(bField.row);
            innerRow.appendChild(canvas); innerRow.appendChild(rgbCol);
            box.appendChild(innerRow);

            const updateFromMouse = (e) => {
                const rect = canvas.getBoundingClientRect();
                const dx = ((e.clientX - rect.left) / 90) - 0.5;
                const dy = ((e.clientY - rect.top) / 90) - 0.5;
                
                const angle = Math.atan2(dy, dx);
                const dist = Math.min(1.0, Math.sqrt(dx*dx + dy*dy) * 2.0);
                
                const rVal = parseFloat((1.0 + Math.cos(angle) * dist * 0.5).toFixed(2));
                const gVal = parseFloat((1.0 + Math.cos(angle - 2.0944) * dist * 0.5).toFixed(2));
                const bVal = parseFloat((1.0 + Math.cos(angle - 4.1888) * dist * 0.5).toFixed(2));

                drawWheel((Math.cos(angle) * dist * 0.5) + 0.5, (Math.sin(angle) * dist * 0.5) + 0.5);

                rField.input.value = rVal; gField.input.value = gVal; bField.input.value = bVal;
                triggerChange();
            };

            let isDragging = false;
            canvas.onmousedown = (e) => { isDragging = true; updateFromMouse(e); };
            window.addEventListener("mousemove", (e) => { if (isDragging) updateFromMouse(e); });
            window.addEventListener("mouseup", () => { isDragging = false; });

            const triggerChange = () => {
                const clip = this.stateManager.getSelectedClip();
                if (clip) {
                    const colorData = { ...(clip.color || {}) };
                    colorData[propertyKey] = {
                        r: parseFloat(rField.input.value) || 1.0,
                        g: parseFloat(gField.input.value) || 1.0,
                        b: parseFloat(bField.input.value) || 1.0
                    };
                    this.stateManager.updateClip(clip.id, { color: colorData });
                }
            };

            rField.input.onchange = triggerChange; gField.input.onchange = triggerChange; bField.input.onchange = triggerChange;

            return { 
                container: box, rInput: rField.input, gInput: gField.input, bInput: bField.input, 
                setValues: (v) => {
                    const r = v?.r !== undefined ? v.r : 1.0;
                    const g = v?.g !== undefined ? v.g : 1.0;
                    const b = v?.b !== undefined ? v.b : 1.0;
                    rField.input.value = r; gField.input.value = g; bField.input.value = b;
                    
                    const dx = ( (r - 1.0)/0.5 * 1.0 + (g - 1.0)/0.5 * -0.5 + (b - 1.0)/0.5 * -0.5 ) / 1.5;
                    const dy = ( (g - 1.0)/0.5 * 0.866 - (b - 1.0)/0.5 * 0.866 ) / 1.5;
                    drawWheel(Math.max(0, Math.min(1, (dx / 2.0) + 0.5)), Math.max(0, Math.min(1, (dy / 2.0) + 0.5)));
                } 
            };
        };

        this.basicWheel = buildColorWheelWidget("Global Tint", "tint", false);
        this.shadowsWheel = buildColorWheelWidget("Shadows (Low)", "shadows", true);
        this.midtonesWheel = buildColorWheelWidget("Midtones (Mid)", "midtones", true);
        this.highlightsWheel = buildColorWheelWidget("Highlights (High)", "highlights", true);
        this.highlightsWheel.container.style.borderBottom = "none"; this.highlightsWheel.container.style.paddingBottom = "0";

        this.basicGroup = document.createElement("div");
        this.basicGroup.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
        this.basicGroup.appendChild(this.basicWheel.container);

        this.advancedGroup = document.createElement("div");
        this.advancedGroup.style.cssText = "display: none; flex-direction: column; gap: 8px; background: #161616; padding: 8px; border: 1px solid #333; border-radius: 6px;";
        this.advancedGroup.appendChild(this.shadowsWheel.container);
        this.advancedGroup.appendChild(this.midtonesWheel.container);
        this.advancedGroup.appendChild(this.highlightsWheel.container);

        this.colorControlsWrapper.appendChild(this.basicGroup);
        this.colorControlsWrapper.appendChild(this.advancedGroup);

        const makeControl = (labelTxt, min, max, isFloat, onChange) => {
            const grp = document.createElement("div");
            grp.style.cssText = "display: flex; flex-direction: column; gap: 4px; flex: 1;";
            const controlRow = document.createElement("div");
            controlRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
            const lbl = document.createElement("span"); lbl.innerText = labelTxt; lbl.style.cssText = "font-size: 11px; color: #aaa;";
            const slider = document.createElement("input");
            slider.type = "range"; slider.min = min; slider.max = max; slider.step = isFloat ? "0.01" : "1";
            slider.style.cssText = "flex: 1; min-width: 30px; cursor: ew-resize;";
            const inp = document.createElement("input");
            inp.type = "number"; inp.step = isFloat ? "0.01" : "1";
            inp.style.cssText = "width: 62px; background: #111; color: #82deff; border: 1px solid #444; border-radius: 4px; padding: 4px; font-family: monospace; text-align: center; box-sizing: border-box;";
            
            const updateLogic = (val) => { const p = isFloat ? parseFloat(val) : parseInt(val); if(!isNaN(p)) onChange(p); };
            slider.oninput = (e) => { inp.value = e.target.value; updateLogic(e.target.value); };
            inp.onchange = (e) => { slider.value = e.target.value; updateLogic(e.target.value); };
            controlRow.appendChild(slider); controlRow.appendChild(inp);
            grp.appendChild(lbl); grp.appendChild(controlRow);
            return { group: grp, input: inp, slider: slider };
        };

        const colorUpdate = (key) => (val) => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                const colorSettings = { ...(clip.color || {}) };
                colorSettings[key] = val;
                this.stateManager.updateClip(clip.id, { color: colorSettings });
            }
        };

        this.opacityCtrl = makeControl("Opacity", 0, 1.0, true, colorUpdate("opacity"));
        this.contrastCtrl = makeControl("Contrast", 0, 3.0, true, colorUpdate("contrast"));
        this.satCtrl = makeControl("Saturation", 0, 3.0, true, colorUpdate("saturation"));
        this.brightCtrl = makeControl("Brightness", 0, 3.0, true, colorUpdate("brightness"));

        this.colorControlsWrapper.appendChild(this.opacityCtrl.group);
        this.colorControlsWrapper.appendChild(this.contrastCtrl.group);
        this.colorControlsWrapper.appendChild(this.satCtrl.group);
        this.colorControlsWrapper.appendChild(this.brightCtrl.group);
        
        this.wrapper.appendChild(this.colorControlsWrapper);
        this.container.appendChild(this.wrapper);
        this._updateColorModeUI();
    }
    
    _updateColorModeUI() {
        if (this.colorMode === 'basic') {
            this.basicModeBtn.style.background = "#2196F3"; this.basicModeBtn.style.color = "#fff";
            this.advancedModeBtn.style.background = "transparent"; this.advancedModeBtn.style.color = "#aaa";
            this.basicGroup.style.display = "flex"; this.advancedGroup.style.display = "none";
        } else {
            this.advancedModeBtn.style.background = "#2196F3"; this.advancedModeBtn.style.color = "#fff";
            this.basicModeBtn.style.background = "transparent"; this.basicModeBtn.style.color = "#aaa";
            this.advancedGroup.style.display = "flex"; this.basicGroup.style.display = "none";
        }
    }
    
    syncUI() {
        const clip = this.stateManager.getSelectedClip();
        const setVals = (ctrl, val) => {
            if (document.activeElement !== ctrl.input && document.activeElement !== ctrl.slider) {
                ctrl.input.value = val; ctrl.slider.value = val;
            }
        };
        
        if (clip) {
            const clipColor = clip.color || {};
            const cEnabled = clipColor.enabled !== false;
            
            this.colorEnabledCheckbox.checked = cEnabled;
            this.colorControlsWrapper.style.opacity = cEnabled ? "1" : "0.4";
            this.colorControlsWrapper.style.pointerEvents = cEnabled ? "auto" : "none";

            setVals(this.opacityCtrl, clipColor.opacity !== undefined ? clipColor.opacity : 1.0);
            setVals(this.contrastCtrl, clipColor.contrast !== undefined ? clipColor.contrast : 1.0);
            setVals(this.satCtrl, clipColor.saturation !== undefined ? clipColor.saturation : 1.0);
            setVals(this.brightCtrl, clipColor.brightness !== undefined ? clipColor.brightness : 1.0);

            this.basicWheel.setValues(clipColor.tint);
            this.shadowsWheel.setValues(clipColor.shadows);
            this.midtonesWheel.setValues(clipColor.midtones);
            this.highlightsWheel.setValues(clipColor.highlights);
        } else {
            setVals(this.opacityCtrl, 1.0); setVals(this.contrastCtrl, 1.0);
            setVals(this.satCtrl, 1.0); setVals(this.brightCtrl, 1.0);
            this.colorEnabledCheckbox.checked = true;
            this.basicWheel.setValues({r:1, g:1, b:1});
            this.shadowsWheel.setValues({r:1, g:1, b:1});
            this.midtonesWheel.setValues({r:1, g:1, b:1});
            this.highlightsWheel.setValues({r:1, g:1, b:1});
        }
    }
}