export class EffectsPanel {
    constructor(container, stateManager) {
        this.stateManager = stateManager;
        this.container = container;
        this.activeFocusId = null;
        this._buildUI();
    }

    _buildUI() {
        const svgEye = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;

        this.wrapper = document.createElement("div");
        this.wrapper.style.cssText = "display: flex; flex-direction: column; gap: 10px; width: 100%;";

        const toolbar = document.createElement("div");
        toolbar.style.cssText = "display: flex; align-items: center; background: #1a1a1a; padding: 4px; border-radius: 4px; border: 1px solid #333; gap: 4px;";

        this.effectDropdown = document.createElement("select");
        this.effectDropdown.style.cssText = "flex: 1; background: #111; color: #fff; border: 1px solid #444; padding: 4px; border-radius: 3px; font-size: 11px;";
        
        const fxOptions = [
            { id: "", name: "Add Effect..." },
            { id: "denoise", name: "Denoise (Temporal)" },
            { id: "blur", name: "Gaussian Blur" },
            { id: "sharpen", name: "Sharpen" },
            { id: "vignette", name: "Vignette" },
            { id: "grain", name: "Film Grain" }
        ];
        fxOptions.forEach(opt => {
            const el = document.createElement("option");
            el.value = opt.id; el.innerText = opt.name;
            if(!opt.id) { el.disabled = true; el.selected = true; }
            this.effectDropdown.appendChild(el);
        });

        this.effectDropdown.onchange = (e) => {
            const type = e.target.value;
            if (type) this.addEffect(type);
            this.effectDropdown.value = ""; 
        };

        this.previewAllBtn = document.createElement("button");
        this.previewAllBtn.innerHTML = `${svgEye} Prev All`;
        this.previewAllBtn.title = "Compare Original vs All Effects";
        this.previewAllBtn.style.cssText = "background: #2196F3; color: #fff; border: none; padding: 4px 8px; font-size: 10px; cursor: pointer; border-radius: 3px; display: flex; align-items: center; gap: 4px; font-weight: bold;";
        this.previewAllBtn.onclick = () => this.requestPreview("all");

        const enableLbl = document.createElement("label");
        enableLbl.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; margin-left: 4px;";
        this.enableCheckbox = document.createElement("input");
        this.enableCheckbox.type = "checkbox";
        this.enableCheckbox.checked = true;
        this.enableCheckbox.onchange = (e) => this.updateGlobalEnable(e.target.checked);
        
        enableLbl.appendChild(this.enableCheckbox);
        toolbar.appendChild(this.effectDropdown);
        toolbar.appendChild(this.previewAllBtn);
        toolbar.appendChild(enableLbl);
        
        this.stackContainer = document.createElement("div");
        this.stackContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px; transition: opacity 0.2s;";

        this.wrapper.appendChild(toolbar);
        this.wrapper.appendChild(this.stackContainer);
        this.container.appendChild(this.wrapper);
    }

    addEffect(type) {
        const clip = this.stateManager.getSelectedClip();
        if (!clip) return;
        const defaultParams = { denoise: { strength: 10.0 }, blur: { radius: 15.0 }, sharpen: { intensity: 1.0 }, vignette: { amount: 0.8, curve: 3.0 }, grain: { strength: 0.15 } };
        const newEffect = { id: `fx_${Math.random().toString(36).substr(2, 6)}`, type: type, ...defaultParams[type] };
        const effects = clip.effects || { enabled: true, stack: [] };
        this.stateManager.updateClip(clip.id, { effects: { ...effects, stack: [...effects.stack, newEffect] } });
    }

    removeEffect(fxId) {
        const clip = this.stateManager.getSelectedClip();
        if (!clip || !clip.effects) return;
        this.stateManager.updateClip(clip.id, { effects: { ...clip.effects, stack: clip.effects.stack.filter(fx => fx.id !== fxId) } });
    }

