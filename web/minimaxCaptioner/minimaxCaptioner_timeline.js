import * as Icons from "./minimaxCaptioner_icons.js";

export class CaptionerTimeline {
    constructor(ctx) {
        this.ctx = ctx;
        this.fps = 24.0;
        this.audioCtx = null;
        this.waveformAbortController = null;
        this.isPlaying = false;
        
        this.draggingCut = null;
        this.draggingEvent = null;
        this.isScrubbing = false;
        this.animationFrameId = null;

        this.el = document.createElement("div");
        this.el.style.cssText = "display:flex; flex-direction:column; gap:8px; width:100%;";

        this.buildTimeline();
        this.buildToolbox(); // Toolbar with buttons
        this.buildCaptionBox(); // Text area
        this.bindGlobalScrubbing();
        
        this.el.appendChild(this.timelineWrapper);
        this.el.appendChild(this.toolbox);
        this.el.appendChild(this.captionBoxWrap);
    }

    buildTimeline() {
        this.timelineWrapper = document.createElement("div");
        this.timelineWrapper.className = "vc-timeline-wrapper";
        this.timelineWrapper.style.cssText = "width:100%; height:40px; background:#111; border:1px solid #444; border-radius:4px; position:relative; cursor:pointer; overflow:hidden;";

        this.waveformCanvas = document.createElement("canvas");
        this.waveformCanvas.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:3;";
        
        this.playhead = document.createElement("div");
        this.playhead.className = "vc-playhead";
        this.playhead.style.cssText = "position:absolute; width:2px; height:100%; background:#ff4444; z-index:10; pointer-events:none;";

        this.timelineWrapper.appendChild(this.waveformCanvas);
        this.timelineWrapper.appendChild(this.playhead);
    }

