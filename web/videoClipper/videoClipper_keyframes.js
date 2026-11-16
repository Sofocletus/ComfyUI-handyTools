import * as Icons from "./videoClipper_icons.js";

export function createKeyframeManager(ctx) {
    let ui = {
        prevBtn: null,
        toggleBtn: null,
        nextBtn: null,
        clearBtn: null,
        interpBtn: null
    };

    const getActiveClip = () => {
        if (ctx.state.selectedClipIndices && ctx.state.selectedClipIndices.length === 1) {
            return ctx.state.clips[ctx.state.selectedClipIndices[0]];
        }
        return null;
    };

    const getCurrentFrame = () => {
        if (!ctx.player || !ctx.player.video) return 0;if (!ctx.player.video.paused) {
            return ctx.player.video.currentTime * 24.0;
        }
        return ctx.timeToFrame(ctx.player.video.currentTime);
    };

    const ensureSorted = (clip) => {
        if (clip.keyframes) clip.keyframes.sort((a, b) => a.frame - b.frame);
    };

    const getInterpolatedPosition = (clip, frame) => {
        if (!clip.keyframes || clip.keyframes.length === 0) {
            return { x: clip.offsetX, y: clip.offsetY };
        }
        
        if (frame <= clip.keyframes[0].frame) return { x: clip.keyframes[0].x, y: clip.keyframes[0].y };
        if (frame >= clip.keyframes[clip.keyframes.length - 1].frame) return { x: clip.keyframes[clip.keyframes.length - 1].x, y: clip.keyframes[clip.keyframes.length - 1].y };
        
        let k1 = clip.keyframes[0];
        let k2 = clip.keyframes[1];
        for (let i = 0; i < clip.keyframes.length - 1; i++) {
            if (frame >= clip.keyframes[i].frame && frame < clip.keyframes[i+1].frame) {
                k1 = clip.keyframes[i];
                k2 = clip.keyframes[i+1];
                break;
            }
        }
        
        let t = (frame - k1.frame) / (k2.frame - k1.frame);
        if (clip.interpMode === "smooth") {
            t = 0.5 * (1 - Math.cos(t * Math.PI)); 
        }
        
        return {
            x: k1.x + (k2.x - k1.x) * t,
            y: k1.y + (k2.y - k1.y) * t
        };
    };

    const addOrUpdateKeyframe = (clip, type, value) => {
        if (!clip.keyframes) clip.keyframes = [];
        const frame = getCurrentFrame();
        
        let kf = clip.keyframes.find(k => k.frame === frame);
        if (!kf) {
            let currentPos = getInterpolatedPosition(clip, frame);
            kf = { frame: frame, x: currentPos.x, y: currentPos.y };
            clip.keyframes.push(kf);
        }
        
        if (type === "x") kf.x = value;
        else if (type === "y") kf.y = value;
        else { kf.x = value.x; kf.y = value.y; }
        
        ensureSorted(clip);
        
        clip.offsetX = kf.x;
        clip.offsetY = kf.y;

        syncUI();
    };

    const toggleKeyframe = () => {
        const clip = getActiveClip();
        if (!clip) return;
        const frame = getCurrentFrame();
        if (!clip.keyframes) clip.keyframes = [];
        
        const idx = clip.keyframes.findIndex(k => k.frame === frame);
        if (idx > -1) {
            clip.keyframes.splice(idx, 1);
        } else {
            addOrUpdateKeyframe(clip, "both", { x: clip.offsetX, y: clip.offsetY });
        }
        
        ctx.saveState();
        ctx.saveUiState();
        syncUI();
        if (ctx.timeline && ctx.timeline.renderTimeline) ctx.timeline.renderTimeline();
    };

    const clearKeyframes = () => {
        const clip = getActiveClip();
        if (!clip) return;
        if (confirm("Remove all keyframes from this clip?")) {
            clip.keyframes = [];
            ctx.saveState();
            ctx.saveUiState();
            syncUI();
            if (ctx.timeline && ctx.timeline.renderTimeline) ctx.timeline.renderTimeline();
        }
    };

    const jumpToRelativeKeyframe = (direction) => {
        const clip = getActiveClip();
        if (!clip || !clip.keyframes || clip.keyframes.length === 0) return;
        const frame = getCurrentFrame();
        
        let targetFrame = null;
        if (direction === -1) {
            for (let i = clip.keyframes.length - 1; i >= 0; i--) {
                if (clip.keyframes[i].frame < frame) { targetFrame = clip.keyframes[i].frame; break; }
            }
        } else {
            for (let i = 0; i < clip.keyframes.length; i++) {
                if (clip.keyframes[i].frame > frame) { targetFrame = clip.keyframes[i].frame; break; }
            }
        }
        
        if (targetFrame !== null) {
            const targetTime = ctx.frameToTime(targetFrame);
            ctx.player.seekVideo(targetTime);
            if (ctx.timeline) {
                ctx.timeline.updatePlayhead(targetTime);
                ctx.syncWithPlayhead(targetTime);
            }
        }
    };

    const toggleInterpolation = () => {
        const clip = getActiveClip();
        if (!clip) return;
        clip.interpMode = clip.interpMode === "smooth" ? "linear" : "smooth";
        ctx.saveState();
        syncUI();
    };

    const applyInterpolationToUI = () => {
        const clip = getActiveClip();
        if (!clip || !clip.keyframes || clip.keyframes.length === 0) return;

        const frame = getCurrentFrame();
        const pos = getInterpolatedPosition(clip, frame);
        
        clip.offsetX = pos.x;
        clip.offsetY = pos.y;
        
        if (ctx.leftPanel && ctx.leftPanel.updateOffsetSlidersQuietly) {
            ctx.leftPanel.updateOffsetSlidersQuietly(pos.x, pos.y);
        }
        
        if (ctx.player && ctx.player.updateCropOverlay) {
            ctx.player.updateCropOverlay();
        }
        syncUI(); 
    };

    const getButtons = () => {
        ui.prevBtn = document.createElement("button");
        ui.prevBtn.className = "vc-kf-btn";
        ui.prevBtn.innerHTML = Icons.ICON_KF_PREV;
        ui.prevBtn.title = "Previous Keyframe";
        ui.prevBtn.onclick = (e) => { e.stopPropagation(); jumpToRelativeKeyframe(-1); };

        ui.toggleBtn = document.createElement("button");
        ui.toggleBtn.className = "vc-kf-btn";
        ui.toggleBtn.innerHTML = Icons.ICON_KF_EMPTY; 
        ui.toggleBtn.title = "Add/Remove Keyframe at Playhead";
        ui.toggleBtn.onclick = (e) => { e.stopPropagation(); toggleKeyframe(); };

        ui.nextBtn = document.createElement("button");
        ui.nextBtn.className = "vc-kf-btn";
        ui.nextBtn.innerHTML = Icons.ICON_KF_NEXT;
        ui.nextBtn.title = "Next Keyframe";
        ui.nextBtn.onclick = (e) => { e.stopPropagation(); jumpToRelativeKeyframe(1); };

        ui.interpBtn = document.createElement("button");
        ui.interpBtn.className = "vc-kf-btn";
        ui.interpBtn.innerHTML = Icons.ICON_LINEAR;
        ui.interpBtn.title = "Interpolation Mode";
        ui.interpBtn.onclick = (e) => { e.stopPropagation(); toggleInterpolation(); };

        ui.clearBtn = document.createElement("button");
        ui.clearBtn.className = "vc-kf-btn danger";
        ui.clearBtn.innerHTML = Icons.ICON_TRASH;
        ui.clearBtn.title = "Clear All Keyframes";
        ui.clearBtn.onclick = (e) => { e.stopPropagation(); clearKeyframes(); };

        return ui;
    };

    // State trackers to prevent DOM thrashing during playback scrubbing
    let lastToggleState = null;
    let lastInterpMode = null;
    let lastHasKeyframes = null;

    const syncUI = () => {
        if (!ui.toggleBtn) return;
        
        const clip = getActiveClip();
        if (!clip) {
            if (lastHasKeyframes !== false) {
                Object.values(ui).forEach(btn => { if(btn) btn.disabled = true; });
                lastHasKeyframes = false;
            }
            return;
        }

        if (lastHasKeyframes !== true) {
            Object.values(ui).forEach(btn => { if(btn) btn.disabled = false; });
        }

        const frame = getCurrentFrame();
        const hasKeyframes = clip.keyframes && clip.keyframes.length > 0;
        const isAtKeyframe = hasKeyframes && clip.keyframes.some(k => k.frame === frame);
        
        if (lastToggleState !== isAtKeyframe) {
            ui.toggleBtn.innerHTML = isAtKeyframe ? Icons.ICON_KF_FILLED : Icons.ICON_KF_EMPTY;
            ui.toggleBtn.className = isAtKeyframe ? "vc-kf-btn active" : "vc-kf-btn";
            lastToggleState = isAtKeyframe;
        }

        if (lastInterpMode !== clip.interpMode) {
            ui.interpBtn.innerHTML = clip.interpMode === "smooth" ? Icons.ICON_SMOOTH : Icons.ICON_LINEAR;
            ui.interpBtn.title = clip.interpMode === "smooth" ? "Smooth Interpolation (Ease In/Out)" : "Linear Interpolation";
            lastInterpMode = clip.interpMode;
        }

        if (lastHasKeyframes !== hasKeyframes) {
            ui.clearBtn.disabled = !hasKeyframes;
            ui.prevBtn.disabled = !hasKeyframes;
            ui.nextBtn.disabled = !hasKeyframes;
            lastHasKeyframes = hasKeyframes;
        }
    };

    return { getButtons, syncUI, applyInterpolationToUI, addOrUpdateKeyframe, toggleKeyframe };
}