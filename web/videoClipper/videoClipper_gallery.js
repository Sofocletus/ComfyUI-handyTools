import * as Icons from "./videoClipper_icons.js";

export function createGallery(ctx) {
    // 1. Create the outer container (Flex Row)
    const galleryContainer = document.createElement("div");
    galleryContainer.className = "vc-gallery-container";
    galleryContainer.style.display = "flex";
    galleryContainer.style.flexDirection = "row";
    galleryContainer.style.alignItems = "stretch";
    galleryContainer.style.width = "100%";
    galleryContainer.style.height = "100px"; // Must match original gallery height in your CSS
    galleryContainer.style.backgroundColor = "#111"; // Optional background to match styling
    
    // 2. The scrollable thumbnail strip
    const strip = document.createElement("div");
    strip.className = "vc-gallery-strip";
    strip.style.flex = "1";
    strip.style.overflowX = "auto";
    strip.style.display = "flex";
    strip.style.flexDirection = "row";

    // 3. The fixed Toolbar on the right
    const toolbar = document.createElement("div");
    toolbar.className = "vc-gallery-toolbar";
    toolbar.style.width = "40px";
    toolbar.style.display = "flex";
    toolbar.style.flexDirection = "column";
    toolbar.style.alignItems = "center";
    toolbar.style.justifyContent = "center";
    toolbar.style.gap = "4px"; 
    toolbar.style.borderLeft = "1px solid #333";
    toolbar.style.backgroundColor = "#1a1a1a";
    toolbar.style.flexShrink = "0";

    galleryContainer.appendChild(strip);
    galleryContainer.appendChild(toolbar);

    let currentVideos = []; // array of { name: '...', hasState: false, hasProxy: false, selectedForExport: true }

    // Wire up Toolbar Buttons
    const btnAll = document.createElement("button");
    btnAll.className = "vc-icon-btn small";
    btnAll.innerHTML = Icons.ICON_CHECK_ALL || "☑";
    btnAll.title = "Mark All Videos for Export";
    btnAll.onclick = () => {
        currentVideos.forEach(v => v.selectedForExport = true);
        render();
    };

    const btnNone = document.createElement("button");
    btnNone.className = "vc-icon-btn small";
    btnNone.innerHTML = Icons.ICON_CHECK_NONE || "☐";
    btnNone.title = "Mark No Videos for Export";
    btnNone.onclick = () => {
        currentVideos.forEach(v => v.selectedForExport = false);
        render();
    };

    const btnInvert = document.createElement("button");
    btnInvert.className = "vc-icon-btn small";
    btnInvert.innerHTML = Icons.ICON_INVERT || "◧";
    btnInvert.title = "Invert Video Export Marks";
    btnInvert.onclick = () => {
        currentVideos.forEach(v => v.selectedForExport = !v.selectedForExport);
        render();
    };

    toolbar.appendChild(btnAll);
    toolbar.appendChild(btnNone);
    toolbar.appendChild(btnInvert);

    const render = () => {
        strip.innerHTML = "";

        if (currentVideos.length === 0) {
            strip.innerHTML = `<div style="padding:10px; color:#666; font-size:12px; margin:auto;">No videos loaded</div>`;
            return;
        }

        // Append thumbnails exactly as before
        currentVideos.forEach(vid => {
            const thumb = document.createElement("div");
            thumb.className = `vc-gallery-thumb ${vid.name === ctx.state.currentFile ? 'active' : ''} ${vid.hasState ? 'has-state' : ''}`;
            thumb.title = vid.name;
            thumb.style.position = "relative"; 

            const img = document.createElement("img");
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.style.transition = "opacity 0.2s";
            
            img.style.opacity = vid.selectedForExport ? "1" : "0.3";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = vid.selectedForExport;
            cb.className = "vc-gallery-export-cb";
            cb.style.position = "absolute";
            cb.style.top = "4px";
            cb.style.right = "4px";
            cb.style.zIndex = "10";
            cb.style.cursor = "pointer";
            cb.style.transform = "scale(1.2)";
            cb.style.transformOrigin = "top right";
            cb.style.margin = "0";
            cb.title = "Include in Gallery Batch Export";
            
            cb.addEventListener("click", (e) => {
                e.stopPropagation();
                vid.selectedForExport = cb.checked;
                img.style.opacity = vid.selectedForExport ? "1" : "0.3";
                label.style.opacity = vid.selectedForExport ? "1" : "0.5";
                if (ctx.rightPanel && ctx.rightPanel.updateExportButtonCount) ctx.rightPanel.updateExportButtonCount();
            });

            const frames = ctx.state.appSettings?.webpFrames || 12;
            const threshold = ctx.state.appSettings?.webpThresholdSec || 30;
            const sampleMode = (ctx.state.appSettings?.webpSampleFull !== false) ? 'full' : 'start';

            const jpgUrl = ctx.api.apiURL(`/video_clipper/gallery_asset?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(vid.name)}&type=jpg`);
            const webpUrl = ctx.api.apiURL(`/video_clipper/gallery_asset?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(vid.name)}&type=webp&frames=${frames}&threshold=${threshold}&sample_mode=${sampleMode}`);

            img.src = jpgUrl;

            let hoverTimer;
            thumb.addEventListener("mouseenter", () => {
                hoverTimer = setTimeout(() => {
                    img.src = webpUrl;
                }, 200); 
            });
            thumb.addEventListener("mouseleave", () => {
                clearTimeout(hoverTimer);
                img.src = jpgUrl;
            });

            thumb.addEventListener("click", async () => {
                if (ctx.state.currentFile !== vid.name) {
                    await ctx.selectVideo(vid.name);
                }
            });

            const label = document.createElement("div");
            label.className = "vc-gallery-filename";
            label.innerText = vid.name;
            label.style.opacity = vid.selectedForExport ? "1" : "0.5";

            thumb.appendChild(cb);
            thumb.appendChild(img);
            thumb.appendChild(label);

            if (vid.hasProxy) {
                const proxyBadge = document.createElement("div");
                proxyBadge.className = "vc-gallery-proxy-badge";
                proxyBadge.innerText = "Proxy ✔";
                thumb.appendChild(proxyBadge);
            }

            strip.appendChild(thumb);
        });

        // Update the Right Panel's export count live when gallery selection changes
        if (ctx.rightPanel && ctx.rightPanel.updateExportButtonCount) {
            ctx.rightPanel.updateExportButtonCount();
        }

        setTimeout(() => {
            const activeEl = strip.querySelector('.vc-gallery-thumb.active');
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 50);
    };

    const loadFolderVideos = async (dir, selectFilename = null, selectTime = null) => {
        if (!dir) return;
        ctx.state.currentDir = dir;
        try {
            const res = await ctx.api.fetchApi(`/video_clipper/video_list?dir=${encodeURIComponent(dir)}`);
            const data = await res.json();

            const statesList = data.states || [];
            const proxiesList = data.proxies || [];

            currentVideos = (data.videos || []).map(v => ({
                name: v,
                hasState: statesList.includes(v.replace(/\.[^/.]+$/, "")),
                hasProxy: proxiesList.includes(v),
                selectedForExport: true
            }));

            if (ctx.leftPanel && ctx.leftPanel.setFolderPath) {
                ctx.leftPanel.setFolderPath(dir);
            }

            if (currentVideos.length > 0) {
                let targetVid = selectFilename;
                if (!targetVid || !currentVideos.find(v => v.name === targetVid)) {
                    targetVid = currentVideos[0].name;
                }
                ctx.selectVideo(targetVid, selectTime);
            } else {
                ctx.state.currentFile = "";
                ctx.player.video.removeAttribute("src");
                ctx.player.video.load();
            }

            render();
        } catch (err) {
            console.error("Gallery load error:", err);
        }
    };

    const setFileHasState = (filename, hasState) => {
        const vid = currentVideos.find(v => v.name === filename);
        if (vid && vid.hasState !== hasState) {
            vid.hasState = hasState;
            render();
        }
    };

    const setFileHasProxy = (filename, hasProxy) => {
        const vid = currentVideos.find(v => v.name === filename);
        if (vid && vid.hasProxy !== hasProxy) {
            vid.hasProxy = hasProxy;
            render();
        }
    };

    const selectNextVideo = () => {
        if (currentVideos.length === 0) return;
        const idx = currentVideos.findIndex(v => v.name === ctx.state.currentFile);
        if (idx >= 0 && idx < currentVideos.length - 1) {
            ctx.selectVideo(currentVideos[idx + 1].name);
        }
    };

    const selectPrevVideo = () => {
        if (currentVideos.length === 0) return;
        const idx = currentVideos.findIndex(v => v.name === ctx.state.currentFile);
        if (idx > 0) {
            ctx.selectVideo(currentVideos[idx - 1].name);
        }
    };

    const getExportableVideos = () => {
        return currentVideos.filter(v => v.selectedForExport).map(v => v.name);
    };

    return {
        element: galleryContainer, 
        render,
        loadFolderVideos,
        setFileHasState,
        setFileHasProxy,
        selectNextVideo,
        selectPrevVideo,
        getExportableVideos
    };
}