    buildToolbox() {
        this.toolbox = document.createElement("div");
        this.toolbox.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#161616; padding:8px 10px; border:1px solid #333; border-radius:4px;";

        // Left Side: Playback Controls
        const playbackGroup = document.createElement("div");
        playbackGroup.style.cssText = "display:flex; gap:4px; align-items:center;";
        
        const btnRewind = this.createIconBtn(Icons.ICON_REWIND, () => { this.ctx.video.currentTime = 0; });
        const btnStepBack = this.createIconBtn(Icons.ICON_STEP_BACK, () => this.stepFrames(-1));
        
        this.btnPlay = this.createIconBtn(Icons.ICON_PLAY, () => {
            if (this.ctx.video.paused) {
                this.ctx.video.play();
                this.isPlaying = true;
                this.btnPlay.innerHTML = Icons.ICON_PAUSE;
            } else {
                this.ctx.video.pause();
                this.isPlaying = false;
                this.btnPlay.innerHTML = Icons.ICON_PLAY;
                this.ctx.video.currentTime = this.snapToFrame(this.ctx.video.currentTime);
                this.updatePlayheadVisual(this.ctx.video.currentTime);
            }
        });
        
        const btnStepFwd = this.createIconBtn(Icons.ICON_STEP_FWD, () => this.stepFrames(1));
        playbackGroup.append(btnRewind, btnStepBack, this.btnPlay, btnStepFwd);

        // Right Side: Shot/Event Controls
        const toolsGroup = document.createElement("div");
        toolsGroup.style.cssText = "display:flex; gap:6px; align-items:center;";

        const btnAddShot = this.createTextBtn("Add Shot", "", () => {
            if (!this.ctx.state.duration) return;
            const t = this.snapToFrame(this.ctx.video.currentTime);
            const idx = this.ctx.state.segments.findIndex(s => t > s.start && t < s.end);
            if (idx !== -1) {
                const oldSeg = this.ctx.state.segments[idx];
                const newSeg = { start: t, end: oldSeg.end, text: "", isShotCut: true };
                oldSeg.end = t;
                this.ctx.state.segments.splice(idx + 1, 0, newSeg);
                this.ctx.state.selection = { type: 'shot', index: idx + 1 };
                this.ctx.methods.markUnsaved();
                this.render();
            }
        });
        btnAddShot.style.background = "#28783d";

        this.btnDelShot = this.createTextBtn("Del Shot", "vc-btn-danger", () => {
            if (this.ctx.state.selection.type !== 'shot' || this.ctx.state.segments.length <= 1) return;
            const i = this.ctx.state.selection.index;
            if (i === this.ctx.state.segments.length - 1) this.ctx.state.segments[i - 1].end = this.ctx.state.segments[i].end;
            else this.ctx.state.segments[i + 1].start = this.ctx.state.segments[i].start;
            this.ctx.state.segments.splice(i, 1);
            this.ctx.state.selection = { type: 'shot', index: Math.max(0, i - 1) };
            this.ctx.methods.markUnsaved();
            this.render();
        });
        this.btnDelShot.style.background = "#5c2a2a";

        const btnAddEvent = this.createTextBtn("Add Event", "", () => {
            if (!this.ctx.state.duration) return;
            const t = this.snapToFrame(this.ctx.video.currentTime);
            this.ctx.state.events.push({ time: t, text: "" });
            this.ctx.state.events.sort((a, b) => a.time - b.time);
            this.ctx.state.selection = { type: 'event', index: this.ctx.state.events.findIndex(e => e.time === t) };
            this.ctx.methods.markUnsaved();
            this.render();
        });
        btnAddEvent.style.background = "#1b4d79";

        this.btnDelEvent = this.createTextBtn("Del Event", "vc-btn-danger", () => {
            if (this.ctx.state.selection.type === 'event') {
                this.ctx.state.events.splice(this.ctx.state.selection.index, 1);
                this.ctx.state.selection = { type: 'shot', index: 0 };
                this.ctx.methods.markUnsaved();
                this.render();
            }
        });
        this.btnDelEvent.style.background = "#5c2a2a";

        const btnReset = this.createTextBtn("Reset", "", () => this.ctx.methods.resetAll());
        btnReset.style.background = "#4a235a";

        const cutLabel = document.createElement("label");
        cutLabel.innerText = " Cut:";
        cutLabel.style.cssText = "color:#ccc; font-size:11px; margin-left:4px; display:flex; align-items:center; gap:4px; cursor:pointer;";
        this.cutCheck = document.createElement("input");
        this.cutCheck.type = "checkbox";
        this.cutCheck.style.cursor = "pointer";
        this.cutCheck.onchange = (e) => {
            if (this.ctx.state.selection.type === 'shot') {
                this.ctx.state.segments[this.ctx.state.selection.index].isShotCut = e.target.checked;
                this.ctx.methods.markUnsaved();
                this.ctx.methods.generateLivePreview();
            }
        };
        cutLabel.appendChild(this.cutCheck);

        toolsGroup.append(btnAddShot, this.btnDelShot, btnAddEvent, this.btnDelEvent, btnReset, cutLabel);
        this.toolbox.append(playbackGroup, toolsGroup);
    }

