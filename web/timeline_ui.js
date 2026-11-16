export class TimelineController {
    constructor(container, stateManager, compositor) {
        this.stateManager = stateManager;
        this.compositor = compositor;
        this.zoomLevel = 0;
        this.baseWidth = 800;
        this.dragState = null; 
        this.dragStartX = 0;
        this.dragInitialStart = 0;
        this.dragInitialEnd = 0;
        this.selectedClipId = null;
        
        this.isRazorActive = false; 
        
        this.clipElements = new Map(); 
        this.waveformCache = new Map();

        this._buildUI(container);
        
        this.stateManager.subscribe(() => {
            this.drawFrameGrid();
            this.renderTracks();
        });
        
        new ResizeObserver(() => {
            this.baseWidth = this.timelineWrapper.clientWidth || 800;
            this.drawFrameGrid();
            this.renderTracks();
        }).observe(this.timelineWrapper);

        this._updatePlayhead = this._updatePlayhead.bind(this);
        requestAnimationFrame(this._updatePlayhead);
    }

    get fps() { return this.stateManager.getState().fps || 30; }
    timeToFrame(time) { return Math.round(time * this.fps); }
    frameToTime(frame) { return frame / this.fps; }

    _buildUI(container) {
        const svgStart = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`;
        const svgPrev = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm12 0l-8 6 8 6z"/></svg>`;
        const svgPlay = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        const svgPause = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        const svgNext = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8-6-8-6v12zm10-12v12h2V6h-2z"/></svg>`;
        const svgLoopOff = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 12l-4-4v3H5v2h12v3z"/></svg>`; 
        const svgLoopOn = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
        const svgZoom = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align: middle;"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
        
        const svgUndo = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C20.32 11.03 16.81 8 12.5 8z"/></svg>`;
        const svgRedo = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8.002 8.002 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>`;
        const svgScissors = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8C4.9 8 4 7.1 4 6s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5l2.5 2.5H13v-1l-2.5-2.5 1-1zM19 3l-6 6 2 2 7-7V3h-3z"/></svg>`;
        const svgTrash = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
        const svgMute = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

        const toolbar = document.createElement("div");
        toolbar.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #222; padding: 8px 15px; border-bottom: 1px solid #444; position: relative;";
        
        const makeBtn = (icon, onClick, title = "") => {
            const btn = document.createElement("button");
            btn.innerHTML = icon;
            btn.title = title;
            btn.style.cssText = "background: #333; color: white; border: 1px solid #555; padding: 4px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all 0.1s;";
            
            btn.onmousedown = (e) => {
                e.preventDefault(); 
                onClick();
            };
            
            btn.onmouseover = () => { if(btn.dataset.active !== "true") btn.style.background = "#555"; };
            btn.onmouseout = () => { if(btn.dataset.active !== "true") btn.style.background = "#333"; };
            return btn;
        };

        const leftControls = document.createElement("div");
        leftControls.style.cssText = "display: flex; align-items: center; gap: 15px;";

        const historyGroup = document.createElement("div");
        historyGroup.style.cssText = "display: flex; gap: 8px; align-items: center;";
        const btnUndo = makeBtn(svgUndo, () => this.stateManager.undo(), "Undo (Ctrl+Z)");
        const btnRedo = makeBtn(svgRedo, () => this.stateManager.redo(), "Redo (Ctrl+Y)");
        historyGroup.appendChild(btnUndo);
        historyGroup.appendChild(btnRedo);

        const toolsGroup = document.createElement("div");
        toolsGroup.style.cssText = "display: flex; gap: 8px; align-items: center; border-left: 1px solid #444; padding-left: 15px;";
        
        this.btnRazor = makeBtn(svgScissors, () => {
            this.isRazorActive = !this.isRazorActive;
            this._updateRazorUI();
        }, "Razor Tool (C for Cut, V for Select)");
        
        // --- NEW: Mute and Delete buttons integrated into the toolbar ---
        this.btnMute = makeBtn(svgMute, () => {
            const clip = this.stateManager.getSelectedClip();
            if (clip) this.stateManager.updateClip(clip.id, { muted: !clip.muted });
        }, "Mute/Unmute Selected Clip");

        this.btnDelete = makeBtn(svgTrash, () => {
            if (this.stateManager.selectedClipId) {
                this.stateManager.removeClip(this.stateManager.selectedClipId);
            }
        }, "Delete Selected Clip (Backspace)");

        toolsGroup.appendChild(this.btnRazor);
        toolsGroup.appendChild(this.btnMute);
        toolsGroup.appendChild(this.btnDelete);

        leftControls.appendChild(historyGroup);
        leftControls.appendChild(toolsGroup);

        const playbackGroup = document.createElement("div");
        playbackGroup.style.cssText = "display: flex; gap: 8px; align-items: center; position: absolute; left: 50%; transform: translateX(-50%);";

        const btnRewind = makeBtn(svgStart, () => this.compositor.seek(0));
        const btnStepBack = makeBtn(svgPrev, () => this.compositor.stepFrame(-1));
        const btnPlayPause = makeBtn(svgPlay, () => this.compositor.togglePlayback());
        const btnStepFwd = makeBtn(svgNext, () => this.compositor.stepFrame(1));
        
        const btnLoop = makeBtn(this.compositor.loopMode ? svgLoopOn : svgLoopOff, () => {
            this.compositor.loopMode = !this.compositor.loopMode;
            btnLoop.innerHTML = this.compositor.loopMode ? svgLoopOn : svgLoopOff;
            btnLoop.style.color = this.compositor.loopMode ? "#82deff" : "white";
        });

        playbackGroup.appendChild(btnRewind);
        playbackGroup.appendChild(btnStepBack);
        playbackGroup.appendChild(btnPlayPause);
        playbackGroup.appendChild(btnStepFwd);
        playbackGroup.appendChild(btnLoop); 

        let lastPlayState = null;
        const updatePlayBtn = () => {
            if (this.compositor.isPlaying !== lastPlayState) {
                lastPlayState = this.compositor.isPlaying;
                btnPlayPause.innerHTML = this.compositor.isPlaying ? svgPause : svgPlay;
            }
            requestAnimationFrame(updatePlayBtn);
        };
        requestAnimationFrame(updatePlayBtn);

        const zoomGroup = document.createElement("div");
        zoomGroup.style.cssText = "display: flex; align-items: center; gap: 8px;";
        const zoomLbl = document.createElement("span");
        zoomLbl.innerHTML = `${svgZoom} Zoom`;
        zoomLbl.style.cssText = "color: #aaa; font-size: 11px; display: flex; align-items: center; gap: 4px;";
        
        const zoomSlider = document.createElement("input");
        zoomSlider.type = "range"; 
        zoomSlider.min = "0"; 
        zoomSlider.max = "10"; 
        zoomSlider.step = "0.5"; 
        zoomSlider.value = "0";
        zoomSlider.style.width = "100px";
        zoomSlider.oninput = (e) => {
            this.zoomLevel = parseFloat(e.target.value);
            this.drawFrameGrid();
            this.renderTracks();
        };

        zoomGroup.appendChild(zoomLbl);
        zoomGroup.appendChild(zoomSlider);

        toolbar.appendChild(leftControls);
        toolbar.appendChild(playbackGroup);
        toolbar.appendChild(zoomGroup);
        container.appendChild(toolbar);

        this.timelineWrapper = document.createElement("div");
        this.timelineWrapper.style.cssText = "width: 100%; height: 160px; background-color: #111; position: relative; overflow-x: scroll; overflow-y: hidden; user-select: none;";
        
        this.timelineContent = document.createElement("div");
        this.timelineContent.style.cssText = "height: 100%; position: relative; min-width: 100%;";
        
        this.trackHead = document.createElement("div");
        this.trackHead.style.cssText = "width: 100%; height: 52px; background-color: #222; border-bottom: 1px solid #333; position: absolute; top: 0; left: 0; cursor: ew-resize; z-index: 8;";
        
        this.frameGridCanvas = document.createElement("canvas");
        this.frameGridCanvas.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 52px; pointer-events: none;";
        this.trackHead.appendChild(this.frameGridCanvas);
        this.trackHead.addEventListener("mousedown", (e) => this._handleScrub(e));

        this.clipArea = document.createElement("div");
        this.clipArea.style.cssText = "width: 100%; height: 92px; position: absolute; top: 52px; left: 0; overflow: hidden; z-index: 2;";
        
        const trackDivider = document.createElement("div");
        trackDivider.style.cssText = "position: absolute; width: 100%; height: 1px; background: #333; top: 46px; pointer-events: none; z-index: 1;";
        this.clipArea.appendChild(trackDivider);

        this.playhead = document.createElement("div");
        this.playhead.style.cssText = "position: absolute; left: 0; width: 2px; height: 100%; top: 0; z-index: 10; pointer-events: none;";
        
        const playheadBox = document.createElement("div");
        playheadBox.style.cssText = "position: absolute; top: 0; left: -25px; width: 50px; height: 24px; background-color: #f44336; color: white; font-size: 13px; font-family: monospace; font-weight: bold; display: flex; align-items: center; justify-content: center; border-radius: 4px;";
        playheadBox.innerText = "00:00";
        this.playheadTime = playheadBox;
        
        const playheadTriangle = document.createElement("div");
        playheadTriangle.style.cssText = "width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid #f44336; position: absolute; top: 24px; left: -7px;"; 
        
        const playheadLine = document.createElement("div");
        playheadLine.style.cssText = "width: 2px; height: 100%; background-color: #f44336; position: absolute; top: 0; left: 0;";
        
        this.playhead.appendChild(playheadLine);
        this.playhead.appendChild(playheadTriangle);
        this.playhead.appendChild(this.playheadTime);

        this.timelineContent.appendChild(this.trackHead);
        this.timelineContent.appendChild(this.clipArea);
        this.timelineContent.appendChild(this.playhead);
        this.timelineWrapper.appendChild(this.timelineContent);
        container.appendChild(this.timelineWrapper);

        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) this.stateManager.redo();
                    else this.stateManager.undo();
                    return;
                }
                if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    this.stateManager.redo();
                    return;
                }
            }
            
            if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.isRazorActive = true;
                this._updateRazorUI();
                return;
            }
            if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.isRazorActive = false;
                this._updateRazorUI();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.stateManager.selectedClipId) {
                    e.preventDefault();
                    this.stateManager.removeClip(this.stateManager.selectedClipId);
                }
                return;
            }

            if (e.key === "ArrowRight") { e.preventDefault(); this.compositor.stepFrame(1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); this.compositor.stepFrame(-1); }
            else if (e.key === " ") { 
                e.preventDefault(); 
                if (!e.repeat) this.compositor.togglePlayback(); 
            }
        });
        window.addEventListener("mouseup", () => this.dragState = null);
    }
    
    _updateRazorUI() {
        this.btnRazor.dataset.active = this.isRazorActive ? "true" : "false";
        this.btnRazor.style.background = this.isRazorActive ? "#f44336" : "#333";
        this.btnRazor.style.borderColor = this.isRazorActive ? "#d32f2f" : "#555";
        this.renderTracks();
    }
    
    // --- NEW: Refresh context-aware buttons (Mute/Delete) based on selection ---
    _updateToolbarContext() {
        const clip = this.stateManager.getSelectedClip();
        if (clip) {
            this.btnDelete.style.opacity = "1";
            this.btnDelete.style.pointerEvents = "auto";
            
            this.btnMute.style.opacity = "1";
            this.btnMute.style.pointerEvents = "auto";
            this.btnMute.style.color = clip.muted ? "#ff5252" : "white";
        } else {
            this.btnDelete.style.opacity = "0.3";
            this.btnDelete.style.pointerEvents = "none";
            
            this.btnMute.style.opacity = "0.3";
            this.btnMute.style.pointerEvents = "none";
            this.btnMute.style.color = "white";
        }
    }

    _getTotalWidth() {
        const factor = 1 + (this.zoomLevel * 0.9);
        return Math.round(this.baseWidth * factor);
    }

    async _getWaveformPeaks(filename) {
        if (this.waveformCache.has(filename)) return;
        this.waveformCache.set(filename, null); 
        
        try {
            const response = await fetch(`/handytools/media?path=${encodeURIComponent(filename)}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const channelData = audioBuffer.getChannelData(0);
            const numPeaks = 1000; 
            const step = Math.ceil(channelData.length / numPeaks);
            const peaks = new Float32Array(numPeaks);

            for (let i = 0; i < numPeaks; i++) {
                let max = 0;
                for (let j = 0; j < step; j++) {
                    const idx = i * step + j;
                    if (idx < channelData.length) {
                        const val = Math.abs(channelData[idx]);
                        if (val > max) max = val;
                    }
                }
                peaks[i] = max;
            }
            
            this.waveformCache.set(filename, { peaks, duration: audioBuffer.duration });
            this.renderTracks(); 
            
        } catch (e) {
            console.warn("[HandyTools] Failed to generate waveform for", filename, e);
            this.waveformCache.set(filename, { peaks: new Float32Array(0), duration: 1 });
        }
    }

    _drawWaveform(clip, canvas, clipLengthFrames, totalFrames) {
        const expectedWidth = Math.max(1, (clipLengthFrames / totalFrames) * this._getTotalWidth());
        const expectedHeight = 46; 
        
        if (canvas.width !== Math.floor(expectedWidth)) canvas.width = expectedWidth;
        if (canvas.height !== expectedHeight) canvas.height = expectedHeight;
        
        const waveData = this.waveformCache.get(clip.filename);
        if (waveData === undefined) {
            this._getWaveformPeaks(clip.filename);
        } else if (waveData && waveData.peaks && waveData.peaks.length > 0) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"; 
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            const peaks = waveData.peaks;
            const srcDur = waveData.duration || 1;
            
            const srcIn = clip.source_in || 0;
            const srcOut = clip.source_out || srcDur; 
            
            const pStart = (srcIn / srcDur) * peaks.length;
            const pEnd = (srcOut / srcDur) * peaks.length;
            const pLen = Math.max(1, pEnd - pStart);
            
            for (let x = 0; x < canvas.width; x++) {
                const percent = x / canvas.width;
                const peakIdx = Math.floor(pStart + percent * pLen);
                if (peakIdx >= 0 && peakIdx < peaks.length) {
                    const val = peaks[peakIdx];
                    const h = val * canvas.height * 0.9; 
                    const y = (canvas.height - h) / 2;
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + h);
                }
            }
            ctx.stroke();
        }
    }

    drawFrameGrid() {
        const duration = this.compositor.getProjectDuration();
        const totalFrames = this.timeToFrame(duration);
        const width = this._getTotalWidth();
        const height = 52; 
        
        this.timelineContent.style.width = `${width}px`;
        
        this.frameGridCanvas.width = width;
        this.frameGridCanvas.height = height;
        const ctx = this.frameGridCanvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);

        if (totalFrames <= 0) return;
        const pxPerFrame = width / totalFrames;

        const candidates = [1, 5, 10, 25, 50, 100, 250, 500];
        let step = 1;
        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i] * pxPerFrame >= 4) { step = candidates[i]; break; }
            step = candidates[candidates.length - 1];
        }

        let majorStep = step * 5;
        if (step === 1) majorStep = 5;
        else if (step === 5) majorStep = 25;
        else if (step === 10) majorStep = 50;

        ctx.lineWidth = 1;
        for (let f = 0; f <= totalFrames; f += step) {
            const x = Math.round((f / totalFrames) * width) + 0.5;
            const isSecond = (f % Math.round(this.fps) === 0);
            const isMajor = (f % majorStep === 0);

            ctx.beginPath();
            if (isSecond) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.moveTo(x, height - 16);
                ctx.fillStyle = "#ccc"; ctx.font = "15px monospace"; ctx.textAlign = "center"; 
                const secVal = Math.round(f / this.fps);
                ctx.fillText(`${secVal}s`, x, height - 22);
            } else if (isMajor) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.22)"; ctx.moveTo(x, height - 12);
            } else {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"; ctx.moveTo(x, height - 8);
            }
            ctx.lineTo(x, height); ctx.stroke();
        }
    }

    renderTracks() {
        const state = this.stateManager.getState();
        const duration = this.compositor.getProjectDuration();
        const totalFrames = this.timeToFrame(duration);
        if (totalFrames <= 0) return;

        const svgTrackMute = `<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" style="vertical-align: middle; margin-left: 4px;"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

        const currentClipIds = new Set();
        
        const activeCursor = this.isRazorActive ? "crosshair" : "pointer";
        const edgeCursor = this.isRazorActive ? "crosshair" : "ew-resize";

        state.clips.forEach(clip => {
            currentClipIds.add(clip.id);

            const startF = this.timeToFrame(clip.timeline_start);
            const endF = this.timeToFrame(clip.timeline_end);
            const clipLengthFrames = endF - startF;

            const isSelected = this.selectedClipId === clip.id;
            const isAudio = clip.track === 1;

            const trackTop = isAudio ? 46 : 0; 
            const clipHeight = 46; 
            
            let bgColor, borderColor;
            
            if (isSelected) {
                bgColor = "rgba(238, 238, 238, 0.55)"; 
                borderColor = "#eeeeee";
            } else {
                const fileColors = this.stateManager.getColorForFile(clip.filename);
                bgColor = fileColors.bg;
                borderColor = fileColors.border;
            }

            const leftPct = (startF / totalFrames) * 100;
            const widthPct = (clipLengthFrames / totalFrames) * 100;
            
            const innerNameHTML = clip.filename.split(/[\\/]/).pop();
            const innerFrameHTML = `${clipLengthFrames}f` + (clip.muted ? svgTrackMute : "");

            if (this.clipElements.has(clip.id)) {
                const cache = this.clipElements.get(clip.id);
                
                cache.element.style.left = `${leftPct}%`;
                cache.element.style.width = `${widthPct}%`;
                cache.element.style.top = `${trackTop}px`;
                cache.element.style.backgroundColor = bgColor;
                cache.element.style.borderColor = borderColor;
                cache.element.style.cursor = activeCursor;
                
                cache.leftHandle.style.cursor = edgeCursor;
                cache.rightHandle.style.cursor = edgeCursor;
                
                if (cache.nameSpan.innerHTML !== innerNameHTML) {
                    cache.nameSpan.innerHTML = innerNameHTML;
                }
                
                if (cache.frameSpan.innerHTML !== innerFrameHTML) {
                    cache.frameSpan.innerHTML = innerFrameHTML;
                }

                if (isAudio) {
                    if (!cache.waveCanvas) {
                        const wc = document.createElement("canvas");
                        wc.style.cssText = "position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;";
                        cache.element.insertBefore(wc, cache.nameSpan);
                        cache.waveCanvas = wc;
                    }
                    this._drawWaveform(clip, cache.waveCanvas, clipLengthFrames, totalFrames);
                }

            } else {
                const clipEl = document.createElement("div");
                clipEl.style.cssText = `
                    position: absolute; height: ${clipHeight}px; top: ${trackTop}px;
                    left: ${leftPct}%; width: ${widthPct}%;
                    background-color: ${bgColor}; border: 1px solid ${borderColor};
                    box-sizing: border-box; display: flex; flex-direction: column;
                    align-items: center; justify-content: center; cursor: ${activeCursor}; border-radius: 2px; overflow: hidden;
                    z-index: 5;
                `;
                
                let waveCanvas = null;
                if (isAudio) {
                    waveCanvas = document.createElement("canvas");
                    waveCanvas.style.cssText = "position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;";
                    clipEl.appendChild(waveCanvas);
                }

                const nameSpan = document.createElement("span");
                nameSpan.style.cssText = "position: relative; z-index: 1; color: #fff; font-size: 10px; font-weight: bold; pointer-events:none; text-shadow: 1px 1px 2px #000;";
                nameSpan.innerHTML = innerNameHTML;

                const frameSpan = document.createElement("span");
                frameSpan.style.cssText = "position: relative; z-index: 1; color: #ddd; font-size: 13px; font-family: monospace; pointer-events:none; margin-top: 2px; text-shadow: 1px 1px 2px #000;";
                frameSpan.innerHTML = innerFrameHTML;

                clipEl.appendChild(nameSpan);
                clipEl.appendChild(frameSpan);

                const leftHandle = document.createElement("div");
                leftHandle.style.cssText = `position: absolute; left: 0; width: 6px; height: 100%; background-color: rgba(255,255,255,0.8); cursor: ${edgeCursor}; z-index: 10;`;
                
                const rightHandle = document.createElement("div");
                rightHandle.style.cssText = `position: absolute; right: 0; width: 6px; height: 100%; background-color: rgba(255,255,255,0.8); cursor: ${edgeCursor}; z-index: 10;`;

                const handleMousedown = (e, dragType) => {
                    if (this.isRazorActive) {
                        e.stopPropagation();
                        const rect = this.timelineContent.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const splitTime = (clickX / rect.width) * duration;
                        this.stateManager.splitClip(clip.id, splitTime);
                        return;
                    }
                    this._initDrag(e, clip.id, dragType);
                };

                clipEl.onmousedown = (e) => handleMousedown(e, 'body');
                leftHandle.onmousedown = (e) => handleMousedown(e, 'left');
                rightHandle.onmousedown = (e) => handleMousedown(e, 'right');

                clipEl.appendChild(leftHandle);
                clipEl.appendChild(rightHandle);
                this.clipArea.appendChild(clipEl);

                this.clipElements.set(clip.id, {
                    element: clipEl,
                    nameSpan: nameSpan,
                    frameSpan: frameSpan,
                    waveCanvas: waveCanvas,
                    leftHandle: leftHandle,
                    rightHandle: rightHandle
                });

                if (isAudio && waveCanvas) {
                    this._drawWaveform(clip, waveCanvas, clipLengthFrames, totalFrames);
                }
            }
        });

        for (const [id, cache] of this.clipElements.entries()) {
            if (!currentClipIds.has(id)) {
                this.clipArea.removeChild(cache.element);
                this.clipElements.delete(id);
            }
        }
        
        // --- NEW: Sync the contextual toolbar buttons ---
        this._updateToolbarContext();
    }

    _updatePlayhead() {
        const duration = this.compositor.getProjectDuration();
        const totalFrames = this.timeToFrame(duration);
        const width = this._getTotalWidth();
        
        if (totalFrames > 0) {
            const currentFrame = this.timeToFrame(this.compositor.currentTime);
            const snappedX = (currentFrame / totalFrames) * width;
            this.playhead.style.transform = `translateX(${Math.round(snappedX) - 1}px)`;
            
            const cTime = this.compositor.currentTime;
            const m = Math.floor(cTime / 60).toString().padStart(2, '0');
            const s = Math.floor(cTime % 60).toString().padStart(2, '0');
            this.playheadTime.innerText = `${m}:${s}`;
        }
        requestAnimationFrame(this._updatePlayhead);
    }

    _handleScrub(e) {
        e.stopPropagation();
        const duration = this.compositor.getProjectDuration();
        const rect = this.timelineContent.getBoundingClientRect();
        const updateTime = (clientX) => {
            const clickX = clientX - rect.left;
            const rawTime = (clickX / rect.width) * duration;
            const targetFrame = Math.max(0, Math.min(this.timeToFrame(duration), this.timeToFrame(rawTime)));
            this.compositor.seek(this.frameToTime(targetFrame));
        };
        updateTime(e.clientX);
        
        const onMove = (moveEv) => updateTime(moveEv.clientX);
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    _initDrag(e, clipId, type) {
        e.stopPropagation();
        
        const clip = this.stateManager.getState().clips.find(c => c.id === clipId);
        if (!clip) return;
        
        this.stateManager.setSelectedClip(clip.id);
        this.selectedClipId = clip.id;
        this.dragState = type;
        this.dragStartX = e.clientX;
        
        this.dragInitialStart = this.timeToFrame(clip.timeline_start);
        this.dragInitialEnd = this.timeToFrame(clip.timeline_end);
        
        const initialSourceIn = this.timeToFrame(clip.source_in);
        const initialSourceOut = this.timeToFrame(clip.source_out);
        
        const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(clip.filename.split('.').pop().toLowerCase());
        
        let srcDurationFrames = Infinity;
        if (!isImg) {
            const rawDuration = clip.source_duration !== undefined ? clip.source_duration : clip.source_out;
            srcDurationFrames = this.timeToFrame(rawDuration);
        }
        
        const duration = this.compositor.getProjectDuration();
        const totalFrames = this.timeToFrame(duration);
        const contentWidth = this.timelineContent.getBoundingClientRect().width;
        
        this.renderTracks(); 

        const onMove = (moveEvent) => {
            if (!this.dragState) return;
            const deltaX = moveEvent.clientX - this.dragStartX;
            const frameDelta = Math.round((deltaX / contentWidth) * totalFrames);
            
            let newTimelineStart = this.dragInitialStart;
            let newTimelineEnd = this.dragInitialEnd;
            let newSourceIn = initialSourceIn;
            let newSourceOut = initialSourceOut;
            const length = this.dragInitialEnd - this.dragInitialStart;

            if (this.dragState === 'body') {
                newTimelineStart = this.dragInitialStart + frameDelta;
                newTimelineEnd = this.dragInitialEnd + frameDelta;
                if (newTimelineStart < 0) {
                    newTimelineStart = 0;
                    newTimelineEnd = length;
                }
            } 
            else if (this.dragState === 'left') {
                const minTimelineStart = Math.max(0, this.dragInitialStart - initialSourceIn);
                newTimelineStart = Math.max(minTimelineStart, this.dragInitialStart + frameDelta);
                
                if (newTimelineStart > this.dragInitialEnd - 5) newTimelineStart = this.dragInitialEnd - 5;
                const diff = newTimelineStart - this.dragInitialStart;
                newSourceIn = initialSourceIn + diff;
            } 
            else if (this.dragState === 'right') {
                let maxTimelineEnd = Infinity;
                
                const player = this.compositor._getAssignedPlayer(clip);
                if (!isImg && player && player.element && player.element.duration > 0) {
                    const trueDurationFrames = this.timeToFrame(player.element.duration);
                    const maxDiff = trueDurationFrames - initialSourceOut;
                    maxTimelineEnd = this.dragInitialEnd + maxDiff;
                }
                
                newTimelineEnd = Math.min(maxTimelineEnd, this.dragInitialEnd + frameDelta);
                if (newTimelineEnd < this.dragInitialStart + 5) newTimelineEnd = this.dragInitialStart + 5;
                
                const diff = newTimelineEnd - this.dragInitialEnd;
                newSourceOut = initialSourceOut + diff;
            }

            this.stateManager.updateClip(clip.id, {
                timeline_start: this.frameToTime(newTimelineStart),
                timeline_end: this.frameToTime(newTimelineEnd),
                source_in: this.frameToTime(newSourceIn),
                source_out: this.frameToTime(newSourceOut)
            });
            const targetFrame = this.dragState === 'right' ? newTimelineEnd : newTimelineStart;
            this.compositor.seek(this.frameToTime(targetFrame));
        };

        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }
}