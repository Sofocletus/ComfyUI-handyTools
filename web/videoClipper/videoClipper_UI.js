import * as Icons from "./videoClipper_icons.js";
import { createToolsOverlay } from "./videoClipper_tools.js";

export function createUIOverlays(ctx) {
    // 1. STANDBY & ERROR OVERLAY
    const standbyOverlay = document.createElement("div");
    standbyOverlay.className = "vc-standby-overlay";
    standbyOverlay.style.display = "none";
    standbyOverlay.innerHTML = `
        <div class="vc-standby-card">
            <div class="vc-standby-icon">⚠</div>
            <div class="vc-standby-title">Large Video — Safe Standby Mode</div>
            <div class="vc-standby-desc"></div>
            <div class="vc-standby-actions">
                <button class="vc-btn vc-btn-proxy-action" id="vc-standby-proxy-btn">Create Proxy Now</button>
                <button class="vc-btn vc-btn-subtle" id="vc-standby-override-btn" style="font-size:10px; opacity:0.7;">Load Raw Anyway</button>
            </div>
        </div>
    `;

    let currentOverrideCallback = null;

    standbyOverlay.querySelector("#vc-standby-proxy-btn").addEventListener("click", () => {
        if (ctx.leftPanel && ctx.leftPanel.triggerProxyCreation) {
            const proxyBtns = ctx.leftPanel.element.querySelectorAll("button");
            proxyBtns.forEach(b => { if (b.innerText.includes("Proxy")) b.disabled = false; });
            ctx.leftPanel.triggerProxyCreation();
        }
    });

    standbyOverlay.querySelector("#vc-standby-override-btn").addEventListener("click", () => {
        standbyOverlay.style.display = "none";
        if (currentOverrideCallback) currentOverrideCallback();
    });

    const showStandby = (type, overrideCb) => {
        currentOverrideCallback = overrideCb;
        const titleEl = standbyOverlay.querySelector(".vc-standby-title");
        const descEl = standbyOverlay.querySelector(".vc-standby-desc");

        if (type === "format") {
            titleEl.innerText = "Unsupported Video Format";
            const dispCodec = ctx.state.codec ? ctx.state.codec.toUpperCase() : "Unknown";
            descEl.innerHTML = `This video uses the <b>${dispCodec}</b> codec, which frequently fails or hangs in web browsers.<br>Please create a lightweight H.264 proxy to safely preview and scrub this file.`;
        } else if (type === "oom") {
            titleEl.innerText = "Large Video — Safe Standby Mode";
            descEl.innerHTML = "Loading this unproxied video directly into browser memory may cause memory exhaustion (OOM) or tab freezing.<br>Please create a lightweight proxy to safely preview and scrub this file.";
        } else {
            titleEl.innerText = "Playback Error";
            descEl.innerHTML = "Your browser natively rejected or failed to decode this stream.<br>Please create an H.264 proxy to enable previewing.";
        }

        standbyOverlay.style.display = "flex";

        if (ctx.state.appSettings?.autoProxy && ctx.leftPanel && ctx.leftPanel.triggerProxyCreation) {
            const proxyBtn = standbyOverlay.querySelector("#vc-standby-proxy-btn");
            if (proxyBtn) proxyBtn.click();
        }
    };

    const hideStandby = () => {
        standbyOverlay.style.display = "none";
    };

    // 2. HELP OVERLAY
    const helpOverlay = document.createElement("div");
    helpOverlay.className = "vc-help-overlay";

    const helpHeader = document.createElement("div");
    helpHeader.className = "vc-help-header";

    const helpTitle = document.createElement("span");
    helpTitle.className = "vc-help-title";
    helpTitle.innerText = "Video Clipper Help & Shortcuts";

    const helpCloseBtn = document.createElement("button");
    helpCloseBtn.className = "vc-icon-btn small";
    helpCloseBtn.innerHTML = Icons.ICON_CLOSE;
    helpCloseBtn.title = "Close Help";
    helpCloseBtn.onclick = () => { helpOverlay.style.display = "none"; };

    helpHeader.appendChild(helpTitle);
    helpHeader.appendChild(helpCloseBtn);
    helpOverlay.appendChild(helpHeader);

    const helpNote = document.createElement("div");
    helpNote.className = "vc-help-note";
    helpNote.innerHTML = `
        <b>Quick Guide:</b><br>
        1. <b>Projects:</b> Type a folder path and click Load, or use the ▼ dropdown for recent projects. App metadata auto-saves to <code>_data/</code>.<br>
        2. <b>Clips:</b> Press <b>C</b> to add a clip. Drag handles on the timeline to trim (snaps to valid <code>22 + n*17</code> Minimax frame lengths).<br>
        3. <b>Multi-Edit:</b> Use <b>Shift+Click</b> or <b>Ctrl+Click</b> in the timeline or right panel to select multiple clips. Use <i>Apply All</i> to sync sizes.<br>
        4. <b>Export:</b> Adjust CRF and Encoder in Settings (⚙️). Rendered files are saved to the clean <code>_clips/</code> subfolder.<br>
        5. <b>Custom Output Size:</b> Automatically scale clips to the selected resolutions.<br><br>
        
        <b>Why Proxies Are Necessary & How Criteria Work:</b><br>
        • <b>Why:</b> Web browsers cannot natively decode high-bitrate raw formats (like 10-bit H.265/HEVC or 4K sequences) smoothly without stuttering, or they lack support entirely (such as Firefox lacking HEVC codecs). Large raw files also risk crashing the browser tab with Out-Of-Memory (OOM) errors during heavy scrubbing.<br>
        • <b>Criteria Settings:</b> You can configure proxy triggers in the <b>Settings (⚙️)</b> menu:<br>
        &nbsp;&nbsp;- <i>Safe Standby Threshold (MB):</i> Files larger than this limit (default 250MB) force Safe Standby Mode to protect browser memory.<br>
        &nbsp;&nbsp;- <i>Auto-Create Proxies:</i> Automatically spins up FFmpeg in the background to render a lightweight H.264 proxy when a heavy file is opened.<br>
        &nbsp;&nbsp;- <i>Proxy Hardware Encoder:</i> Selects your hardware acceleration engine (NVENC, AMF, QSV, VideoToolbox, or CPU libx264) to speed up proxy generation.<br><br>

        <div style="background-color: rgba(33, 150, 243, 0.1); border-left: 3px solid #2196F3; padding: 10px; margin-top: 8px;">
            <b style="color: #82deff;">⚠️ System Requirements</b><br>
            This node requires <b>FFmpeg</b> to be installed on your system and available in your system's PATH. <i>(No additional Python pip dependencies are required).</i><br>
            <ul style="margin-top: 4px; margin-bottom: 0; padding-left: 20px;">
                <li><b>Windows:</b> Download from gyan.dev/ffmpeg/builds or use <code>winget install ffmpeg</code></li>
                <li><b>Mac:</b> <code>brew install ffmpeg</code></li>
                <li><b>Linux:</b> <code>sudo apt install ffmpeg</code></li>
            </ul>
        </div>
    `;
    helpOverlay.appendChild(helpNote);

    const shortcutsGrid = document.createElement("div");
    shortcutsGrid.className = "vc-help-shortcuts-grid";

    // --- UPDATED SHORTCUT DESCRIPTIONS ---
    const shortcuts = [
        { key: "Space", desc: "Play / Pause video" },
        { key: "← / →", desc: "Step backward / forward 1 frame" },
        { key: "Shift + ← / →", desc: "Jump to previous / next clip start or end" },
        { key: "Shift + Ctrl + ← / →", desc: "Clip multi-select" },
        { key: "Ctrl + Left Click", desc: "Select/Deselect clips one by one" },
        { key: "Shift + Left Click", desc: "Select clip range" },
        { key: "Ctrl + ← / →", desc: "Shift active clip(s) position by 1 frame" },
        { key: "↑ / ↓", desc: "Increase / decrease clip length (snaps to Minimax frames)" },
        { key: "C", desc: "Create clip at current playhead" },
        { key: "K", desc: "Create / delete keyframe at playhead" },
        { key: "+ / -", desc: "Zoom timeline in / out" },
        { key: "Delete", desc: "Delete selected clip(s)" },
        { key: "W / A / S / D", desc: "Pan crop area (Offset X/Y)" },
        { key: "Shift + W/A/S/D", desc: "Adjust crop size (W/H) in 32px increments" },
        { key: "Ctrl + C / V", desc: "Copy / Paste clip settings" },
        { key: "Ctrl + A", desc: "Select all clips in current video" },
        { key: "Ctrl + Scroll", desc: "Step backward / forward 1 frame (Mouse Wheel)" },
        { key: "Shift + Scroll", desc: "Scroll the timeline (Mouse Wheel)" },
        { key: "Alt + Scroll", desc: "Zoom timeline in / out (Mouse Wheel)" },
        { key: "Page Down", desc: "Jump to next video in gallery" },
        { key: "Page Up", desc: "Jump to previous video in gallery" }
    ];

    shortcuts.forEach(s => {
        const badge = document.createElement("div");
        badge.innerHTML = `<span class="vc-key-badge">${s.key}</span>`;
        const desc = document.createElement("div");
        desc.className = "vc-key-desc";
        desc.innerText = s.desc;
        shortcutsGrid.appendChild(badge);
        shortcutsGrid.appendChild(desc);
    });

    helpOverlay.appendChild(shortcutsGrid);

    // 3. SETTINGS OVERLAY
    const settingsOverlay = document.createElement("div");
    settingsOverlay.className = "vc-settings-overlay";

    const settingsHeader = document.createElement("div");
    settingsHeader.className = "vc-help-header";

    const settingsTitle = document.createElement("span");
    settingsTitle.className = "vc-help-title";
    settingsTitle.innerText = "System Settings & Thresholds";

    const settingsCloseBtn = document.createElement("button");
    settingsCloseBtn.className = "vc-icon-btn small";
    settingsCloseBtn.innerHTML = Icons.ICON_CLOSE;
    settingsCloseBtn.title = "Close Settings";
    settingsCloseBtn.onclick = () => { settingsOverlay.style.display = "none"; };

    settingsHeader.appendChild(settingsTitle);
    settingsHeader.appendChild(settingsCloseBtn);
    settingsOverlay.appendChild(settingsHeader);

    const buildSettingRow = (labelText, descText, inputElement) => {
        const row = document.createElement("div");
        row.className = "vc-settings-row";
        
        const labelCol = document.createElement("div");
        const lbl = document.createElement("div");
        lbl.className = "vc-settings-row-label";
        lbl.innerText = labelText;
        const desc = document.createElement("div");
        desc.className = "vc-settings-row-desc";
        desc.innerText = descText;
        labelCol.appendChild(lbl);
        labelCol.appendChild(desc);

        row.appendChild(labelCol);
        row.appendChild(inputElement);
        return row;
    };

    const autoLoadCheck = document.createElement("input");
    autoLoadCheck.type = "checkbox";
    autoLoadCheck.style.accentColor = "#2196F3";
    autoLoadCheck.style.cursor = "pointer";
    autoLoadCheck.addEventListener("change", (e) => {
        ctx.globalState.autoLoadProject = e.target.checked;
        ctx.saveGlobalState(); 
    });
    settingsOverlay.appendChild(buildSettingRow("Auto-Load Last Project", "Automatically load the last active folder when the extension starts.", autoLoadCheck));

    const exportEncSelect = document.createElement("select");
    exportEncSelect.className = "vc-input vc-settings-input";
    const encOptions = [
        { val: "h264", label: "H.264 (Standard / Compatible)" },
        { val: "hevc", label: "H.265 / HEVC (Small File Size)" },
        { val: "prores", label: "ProRes 422 (Editing Workflow)" }
    ];
    encOptions.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.val;
        o.innerText = opt.label;
        exportEncSelect.appendChild(o);
    });
    exportEncSelect.addEventListener("change", (e) => {
        ctx.state.appSettings.exportEncoder = e.target.value;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Final Export Encoder", "Compression engine used when rendering final clips to the _clips folder.", exportEncSelect));

    const crfContainer = document.createElement("div");
    crfContainer.style.display = "flex";
    crfContainer.style.alignItems = "center";
    crfContainer.style.gap = "8px";

    const crfSlider = document.createElement("input");
    crfSlider.type = "range";
    crfSlider.min = "0";
    crfSlider.max = "30";
    crfSlider.value = "17";
    crfSlider.style.width = "100px";
    crfSlider.style.accentColor = "#2196F3";

    const crfValueDisplay = document.createElement("span");
    crfValueDisplay.style.fontFamily = "monospace";
    crfValueDisplay.style.fontSize = "11px";
    crfValueDisplay.style.minWidth = "20px";
    crfValueDisplay.innerText = "17";

    crfSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        crfValueDisplay.innerText = val;
        ctx.state.appSettings.exportCrf = val;
        ctx.saveGlobalState();
    });

    crfContainer.appendChild(crfSlider);
    crfContainer.appendChild(crfValueDisplay);
    settingsOverlay.appendChild(buildSettingRow("Export Compression (CRF)", "Quality loss factor for H.264/H.265. (0 = Lossless, 17 = High, 30 = Low). Ignored by ProRes.", crfContainer));

    const hwSelect = document.createElement("select");
    hwSelect.className = "vc-input vc-settings-input";
    const hwOptions = [
        { val: "libx264", label: "libx264 (CPU - Safe)" },
        { val: "h264_nvenc", label: "NVENC (NVIDIA GPU)" },
        { val: "h264_amf", label: "AMF (AMD GPU)" },
        { val: "h264_qsv", label: "QSV (Intel GPU)" },
        { val: "h264_videotoolbox", label: "VideoToolbox (Mac)" }
    ];
    hwOptions.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.val;
        o.innerText = opt.label;
        hwSelect.appendChild(o);
    });
    hwSelect.addEventListener("change", (e) => {
        ctx.state.appSettings.hwEncoder = e.target.value;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Proxy Hardware Encoder", "Accelerates proxy creation. Fall back to CPU if your system fails.", hwSelect));

    const proxyThreshInput = document.createElement("input");
    proxyThreshInput.type = "number";
    proxyThreshInput.className = "vc-input vc-settings-input-num";
    proxyThreshInput.min = "10";
    proxyThreshInput.addEventListener("change", (e) => {
        ctx.state.appSettings.proxyThresholdMb = parseFloat(e.target.value) || 250;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Safe Standby Threshold (MB)", "Files larger than this require a proxy to prevent browser OOM crashes.", proxyThreshInput));

    const autoProxyCheck = document.createElement("input");
    autoProxyCheck.type = "checkbox";
    autoProxyCheck.style.accentColor = "#2196F3";
    autoProxyCheck.style.cursor = "pointer";
    autoProxyCheck.addEventListener("change", (e) => {
        ctx.state.appSettings.autoProxy = e.target.checked;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Auto-Create Proxies", "Automatically begin proxy generation for videos that exceed the Safe Threshold.", autoProxyCheck));

    const webpFramesInput = document.createElement("input");
    webpFramesInput.type = "number";
    webpFramesInput.className = "vc-input vc-settings-input-num";
    webpFramesInput.min = "2";
    webpFramesInput.addEventListener("change", (e) => {
        ctx.state.appSettings.webpFrames = parseInt(e.target.value, 10) || 12;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Gallery Preview Frames", "Number of frames extracted for the animated WebP gallery hover.", webpFramesInput));

    const sampleModeCheck = document.createElement("input");
    sampleModeCheck.type = "checkbox";
    sampleModeCheck.style.accentColor = "#2196F3";
    sampleModeCheck.style.cursor = "pointer";
    sampleModeCheck.addEventListener("change", (e) => {
        ctx.state.appSettings.webpSampleFull = e.target.checked;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Sample Preview Across Full Video", "Uncheck to only sample the first 5 seconds (saves CPU on long videos).", sampleModeCheck));

    const webpThreshInput = document.createElement("input");
    webpThreshInput.type = "number";
    webpThreshInput.className = "vc-input vc-settings-input-num";
    webpThreshInput.min = "5";
    webpThreshInput.addEventListener("change", (e) => {
        ctx.state.appSettings.webpThresholdSec = parseFloat(e.target.value) || 30;
        ctx.saveGlobalState();
    });
    settingsOverlay.appendChild(buildSettingRow("Smart Preview Threshold (sec)", "Only sample full duration if video is longer than this threshold.", webpThreshInput));

    // 4. TOOLS OVERLAY
    const toolsUI = createToolsOverlay(ctx);

    return {
        elements: [standbyOverlay, helpOverlay, settingsOverlay, toolsUI.element],
        showStandby,
        hideStandby,
        toggleHelp: () => {
            settingsOverlay.style.display = "none";
            toolsUI.closeTools();
            const isHidden = helpOverlay.style.display === "none" || helpOverlay.style.display === "";
            helpOverlay.style.display = isHidden ? "flex" : "none";
        },
        toggleSettings: () => {
            helpOverlay.style.display = "none";
            toolsUI.closeTools();
            const isHidden = settingsOverlay.style.display === "none" || settingsOverlay.style.display === "";
            settingsOverlay.style.display = isHidden ? "flex" : "none";
        },
        toggleTools: () => {
            helpOverlay.style.display = "none";
            settingsOverlay.style.display = "none";
            if (toolsUI.element.style.display === "flex") {
                toolsUI.closeTools();
            } else {
                toolsUI.openTools();
            }
        },
        syncSettingsToForm: (appSettings) => {
            autoLoadCheck.checked = !!ctx.globalState.autoLoadProject;
            exportEncSelect.value = appSettings.exportEncoder || "h264";
            crfSlider.value = appSettings.exportCrf !== undefined ? appSettings.exportCrf : 17;
            crfValueDisplay.innerText = crfSlider.value;
            hwSelect.value = appSettings.hwEncoder || "libx264";
            proxyThreshInput.value = appSettings.proxyThresholdMb || 250;
            webpFramesInput.value = appSettings.webpFrames || 12;
            webpThreshInput.value = appSettings.webpThresholdSec || 30;
            sampleModeCheck.checked = appSettings.webpSampleFull !== false;
            autoProxyCheck.checked = !!appSettings.autoProxy;
        }
    };
}