    buildCaptionBox() {
        this.captionBoxWrap = document.createElement("div");
        this.captionBoxWrap.style.cssText = "display:flex; flex-direction:column; flex:1; background:#161616; padding:8px 10px; border:1px solid #333; border-radius:4px;";
        
        const headerRow = document.createElement("div");
        headerRow.style.cssText = "display:flex; justify-content:space-between; margin-bottom:6px;";

        this.statusText = document.createElement("div");
        this.statusText.className = "vc-label";
        this.statusText.style.color = "#ffeb3b";
        this.statusText.innerText = "Select a shot or event";

        this.frameCounter = document.createElement("div");
        this.frameCounter.style.cssText = "color:#82deff; font-size:11px; font-weight:bold; font-family:monospace;";
        this.frameCounter.innerText = "Frame: 0 | 00:00.000";

        headerRow.append(this.statusText, this.frameCounter);

        this.captionBox = document.createElement("textarea");
        this.captionBox.className = "vc-input";
        this.captionBox.placeholder = "Write description for this shot/event here...";
        this.captionBox.style.cssText = "flex:1; resize:none; min-height:80px; background:#111; color:#fff; border:1px solid #444; border-radius:4px; padding:8px; font-family:sans-serif; font-size:11px; outline:none;";
        this.captionBox.addEventListener("keydown", e => e.stopPropagation());
        this.captionBox.addEventListener("mousedown", e => e.stopPropagation());
        this.captionBox.addEventListener("input", e => {
            if (this.ctx.state.selection.type === 'shot' && this.ctx.state.segments[this.ctx.state.selection.index]) 
                this.ctx.state.segments[this.ctx.state.selection.index].text = e.target.value;
            else if (this.ctx.state.selection.type === 'event' && this.ctx.state.events[this.ctx.state.selection.index]) 
                this.ctx.state.events[this.ctx.state.selection.index].text = e.target.value;
            this.ctx.methods.markUnsaved();
            this.ctx.methods.generateLivePreview();
        });

        this.captionBoxWrap.append(headerRow, this.captionBox);
    }

    createIconBtn(svg, onClick) {
        const btn = document.createElement("button");
        btn.className = "vc-icon-btn";
        btn.style.cssText = "width:26px; height:26px; background:#282828; border:1px solid #4a4a4a; border-radius:4px; color:#e0e0e0; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;";
        btn.innerHTML = svg;
        btn.onclick = onClick;
        return btn;
    }

    createTextBtn(html, extraClass, onClick) {
        const btn = document.createElement("button");
        btn.className = `vc-btn ${extraClass}`;
        btn.style.cssText = "background:#2196F3; color:#fff; border:none; border-radius:4px; padding:6px 10px; cursor:pointer; font-weight:bold; font-size:11px; display:inline-flex; align-items:center; gap:4px;";
        btn.innerHTML = html;
        btn.onclick = onClick;
        return btn;
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toFixed(3).padStart(6, '0');
        return `${m}:${s}`;
    }

    snapToFrame(time) {
        if (!this.ctx.state.duration) return time;
        let frameIndex = Math.round(time * this.fps);
        let snappedTime = (frameIndex / this.fps) + 0.001; 
        return Math.max(0, Math.min(snappedTime, this.ctx.state.duration));
    }

    stepFrames(frames) {
        if (!this.ctx.state.duration) return;
        this.ctx.video.pause();
        this.isPlaying = false;
        this.btnPlay.innerHTML = Icons.ICON_PLAY;
        let currentFrameIndex = Math.round(this.ctx.video.currentTime * this.fps);
        let newTime = ((currentFrameIndex + frames) / this.fps) + 0.001;
        this.ctx.video.currentTime = Math.max(0, Math.min(newTime, this.ctx.state.duration));
        this.updatePlayheadVisual(this.ctx.video.currentTime);
    }

    updatePlayheadVisual(time) {
        if (!this.ctx.state.duration) return;
        this.playhead.style.left = `calc(${(time / this.ctx.state.duration) * 100}% - 1px)`;
        let currentFrameIndex = Math.round(time * this.fps);
        this.frameCounter.innerText = `Frame: ${currentFrameIndex} | ${this.formatTime(time)}`;
    }

