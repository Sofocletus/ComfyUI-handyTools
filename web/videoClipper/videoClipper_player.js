import * as Icons from "./videoClipper_icons.js";
import { createUIOverlays } from "./videoClipper_UI.js";

export function createPlayer(ctx) {
    const centerPanel = document.createElement("div");
    centerPanel.className = "vc-center-panel";

    // 1. 32px TOP INFO BAR
    const topInfoBar = document.createElement("div");
    topInfoBar.className = "vc-player-topbar";

    const infoLeft = document.createElement("div");
    infoLeft.className = "vc-topbar-left";
    infoLeft.innerHTML = `<span>No video</span>`;

    const infoCenter = document.createElement("div");
    infoCenter.className = "vc-topbar-center";
    infoCenter.innerText = "00:00.00";

    const infoRight = document.createElement("div");
    infoRight.className = "vc-topbar-right none";
    infoRight.innerText = "No clip";

    topInfoBar.appendChild(infoLeft);
    topInfoBar.appendChild(infoCenter);
    topInfoBar.appendChild(infoRight);
    centerPanel.appendChild(topInfoBar);

    // 2. 640x360 VIDEO VIEWER
    const videoViewer = document.createElement("div");
    videoViewer.className = "vc-video-viewer";
    videoViewer.style.position = "relative";
    videoViewer.style.overflow = "hidden";

    const video = document.createElement("video");
    video.controls = false;
    video.playsInline = true;

    const cropOverlay = document.createElement("div");
    cropOverlay.className = "vc-crop-overlay";
    cropOverlay.style.display = "none";

    const uiOverlays = createUIOverlays(ctx);
    videoViewer.appendChild(video);
    videoViewer.appendChild(cropOverlay);
    uiOverlays.elements.forEach(el => videoViewer.appendChild(el));
    centerPanel.appendChild(videoViewer);

    video.addEventListener("error", () => {
        if (!video.src || video.src.includes("undefined")) return;
        uiOverlays.showStandby("error", () => setVideoSource(false, 0, true));
    });

    // 3. 36px PLAYER BOTTOM TOOLBAR
    const playerToolbar = document.createElement("div");
    playerToolbar.className = "vc-player-toolbar";

    const leftGroup = document.createElement("div");
    leftGroup.className = "vc-toolbar-group left";

    const prevClipBtn = document.createElement("button");
    prevClipBtn.className = "vc-icon-btn";
    prevClipBtn.innerHTML = Icons.ICON_PREV_CLIP;
    prevClipBtn.title = "Jump to Previous Clip Start";
    prevClipBtn.addEventListener("click", () => {
        if (!ctx.state.duration || ctx.state.clips.length === 0) return;
        video.pause();

        const currentFrame = ctx.timeToFrame(video.currentTime);
        const sorted = [...ctx.state.clips].sort((a, b) => a.startFrame - b.startFrame);

        let targetFrame = null;
        for (let i = sorted.length - 1; i >= 0; i--) {
            if (sorted[i].startFrame < currentFrame - 1) {
                targetFrame = sorted[i].startFrame;
                break;
            }
        }

        if (targetFrame === null) {
            targetFrame = sorted[0].startFrame < currentFrame ? sorted[0].startFrame : 0;
        }

        const targetTime = ctx.frameToTime(targetFrame);
        seekVideo(targetTime);
        ctx.timeline.updatePlayhead(targetTime);
        ctx.syncWithPlayhead(targetTime);
        updateTopInfoBar();
        ctx.saveUiState();
    });

    const nextClipBtn = document.createElement("button");
    nextClipBtn.className = "vc-icon-btn";
    nextClipBtn.innerHTML = Icons.ICON_NEXT_CLIP;
    nextClipBtn.title = "Jump to Next Clip Start";
    nextClipBtn.addEventListener("click", () => {
        if (!ctx.state.duration || ctx.state.clips.length === 0) return;
        video.pause();

        const currentFrame = ctx.timeToFrame(video.currentTime);
        const sorted = [...ctx.state.clips].sort((a, b) => a.startFrame - b.startFrame);

        let targetFrame = null;
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].startFrame > currentFrame + 1) {
                targetFrame = sorted[i].startFrame;
                break;
            }
        }

        if (targetFrame !== null) {
            const targetTime = ctx.frameToTime(targetFrame);
            seekVideo(targetTime);
            ctx.timeline.updatePlayhead(targetTime);
            ctx.syncWithPlayhead(targetTime);
            updateTopInfoBar();
            ctx.saveUiState();
        }
    });

    const addClipBtn = document.createElement("button");
    addClipBtn.className = "vc-btn vc-btn-add-clip";
    addClipBtn.innerHTML = `${Icons.ICON_PLUS} Clip`;
    addClipBtn.title = "Add Clip at current playhead";
    addClipBtn.addEventListener("click", () => ctx.addClip());

    const delClipBtn = document.createElement("button");
    delClipBtn.className = "vc-icon-btn danger";
    delClipBtn.innerHTML = Icons.ICON_TRASH;
    delClipBtn.title = "Delete Selected Clip";
    delClipBtn.disabled = true;
    delClipBtn.addEventListener("click", () => ctx.deleteSelectedClip());

    leftGroup.appendChild(prevClipBtn);
    leftGroup.appendChild(nextClipBtn);
    leftGroup.appendChild(addClipBtn);
    leftGroup.appendChild(delClipBtn);

    const centerGroup = document.createElement("div");
    centerGroup.className = "vc-toolbar-group center";

    const rewindBtn = document.createElement("button");
    rewindBtn.className = "vc-icon-btn";
    rewindBtn.innerHTML = Icons.ICON_REWIND;
    rewindBtn.title = "Rewind to Start";
    rewindBtn.addEventListener("click", () => {
        if (!ctx.state.duration) return;
        video.pause();
        seekVideo(0);
        ctx.timeline.updatePlayhead(0);
        ctx.syncWithPlayhead(0);
        updateTopInfoBar();
        ctx.saveUiState();
    });

    const stepBackBtn = document.createElement("button");
    stepBackBtn.className = "vc-icon-btn";
    stepBackBtn.innerHTML = Icons.ICON_STEP_BACK;
    stepBackBtn.title = "Step Back 1 Frame";
    stepBackBtn.addEventListener("click", () => {
        if (!ctx.state.duration) return;
        video.pause();
        const currentFrame = ctx.timeToFrame(video.currentTime);
        const targetFrame = Math.max(0, currentFrame - 1);
        const targetTime = ctx.frameToTime(targetFrame);
        seekVideo(targetTime);
        ctx.timeline.updatePlayhead(targetTime);
        ctx.syncWithPlayhead(targetTime);
        updateTopInfoBar();
        ctx.saveUiState();
    });

    const playPauseBtn = document.createElement("button");
    playPauseBtn.className = "vc-icon-btn play-btn";
    playPauseBtn.innerHTML = Icons.ICON_PLAY;
    playPauseBtn.title = "Play / Pause";
    playPauseBtn.addEventListener("click", () => {
        if (!ctx.state.duration) return;
        if (video.paused) {
            video.play();
        } else {
            video.pause();
            ctx.saveUiState();
        }
    });

    // --- SMOOTH PLAYBACK RENDER LOOP ---
    let animFrameId = null;
    const playbackTick = () => {
        if (!video.paused && !video.ended) {
            if (!ctx.isInteracting() && !isSeeking && !video.seeking) {
                ctx.timeline.updatePlayhead(video.currentTime);
                ctx.syncWithPlayhead(video.currentTime);
            }
            updateTopInfoBar();
            animFrameId = requestAnimationFrame(playbackTick);
        } else {
            animFrameId = null;
        }
    };

    video.addEventListener("play", () => {
        playPauseBtn.innerHTML = Icons.ICON_PAUSE;
        if (!animFrameId) animFrameId = requestAnimationFrame(playbackTick);
    });
    video.addEventListener("pause", () => {
        playPauseBtn.innerHTML = Icons.ICON_PLAY;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    });

    const stepFwdBtn = document.createElement("button");
    stepFwdBtn.className = "vc-icon-btn";
    stepFwdBtn.innerHTML = Icons.ICON_STEP_FWD;
    stepFwdBtn.title = "Step Forward 1 Frame";
    stepFwdBtn.addEventListener("click", () => {
        if (!ctx.state.duration) return;
        video.pause();
        const totalFrames = ctx.timeToFrame(ctx.state.duration);
        const currentFrame = ctx.timeToFrame(video.currentTime);
        const targetFrame = Math.min(totalFrames, currentFrame + 1);
        const targetTime = ctx.frameToTime(targetFrame);
        seekVideo(targetTime);
        ctx.timeline.updatePlayhead(targetTime);
        ctx.syncWithPlayhead(targetTime);
        updateTopInfoBar();
        ctx.saveUiState();
    });

    // --- PLAYBACK SPEED BUTTON ---
    const speedBtn = document.createElement("button");
    speedBtn.className = "vc-icon-btn";
    speedBtn.style.width = "auto";
    speedBtn.style.padding = "0 6px";
    speedBtn.style.fontSize = "11px";
    speedBtn.style.fontWeight = "bold";
    speedBtn.style.color = "#82deff";
    speedBtn.innerText = "1x";
    speedBtn.title = "Playback Speed";

    const speeds = [1, 2, 4, 8];
    let currentSpeedIdx = 0;
    speedBtn.addEventListener("click", () => {
        currentSpeedIdx = (currentSpeedIdx + 1) % speeds.length;
        const s = speeds[currentSpeedIdx];
        video.playbackRate = s;
        speedBtn.innerText = s + "x";
    });

    centerGroup.appendChild(rewindBtn);
    centerGroup.appendChild(stepBackBtn);
    centerGroup.appendChild(playPauseBtn);
    centerGroup.appendChild(stepFwdBtn);
    centerGroup.appendChild(speedBtn);

    const rightGroup = document.createElement("div");
    rightGroup.className = "vc-toolbar-group right";
    rightGroup.style.display = "flex";
    rightGroup.style.alignItems = "center";

    // Rotate Button
    const rotateBtn = document.createElement("button");
    rotateBtn.className = "vc-icon-btn";
    rotateBtn.innerHTML = "↻";
    rotateBtn.title = "Rotate Video 90° Clockwise";
    rotateBtn.style.fontSize = "16px";
    rotateBtn.addEventListener("click", () => {
        if (!ctx.state.duration) return;
        const cfg = ctx.getActiveSettings();
        cfg.rotation = ((cfg.rotation || 0) + 90) % 360;
        updateCropOverlay();
        ctx.saveState();
        ctx.saveUiState();
    });

    // --- REARRANGED ZOOM SLIDER & LABEL ---
    const zoomWrapper = document.createElement("div");
    zoomWrapper.style.display = "flex";
    zoomWrapper.style.flexDirection = "column";
    zoomWrapper.style.alignItems = "center";
    zoomWrapper.style.gap = "0px";

    const zoomSlider = document.createElement("input");
    zoomSlider.type = "range";
    zoomSlider.min = "0";
    zoomSlider.max = "50";
    zoomSlider.value = "0";
    zoomSlider.style.width = "112px"; 
    zoomSlider.style.marginTop = "6px"; 
    zoomSlider.style.accentColor = "#82deff";
    zoomSlider.addEventListener("mousedown", (e) => e.stopPropagation());
    zoomSlider.addEventListener("input", (e) => {
        ctx.state.zoomLevel = parseInt(e.target.value, 10);
        ctx.timeline.updateTimelineZoom();
        ctx.saveUiState();
    });

    const zoomLbl = document.createElement("span");
    zoomLbl.style.fontSize = "8px";
    zoomLbl.style.fontWeight = "bold";
    zoomLbl.style.color = "#888";
    zoomLbl.style.marginTop = "2px";
    zoomLbl.style.letterSpacing = "0.5px";
    zoomLbl.innerText = "Timeline Zoom";

    zoomWrapper.appendChild(zoomSlider);
    zoomWrapper.appendChild(zoomLbl);

    // Helper for visual divider lines
    const createDivider = () => {
        const d = document.createElement("div");
        d.style.width = "1px";
        d.style.height = "16px";
        d.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
        d.style.margin = "0 12px";
        return d;
    };

    // Assemble the Right Group
    rightGroup.appendChild(createDivider());
    rightGroup.appendChild(rotateBtn);
    rightGroup.appendChild(createDivider());
    rightGroup.appendChild(zoomWrapper);

    playerToolbar.appendChild(leftGroup);
    playerToolbar.appendChild(centerGroup);
    playerToolbar.appendChild(rightGroup);
    centerPanel.appendChild(playerToolbar);

    let lastIsOutOfBounds = false;

    const updateTopInfoBar = () => {
        const fps = ctx.state.targetFps || 24;
        const totalFrames = Math.max(0, ctx.timeToFrame(video.currentTime || 0));
        const totalSeconds = Math.floor(totalFrames / fps);
        const remFrames = totalFrames % fps;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');
        const ff = String(remFrames).padStart(2, '0');
        infoCenter.innerText = `${mm}:${ss}.${ff}`;

        const cfg = ctx.getActiveSettings();
        const rot = cfg.rotation || 0;
        
        let dispW = ctx.state.trueWidth || video.videoWidth;
        let dispH = ctx.state.trueHeight || video.videoHeight;
        
        // Swap visual dimensions for the info bar if rotated
        if (rot === 90 || rot === 270) {
            const temp = dispW;
            dispW = dispH;
            dispH = temp;
        }

        let dispFile = ctx.state.currentFile;
        if (dispFile && dispFile.length > 16) {
            dispFile = dispFile.substring(0, 15) + "…";
        }

        if (ctx.state.currentFile && dispW > 0) {
            infoLeft.innerHTML = `<span title="${ctx.state.currentFile}">${dispFile}</span> <span class="video-dims">(${dispW}x${dispH})</span>`;
        } else if (ctx.state.currentFile) {
            infoLeft.innerHTML = `<span title="${ctx.state.currentFile}">${dispFile}</span>`;
        } else {
            infoLeft.innerHTML = `<span>No video</span>`;
        }

        if (ctx.state.selectedClipIndices && ctx.state.selectedClipIndices.length === 1) {
            const clip = ctx.state.clips[ctx.state.selectedClipIndices[0]];
            if (clip) {
                const lengthFrames = clip.endFrame - clip.startFrame;
                const expW = clip.actualExportW || cfg.actualExportW || 960;
                const expH = clip.actualExportH || cfg.actualExportH || 544;
                const dynId = ctx.getDynamicClipId(clip);

                if (cfg.cropMode === false) {
                    infoRight.className = "vc-topbar-right stretch";
                    infoRight.innerText = `${dynId} (${expW}x${expH}) [Stretch] ${lengthFrames}f`;
                } else if (typeof lastIsOutOfBounds !== 'undefined' && lastIsOutOfBounds) {
                    infoRight.className = "vc-topbar-right warning";
                    infoRight.innerText = `${dynId} (${expW}x${expH}) [Padded] ${lengthFrames}f`;
                } else {
                    infoRight.className = "vc-topbar-right";
                    infoRight.innerText = `${dynId} (${expW}x${expH}) ${lengthFrames}f`;
                }
            }
        } else if (ctx.state.selectedClipIndices && ctx.state.selectedClipIndices.length > 1) {
            infoRight.className = "vc-topbar-right stretch";
            infoRight.innerText = `${ctx.state.selectedClipIndices.length} Clips Selected (Multi-Edit)`;
        } else {
            infoRight.className = "vc-topbar-right none";
            infoRight.innerText = "No clip";
        }
    };

    let isSeeking = false;
    let pendingSeekTime = null;
    let seekTimeout = null;

    const seekVideo = (targetTime) => {
        if (Math.abs(video.currentTime - targetTime) < 0.001) {
            isSeeking = false;
            pendingSeekTime = null;
            return;
        }

        if (isSeeking || video.seeking) {
            pendingSeekTime = targetTime;
            return;
        }

        isSeeking = true;
        video.currentTime = targetTime;

        if (seekTimeout) clearTimeout(seekTimeout);
        seekTimeout = setTimeout(() => {
            isSeeking = false;
            if (pendingSeekTime !== null) {
                const next = pendingSeekTime;
                pendingSeekTime = null;
                seekVideo(next);
            }
        }, 500);
    };

    video.addEventListener("seeked", () => {
        if (seekTimeout) clearTimeout(seekTimeout);
        isSeeking = false;

        if (pendingSeekTime !== null) {
            const nextTime = pendingSeekTime;
            pendingSeekTime = null;
            seekVideo(nextTime);
            return;
        }

        if (!ctx.isInteracting()) {
            ctx.timeline.updatePlayhead(video.currentTime);
            ctx.syncWithPlayhead(video.currentTime);
        }
        updateTopInfoBar();
    });

    video.addEventListener("timeupdate", () => {
        if (video.paused && !ctx.isInteracting() && !isSeeking && !video.seeking) {
            ctx.timeline.updatePlayhead(video.currentTime);
            ctx.syncWithPlayhead(video.currentTime);
            updateTopInfoBar();
        }
    });

    const setVideoSource = (useProxy, targetTime = null, forceRaw = false) => {
        if (!useProxy && ctx.state.needsFpsProxy && !forceRaw) {
            video.pause();
            video.removeAttribute("src");
            video.load();
            cropOverlay.style.display = "none";
            
            const content = document.createElement("div");
            content.style.textAlign = "center";
            content.innerHTML = `
                <div style="font-size:32px; margin-bottom:8px; color:#ff8800;">${Icons.ICON_ALERT || "⚠"}</div>
                <div style="font-size:16px; font-weight:bold; color:#fff; margin-bottom:8px;">Format Update Required</div>
                <div style="font-size:12px; color:#aaa; margin-bottom:12px; line-height:1.4;">
                    To prevent clipping and sync errors, the timeline <br>
                    requires exactly 24 FPS.
                    <br><br>
                    <span style="color:#ff8800;">Source: ${ctx.state.srcFps.toFixed(2)} FPS</span>
                </div>
                <button class="vc-btn" style="background:#aa4400; border-color:#ff8800; color:#fff;" onclick="window.vcTriggerProxy()">
                    Create 24fps Proxy
                </button>
            `;
            
            window.vcTriggerProxy = () => { ctx.leftPanel.triggerProxyCreation(); };
            
            const existing = videoViewer.querySelector(".vc-standby-overlay");
            if (existing) videoViewer.removeChild(existing);
            
            const overlay = document.createElement("div");
            overlay.className = "vc-standby-overlay";
            overlay.style.display = "flex";
            overlay.appendChild(content);
            videoViewer.appendChild(overlay);
            
            updateTopInfoBar();
            return;
        }

        if (!useProxy && ctx.state.needsProxyFormat && !forceRaw) {
            video.pause();
            video.removeAttribute("src");
            video.load();
            cropOverlay.style.display = "none";
            
            const content = document.createElement("div");
            content.style.textAlign = "center";
            content.innerHTML = `
                <div style="font-size:32px; margin-bottom:8px; color:#ff8800;">${Icons.ICON_ALERT || "⚠"}</div>
                <div style="font-size:16px; font-weight:bold; color:#fff; margin-bottom:8px;">Format Update Required</div>
                <div style="font-size:12px; color:#aaa; margin-bottom:12px; line-height:1.4;">
                    The browser does not natively support this codec.
                    <br><br>
                    <span style="color:#ff8800;">Codec: ${ctx.state.codec || "Unknown"}</span>
                </div>
                <button class="vc-btn" style="background:#aa4400; border-color:#ff8800; color:#fff;" onclick="window.vcTriggerProxy()">
                    Create Proxy
                </button>
            `;
            
            window.vcTriggerProxy = () => { ctx.leftPanel.triggerProxyCreation(); };
            
            const existing = videoViewer.querySelector(".vc-standby-overlay");
            if (existing) videoViewer.removeChild(existing);
            
            const overlay = document.createElement("div");
            overlay.className = "vc-standby-overlay";
            overlay.style.display = "flex";
            overlay.appendChild(content);
            videoViewer.appendChild(overlay);
            
            updateTopInfoBar();
            return;
        }

        if (!useProxy && ctx.state.isHeavy && !forceRaw) {
            video.pause();
            video.removeAttribute("src");
            video.load();
            cropOverlay.style.display = "none";
            uiOverlays.showStandby("oom", () => setVideoSource(false, 0, true));
            updateTopInfoBar();
            return;
        }

        uiOverlays.hideStandby();
        const existingCustom = videoViewer.querySelector(".vc-standby-overlay");
        if (existingCustom) videoViewer.removeChild(existingCustom);

        const curTime = targetTime !== null ? targetTime : (video.currentTime || 0);
        const isPaused = video.paused;
        const src = ctx.api.apiURL(`/video_clipper/serve_video?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(ctx.state.currentFile)}&proxy=${useProxy ? "true" : "false"}`);
        
        video.src = src;
        video.load(); 
        
        video.onloadedmetadata = () => {
            if (ctx.state.trueWidth > 0 && ctx.state.trueHeight > 0 && video.videoWidth > 0 && video.videoHeight > 0) {
                const trueRatio = ctx.state.trueWidth / ctx.state.trueHeight;
                const vidRatio = video.videoWidth / video.videoHeight;
                
                if ((trueRatio > 1 && vidRatio < 1) || (trueRatio < 1 && vidRatio > 1)) {
                    const temp = ctx.state.trueWidth;
                    ctx.state.trueWidth = ctx.state.trueHeight;
                    ctx.state.trueHeight = temp;
                }
            }

            video.currentTime = curTime;
            
            // Re-apply playback rate because video.load() resets it
            video.playbackRate = speeds[currentSpeedIdx];
            
            if (!isPaused) video.play();
            updateCropOverlay();
            ctx.timeline.updatePlayhead(curTime);
            updateTopInfoBar();
        };
    };

    const updateCropOverlay = () => {
        const cfg = ctx.getActiveSettings();
        ctx.computeExportResolution(cfg);

        if (!video.videoWidth || !video.videoHeight || videoViewer.querySelector(".vc-standby-overlay")) {
            cropOverlay.style.display = "none";
            lastIsOutOfBounds = false;
            return;
        }

        const rawW = ctx.state.trueWidth || video.videoWidth;
        const rawH = ctx.state.trueHeight || video.videoHeight;
        const rot = cfg.rotation || 0;

        // Swap dimensions mathematically if rotated 90 or 270
        const vW = (rot === 90 || rot === 270) ? rawH : rawW;
        const vH = (rot === 90 || rot === 270) ? rawW : rawH;
        
        const cW = 640;
        const cH = 360;
        const stageRatio = cW / cH;

        let actualDisplayW, actualDisplayH;

        if (cfg.cropMode === false) {
            const targetRatio = (cfg.targetWidth || 960) / (cfg.targetHeight || 544);
            if (targetRatio > stageRatio) {
                actualDisplayW = cW;
                actualDisplayH = Math.round(cW / targetRatio);
            } else {
                actualDisplayH = cH;
                actualDisplayW = Math.round(cH * targetRatio);
            }
        } else {
            const videoRatio = vW / vH;
            if (videoRatio > stageRatio) {
                actualDisplayW = cW;
                actualDisplayH = cW / videoRatio;
            } else {
                actualDisplayH = cH;
                actualDisplayW = cH * videoRatio;
            }
        }

        // Apply CSS rotation to the video element explicitly
        video.style.position = "absolute";
        video.style.top = "50%";
        video.style.left = "50%";
        
        if (rot === 90 || rot === 270) {
            video.style.width = `${actualDisplayH}px`;
            video.style.height = `${actualDisplayW}px`;
        } else {
            video.style.width = `${actualDisplayW}px`;
            video.style.height = `${actualDisplayH}px`;
        }
        
        video.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
        video.style.objectFit = cfg.cropMode === false ? "fill" : "contain";

        if (cfg.cropMode === false) {
            cropOverlay.style.display = "none";
            lastIsOutOfBounds = false;
            return;
        }

        const displayOffsetX = (cW - actualDisplayW) / 2;
        const displayOffsetY = (cH - actualDisplayH) / 2;
        const scaleFactor = actualDisplayW / vW;

        const cropPixelW = cfg.targetWidth || 960;
        const cropPixelH = cfg.targetHeight || 544;
        const offX = cfg.offsetX !== undefined ? cfg.offsetX : 0.5;
        const offY = cfg.offsetY !== undefined ? cfg.offsetY : 0.5;

        const cropX = (vW - cropPixelW) * offX;
        const cropY = (vH - cropPixelH) * offY;

        const isOutOfBounds = cropPixelW > vW || cropPixelH > vH ||
                            cropX < -0.5 || (cropX + cropPixelW) > (vW + 0.5) ||
                            cropY < -0.5 || (cropY + cropPixelH) > (vH + 0.5);
        lastIsOutOfBounds = isOutOfBounds;

        const screenX = displayOffsetX + (cropX * scaleFactor);
        const screenY = displayOffsetY + (cropY * scaleFactor);
        const screenW = cropPixelW * scaleFactor;
        const screenH = cropPixelH * scaleFactor;

        cropOverlay.style.display = "block";
        cropOverlay.style.width = `${Math.round(screenW)}px`;
        cropOverlay.style.height = `${Math.round(screenH)}px`;
        cropOverlay.style.left = `${Math.round(screenX)}px`;
        cropOverlay.style.top = `${Math.round(screenY)}px`;

        if (isOutOfBounds) {
            cropOverlay.style.border = "2px solid #ff4444";
            cropOverlay.style.boxShadow = "0 0 0 9999px rgba(0, 0, 0, 0.75)";
        } else if (ctx.state.selectedClipIndices && ctx.state.selectedClipIndices.length > 0) {
            cropOverlay.style.border = "2px solid #55ff88";
            cropOverlay.style.boxShadow = "0 0 0 9999px rgba(0, 0, 0, 0.75)";
        } else {
            cropOverlay.style.border = "1px dashed rgba(130, 222, 255, 0.6)";
            cropOverlay.style.boxShadow = "0 0 0 9999px rgba(0, 0, 0, 0.4)";
        }
    };

    video.addEventListener("loadedmetadata", () => {
        ctx.state.duration = video.duration || 0;
        ctx.timeline.updateTimelineZoom();
        updateCropOverlay();
        updateTopInfoBar();
    });

    return {
        element: centerPanel,
        video,
        seekVideo,
        setVideoSource,
        updateCropOverlay,
        updateTopInfoBar,
        toggleHelp: uiOverlays.toggleHelp,
        toggleSettings: uiOverlays.toggleSettings,
        toggleTools: uiOverlays.toggleTools,
        setZoomSlider: (val) => {
            zoomSlider.value = `${val}`;
        },
        setDelClipBtnDisabled: (disabled) => {
            delClipBtn.disabled = disabled;
        },
        syncSettingsToForm: uiOverlays.syncSettingsToForm
    };
}