export class ProjectSettings {
    constructor(container, stateManager) {
        this.stateManager = stateManager;
        this._buildUI(container);
        this.stateManager.subscribe(() => this.syncUI());
    }

    _buildUI(container) {
        const svgExport = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle; margin-right: 6px;"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>`;

        this.wrapper = document.createElement("div");
        this.wrapper.style.cssText = "display: flex; flex-direction: column; gap: 14px; width: 100%; height: 100%; color: #ddd; overflow-y: auto; padding-right: 4px; box-sizing: border-box;";

        const title = document.createElement("h3");
        title.innerText = "Composition Settings";
        title.style.cssText = "margin: 0; font-size: 14px; color: #fff; padding-bottom: 0px; text-align: center; border: none;";
        
        // --- 1. TOP ROW: New, Load, Save ---
        const topRow = document.createElement("div");
        topRow.style.cssText = "display: flex; gap: 8px; width: 100%;";
        
        this.newProjBtn = document.createElement("button");
        this.newProjBtn.innerText = "New";
        // Original padding: 8px. Reduced height by 2px -> 7px top/bottom, 8px left/right.
        this.newProjBtn.style.cssText = "flex: 1; background: #5c2a2a; color: white; border: 1px solid #8c3b3b; padding: 7px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; text-align: center;";
        this.newProjBtn.onmouseover = () => this.newProjBtn.style.background = "#7a3838";
        this.newProjBtn.onmouseout = () => this.newProjBtn.style.background = "#5c2a2a";
        this.newProjBtn.onclick = () => {
            if(confirm("Create a new project? This will clear your timeline and media gallery.")) {
                this.stateManager.clearProject();
            }
        };

        this.loadProjBtn = document.createElement("button");
        this.loadProjBtn.innerText = "Load";
        this.loadProjBtn.style.cssText = "flex: 1; background: #333; color: white; border: 1px solid #555; padding: 7px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; text-align: center;";
        this.loadProjBtn.onmouseover = () => this.loadProjBtn.style.background = "#444";
        this.loadProjBtn.onmouseout = () => this.loadProjBtn.style.background = "#333";
        
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";
        this.loadProjBtn.onclick = () => fileInput.click();
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (parsed._type !== "HandyToolsVideoComposition") {
                        alert("Invalid File: This is not a HandyTools Composition file.");
                        return;
                    }
                    this.stateManager.loadState(parsed);
                } catch (err) {
                    alert("Error parsing the JSON file. It might be corrupted.");
                }
            };
            reader.readAsText(file);
            fileInput.value = ""; 
        };

        this.saveProjBtn = document.createElement("button");
        this.saveProjBtn.innerText = "Save";
        this.saveProjBtn.style.cssText = "flex: 1; background: #333; color: white; border: 1px solid #555; padding: 7px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; text-align: center;";
        this.saveProjBtn.onmouseover = () => { if(this.saveProjBtn.innerText === "Save") this.saveProjBtn.style.background = "#444"; };
        this.saveProjBtn.onmouseout = () => { if(this.saveProjBtn.innerText === "Save") this.saveProjBtn.style.background = "#333"; };
        
        this.saveProjBtn.onclick = async () => {
            this.saveProjBtn.innerText = `Saving...`;
            try {
                const response = await fetch("/handytools/save_project", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.stateManager.getState())
                });
                const data = await response.json();
                if (data.status === "success") {
                    this.saveProjBtn.innerText = `Saved!`;
                    this.saveProjBtn.style.background = "#28783d";
                } else throw new Error(data.message);
            } catch (err) {
                console.error("[HandyTools] Save JSON Error:", err);
                this.saveProjBtn.innerText = `Error`;
                this.saveProjBtn.style.background = "#5c2a2a";
            }
            setTimeout(() => {
                this.saveProjBtn.innerText = "Save";
                this.saveProjBtn.style.background = "#333";
            }, 3000);
        };

        topRow.appendChild(this.newProjBtn);
        topRow.appendChild(this.loadProjBtn);
        topRow.appendChild(this.saveProjBtn);
        topRow.appendChild(fileInput);

        // --- Helper for Input Blocks ---
        const makeInput = (labelTxt, type="text") => {
            const grp = document.createElement("div");
            grp.style.cssText = "display: flex; flex-direction: column; gap: 4px; flex: 1;";
            const lbl = document.createElement("span");
            lbl.innerText = labelTxt;
            lbl.style.cssText = "font-size: 11px; color: #aaa;";
            const inp = document.createElement("input");
            inp.type = type;
            // Original padding: 6px. Reduced height by 2px -> 5px top/bottom, 6px left/right.
            inp.style.cssText = "background: #111; color: #82deff; border: 1px solid #444; border-radius: 4px; padding: 5px 6px; font-family: monospace; box-sizing: border-box; width: 100%;";
            grp.appendChild(lbl);
            grp.appendChild(inp);
            return { group: grp, input: inp };
        };

        // --- 2. Project Paths ---
        this.compName = makeInput("Composition Name", "text");
        this.compName.input.onchange = (e) => this.stateManager.setProjectName(e.target.value);
        
        this.saveLocation = makeInput("Save Location (Path)", "text");
        this.saveLocation.input.placeholder = "Leave empty for Output folder";
        this.saveLocation.input.onchange = (e) => this.stateManager.setSavePath(e.target.value);

        // --- 3. Resolution Row ---
        const resGrp = document.createElement("div");
        resGrp.style.cssText = "display: flex; gap: 10px; width: 100%;";
        
        this.compW = makeInput("Width", "number");
        this.compH = makeInput("Height", "number");
        
        this.compW.input.onchange = (e) => {
            const state = this.stateManager.getState() || {};
            const res = state.resolution || [1920, 1080];
            this.stateManager.setResolution(parseInt(e.target.value) || 1920, res[1]);
        };
        this.compH.input.onchange = (e) => {
            const state = this.stateManager.getState() || {};
            const res = state.resolution || [1920, 1080];
            this.stateManager.setResolution(res[0], parseInt(e.target.value) || 1080);
        };

        resGrp.appendChild(this.compW.group);
        resGrp.appendChild(this.compH.group);

        // --- 4. Global Watermark Overlay Section ---
        const wmContainer = document.createElement("div");
        wmContainer.style.cssText = "background: #161616; border: 1px solid #333; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 10px;";
        
        const wmHeader = document.createElement("div");
        wmHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; cursor: pointer;";
        const wmLbl = document.createElement("span");
        wmLbl.innerText = "Watermark";
        wmLbl.style.cssText = "font-size: 11px; font-weight: bold; color: #aaa;";
        
        const wmToggle = document.createElement("input");
        wmToggle.type = "checkbox";
        wmToggle.style.cursor = "pointer";
        wmToggle.onchange = (e) => this._updateWatermark({ enabled: e.target.checked });
        
        wmHeader.appendChild(wmLbl);
        wmHeader.appendChild(wmToggle);
        wmContainer.appendChild(wmHeader);

        const wmBody = document.createElement("div");
        wmBody.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
        
        const pathRow = document.createElement("div");
        pathRow.style.cssText = "display: flex; align-items: center; gap: 8px; width: 100%;";
        const pLbl = document.createElement("span"); pLbl.innerText = "PNG Path"; pLbl.style.cssText = "font-size: 11px; color: #aaa; width: 50px;";
        this.wmPathInp = document.createElement("input");
        this.wmPathInp.type = "text"; this.wmPathInp.placeholder = "logo.png";
        this.wmPathInp.style.cssText = "flex: 1; background: #111; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 4px 6px; font-family: monospace; font-size: 11px;";
        this.wmPathInp.onchange = (e) => this._updateWatermark({ path: e.target.value });
        
        pathRow.appendChild(pLbl); pathRow.appendChild(this.wmPathInp);
        wmBody.appendChild(pathRow);

        const makeWmSlider = (labelTxt, min, max, isFloat, onChange) => {
            const grp = document.createElement("div");
            grp.style.cssText = "display: flex; flex-direction: column; gap: 4px; width: 100%;";
            const controlRow = document.createElement("div");
            controlRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
            const lbl = document.createElement("span"); lbl.innerText = labelTxt; lbl.style.cssText = "font-size: 11px; color: #aaa; width: 40px;";
            const slider = document.createElement("input");
            slider.type = "range"; slider.min = min; slider.max = max; slider.step = isFloat ? "0.01" : "1";
            slider.style.cssText = "flex: 1; min-width: 30px; cursor: ew-resize;";
            const inp = document.createElement("input");
            inp.type = "number"; inp.step = isFloat ? "0.01" : "1";
            inp.style.cssText = "width: 50px; background: #111; color: #82deff; border: 1px solid #444; border-radius: 3px; padding: 2px 4px; font-family: monospace; text-align: center; font-size: 11px;";
            
            const updateLogic = (val) => { const p = isFloat ? parseFloat(val) : parseInt(val); if(!isNaN(p)) onChange(p); };
            slider.oninput = (e) => { inp.value = e.target.value; updateLogic(e.target.value); };
            inp.onchange = (e) => { slider.value = e.target.value; updateLogic(e.target.value); };
            controlRow.appendChild(lbl); controlRow.appendChild(slider); controlRow.appendChild(inp);
            grp.appendChild(controlRow);
            return { group: grp, input: inp, slider: slider };
        };

        this.wmScale = makeWmSlider("Scale", 0.01, 3.0, true, (v) => this._updateWatermark({ scale: v }));
        this.wmX = makeWmSlider("Pos X", 0, 2000, false, (v) => this._updateWatermark({ x: v }));
        this.wmY = makeWmSlider("Pos Y", 0, 2000, false, (v) => this._updateWatermark({ y: v }));

        wmBody.appendChild(this.wmScale.group);
        wmBody.appendChild(this.wmX.group);
        wmBody.appendChild(this.wmY.group);
        wmContainer.appendChild(wmBody);
        
        this.wmToggle = wmToggle;
        this.wmBody = wmBody;

        // --- Export ---
        this.exportBtn = document.createElement("button");
        this.exportBtn.innerHTML = `${svgExport} Export Composition`;
        // Original padding: 10px. Reduced height by 2px -> 9px top/bottom, 10px left/right.
        this.exportBtn.style.cssText = "margin-top: auto; background: #1b4d79; color: white; border: 1px solid #2a6fba; padding: 9px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; display: flex; align-items: center; justify-content: center;";
        
        this.exportBtn.onclick = async () => {
            this.exportBtn.innerHTML = `Rendering...`;
            this.exportBtn.disabled = true;
            this.exportBtn.style.background = "#444";

            try {
                const response = await fetch("/handytools/render_composition", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.stateManager.getState())
                });
                const data = await response.json();
                if (data.status === "success") {
                    this.exportBtn.innerHTML = `Export Successful!`;
                    this.exportBtn.style.background = "#28783d";
                } else throw new Error(data.message);
            } catch (err) {
                console.error("[HandyTools] Export Error:", err);
                this.exportBtn.innerHTML = `Error Exporting`;
                this.exportBtn.style.background = "#5c2a2a";
            }

            setTimeout(() => {
                this.exportBtn.innerHTML = `${svgExport} Export Composition`;
                this.exportBtn.disabled = false;
                this.exportBtn.style.background = "#1b4d79";
            }, 3000);
        };

        this.wrapper.appendChild(title);
        this.wrapper.appendChild(topRow);
        this.wrapper.appendChild(this.compName.group);
        this.wrapper.appendChild(this.saveLocation.group);
        this.wrapper.appendChild(resGrp);
        this.wrapper.appendChild(wmContainer); 
        this.wrapper.appendChild(this.exportBtn);

        container.appendChild(this.wrapper);
        this.syncUI();
    }

    _updateWatermark(updates) {
        const state = this.stateManager.getState();
        if (!state.watermark) state.watermark = { enabled: false, path: "", scale: 1.0, x: 20.0, y: 20.0 };
        
        state.watermark = { ...state.watermark, ...updates };
        
        if (typeof this.stateManager.updateState === 'function') {
            this.stateManager.updateState({ watermark: state.watermark });
        } else if (typeof this.stateManager.setProjectName === 'function') {
            this.stateManager.setProjectName(state.projectName || "My_Composition");
        }
    }

    syncUI() {
        const state = this.stateManager.getState() || {};
        const res = state.resolution || [1920, 1080];
        
        if (this.compName.input.value !== state.projectName) this.compName.input.value = state.projectName || "My_Composition";
        if (this.compW.input.value != res[0]) this.compW.input.value = res[0];
        if (this.compH.input.value != res[1]) this.compH.input.value = res[1];
        if (this.saveLocation.input.value !== state.savePath) this.saveLocation.input.value = state.savePath || "";

        const setVals = (ctrl, val) => {
            if (document.activeElement !== ctrl.input && document.activeElement !== ctrl.slider) {
                ctrl.input.value = val; ctrl.slider.value = val;
            }
        };

        const wm = state.watermark || { enabled: false, path: "", scale: 1.0, x: 20.0, y: 20.0 };
        this.wmToggle.checked = wm.enabled;
        this.wmBody.style.opacity = wm.enabled ? "1" : "0.4";
        this.wmBody.style.pointerEvents = wm.enabled ? "auto" : "none";
        
        if (document.activeElement !== this.wmPathInp) this.wmPathInp.value = wm.path || "";
        setVals(this.wmScale, wm.scale !== undefined ? wm.scale : 1.0);
        setVals(this.wmX, wm.x !== undefined ? wm.x : 20.0);
        setVals(this.wmY, wm.y !== undefined ? wm.y : 20.0);
    }
}