    render(isDragging = false) {
        Array.from(this.timelineWrapper.children).forEach(c => { 
            if (c !== this.playhead && c !== this.waveformCanvas) c.remove(); 
        });
        const dur = this.ctx.state.duration;
        if (!dur) return;

        this.ctx.state.segments.forEach((seg, i) => {
            const segEl = document.createElement("div");
            segEl.className = "vc-clip-block";
            segEl.style.cssText = `position:absolute; height:calc(100% - 12px); top:0; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; z-index:2; left:${(seg.start / dur) * 100}%; width:${((seg.end - seg.start) / dur) * 100}%;`;
            segEl.style.backgroundColor = (i % 2 === 0) ? "#2b6a2e" : "#1e4d21";
            segEl.style.border = (this.ctx.state.selection.type === 'shot' && this.ctx.state.selection.index === i) ? "2px solid #ffeb3b" : "1px solid #111";
            segEl.innerText = `S${i+1}`;
            
            segEl.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                this.ctx.state.selection = { type: 'shot', index: i };
                if (dur) {
                    this.isScrubbing = true;
                    this.ctx.video.pause(); this.isPlaying = false; this.btnPlay.innerHTML = Icons.ICON_PLAY;
                    let rect = this.timelineWrapper.getBoundingClientRect();
                    let clickTime = this.snapToFrame(((e.clientX - rect.left) / rect.width) * dur);
                    this.ctx.video.currentTime = clickTime;
                    this.updatePlayheadVisual(clickTime);
                }
                this.render(false);
            });
            this.timelineWrapper.appendChild(segEl);

            if (i < this.ctx.state.segments.length - 1) {
                const handle = document.createElement("div");
                handle.className = "vc-clip-handle";
                handle.style.cssText = `position:absolute; width:8px; height:calc(100% - 12px); top:0; background:#fff; cursor:ew-resize; z-index:5; left:calc(${(seg.end / dur) * 100}% - 4px);`;
                handle.addEventListener("mousedown", (e) => {
                    e.stopPropagation();
                    this.draggingCut = i;
                    if (dur) { this.ctx.video.pause(); this.isPlaying = false; this.btnPlay.innerHTML = Icons.ICON_PLAY; this.ctx.video.currentTime = seg.end; }
                });
                this.timelineWrapper.appendChild(handle);
            }
        });

        this.ctx.state.events.forEach((ev, i) => {
            const marker = document.createElement("div");
            marker.style.cssText = `position:absolute; bottom:1px; width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; z-index:20; cursor:ew-resize; left:calc(${(ev.time / dur) * 100}% - 5px);`;
            const isSelected = (this.ctx.state.selection.type === 'event' && this.ctx.state.selection.index === i);
            marker.style.borderBottom = isSelected ? "10px solid #ffeb3b" : "10px solid #2196F3";

            marker.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                this.ctx.state.selection = { type: 'event', index: i };
                this.draggingEvent = i;
                if (dur) { this.ctx.video.pause(); this.isPlaying = false; this.btnPlay.innerHTML = Icons.ICON_PLAY; this.ctx.video.currentTime = ev.time; }
                this.render(false);
            });
            this.timelineWrapper.appendChild(marker);
        });

        this.updateToolboxStates(isDragging);
    }

    updateToolboxStates(isDragging) {
        const sel = this.ctx.state.selection;
        if (sel.type === 'shot' && this.ctx.state.segments[sel.index]) {
            const seg = this.ctx.state.segments[sel.index];
            this.statusText.innerText = `Editing Shot ${sel.index + 1} (${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s)`;
            if (!isDragging) {
                this.captionBox.value = seg.text || "";
                this.cutCheck.checked = seg.isShotCut !== false;
                this.captionBox.disabled = false; this.cutCheck.disabled = false;
                this.btnDelShot.disabled = this.ctx.state.segments.length <= 1; this.btnDelEvent.disabled = true;
            }
        } else if (sel.type === 'event' && this.ctx.state.events[sel.index]) {
            const ev = this.ctx.state.events[sel.index];
            this.statusText.innerText = `Editing Event ${sel.index + 1} (At ${ev.time.toFixed(2)}s)`;
            if (!isDragging) {
                this.captionBox.value = ev.text || "";
                this.captionBox.disabled = false; this.cutCheck.disabled = true;
                this.btnDelShot.disabled = true; this.btnDelEvent.disabled = false;
            }
        }
        if (!isDragging) this.ctx.methods.generateLivePreview();
    }

    bindGlobalScrubbing() {
        window.addEventListener("mousemove", (e) => {
            const dur = this.ctx.state.duration;
            if (!dur || (this.draggingCut === null && this.draggingEvent === null && !this.isScrubbing)) return;

            const rect = this.timelineWrapper.getBoundingClientRect();
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

            this.animationFrameId = requestAnimationFrame(() => {
                let rawTime = ((e.clientX - rect.left) / rect.width) * dur;
                let newTime = this.snapToFrame(rawTime);

                if (this.draggingCut !== null) {
                    const minTime = this.snapToFrame(this.ctx.state.segments[this.draggingCut].start + (1.0 / this.fps));
                    const maxTime = this.snapToFrame(this.ctx.state.segments[this.draggingCut + 1].end - (1.0 / this.fps));
                    newTime = this.snapToFrame(Math.max(minTime, Math.min(newTime, maxTime)));
                    
                    this.ctx.state.segments[this.draggingCut].end = newTime;
                    this.ctx.state.segments[this.draggingCut + 1].start = newTime;

                    if (Math.abs(this.ctx.video.currentTime - newTime) > 0.01) this.ctx.video.currentTime = newTime;
                    this.updatePlayheadVisual(newTime); this.ctx.methods.markUnsaved(); this.render(true);
                } 
                else if (this.draggingEvent !== null) {
                    newTime = Math.max(0, Math.min(newTime, dur));
                    this.ctx.state.events[this.draggingEvent].time = newTime;
                    if (Math.abs(this.ctx.video.currentTime - newTime) > 0.01) this.ctx.video.currentTime = newTime;
                    this.updatePlayheadVisual(newTime); this.ctx.methods.markUnsaved(); this.render(true);
                } 
                else if (this.isScrubbing) {
                    newTime = Math.max(0, Math.min(newTime, dur));
                    if (Math.abs(this.ctx.video.currentTime - newTime) > 0.01) this.ctx.video.currentTime = newTime;
                    this.updatePlayheadVisual(newTime);
                }
            });
        });

        window.addEventListener("mouseup", () => {
            let needsRender = false;
            if (this.draggingCut !== null) { this.draggingCut = null; needsRender = true; }
            if (this.draggingEvent !== null) {
                const ev = this.ctx.state.events[this.draggingEvent];
                this.ctx.state.events.sort((a, b) => a.time - b.time);
                this.ctx.state.selection = { type: 'event', index: this.ctx.state.events.indexOf(ev) };
                this.draggingEvent = null; needsRender = true;
            }
            if (this.isScrubbing) { this.isScrubbing = false; needsRender = true; }
            if (needsRender) {
                if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
                this.render(false);
            }
        });
    }

    async drawWaveform(url) {
        if (this.waveformAbortController) this.waveformAbortController.abort();
        this.waveformAbortController = new AbortController();

        const canvas = this.waveformCanvas;
        const ctx = canvas.getContext("2d");
        canvas.width = this.timelineWrapper.clientWidth || 1000;
        canvas.height = this.timelineWrapper.clientHeight || 40;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#888"; ctx.font = "11px sans-serif";
        ctx.fillText("〰️ Loading audio...", 5, 24);

        try {
            const response = await fetch(url, { signal: this.waveformAbortController.signal });
            const arrayBuffer = await response.arrayBuffer();
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0);
            const step = Math.ceil(channelData.length / canvas.width);
            const amp = canvas.height / 2;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "rgba(255, 255, 255, 0.55)"; 
            
            for (let i = 0; i < canvas.width; i++) {
                let min = 1.0; let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const datum = channelData[(i * step) + j];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
                const y = (1 + min) * amp;
                const height = Math.max(1, (max - min) * amp);
                ctx.fillRect(i, y, 1, height);
            }
        } catch (err) {
            if (err.name !== 'AbortError') ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}