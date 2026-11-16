export function createTimeline(ctx) {
    const timelineWrapper = document.createElement("div");
    timelineWrapper.className = "vc-timeline-wrapper";

    const timelineContent = document.createElement("div");
    timelineContent.className = "vc-timeline-content";

    const trackHead = document.createElement("div");
    trackHead.className = "vc-trackhead";

    const frameGridCanvas = document.createElement("canvas");
    frameGridCanvas.style.position = "absolute";
    frameGridCanvas.style.top = "0";
    frameGridCanvas.style.left = "0";
    frameGridCanvas.style.pointerEvents = "none";
    trackHead.appendChild(frameGridCanvas);
    timelineContent.appendChild(trackHead);

    const waveformCanvas = document.createElement("canvas");
    waveformCanvas.style.position = "absolute";
    waveformCanvas.style.top = "20px";
    waveformCanvas.style.left = "0";
    waveformCanvas.style.pointerEvents = "none";
    waveformCanvas.style.zIndex = "1";
    timelineContent.appendChild(waveformCanvas);

    const clipArea = document.createElement("div");
    clipArea.className = "vc-clip-area";
    timelineContent.appendChild(clipArea);

    const playhead = document.createElement("div");
    playhead.className = "vc-playhead";
    const playheadLine = document.createElement("div");
    playheadLine.className = "vc-playhead-line";
    const playheadTri = document.createElement("div");
    playheadTri.className = "vc-playhead-tri";
    playhead.appendChild(playheadLine);
    playhead.appendChild(playheadTri);
    timelineContent.appendChild(playhead);

    timelineWrapper.appendChild(timelineContent);

    let dragState = null;
    let dragStartX = 0;
    let dragInitialStart = 0;
    let dragClickFrameOffset = 0;
    let isScrubbing = false;
    let animationFrameId = null;
    let cachedContentRect = null;
    let renderRequested = false;
    let lastClickedIndex = -1; 

    const isInteracting = () => isScrubbing || dragState !== null;

    const requestVirtualRender = () => {
        if (!renderRequested) {
            renderRequested = true;
            requestAnimationFrame(() => {
                drawFrameGrid();
                drawWaveform();
                renderRequested = false;
            });
        }
    };

    timelineWrapper.addEventListener('scroll', requestVirtualRender);

    timelineWrapper.addEventListener("wheel", (e) => {
        if (!ctx.state.duration) return;

        if (e.altKey) {
            e.preventDefault();
            const step = e.deltaY < 0 ? 2 : -2;
            let val = ctx.state.zoomLevel + step;
            val = Math.max(0, Math.min(50, val));
            ctx.state.zoomLevel = val;
            if (ctx.player && ctx.player.setZoomSlider) {
                ctx.player.setZoomSlider(val);
            }
            updateTimelineZoom();
            ctx.saveUiState();
        } else if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const framesToMove = e.deltaY < 0 ? 1 : -1;
            const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
            const totalFrames = ctx.timeToFrame(ctx.state.duration);
            const targetFrame = Math.max(0, Math.min(totalFrames, currentFrame + framesToMove));
            const targetTime = ctx.frameToTime(targetFrame);
            ctx.player.seekVideo(targetTime);
            updatePlayhead(targetTime);
            ctx.syncWithPlayhead(targetTime);
        }
    }, { passive: false });

    const drawFrameGrid = () => {
        if (!ctx.state.duration || ctx.state.duration <= 0) return;
        const totalFrames = ctx.timeToFrame(ctx.state.duration);
        if (totalFrames <= 0) return;

        const viewportWidth = timelineWrapper.clientWidth || 1198;
        const totalTrackWidth = timelineContent.clientWidth || viewportWidth;
        const scrollLeft = timelineWrapper.scrollLeft;

        frameGridCanvas.style.transform = `translateX(${scrollLeft}px)`;
        frameGridCanvas.width = viewportWidth;
        frameGridCanvas.height = 20;

        const canvasCtx = frameGridCanvas.getContext("2d");
        canvasCtx.clearRect(0, 0, viewportWidth, 20);

        const pxPerFrame = totalTrackWidth / totalFrames;
        
        const candidates = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
        let step = 1;
        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i] * pxPerFrame >= 4) {
                step = candidates[i];
                break;
            }
            step = candidates[candidates.length - 1];
        }

        let majorStep = step * 5;
        if (step === 1) majorStep = 5;
        else if (step === 5) majorStep = 25;
        else if (step === 10) majorStep = 50;

        const startFrame = Math.max(0, Math.floor((scrollLeft / totalTrackWidth) * totalFrames));
        const endFrame = Math.min(totalFrames, Math.ceil(((scrollLeft + viewportWidth) / totalTrackWidth) * totalFrames));
        const snappedStartFrame = Math.floor(startFrame / step) * step;

        canvasCtx.lineWidth = 1;

        canvasCtx.beginPath();
        canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.20)";
        for (let f = snappedStartFrame; f <= endFrame; f += step) {
            if (f % majorStep !== 0) {
                const absoluteX = (f / totalFrames) * totalTrackWidth;
                const relativeX = Math.floor(absoluteX - scrollLeft) + 0.5;
                canvasCtx.moveTo(relativeX, 20 - 8);
                canvasCtx.lineTo(relativeX, 20);
            }
        }
        canvasCtx.stroke();

        canvasCtx.beginPath();
        canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.50)";
        for (let f = snappedStartFrame; f <= endFrame; f += step) {
            if (f % majorStep === 0) {
                const absoluteX = (f / totalFrames) * totalTrackWidth;
                const relativeX = Math.floor(absoluteX - scrollLeft) + 0.5;
                canvasCtx.moveTo(relativeX, 20 - 14);
                canvasCtx.lineTo(relativeX, 20);
            }
        }
        canvasCtx.stroke();
    };

    const drawWaveform = () => {
        if (!ctx.state.audioPeaks || ctx.state.audioPeaks.length === 0) {
            const canvasCtx = waveformCanvas.getContext("2d");
            canvasCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            return;
        }

        const viewportWidth = timelineWrapper.clientWidth || 1198;
        const totalTrackWidth = timelineContent.clientWidth || viewportWidth;
        const scrollLeft = timelineWrapper.scrollLeft;
        const height = 40;
        const amp = height / 2;

        waveformCanvas.style.transform = `translateX(${scrollLeft}px)`;
        waveformCanvas.width = viewportWidth;
        waveformCanvas.height = height;

        const canvasCtx = waveformCanvas.getContext("2d");
        canvasCtx.clearRect(0, 0, viewportWidth, height);
        canvasCtx.fillStyle = "rgba(130, 222, 255, 0.35)";

        const totalPeaks = ctx.state.audioPeaks.length;

        for (let px = 0; px < viewportWidth; px++) {
            const absoluteX = scrollLeft + px;
            const peakIndex = Math.floor((absoluteX / totalTrackWidth) * totalPeaks);
            
            if (peakIndex >= 0 && peakIndex < totalPeaks) {
                const val = Math.abs(ctx.state.audioPeaks[peakIndex] || 0);
                const barHeight = Math.max(1, val * amp * 1.8);
                canvasCtx.fillRect(px, amp - (barHeight / 2), 1, barHeight);
            }
        }
    };

    const updateTimelineZoom = () => {
        const viewportWidth = timelineWrapper.clientWidth || 1198;
        const factor = 1 + (ctx.state.zoomLevel * 0.9);
        const totalTrackWidth = Math.round(viewportWidth * factor);

        timelineContent.style.width = `${totalTrackWidth}px`;

        if (ctx.state.duration > 0) {
            const snappedFrame = ctx.timeToFrame(ctx.player.video.currentTime);
            const snappedTime = ctx.frameToTime(snappedFrame);
            const playheadPx = (snappedTime / ctx.state.duration) * totalTrackWidth;
            
            const targetScroll = playheadPx - (viewportWidth / 2);
            timelineWrapper.scrollLeft = Math.max(0, targetScroll);
        }

        requestVirtualRender();
        renderTimeline();
        updatePlayhead(ctx.player.video.currentTime);
    };

    const updatePlayhead = (time) => {
        if (!ctx.state.duration) return;
        const trackWidth = timelineContent.clientWidth || 1;
        const totalFrames = ctx.timeToFrame(ctx.state.duration);
        if (totalFrames <= 0) return;

        const frame = Math.max(0, Math.min(totalFrames, ctx.timeToFrame(time)));
        const snappedX = (frame / totalFrames) * trackWidth;
        playhead.style.left = `${Math.round(snappedX) - 1}px`;
        
        if (!isInteracting()) {
            const scrollLeft = timelineWrapper.scrollLeft;
            const viewWidth = timelineWrapper.clientWidth;
            if (snappedX < scrollLeft || snappedX > scrollLeft + viewWidth) {
                timelineWrapper.scrollLeft = Math.max(0, snappedX - (viewWidth / 2));
            }
        }
    };

    const renderTimeline = () => {
        clipArea.innerHTML = "";
        if (!ctx.state.duration) return;
        const totalFrames = ctx.timeToFrame(ctx.state.duration);

        ctx.state.clips.forEach((clip, index) => {
            const clipLengthFrames = clip.endFrame - clip.startFrame;
            const isSelected = ctx.state.selectedClipIndices.includes(index);
            const dynId = ctx.getDynamicClipId(clip);

            const clipEl = document.createElement("div");
            clipEl.className = "vc-clip-block";
            clipEl.style.left = `${(clip.startFrame / totalFrames) * 100}%`;
            clipEl.style.width = `${(clipLengthFrames / totalFrames) * 100}%`;
            clipEl.style.backgroundColor = isSelected ? "rgba(85, 255, 136, 0.4)" : "rgba(33, 150, 243, 0.4)";
            clipEl.style.border = isSelected ? "2px solid #55ff88" : "1px solid #2196F3";
            clipEl.style.zIndex = isSelected ? "2" : "1";

            const nameSpan = document.createElement("span");
            nameSpan.style.color = "#fff";
            nameSpan.style.fontWeight = "bold";
            nameSpan.innerText = `${dynId}`;

            const frameSpan = document.createElement("span");
            frameSpan.style.color = "#ddd";
            frameSpan.style.fontFamily = "monospace";
            frameSpan.innerText = `${clipLengthFrames}f`;

            clipEl.appendChild(nameSpan);
            clipEl.appendChild(frameSpan);

            // RENDER KEYFRAMES
            if (clip.keyframes && clip.keyframes.length > 0) {
                clip.keyframes.forEach(kf => {
                    if (kf.frame >= clip.startFrame && kf.frame <= clip.endFrame) {
                        const pct = ((kf.frame - clip.startFrame) / clipLengthFrames) * 100;
                        const marker = document.createElement("div");
                        marker.className = "vc-keyframe-marker";
                        marker.style.left = `${pct}%`;
                        clipEl.appendChild(marker);
                    }
                });
            }

            const leftHandle = document.createElement("div");
            leftHandle.className = "vc-clip-handle left";
            leftHandle.style.cursor = "ew-resize";
            leftHandle.style.zIndex = "10";

            const rightHandle = document.createElement("div");
            rightHandle.className = "vc-clip-handle right";
            rightHandle.style.cursor = "ew-resize";
            rightHandle.style.zIndex = "10";

            clipEl.addEventListener("mousedown", (e) => {
                cachedContentRect = timelineContent.getBoundingClientRect();
                const clickX = e.clientX - cachedContentRect.left;
                const rawTime = (clickX / cachedContentRect.width) * ctx.state.duration;
                const targetFrame = Math.max(0, Math.min(totalFrames, ctx.timeToFrame(Math.max(0, Math.min(rawTime, ctx.state.duration)))));
                const targetTime = ctx.frameToTime(targetFrame);

                updatePlayhead(targetTime);
                ctx.player.seekVideo(targetTime);

                if (e.shiftKey && lastClickedIndex !== -1) {
                    const start = Math.min(lastClickedIndex, index);
                    const end = Math.max(lastClickedIndex, index);
                    ctx.state.selectedClipIndices = [];
                    for (let i = start; i <= end; i++) ctx.state.selectedClipIndices.push(i);
                } else if (e.ctrlKey || e.metaKey) {
                    const existingIdx = ctx.state.selectedClipIndices.indexOf(index);
                    if (existingIdx > -1) {
                        ctx.state.selectedClipIndices.splice(existingIdx, 1);
                    } else {
                        ctx.state.selectedClipIndices.push(index);
                    }
                    lastClickedIndex = index;
                } else {
                    if (!ctx.state.selectedClipIndices.includes(index)) {
                        ctx.state.selectedClipIndices = [index];
                    }
                    lastClickedIndex = index;
                }

                initDrag(e, index, 'body', targetFrame);
                ctx.leftPanel.syncControlsFromSettings(ctx.getActiveSettings());
                ctx.player.updateCropOverlay();
                if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
            });

            leftHandle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                cachedContentRect = timelineContent.getBoundingClientRect();
                const targetTime = ctx.frameToTime(clip.startFrame);
                updatePlayhead(targetTime);
                ctx.player.seekVideo(targetTime);
                
                if (!ctx.state.selectedClipIndices.includes(index)) {
                    ctx.state.selectedClipIndices = [index];
                }
                
                initDrag(e, index, 'left');
                ctx.leftPanel.syncControlsFromSettings(ctx.getActiveSettings());
                ctx.player.updateCropOverlay();
                if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
            });

            rightHandle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                cachedContentRect = timelineContent.getBoundingClientRect();
                const targetTime = ctx.frameToTime(clip.endFrame);
                updatePlayhead(targetTime);
                ctx.player.seekVideo(targetTime);
                
                if (!ctx.state.selectedClipIndices.includes(index)) {
                    ctx.state.selectedClipIndices = [index];
                }
                
                initDrag(e, index, 'right');
                ctx.leftPanel.syncControlsFromSettings(ctx.getActiveSettings());
                ctx.player.updateCropOverlay();
                if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
            });

            clipEl.appendChild(leftHandle);
            clipEl.appendChild(rightHandle);
            clipArea.appendChild(clipEl);
        });

        if (ctx.player && ctx.player.setDelClipBtnDisabled) {
            ctx.player.setDelClipBtnDisabled(ctx.state.selectedClipIndices.length === 0);
        }
    };

    const initDrag = (e, targetIndex, type, clickFrame = null) => {
        e.stopPropagation();
        dragState = type;
        dragStartX = e.clientX;
        
        ctx.state.selectedClipIndices.forEach(idx => {
            const c = ctx.state.clips[idx];
            if (c) {
                c._dragInitialStart = c.startFrame;
                c._dragInitialEnd = c.endFrame;
                if (c.keyframes) c.keyframes.forEach(kf => kf._dragInitialFrame = kf.frame);
            }
        });

        if (ctx.state.clips[targetIndex]) {
            dragInitialStart = ctx.state.clips[targetIndex].startFrame;
            
            if (type === 'body' && clickFrame !== null) {
                dragClickFrameOffset = clickFrame - dragInitialStart;
            } else {
                dragClickFrameOffset = 0;
            }
        }
        renderTimeline();
    };

    window.addEventListener("mousemove", (e) => {
        if (!ctx.state.duration) return;
        if (dragState === null && !isScrubbing) return;

        const clientX = e.clientX;
        const totalFrames = ctx.timeToFrame(ctx.state.duration);
        const contentWidth = cachedContentRect ? cachedContentRect.width : (timelineContent.clientWidth || 1198);
        const contentLeft = cachedContentRect ? cachedContentRect.left : 0;

        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        animationFrameId = requestAnimationFrame(() => {
            if (dragState !== null && ctx.state.selectedClipIndices.length > 0) {
                const deltaX = clientX - dragStartX;
                const frameDelta = Math.round((deltaX / contentWidth) * totalFrames);

                let focusClip = null;

                ctx.state.selectedClipIndices.forEach(idx => {
                    const clip = ctx.state.clips[idx];
                    if (!clip) return;
                    
                    if (dragState === 'body') {
                        let newStart = clip._dragInitialStart + frameDelta;
                        let newEnd = clip._dragInitialEnd + frameDelta;
                        const length = clip._dragInitialEnd - clip._dragInitialStart;

                        if (newStart < 0) { newStart = 0; newEnd = length; }
                        if (newEnd > totalFrames) { newEnd = totalFrames; newStart = totalFrames - length; }

                        clip.startFrame = newStart;
                        clip.endFrame = newEnd;

                        const actualDelta = newStart - clip._dragInitialStart;
                        if (clip.keyframes) {
                            clip.keyframes.forEach(kf => {
                                kf.frame = kf._dragInitialFrame + actualDelta;
                            });
                        }
                    } else if (dragState === 'right') {
                        let rawNewEnd = clip._dragInitialEnd + frameDelta;
                        if (rawNewEnd > totalFrames) rawNewEnd = totalFrames;
                        let desiredLength = rawNewEnd - clip._dragInitialStart;

                        let validLength = ctx.getValidLength(desiredLength);
                        clip.endFrame = clip._dragInitialStart + validLength;
                        if (clip.endFrame > totalFrames) clip.endFrame = clip._dragInitialStart + ctx.getValidLength(totalFrames - clip._dragInitialStart);
                    } else if (dragState === 'left') {
                        let rawNewStart = clip._dragInitialStart + frameDelta;
                        if (rawNewStart < 0) rawNewStart = 0;
                        let desiredLength = clip._dragInitialEnd - rawNewStart;

                        let validLength = ctx.getValidLength(desiredLength);
                        clip.startFrame = clip._dragInitialEnd - validLength;
                        if (clip.startFrame < 0) clip.startFrame = clip._dragInitialEnd - ctx.getValidLength(clip._dragInitialEnd);
                    }
                    
                    if (!focusClip) focusClip = clip;
                });

                if (focusClip) {
                    let targetFrame;
                    if (dragState === 'right') {
                        targetFrame = focusClip.endFrame;
                    } else if (dragState === 'left') {
                        targetFrame = focusClip.startFrame;
                    } else {
                        targetFrame = Math.min(focusClip.endFrame, Math.max(focusClip.startFrame, focusClip.startFrame + dragClickFrameOffset));
                    }

                    const targetTime = ctx.frameToTime(targetFrame);
                    updatePlayhead(targetTime);
                    ctx.player.seekVideo(targetTime);
                }
                
                renderTimeline();
                if (ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
            } else if (isScrubbing) {
                let rawTime = ((clientX - contentLeft) / contentWidth) * ctx.state.duration;
                const clampedTime = Math.max(0, Math.min(rawTime, ctx.state.duration));
                const targetFrame = Math.max(0, Math.min(totalFrames, ctx.timeToFrame(clampedTime)));
                const snappedTime = ctx.frameToTime(targetFrame);

                updatePlayhead(snappedTime);
                ctx.player.seekVideo(snappedTime);
                ctx.syncWithPlayhead(snappedTime);
            }
        });
    });

    window.addEventListener("mouseup", () => {
        if (dragState !== null) {
            const finishedState = dragState; 
            ctx.saveState();
            ctx.saveUiState();
            
            if (finishedState === 'body' || finishedState === 'left') {
                setTimeout(() => {
                    if (ctx.captureFrameFromVideo && ctx.player && ctx.player.video) {
                        const thumb = ctx.captureFrameFromVideo(ctx.player.video);
                        if (thumb) {
                            ctx.state.selectedClipIndices.forEach(idx => {
                                if (ctx.state.clips[idx]) ctx.state.clips[idx].thumbData = thumb;
                            });
                            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                        }
                    }
                }, 150);
            }
        }
        dragState = null;
        isScrubbing = false;
        cachedContentRect = null;
    });

    const handleTrackMouseDown = (e) => {
        e.stopPropagation();
        isScrubbing = true;
        cachedContentRect = timelineContent.getBoundingClientRect();
        const clickX = e.clientX - cachedContentRect.left;
        const rawTime = (clickX / cachedContentRect.width) * ctx.state.duration;
        const totalFrames = ctx.timeToFrame(ctx.state.duration);
        const targetFrame = Math.max(0, Math.min(totalFrames, ctx.timeToFrame(Math.max(0, Math.min(rawTime, ctx.state.duration)))));
        const snappedTime = ctx.frameToTime(targetFrame);

        updatePlayhead(snappedTime);
        ctx.player.seekVideo(snappedTime);
        ctx.syncWithPlayhead(snappedTime);
    };

    trackHead.addEventListener("mousedown", handleTrackMouseDown);
    clipArea.addEventListener("mousedown", (e) => {
        if (e.target === clipArea) handleTrackMouseDown(e);
    });

    return {
        element: timelineWrapper,
        drawFrameGrid,
        drawWaveform,
        updateTimelineZoom,
        updatePlayhead,
        renderTimeline,
        isInteracting
    };
}