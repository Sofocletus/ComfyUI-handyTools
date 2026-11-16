import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { createPlayer } from "./videoClipper_player.js";
import { createTimeline } from "./videoClipper_timeline.js";
import { createLeftPanel } from "./videoClipper_leftPanel.js";
import { createRightPanel } from "./videoClipper_rightPanel.js";
import { createGallery } from "./videoClipper_gallery.js";
import { createKeyframeManager } from "./videoClipper_keyframes.js";

if (!document.getElementById("vc-styles")) {
    const link = document.createElement("link");
    link.id = "vc-styles";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = new URL("./videoClipper_style.css", import.meta.url).href;
    document.head.appendChild(link);
}

app.registerExtension({
    name: "HandyTools.MinimaxVideoClipper",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "MinimaxVideoClipper") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                try {
                    const RESOLUTIONS = {
                        "16:9": {
                            "0.1": [448, 256], "0.2": [608, 352], "0.3": [736, 416], "0.4": [864, 480], "0.5": [960, 544],
                            "0.6": [1056, 608], "0.7": [1152, 640], "0.8": [1216, 672], "0.9": [1280, 736],
                            "0.98": [1344, 768], "1.0": [1376, 768], "1.2": [1504, 832], "1.5": [1664, 928],
                            "1.8": [1824, 1024], "2.0": [1920, 1088]
                        },
                        "9:16": {
                            "0.1": [256, 448], "0.2": [352, 608], "0.3": [416, 736], "0.4": [480, 864], "0.5": [544, 960],
                            "0.6": [1056, 608], "0.7": [1152, 640], "0.8": [1216, 672], "0.9": [1280, 736],
                            "0.6": [608, 1056], "0.7": [640, 1152], "0.8": [672, 1216], "0.9": [736, 1280],
                            "0.98": [768, 1344], "1.0": [768, 1376], "1.2": [832, 1504], "1.5": [928, 1664],
                            "1.8": [1024, 1824], "2.0": [1088, 1920]
                        },
                        "1:1": {
                            "0.1": [320, 320], "0.2": [448, 448], "0.3": [544, 544], "0.4": [640, 640], "0.5": [704, 704],
                            "0.6": [768, 768], "0.7": [832, 832], "0.8": [896, 896], "0.9": [960, 960],
                            "0.98": [992, 992], "1.0": [1024, 1024], "1.2": [1088, 1088], "1.5": [1216, 1216],
                            "1.8": [1344, 1344], "2.0": [1408, 1408]
                        },
                        "4:3": {
                            "0.1": [384, 288], "0.2": [512, 384], "0.3": [640, 480], "0.4": [736, 544], "0.5": [832, 608],
                            "0.6": [896, 672], "0.7": [960, 736], "0.8": [1024, 768], "0.9": [1088, 832],
                            "0.98": [1152, 864], "1.0": [1152, 864], "1.2": [1280, 960], "1.5": [1408, 1056],
                            "1.8": [1536, 1152], "2.0": [1632, 1216]
                        },
                        "3:4": {
                            "0.1": [288, 384], "0.2": [384, 512], "0.3": [480, 640], "0.4": [544, 736], "0.5": [608, 832],
                            "0.6": [672, 896], "0.7": [736, 960], "0.8": [768, 1024], "0.9": [832, 1088],
                            "0.98": [864, 1152], "1.0": [864, 1152], "1.2": [960, 1280], "1.5": [1056, 1408],
                            "1.8": [1152, 1536], "2.0": [1216, 1632]
                        }
                    };

                    let uiSaveTimeout = null;

                    const thumbCanvas = document.createElement("canvas");
                    thumbCanvas.width = 42;
                    thumbCanvas.height = 24;
                    const thumbCtx = thumbCanvas.getContext("2d");

                    const captureFrameFromVideo = (videoEl) => {
                        try {
                            if (videoEl && videoEl.videoWidth > 0) {
                                thumbCtx.drawImage(videoEl, 0, 0, thumbCanvas.width, thumbCanvas.height);
                                return thumbCanvas.toDataURL("image/jpeg", 0.7);
                            }
                        } catch (e) {
                            console.warn("Capture thumbnail failed", e);
                        }
                        return null;
                    };

                    const ctx = {
                        api,
                        RESOLUTIONS,
                        captureFrameFromVideo, 
                        projectVideoStates: {}, 
                        isNodeFocused: false, 
                        globalState: {
                            recentProjects: [],
                            autoLoadProject: false
                        },
                        state: {
                            currentDir: "",
                            currentFile: "",
                            codec: "",
                            duration: 0,
                            targetFps: 24,
                            srcFps: 24,
                            needsFpsProxy: false,
                            force24Fps: true,
                            isHeavy: false,
                            needsProxyFormat: false,
                            trueWidth: 0,
                            trueHeight: 0,
                            clips: [],
                            selectedClipIndices: [], 
                            zoomLevel: 0,
                            audioPeaks: [],
                            isProxyActive: false,
                            clipboard: null, 
                            appSettings: {
                                hwEncoder: "libx264",
                                proxyThresholdMb: 250,
                                webpFrames: 12,
                                webpThresholdSec: 30,
                                webpSampleFull: true,
                                autoProxy: false,
                                exportEncoder: "h264",
                                exportCrf: 17
                            },
                            currentSettings: {
                                baseName: "Clip",
                                ar: "16:9",
                                mp: "0.5",
                                targetWidth: 960,
                                targetHeight: 544,
                                offsetX: 0.5,
                                offsetY: 0.5,
                                rotation: 0,
                                cropMode: true,
                                actualExportW: 960,
                                actualExportH: 544,
                                includeVideo: true,
                                includeAudio: true
                            }
                        },
                        timeToFrame: (time) => Math.round(time * 24),
                        frameToTime: (frame) => frame / 24,
                        getValidLength: (targetFrames) => {
                            if (targetFrames <= 22) return 22;
                            const k = Math.round((targetFrames - 22) / 17);
                            return 22 + (k * 17);
                        },
                        getDynamicClipId: (targetClip, clipArray = ctx.state.clips) => {
                            const base = targetClip.baseName || (targetClip.id ? targetClip.id.replace(/[0-9]+$/, '') : "Clip");
                            let count = 1;
                            for (let i = 0; i < clipArray.length; i++) {
                                const c = clipArray[i];
                                if (c === targetClip) break;
                                const cBase = c.baseName || (c.id ? c.id.replace(/[0-9]+$/, '') : "Clip");
                                if (cBase === base) count++;
                            }
                            return `${base}${String(count).padStart(3, '0')}`;
                        },
                        getActiveSettings: () => {
                            if (ctx.state.selectedClipIndices.length > 0) {
                                const firstIdx = ctx.state.selectedClipIndices[0];
                                if (ctx.state.clips[firstIdx]) return ctx.state.clips[firstIdx];
                            }
                            return ctx.state.currentSettings;
                        },
                        computeExportResolution: (cfg) => {
                            if (!cfg.actualExportW) cfg.actualExportW = cfg.targetWidth || 960;
                            if (!cfg.actualExportH) cfg.actualExportH = cfg.targetHeight || 544;
                            cfg.actualExportW = Math.max(32, Math.round(cfg.actualExportW / 32) * 32);
                            cfg.actualExportH = Math.max(32, Math.round(cfg.actualExportH / 32) * 32);
                        },
                        copyClipSettings: () => {
                            const cfg = ctx.getActiveSettings();
                            ctx.state.clipboard = {
                                ar: cfg.ar,
                                mp: cfg.mp,
                                targetWidth: cfg.targetWidth,
                                targetHeight: cfg.targetHeight,
                                rotation: cfg.rotation || 0,
                                cropMode: cfg.cropMode,
                                actualExportW: cfg.actualExportW,
                                actualExportH: cfg.actualExportH,
                                includeVideo: cfg.includeVideo,
                                includeAudio: cfg.includeAudio
                            };
                            
                            if (!cfg.keyframes || cfg.keyframes.length === 0) {
                                ctx.state.clipboard.offsetX = cfg.offsetX !== undefined ? cfg.offsetX : 0.5;
                                ctx.state.clipboard.offsetY = cfg.offsetY !== undefined ? cfg.offsetY : 0.5;
                            }
                            return true;
                        },
                        pasteClipSettings: () => {
                            if (!ctx.state.clipboard) return false;
                            
                            if (ctx.state.selectedClipIndices.length > 0) {
                                ctx.state.selectedClipIndices.forEach(idx => {
                                    if (ctx.state.clips[idx]) {
                                        Object.assign(ctx.state.clips[idx], ctx.state.clipboard);
                                    }
                                });
                            } else {
                                Object.assign(ctx.state.currentSettings, ctx.state.clipboard);
                            }
                            
                            ctx.leftPanel.syncControlsFromSettings(ctx.getActiveSettings());
                            if (ctx.player && ctx.player.updateCropOverlay) ctx.player.updateCropOverlay();
                            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                            ctx.saveState();
                            ctx.saveUiState();
                            return true;
                        },
                        applyToAllClips: () => {
                            if (!ctx.state.clips || ctx.state.clips.length === 0) return false;
                            const src = ctx.getActiveSettings();
                            
                            const propsToCopy = ['ar', 'mp', 'targetWidth', 'targetHeight', 'rotation', 'cropMode', 'actualExportW', 'actualExportH', 'includeVideo', 'includeAudio'];
                            
                            if (!src.keyframes || src.keyframes.length === 0) {
                                propsToCopy.push('offsetX', 'offsetY');
                            }
                            
                            let changed = false;
                            ctx.state.clips.forEach(clip => {
                                if (clip !== src) {
                                    propsToCopy.forEach(prop => {
                                        clip[prop] = src[prop];
                                    });
                                    changed = true;
                                }
                            });
                            
                            if (changed) {
                                ctx.saveState();
                                ctx.saveUiState();
                            }
                            return true;
                        },
                        isInteracting: () => ctx.timeline && ctx.timeline.isInteracting(),
                        syncWithPlayhead: (targetTime) => {
                            if (!ctx.state.duration || ctx.state.clips.length === 0) {
                                if (ctx.player && ctx.player.setDelClipBtnDisabled) {
                                    ctx.player.setDelClipBtnDisabled(true);
                                }
                                return;
                            }
                            const frame = ctx.timeToFrame(targetTime);

                            let idx = ctx.state.clips.findIndex(c => frame >= c.startFrame && frame < c.endFrame);
                            if (idx === -1) {
                                idx = ctx.state.clips.findIndex(c => frame >= c.startFrame && frame <= c.endFrame);
                            }

                            if (idx !== -1) {
                                if (!ctx.state.selectedClipIndices.includes(idx)) {
                                    ctx.state.selectedClipIndices = [idx];
                                    ctx.leftPanel.syncControlsFromSettings(ctx.state.clips[idx]);
                                    ctx.timeline.renderTimeline();
                                    if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                                } else {
                                    ctx.player.updateCropOverlay();
                                }
                            } else {
                                if (ctx.state.selectedClipIndices.length > 0) {
                                    ctx.state.selectedClipIndices = [];
                                    ctx.leftPanel.syncControlsFromSettings(ctx.state.currentSettings);
                                    ctx.timeline.renderTimeline();
                                    if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                                } else {
                                    ctx.player.updateCropOverlay();
                                }
                            }
                            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                            
                            if (ctx.keyframeManager) {
                                ctx.keyframeManager.syncUI();
                                ctx.keyframeManager.applyInterpolationToUI();
                            }
                        },
                        queueClipThumbnail: (clip, imgEl) => {
                            if (clip._isFetchingThumb) return;
                            clip._isFetchingThumb = true;
                            const time = ctx.frameToTime(clip.startFrame);
                            const useProxy = ctx.state.isProxyActive ? "true" : "false";
                            const url = api.apiURL(`/video_clipper/clip_thumb?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(ctx.state.currentFile)}&time=${time}&proxy=${useProxy}`);
                            
                            imgEl.onload = () => {
                                clip.thumbData = url; 
                                clip._isFetchingThumb = false;
                            };
                            imgEl.onerror = () => { clip._isFetchingThumb = false; };
                            imgEl.src = url;
                        },

                        selectVideo: async (filename, targetTime = null) => {
                            if (ctx.state.currentFile && ctx.projectVideoStates) {
                                ctx.projectVideoStates[ctx.state.currentFile] = { ...ctx.state.currentSettings };
                            }

                            if (ctx.state.currentFile && ctx.state.currentFile !== filename) {
                                await ctx.saveState();
                            }
                            
                            ctx.state.currentFile = filename;
                            if (ctx.gallery && ctx.gallery.render) ctx.gallery.render();

                            if (ctx.projectVideoStates && ctx.projectVideoStates[filename]) {
                                ctx.state.currentSettings = { ...ctx.state.currentSettings, ...ctx.projectVideoStates[filename] };
                            } else {
                                ctx.state.currentSettings.rotation = 0; 
                            }

                            let hasProxy = false;
                            try {
                                const infoRes = await ctx.api.fetchApi(`/video_clipper/file_info?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(ctx.state.currentFile)}`);
                                const info = await infoRes.json();
                                hasProxy = !!info.hasProxy;
                                ctx.state.isHeavy = !!info.isHeavy;
                                
                                const srcFps = info.fps || 24.0;
                                ctx.state.srcFps = srcFps;
                                
                                const isNear24 = Math.abs(srcFps - 24.0) < 0.05 || Math.abs(srcFps - 23.976) < 0.05 || Math.abs(srcFps - 25.0) < 0.05;
                                ctx.state.needsFpsProxy = !isNear24;
                                
                                let needsProxy = !!info.needsProxyFormat;
                                const codecName = (info.codec || "").toLowerCase();
                                
                                if (!needsProxy && (codecName.includes("hevc") || codecName.includes("h265") || codecName.includes("hvc1") || codecName.includes("hev1"))) {
                                    if (navigator.userAgent.toLowerCase().includes("firefox")) {
                                        needsProxy = true;
                                    }
                                }

                                ctx.state.needsProxyFormat = needsProxy || ctx.state.needsFpsProxy;
                                ctx.state.trueWidth = info.width || 0;
                                ctx.state.trueHeight = info.height || 0;
                                ctx.state.codec = info.codec || "unknown";
                            } catch (e) {
                                ctx.state.isHeavy = false;
                                ctx.state.needsProxyFormat = false;
                                ctx.state.needsFpsProxy = false;
                                ctx.state.srcFps = 24.0;
                                ctx.state.trueWidth = 0;
                                ctx.state.trueHeight = 0;
                                ctx.state.codec = "unknown";
                            }

                            ctx.leftPanel.setProxyBtnState(hasProxy);
                            await ctx.loadState(ctx.state.currentFile);

                            let seekTime = targetTime;
                            if (seekTime === null || seekTime === undefined) {
                                if (ctx.state.selectedClipIndices.length > 0) {
                                    const firstIdx = ctx.state.selectedClipIndices[0];
                                    if (ctx.state.clips[firstIdx]) seekTime = ctx.frameToTime(ctx.state.clips[firstIdx].startFrame);
                                    else seekTime = 0;
                                } else {
                                    seekTime = 0;
                                }
                            }

                            ctx.player.setVideoSource(hasProxy, seekTime, false);

                            if (hasProxy || !ctx.state.isHeavy) {
                                ctx.loadAudioPeaks(ctx.state.currentFile, hasProxy);
                            } else {
                                ctx.state.audioPeaks = [];
                                ctx.timeline.drawWaveform();
                            }

                            ctx.saveUiState();
                        },
                        addClip: () => {
                            if (!ctx.state.duration) return;
                            let startFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                            const validLength = ctx.getValidLength(243);
                            let endFrame = startFrame + validLength;
                            const totalFrames = ctx.timeToFrame(ctx.state.duration);

                            if (endFrame > totalFrames) {
                                endFrame = totalFrames;
                                startFrame = Math.max(0, endFrame - ctx.getValidLength(endFrame - startFrame));
                            }

                            const thumb = captureFrameFromVideo(ctx.player.video);

                            const newClip = {
                                id: `Clip${Date.now()}`,
                                baseName: ctx.state.currentSettings.baseName || "Clip",
                                startFrame,
                                endFrame,
                                ar: ctx.state.currentSettings.ar,
                                mp: ctx.state.currentSettings.mp,
                                targetWidth: ctx.state.currentSettings.targetWidth,
                                targetHeight: ctx.state.currentSettings.targetHeight,
                                offsetX: ctx.state.currentSettings.offsetX,
                                offsetY: ctx.state.currentSettings.offsetY,
                                rotation: ctx.state.currentSettings.rotation || 0,
                                cropMode: ctx.state.currentSettings.cropMode !== false,
                                actualExportW: ctx.state.currentSettings.actualExportW || ctx.state.currentSettings.targetWidth,
                                actualExportH: ctx.state.currentSettings.actualExportH || ctx.state.currentSettings.targetHeight,
                                includeVideo: ctx.state.currentSettings.includeVideo !== false,
                                includeAudio: ctx.state.currentSettings.includeAudio !== false,
                                selectedForExport: true,
                                thumbData: thumb,
                                _isFetchingThumb: false,
                                keyframes: [],
                                interpMode: "linear"
                            };

                            ctx.state.clips.push(newClip);
                            ctx.state.selectedClipIndices = [ctx.state.clips.length - 1]; 
                            ctx.leftPanel.syncControlsFromSettings(newClip);
                            ctx.timeline.renderTimeline();
                            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                            ctx.saveState();
                            ctx.saveUiState();
                        },
                        deleteSelectedClip: () => {
                            if (ctx.state.selectedClipIndices.length > 0) {
                                const sortedIndices = [...ctx.state.selectedClipIndices].sort((a, b) => b - a);
                                sortedIndices.forEach(idx => {
                                    if (ctx.state.clips[idx]) ctx.state.clips.splice(idx, 1);
                                });
                                
                                if (ctx.state.clips.length > 0) {
                                    ctx.state.selectedClipIndices = [ctx.state.clips.length - 1];
                                    ctx.leftPanel.syncControlsFromSettings(ctx.state.clips[ctx.state.selectedClipIndices[0]]);
                                } else {
                                    ctx.state.selectedClipIndices = [];
                                    ctx.leftPanel.syncControlsFromSettings(ctx.state.currentSettings);
                                }

                                ctx.timeline.renderTimeline();
                                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                                ctx.player.updateCropOverlay();
                                if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                                ctx.saveState();
                                ctx.saveUiState();
                            }
                        },
                        loadAudioPeaks: async (filename, useProxy = false) => {
                            ctx.state.audioPeaks = [];
                            ctx.timeline.drawWaveform();
                            try {
                                const res = await api.fetchApi(`/video_clipper/audio_peaks?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(filename)}&proxy=${useProxy ? "true" : "false"}&points=1200`);
                                const data = await res.json();
                                if (data.peaks) {
                                    ctx.state.audioPeaks = data.peaks;
                                    ctx.timeline.drawWaveform();
                                }
                            } catch (err) {
                                ctx.state.audioPeaks = [];
                                ctx.timeline.drawWaveform();
                            }
                        },
                        checkProxyStatus: async (filename, targetTime = 0) => {
                            try {
                                const res = await api.fetchApi(`/video_clipper/check_proxy?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(filename)}`);
                                const data = await res.json();
                                ctx.leftPanel.setProxyBtnState(data.exists);
                                ctx.player.setVideoSource(data.exists, targetTime);
                            } catch (err) {
                                ctx.leftPanel.setProxyBtnState(false);
                            }
                        },
                        saveGlobalState: async () => {
                            try {
                                await api.fetchApi("/video_clipper/save_global_state", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        recentProjects: ctx.globalState.recentProjects,
                                        autoLoadProject: ctx.globalState.autoLoadProject,
                                        appSettings: ctx.state.appSettings
                                    })
                                });
                            } catch (e) {
                                console.warn("Save global state failed.");
                            }
                        },
                        loadGlobalState: async () => {
                            try {
                                const res = await api.fetchApi("/video_clipper/load_global_state");
                                const data = await res.json();
                                if (data.status === "success" && data.state) {
                                    const st = data.state;
                                    if (st.recentProjects) ctx.globalState.recentProjects = st.recentProjects;
                                    if (st.autoLoadProject !== undefined) ctx.globalState.autoLoadProject = st.autoLoadProject;
                                    if (st.appSettings) {
                                        ctx.state.appSettings = { ...ctx.state.appSettings, ...st.appSettings };
                                        if (ctx.player && ctx.player.syncSettingsToForm) {
                                            ctx.player.syncSettingsToForm(ctx.state.appSettings);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn("Load global state failed.");
                            }
                        },

                        loadProject: async (dir) => {
                            if (!dir) return;
                            
                            let recents = ctx.globalState.recentProjects || [];
                            recents = recents.filter(p => p !== dir);
                            recents.unshift(dir);
                            if (recents.length > 8) recents.pop();
                            ctx.globalState.recentProjects = recents;
                            ctx.saveGlobalState();
                            
                            if (ctx.leftPanel && ctx.leftPanel.updateRecentProjects) {
                                ctx.leftPanel.updateRecentProjects(recents);
                            }

                            try {
                                const res = await api.fetchApi(`/video_clipper/load_project_state?dir=${encodeURIComponent(dir)}`);
                                const data = await res.json();
                                
                                let targetFile = null;
                                let targetTime = null;

                                ctx.projectVideoStates = {};

                                if (data.status === "success" && data.state) {
                                    const st = data.state;
                                    
                                    if (st.videoStates) {
                                        ctx.projectVideoStates = st.videoStates;
                                    }
                                    if (st.currentSettings) {
                                        ctx.state.currentSettings = { ...ctx.state.currentSettings, ...st.currentSettings };
                                    }
                                    if (st.force24Fps !== undefined) {
                                        ctx.state.force24Fps = st.force24Fps;
                                        if (ctx.leftPanel && ctx.leftPanel.setForce24Fps) ctx.leftPanel.setForce24Fps(st.force24Fps);
                                    }
                                    if (st.zoomLevel !== undefined) {
                                        ctx.state.zoomLevel = st.zoomLevel;
                                        if (ctx.player && ctx.player.setZoomSlider) ctx.player.setZoomSlider(st.zoomLevel);
                                    }
                                    if (st.exportOptions && ctx.rightPanel) {
                                        ctx.rightPanel.setExportOptions(st.exportOptions);
                                    }
                                    targetFile = st.filename || null;
                                    targetTime = st.currentTime || null;
                                }

                                const listRes = await api.fetchApi(`/video_clipper/video_list?dir=${encodeURIComponent(dir)}`);
                                const listData = await listRes.json();
                                const actualVideos = listData.videos || [];

                                let stateChanged = false;

                                Object.keys(ctx.projectVideoStates).forEach(vid => {
                                    if (!actualVideos.includes(vid)) {
                                        delete ctx.projectVideoStates[vid];
                                        stateChanged = true;
                                    }
                                });

                                actualVideos.forEach(vid => {
                                    if (!ctx.projectVideoStates[vid]) {
                                        ctx.projectVideoStates[vid] = { rotation: 0 };
                                        stateChanged = true;
                                    }
                                });

                                if (stateChanged && dir) {
                                    const payload = data.state || {};
                                    payload.videoStates = ctx.projectVideoStates;
                                    payload.directory = dir;
                                    await api.fetchApi("/video_clipper/save_project_state", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload)
                                    }).catch(() => {});
                                }

                                await ctx.gallery.loadFolderVideos(dir, targetFile, targetTime);
                            } catch (err) {
                                console.warn("Project state load failed, opening folder fresh.", err);
                                await ctx.gallery.loadFolderVideos(dir);
                            }
                        },

                        saveUiState: () => {
                            if (uiSaveTimeout) clearTimeout(uiSaveTimeout);
                            uiSaveTimeout = setTimeout(async () => {
                                if (!ctx.state.currentDir) return;

                                if (ctx.state.currentFile) {
                                    if (!ctx.projectVideoStates) ctx.projectVideoStates = {};
                                    ctx.projectVideoStates[ctx.state.currentFile] = { ...ctx.state.currentSettings };
                                }

                                const exportOpts = ctx.rightPanel ? ctx.rightPanel.getExportOptions() : {};
                                const payload = {
                                    directory: ctx.state.currentDir,
                                    filename: ctx.state.currentFile,
                                    currentTime: ctx.player && ctx.player.video ? ctx.player.video.currentTime : 0,
                                    zoomLevel: ctx.state.zoomLevel,
                                    currentSettings: ctx.state.currentSettings,
                                    videoStates: ctx.projectVideoStates || {},
                                    force24Fps: ctx.state.force24Fps !== false,
                                    exportOptions: exportOpts
                                };
                                try {
                                    await api.fetchApi("/video_clipper/save_project_state", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload)
                                    });
                                } catch (e) {
                                    console.warn("Save project state failed.");
                                }
                            }, 250);
                        },

                        saveState: async () => {
                            if (!ctx.state.currentFile) return;
                            try {
                                const hasClips = ctx.state.clips && ctx.state.clips.length > 0;
                                await api.fetchApi("/video_clipper/save_state", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        directory: ctx.state.currentDir,
                                        filename: ctx.state.currentFile,
                                        selectedClipIndex: ctx.state.selectedClipIndices.length > 0 ? ctx.state.selectedClipIndices[0] : -1,
                                        selectedClipIndices: ctx.state.selectedClipIndices,
                                        clips: ctx.state.clips.map(c => ({
                                            id: c.id,
                                            baseName: c.baseName || "Clip", 
                                            startFrame: c.startFrame,
                                            endFrame: c.endFrame,
                                            ar: c.ar,
                                            mp: c.mp,
                                            targetWidth: c.targetWidth,
                                            targetHeight: c.targetHeight,
                                            offsetX: c.offsetX,
                                            offsetY: c.offsetY,
                                            rotation: c.rotation || 0, 
                                            cropMode: c.cropMode !== false,
                                            actualExportW: c.actualExportW || c.targetWidth,
                                            actualExportH: c.actualExportH || c.targetHeight,
                                            includeVideo: c.includeVideo !== false,
                                            includeAudio: c.includeAudio !== false,
                                            selectedForExport: c.selectedForExport !== false,
                                            keyframes: c.keyframes || [],
                                            interpMode: c.interpMode || "linear"
                                        }))
                                    })
                                });
                                if (ctx.gallery && ctx.gallery.setFileHasState) {
                                    ctx.gallery.setFileHasState(ctx.state.currentFile, hasClips);
                                }
                            } catch (e) {
                                console.warn("Save state failed.");
                            }
                        },
                        loadState: async (filename) => {
                            try {
                                const res = await api.fetchApi(`/video_clipper/load_state?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(filename)}`);
                                const data = await res.json();
                                if (data.status === "success" && data.clips && data.clips.length > 0) {
                                    ctx.state.clips = data.clips.map(c => ({
                                        ...c,
                                        baseName: c.baseName || (c.id ? c.id.replace(/[0-9]+$/, '') : "Clip"),
                                        ar: c.ar || "16:9",
                                        mp: c.mp || "0.5",
                                        targetWidth: c.targetWidth || 960,
                                        targetHeight: c.targetHeight || 544,
                                        offsetX: c.offsetX !== undefined ? c.offsetX : 0.5,
                                        offsetY: c.offsetY !== undefined ? c.offsetY : 0.5,
                                        rotation: c.rotation || 0,
                                        cropMode: c.cropMode !== false,
                                        actualExportW: c.actualExportW || c.targetWidth || 960,
                                        actualExportH: c.actualExportH || c.targetHeight || 544,
                                        includeVideo: c.includeVideo !== false,
                                        includeAudio: c.includeAudio !== false,
                                        selectedForExport: c.selectedForExport !== false,
                                        thumbData: null,
                                        _isFetchingThumb: false,
                                        keyframes: c.keyframes || [],
                                        interpMode: c.interpMode || "linear"
                                    }));
                                    
                                    if (data.selectedClipIndices) {
                                        ctx.state.selectedClipIndices = data.selectedClipIndices;
                                    } else if (data.selectedClipIndex !== undefined && data.selectedClipIndex >= 0) {
                                        ctx.state.selectedClipIndices = [data.selectedClipIndex];
                                    } else {
                                        ctx.state.selectedClipIndices = [];
                                    }
                                    
                                    ctx.leftPanel.syncControlsFromSettings(ctx.getActiveSettings());
                                } else {
                                    ctx.state.clips = [];
                                    ctx.state.selectedClipIndices = [];
                                    ctx.leftPanel.syncControlsFromSettings(ctx.state.currentSettings);
                                }
                            } catch (e) {
                                ctx.state.clips = [];
                                ctx.state.selectedClipIndices = [];
                                ctx.leftPanel.syncControlsFromSettings(ctx.state.currentSettings);
                            }
                            ctx.timeline.renderTimeline();
                            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                            if (ctx.gallery && ctx.gallery.setFileHasState) {
                                ctx.gallery.setFileHasState(filename, ctx.state.clips.length > 0);
                            }
                        }
                    };

                    ctx.keyframeManager = createKeyframeManager(ctx);

                    ctx.player = createPlayer(ctx);
                    ctx.timeline = createTimeline(ctx);
                    ctx.leftPanel = createLeftPanel(ctx);
                    ctx.rightPanel = createRightPanel(ctx);
                    ctx.gallery = createGallery(ctx);

                    ctx.panels = { ...ctx.leftPanel, ...ctx.rightPanel };

                    const container = document.createElement("div");
                    container.className = "vc-container";
                    
                    container.addEventListener("mouseenter", () => { ctx.isNodeFocused = true; });
                    container.addEventListener("mouseleave", () => { ctx.isNodeFocused = false; });

                    const topLayout = document.createElement("div");
                    topLayout.className = "vc-top-layout";
                    topLayout.appendChild(ctx.leftPanel.element);
                    topLayout.appendChild(ctx.player.element);
                    topLayout.appendChild(ctx.rightPanel.element);

                    container.appendChild(topLayout);
                    container.appendChild(ctx.timeline.element);
                    container.appendChild(ctx.gallery.element);

                    const handleKeyDown = (e) => {
                        if (!container.isConnected || !ctx.isNodeFocused) return;
                        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) {
                            return;
                        }

                        // Space: Play/Pause
                        if (e.code === "Space" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration) return;
                            if (ctx.player.video.paused) {
                                ctx.player.video.play();
                            } else {
                                ctx.player.video.pause();
                                ctx.saveUiState();
                            }
                            return;
                        }
                        
                        // K: Toggle Keyframe
                        if ((e.key === "k" || e.key === "K") && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.repeat) return;
                            
                            if (ctx.keyframeManager && ctx.state.selectedClipIndices.length > 0) {
                                if (ctx.keyframeManager.toggleKeyframe) {
                                    ctx.keyframeManager.toggleKeyframe();
                                } else {
                                    const kfBtns = ctx.keyframeManager.getButtons();
                                    if (kfBtns && kfBtns.toggleBtn) {
                                        kfBtns.toggleBtn.click();
                                        setTimeout(() => {
                                            if (document.activeElement === kfBtns.toggleBtn) kfBtns.toggleBtn.blur();
                                        }, 10);
                                    }
                                }
                            }
                            return;
                        }

                        // Ctrl+C: Copy Settings
                        if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            ctx.copyClipSettings();
                            return;
                        }

                        // Ctrl+V: Paste Settings
                        if ((e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            ctx.pasteClipSettings();
                            return;
                        }

                        // Ctrl+A: Select All Clips
                        if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.state.clips.length > 0) {
                                ctx.state.selectedClipIndices = ctx.state.clips.map((_, i) => i);
                                ctx.timeline.renderTimeline();
                                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                                if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                                ctx.saveUiState();
                            }
                            return;
                        }

                        // W/A/S/D FOR BOTH PANNING (OFFSET) AND SIZING
                        if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            if (e.shiftKey) {
                                if (ctx.leftPanel && ctx.leftPanel.nudgeSize) {
                                    let dw = 0;
                                    let dh = 0;
                                    if (e.code === "KeyW") dh = 32; 
                                    if (e.code === "KeyS") dh = -32; 
                                    if (e.code === "KeyA") dw = -32; 
                                    if (e.code === "KeyD") dw = 32;  
                                    ctx.leftPanel.nudgeSize(dw, dh);
                                }
                            } else {
                                if (ctx.leftPanel && ctx.leftPanel.nudgeOffset) {
                                    let dx = 0;
                                    let dy = 0;
                                    if (e.code === "KeyW") dy = -1;
                                    if (e.code === "KeyS") dy = 1; 
                                    if (e.code === "KeyA") dx = -1;
                                    if (e.code === "KeyD") dx = 1; 
                                    
                                    ctx.leftPanel.nudgeOffset(dx, dy);
                                }
                            }
                            return;
                        }

                        // ==========================================
                        // SHIFT + LEFT/RIGHT: Milestone Jumping (Start/End of Clips)
                        // ==========================================
                        if (e.key === "ArrowLeft" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration || ctx.state.clips.length === 0) return;
                            ctx.player.video.pause();

                            const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                            const milestones = [...new Set(ctx.state.clips.flatMap(c => [c.startFrame, c.endFrame]))].sort((a, b) => a - b);

                            let targetFrame = milestones[0];
                            for (let i = milestones.length - 1; i >= 0; i--) {
                                if (milestones[i] < currentFrame - 1) {
                                    targetFrame = milestones[i];
                                    break;
                                }
                            }

                            const targetTime = ctx.frameToTime(targetFrame);
                            ctx.player.seekVideo(targetTime);
                            ctx.timeline.updatePlayhead(targetTime);
                            ctx.syncWithPlayhead(targetTime);
                            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                            ctx.saveUiState();
                            return;
                        }

                        if (e.key === "ArrowRight" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration || ctx.state.clips.length === 0) return;
                            ctx.player.video.pause();

                            const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                            const milestones = [...new Set(ctx.state.clips.flatMap(c => [c.startFrame, c.endFrame]))].sort((a, b) => a - b);

                            let targetFrame = milestones[milestones.length - 1];
                            for (let i = 0; i < milestones.length; i++) {
                                if (milestones[i] > currentFrame + 1) {
                                    targetFrame = milestones[i];
                                    break;
                                }
                            }

                            const targetTime = ctx.frameToTime(targetFrame);
                            ctx.player.seekVideo(targetTime);
                            ctx.timeline.updatePlayhead(targetTime);
                            ctx.syncWithPlayhead(targetTime);
                            if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                            ctx.saveUiState();
                            return;
                        }

                        // ==========================================
                        // CTRL + SHIFT + LEFT/RIGHT: Multi-Select Expansion & Retraction
                        // ==========================================
                        if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.state.clips.length === 0) return;

                            const sortedClips = ctx.state.clips.map((c, idx) => ({ ...c, originalIdx: idx })).sort((a, b) => a.startFrame - b.startFrame);
                            const getSortedPos = (origIdx) => sortedClips.findIndex(c => c.originalIdx === origIdx);

                            if (ctx.state.selectedClipIndices.length === 0) {
                                ctx.state.selectedClipIndices = [sortedClips[0].originalIdx];
                            } else {
                                const anchorIdx = ctx.state.selectedClipIndices[0];
                                const activeIdx = ctx.state.selectedClipIndices[ctx.state.selectedClipIndices.length - 1];
                                const anchorPos = getSortedPos(anchorIdx);
                                const activePos = getSortedPos(activeIdx);

                                if (activePos > anchorPos) {
                                    ctx.state.selectedClipIndices.pop();
                                } else {
                                    if (activePos > 0) {
                                        const nextToAdd = sortedClips[activePos - 1].originalIdx;
                                        if (!ctx.state.selectedClipIndices.includes(nextToAdd)) {
                                            ctx.state.selectedClipIndices.push(nextToAdd);
                                        }
                                    }
                                }
                            }

                            if (ctx.timeline && ctx.timeline.renderTimeline) ctx.timeline.renderTimeline();
                            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                            ctx.saveState();
                            ctx.saveUiState();
                            return;
                        }

                        if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.state.clips.length === 0) return;

                            const sortedClips = ctx.state.clips.map((c, idx) => ({ ...c, originalIdx: idx })).sort((a, b) => a.startFrame - b.startFrame);
                            const getSortedPos = (origIdx) => sortedClips.findIndex(c => c.originalIdx === origIdx);

                            if (ctx.state.selectedClipIndices.length === 0) {
                                ctx.state.selectedClipIndices = [sortedClips[0].originalIdx];
                            } else {
                                const anchorIdx = ctx.state.selectedClipIndices[0];
                                const activeIdx = ctx.state.selectedClipIndices[ctx.state.selectedClipIndices.length - 1];
                                const anchorPos = getSortedPos(anchorIdx);
                                const activePos = getSortedPos(activeIdx);

                                if (activePos < anchorPos) {
                                    ctx.state.selectedClipIndices.pop();
                                } else {
                                    if (activePos < sortedClips.length - 1) {
                                        const nextToAdd = sortedClips[activePos + 1].originalIdx;
                                        if (!ctx.state.selectedClipIndices.includes(nextToAdd)) {
                                            ctx.state.selectedClipIndices.push(nextToAdd);
                                        }
                                    }
                                }
                            }

                            if (ctx.timeline && ctx.timeline.renderTimeline) ctx.timeline.renderTimeline();
                            if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                            ctx.saveState();
                            ctx.saveUiState();
                            return;
                        }

                        // Ctrl+Left: Shift clip backward
                        if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.state.selectedClipIndices.length > 0) {
                                let moved = false;
                                ctx.state.selectedClipIndices.forEach(idx => {
                                    const clip = ctx.state.clips[idx];
                                    if (clip && clip.startFrame > 0) {
                                        clip.startFrame -= 1;
                                        clip.endFrame -= 1;
                                        if (clip.keyframes) clip.keyframes.forEach(k => k.frame -= 1);
                                        moved = true;
                                    }
                                });

                                if (moved) {
                                    const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                                    const targetFrame = Math.max(0, currentFrame - 1);
                                    const targetTime = ctx.frameToTime(targetFrame);

                                    ctx.player.seekVideo(targetTime);
                                    ctx.timeline.updatePlayhead(targetTime);
                                    ctx.timeline.renderTimeline();

                                    const primaryClip = ctx.state.clips[ctx.state.selectedClipIndices[0]];
                                    if (primaryClip && targetFrame === primaryClip.startFrame) {
                                        setTimeout(() => {
                                            if (ctx.player && ctx.player.video) {
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

                                    if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                                    ctx.saveState();
                                    ctx.saveUiState();
                                }
                            }
                            return;
                        }

                        // Ctrl+Right: Shift clip forward
                        if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration) return;
                            const totalFrames = ctx.timeToFrame(ctx.state.duration);
                            if (ctx.state.selectedClipIndices.length > 0) {
                                let moved = false;
                                ctx.state.selectedClipIndices.forEach(idx => {
                                    const clip = ctx.state.clips[idx];
                                    if (clip && clip.endFrame < totalFrames) {
                                        clip.startFrame += 1;
                                        clip.endFrame += 1;
                                        if (clip.keyframes) clip.keyframes.forEach(k => k.frame += 1);
                                        moved = true;
                                    }
                                });

                                if (moved) {
                                    const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                                    const targetFrame = Math.min(totalFrames, currentFrame + 1);
                                    const targetTime = ctx.frameToTime(targetFrame);

                                    ctx.player.seekVideo(targetTime);
                                    ctx.timeline.updatePlayhead(targetTime);
                                    ctx.timeline.renderTimeline();

                                    const primaryClip = ctx.state.clips[ctx.state.selectedClipIndices[0]];
                                    if (primaryClip && targetFrame === primaryClip.startFrame) {
                                        setTimeout(() => {
                                            if (ctx.player && ctx.player.video) {
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

                                    if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                                    ctx.saveState();
                                    ctx.saveUiState();
                                }
                            }
                            return;
                        }

                        // Left Arrow: Step backward 1 frame
                        if (e.key === "ArrowLeft" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration) return;
                            ctx.player.video.pause();
                            const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                            const targetFrame = Math.max(0, currentFrame - 1);
                            const targetTime = ctx.frameToTime(targetFrame);
                            ctx.player.seekVideo(targetTime);
                            ctx.timeline.updatePlayhead(targetTime);
                            ctx.syncWithPlayhead(targetTime);
                            return;
                        }

                        // Right Arrow: Step forward 1 frame
                        if (e.key === "ArrowRight" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration) return;
                            ctx.player.video.pause();
                            const totalFrames = ctx.timeToFrame(ctx.state.duration);
                            const currentFrame = ctx.timeToFrame(ctx.player.video.currentTime);
                            const targetFrame = Math.min(totalFrames, currentFrame + 1);
                            const targetTime = ctx.frameToTime(targetFrame);
                            ctx.player.seekVideo(targetTime);
                            ctx.timeline.updatePlayhead(targetTime);
                            ctx.syncWithPlayhead(targetTime);
                            return;
                        }

                        // Up Arrow: Increase length
                        if (e.key === "ArrowUp") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!ctx.state.duration) return;
                            const totalFrames = ctx.timeToFrame(ctx.state.duration);
                            if (ctx.state.selectedClipIndices.length > 0) {
                                ctx.state.selectedClipIndices.forEach(idx => {
                                    const clip = ctx.state.clips[idx];
                                    if (clip) {
                                        const curLen = clip.endFrame - clip.startFrame;
                                        let newLen = curLen < 22 ? 22 : 22 + (Math.floor((curLen - 22) / 17) + 1) * 17;
                                        clip.endFrame = Math.min(totalFrames, clip.startFrame + newLen);
                                    }
                                });
                                ctx.timeline.renderTimeline();
                                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                                if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                                ctx.saveState();
                                ctx.saveUiState();
                            }
                            return;
                        }

                        // Down Arrow: Decrease length
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.state.selectedClipIndices.length > 0) {
                                ctx.state.selectedClipIndices.forEach(idx => {
                                    const clip = ctx.state.clips[idx];
                                    if (clip) {
                                        const curLen = clip.endFrame - clip.startFrame;
                                        if (curLen > 22) {
                                            const k = Math.ceil((curLen - 22) / 17) - 1;
                                            clip.endFrame = clip.startFrame + (22 + Math.max(0, k) * 17);
                                        }
                                    }
                                });
                                ctx.timeline.renderTimeline();
                                if (ctx.rightPanel && ctx.rightPanel.renderClipList) ctx.rightPanel.renderClipList();
                                if (ctx.player && ctx.player.updateTopInfoBar) ctx.player.updateTopInfoBar();
                                ctx.saveState();
                                ctx.saveUiState();
                            }
                            return;
                        }
                        
                        // +/-: Timeline Zoom
                        if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd" || e.code === "Equal" || e.key === "-" || e.key === "_" || e.code === "Minus" || e.code === "NumpadSubtract") {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const isIncrease = (e.key === "+" || e.key === "=" || e.code === "NumpadAdd" || e.code === "Equal");
                            let newZoom = ctx.state.zoomLevel + (isIncrease ? 5 : -5);
                            newZoom = Math.max(0, Math.min(50, newZoom));
                            
                            ctx.state.zoomLevel = newZoom;
                            if (ctx.player && ctx.player.setZoomSlider) {
                                ctx.player.setZoomSlider(newZoom);
                            }
                            ctx.timeline.updateTimelineZoom();
                            ctx.saveUiState();
                            return;
                        }

                        // Delete/Backspace: Delete Clip
                        if (e.key === "Delete" || e.key === "Backspace") {
                            e.preventDefault();
                            e.stopPropagation();
                            ctx.deleteSelectedClip();
                            return;
                        }

                        // C: Create Clip
                        if ((e.key === "c" || e.key === "C" || e.code === "KeyC") && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.repeat) return; 
                            ctx.addClip();
                            return;
                        }

                        // Page Down: Next Video
                        if (e.key === "PageDown") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.gallery && ctx.gallery.selectNextVideo) {
                                ctx.gallery.selectNextVideo();
                            }
                            return;
                        }

                        // Page Up: Prev Video
                        if (e.key === "PageUp") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (ctx.gallery && ctx.gallery.selectPrevVideo) {
                                ctx.gallery.selectPrevVideo();
                            }
                            return;
                        }
                    };

                    window.addEventListener("keydown", handleKeyDown, true);

                    const domWidget = node.addDOMWidget("VideoClipperUI", "DOM", container);

                    if (node.widgets) {
                        const dummyIndex = node.widgets.findIndex(w => w.name === "dummy_trigger");
                        if (dummyIndex !== -1) node.widgets.splice(dummyIndex, 1);
                    }

                    domWidget.computeSize = function (width) {
                        return [1400, 656]; 
                    };

                    setTimeout(() => {
                        if (node.size[0] < 1340) node.size[0] = 1340;
                        if (node.size[1] > 656) node.size[1] = 656; 
                        
                        if (node.graph && node.graph.setDirtyCanvas) {
                            node.graph.setDirtyCanvas(true, true);
                        }
                    }, 10);

                    ctx.leftPanel.syncControlsFromSettings(ctx.state.currentSettings);
                    
                    (async () => {
                        await ctx.loadGlobalState();
                        if (ctx.leftPanel && ctx.leftPanel.updateRecentProjects) {
                            ctx.leftPanel.updateRecentProjects(ctx.globalState.recentProjects);
                        }
                        if (ctx.globalState.autoLoadProject && ctx.globalState.recentProjects.length > 0) {
                            const lastDir = ctx.globalState.recentProjects[0];
                            if (ctx.leftPanel && ctx.leftPanel.setFolderPath) {
                                ctx.leftPanel.setFolderPath(lastDir);
                            }
                            await ctx.loadProject(lastDir);
                        }
                    })();

                } catch (err) {
                    console.error("Minimax Video Clipper init error:", err);
                }

                return r;
            };
        }
    }
});