    updateEffectParam(fxId, param, value) {
        const clip = this.stateManager.getSelectedClip();
        if (!clip || !clip.effects) return;
        const newStack = clip.effects.stack.map(fx => fx.id === fxId ? { ...fx, [param]: value } : fx);
        this.stateManager.updateClip(clip.id, { effects: { ...clip.effects, stack: newStack } });
    }

    updateGlobalEnable(isEnabled) {
        const clip = this.stateManager.getSelectedClip();
        if (clip) {
            const effects = clip.effects || { stack: [] };
            this.stateManager.updateClip(clip.id, { effects: { ...effects, enabled: isEnabled } });
        }
    }

    async requestPreview(fxId) {
        const clip = this.stateManager.getSelectedClip();
        if (!clip) return;

        this.previewAllBtn.innerHTML = "Rendering...";
        this.previewAllBtn.style.background = "#FF9800";
        
        let filteredStack = clip.effects?.stack || [];
        if (fxId !== "all") filteredStack = filteredStack.filter(fx => fx.id === fxId);

        const midOffset = (clip.source_out - clip.source_in) * 0.5;
        const sourceStart = clip.source_in + midOffset - 0.5;
        const dur = Math.min(1.0, clip.source_out - sourceStart);
        const sourceEnd = sourceStart + dur;

        const baseState = { ...this.stateManager.getState(), isPreview: true };

        const stateBefore = { ...baseState, projectName: "preview_temp_before" };
        stateBefore.clips = [{
            ...clip,
            effects: { enabled: false, stack: [] },
            timeline_start: 0, timeline_end: dur,
            source_in: sourceStart, source_out: sourceEnd
        }];

        const stateAfter = { ...baseState, projectName: "preview_temp_after" };
        stateAfter.clips = [{
            ...clip,
            effects: { enabled: true, stack: filteredStack },
            timeline_start: 0, timeline_end: dur,
            source_in: sourceStart, source_out: sourceEnd
        }];

        try {
            const [resBefore, resAfter] = await Promise.all([
                fetch('/handytools/render_composition', { method: 'POST', body: JSON.stringify(stateBefore) }).then(r => r.json()),
                fetch('/handytools/render_composition', { method: 'POST', body: JSON.stringify(stateAfter) }).then(r => r.json())
            ]);
            
            if (resBefore.status === "success" && resAfter.status === "success") {
                window.dispatchEvent(new CustomEvent('ht_preview_mode', { 
                    detail: { 
                        pathBefore: `/handytools/media?path=${encodeURIComponent(resBefore.path)}&t=${Date.now()}`,
                        pathAfter: `/handytools/media?path=${encodeURIComponent(resAfter.path)}&t=${Date.now()}`
                    } 
                }));
            } else {
                alert("Preview render failed. Check backend logs.");
            }
        } catch (e) {
            alert("Error requesting preview.");
        }

        this.previewAllBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> Prev All`;
        this.previewAllBtn.style.background = "#2196F3";
    }

    _buildEffectCard(fx) {
        const svgTrash = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        const svgEye = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;

        const card = document.createElement("div");
        card.style.cssText = "background: #161616; border: 1px solid #333; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 8px;";
        
        const header = document.createElement("div");
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center;";
        
        const title = document.createElement("span");
        title.innerText = fx.type.charAt(0).toUpperCase() + fx.type.slice(1);
        title.style.cssText = "font-size: 11px; color: #82deff; font-weight: bold;";
        if (fx.type === "denoise") title.innerText = "Denoise (HQ Temporal)";

        const btnGroup = document.createElement("div");
        btnGroup.style.cssText = "display: flex; gap: 4px;";
        
        const btnPrev = document.createElement("button");
        btnPrev.innerHTML = svgEye; btnPrev.title = "Compare Original vs This Effect";
        btnPrev.style.cssText = "background: #222; color: #aaa; border: 1px solid #444; border-radius: 3px; padding: 2px 4px; cursor: pointer;";
        btnPrev.onclick = () => this.requestPreview(fx.id);

        const btnDel = document.createElement("button");
        btnDel.innerHTML = svgTrash; btnDel.title = "Remove Effect";
        btnDel.style.cssText = "background: #222; color: #F44336; border: 1px solid #444; border-radius: 3px; padding: 2px 4px; cursor: pointer;";
        btnDel.onclick = () => this.removeEffect(fx.id);

        btnGroup.appendChild(btnPrev);
        btnGroup.appendChild(btnDel);
        header.appendChild(title);
        header.appendChild(btnGroup);
        card.appendChild(header);

        const makeSlider = (labelTxt, paramKey, min, max, val) => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; align-items: center; gap: 8px;";
            const lbl = document.createElement("span");
            lbl.innerText = labelTxt;
            lbl.style.cssText = "font-size: 10px; color: #aaa; width: 40px;";
            
            const slider = document.createElement("input");
            slider.type = "range"; slider.min = min; slider.max = max; slider.step = "0.01";
            slider.value = val;
            slider.style.cssText = "flex: 1; min-width: 30px; cursor: ew-resize;";
            
            const inp = document.createElement("input");
            inp.type = "number"; inp.step = "0.01"; inp.value = val;
            inp.style.cssText = "width: 50px; background: #111; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 2px; font-family: monospace; text-align: center; font-size: 10px;";
            
            const onChange = (newVal) => {
                this.activeFocusId = fx.id;
                this.updateEffectParam(fx.id, paramKey, parseFloat(newVal));
            };

            slider.oninput = (e) => { inp.value = e.target.value; onChange(e.target.value); };
            inp.onchange = (e) => { slider.value = e.target.value; onChange(e.target.value); };
            slider.onmouseup = () => { this.activeFocusId = null; };
            inp.onblur = () => { this.activeFocusId = null; };

            row.appendChild(lbl); row.appendChild(slider); row.appendChild(inp);
            card.appendChild(row);
        };

        if (fx.type === "blur") makeSlider("Radius", "radius", 0, 50, fx.radius);
        if (fx.type === "sharpen") makeSlider("Amount", "intensity", 0, 5.0, fx.intensity);
        if (fx.type === "vignette") {
            makeSlider("Amount", "amount", 0, 1.0, fx.amount);
            makeSlider("Curve", "curve", 1.0, 10.0, fx.curve !== undefined ? fx.curve : 3.0);
        }
        if (fx.type === "grain") makeSlider("Strength", "strength", 0, 1.0, fx.strength);
        if (fx.type === "denoise") makeSlider("Strength", "strength", 0, 100, fx.strength);

        return card;
    }

    syncUI() {
        const clip = this.stateManager.getSelectedClip();
        if (!clip) {
            this.container.style.opacity = "0.3";
            this.container.style.pointerEvents = "none";
            this.stackContainer.innerHTML = "";
            return;
        }

        this.container.style.opacity = "1";
        this.container.style.pointerEvents = "auto";
        
        const effects = clip.effects || { enabled: true, stack: [] };
        
        this.enableCheckbox.checked = effects.enabled;
        this.stackContainer.style.opacity = effects.enabled ? "1" : "0.4";
        this.stackContainer.style.pointerEvents = effects.enabled ? "auto" : "none";

        if (!this.activeFocusId) {
            this.stackContainer.innerHTML = "";
            if (effects.stack.length === 0) {
                const emptyState = document.createElement("div");
                emptyState.innerText = "No effects applied.";
                emptyState.style.cssText = "text-align: center; color: #666; font-size: 11px; padding: 10px; font-style: italic;";
                this.stackContainer.appendChild(emptyState);
            } else {
                effects.stack.forEach(fx => {
                    this.stackContainer.appendChild(this._buildEffectCard(fx));
                });
            }
        }
    }
}