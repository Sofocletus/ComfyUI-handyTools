import { ColorPanel } from "./color_panel.js";
import { EffectsPanel } from "./effects_panel.js";

export class PropertyInspector {
    constructor(container, stateManager) {
        this.stateManager = stateManager;
        this.aspectLocked = true;
        this.aspectRatio = 1.0;
        this.activeTab = 'transform'; 
        
        this._buildUI(container);
        this.stateManager.subscribe(() => this.syncUI());
    }
    
    _buildUI(container) {
        const svgLock = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
        const svgUnlock = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`;
        const svgAudio = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

        this.wrapper = document.createElement("div");
        this.wrapper.style.cssText = "display: flex; flex-direction: column; gap: 10px; width: 100%; height: 100%; color: #ddd; overflow-y: scroll; overflow-x: hidden; padding-right: 4px; box-sizing: border-box;";

        const tabBar = document.createElement("div");
        tabBar.style.cssText = "display: flex; border-bottom: 1px solid #444; margin-bottom: 5px; flex-shrink: 0;";
        
        const makeTabBtn = (id, label) => {
            const btn = document.createElement("button");
            btn.innerText = label;
            btn.style.cssText = "flex: 1; background: transparent; color: #aaa; border: none; border-bottom: 2px solid transparent; padding: 6px 0; cursor: pointer; font-size: 11px; font-weight: bold; transition: all 0.2s;";
            btn.onclick = () => { this.activeTab = id; this._updateTabVisibility(); };
            return btn;
        };
        
        this.tabTransformBtn = makeTabBtn("transform", "Transform");
        this.tabColorBtn = makeTabBtn("color", "Color");
        this.tabEffectsBtn = makeTabBtn("effects", "Effects");
        this.tabAudioBtn = makeTabBtn("audio", "Audio");
        
        tabBar.appendChild(this.tabTransformBtn);
        tabBar.appendChild(this.tabColorBtn);
        tabBar.appendChild(this.tabEffectsBtn);
        tabBar.appendChild(this.tabAudioBtn);

        // --- TRANSFORM TAB ---
        this.transformContainer = document.createElement("div");
        this.transformContainer.style.cssText = "display: flex; flex-direction: column; gap: 10px;";

        const makeControl = (labelTxt, min, max, isFloat, onChange) => {
            const grp = document.createElement("div");
            grp.style.cssText = "display: flex; flex-direction: column; gap: 4px; flex: 1;";
            const lbl = document.createElement("span");
            lbl.innerText = labelTxt;
            lbl.style.cssText = "font-size: 11px; color: #aaa;";
            const controlRow = document.createElement("div");
            controlRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
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

        this.cropW = makeControl("Width", 0, 3840, false, (val) => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                let crop = { ...clip.crop, w: val };
                if (this.aspectLocked && this.aspectRatio > 0) crop.h = Math.round(val / this.aspectRatio);
                this.stateManager.updateClip(clip.id, { crop });
            }
        });
        
        this.cropH = makeControl("Height", 0, 2160, false, (val) => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                let crop = { ...clip.crop, h: val };
                if (this.aspectLocked && this.aspectRatio > 0) crop.w = Math.round(val * this.aspectRatio);
                this.stateManager.updateClip(clip.id, { crop });
            }
        });

        this.lockBtn = document.createElement("button");
        this.lockBtn.innerHTML = `${svgLock} Locked Ratio`;
        this.lockBtn.style.cssText = "background: #222; border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 11px; align-self: flex-start; color: #82deff; border: 1px solid #82deff; display: flex; align-items: center;";
        this.lockBtn.onclick = () => {
            this.aspectLocked = !this.aspectLocked;
            if (this.aspectLocked) {
                this.lockBtn.innerHTML = `${svgLock} Locked Ratio`;
                this.lockBtn.style.color = "#82deff"; this.lockBtn.style.borderColor = "#82deff";
                const w = parseFloat(this.cropW.input.value); const h = parseFloat(this.cropH.input.value);
                if (h > 0) this.aspectRatio = w / h;
            } else {
                this.lockBtn.innerHTML = `${svgUnlock} Unlocked Ratio`;
                this.lockBtn.style.color = "#aaa"; this.lockBtn.style.borderColor = "#444";
            }
        };

        const standardUpdate = (key) => (val) => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) {
                const crop = { ...clip.crop }; crop[key] = val;
                this.stateManager.updateClip(clip.id, { crop });
            }
        };

        this.cropX = makeControl("Pos X", -2000, 2000, false, standardUpdate("x"));
        this.cropY = makeControl("Pos Y", -2000, 2000, false, standardUpdate("y"));
        this.cropScale = makeControl("Scale", 0.1, 5.0, true, standardUpdate("scale"));

        const sizeBox = document.createElement("div");
        sizeBox.style.cssText = "display: flex; flex-direction: column; gap: 8px; background: #1a1a1a; padding: 8px; border: 1px solid #333; border-radius: 6px; margin-bottom: 5px;";
        sizeBox.appendChild(this.cropW.group); sizeBox.appendChild(this.lockBtn); sizeBox.appendChild(this.cropH.group);

        this.transformContainer.appendChild(sizeBox);
        this.transformContainer.appendChild(this.cropX.group);
        this.transformContainer.appendChild(this.cropY.group);
        this.transformContainer.appendChild(this.cropScale.group);
        
        // --- OFFLOADED MODULES ---
        this.colorContainer = document.createElement("div");
        this.colorContainer.style.cssText = "display: none; flex-direction: column; gap: 10px;";
        this.colorPanel = new ColorPanel(this.colorContainer, this.stateManager);

        this.effectsContainer = document.createElement("div");
        this.effectsContainer.style.cssText = "display: none; flex-direction: column; gap: 10px;";
        this.effectsPanel = new EffectsPanel(this.effectsContainer, this.stateManager);
        
        // --- AUDIO TAB ---
        this.audioContainer = document.createElement("div");
        this.audioContainer.style.cssText = "display: none; flex-direction: column; gap: 10px;";
        this.volumeCtrl = makeControl("Volume", 0, 2.0, true, (val) => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) this.stateManager.updateClip(clip.id, { volume: val });
        });
        this.audioContainer.appendChild(this.volumeCtrl.group);

        // --- WRAP UP ---
        this.wrapper.appendChild(tabBar);
        this.wrapper.appendChild(this.transformContainer);
        this.wrapper.appendChild(this.colorContainer);
        this.wrapper.appendChild(this.effectsContainer);
        this.wrapper.appendChild(this.audioContainer);
        
        container.appendChild(this.wrapper);
        this._updateTabVisibility();
        this.syncUI();
    }
    
    _updateTabVisibility() {
        const clip = this.stateManager.getSelectedClip();
        const isAudioTrack = clip && clip.track === 1;

        if (isAudioTrack && this.activeTab !== 'audio') this.activeTab = 'audio';

        this.tabTransformBtn.style.display = isAudioTrack ? "none" : "block";
        this.tabColorBtn.style.display = isAudioTrack ? "none" : "block";
        this.tabEffectsBtn.style.display = isAudioTrack ? "none" : "block";
        this.tabAudioBtn.style.display = "block";

        const setBtnState = (btn, isActive) => {
            btn.style.color = isActive ? "#82deff" : "#aaa";
            btn.style.borderBottomColor = isActive ? "#82deff" : "transparent";
        };

        setBtnState(this.tabTransformBtn, this.activeTab === 'transform');
        setBtnState(this.tabColorBtn, this.activeTab === 'color');
        setBtnState(this.tabEffectsBtn, this.activeTab === 'effects');
        setBtnState(this.tabAudioBtn, this.activeTab === 'audio');

        this.transformContainer.style.display = this.activeTab === 'transform' ? "flex" : "none";
        this.colorContainer.style.display = this.activeTab === 'color' ? "flex" : "none";
        this.effectsContainer.style.display = this.activeTab === 'effects' ? "flex" : "none";
        this.audioContainer.style.display = this.activeTab === 'audio' ? "flex" : "none";
    }

    syncUI() {
        const clip = this.stateManager.getSelectedClip();
        const setVals = (ctrl, val) => {
            if (document.activeElement !== ctrl.input && document.activeElement !== ctrl.slider) {
                ctrl.input.value = val; ctrl.slider.value = val;
            }
        };
        
        if (clip) {
            this.wrapper.style.opacity = "1";
            this.wrapper.style.pointerEvents = "auto";
            
            this._updateTabVisibility();
            setVals(this.volumeCtrl, clip.volume !== undefined ? clip.volume : 1.0);
            
            if (clip.track === 0) {
                if (this.aspectLocked) {
                    const w = clip.crop?.w || this.stateManager.getState().resolution[0];
                    const h = clip.crop?.h || this.stateManager.getState().resolution[1];
                    if (h > 0) this.aspectRatio = w / h;
                }
                
                setVals(this.cropX, clip.crop?.x || 0);
                setVals(this.cropY, clip.crop?.y || 0);
                setVals(this.cropW, clip.crop?.w || this.stateManager.getState().resolution[0]);
                setVals(this.cropH, clip.crop?.h || this.stateManager.getState().resolution[1]);
                setVals(this.cropScale, clip.crop?.scale !== undefined ? clip.crop.scale : 1.0);
            }
        } else {
            this.wrapper.style.opacity = "0.3";
            this.wrapper.style.pointerEvents = "none";
            setVals(this.cropX, 0); setVals(this.cropY, 0);
            setVals(this.cropW, 0); setVals(this.cropH, 0);
            setVals(this.cropScale, 1.0); setVals(this.volumeCtrl, 1.0);
        }

        // Delegate downstream syncing to the sub-panels
        this.colorPanel.syncUI();
        this.effectsPanel.syncUI();
    }
}