import { app } from "/scripts/app.js";

app.registerExtension({
    name: "HandyTools.VideoSaver",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "HandyToolVideoSaver") return;

        // ----------------------------------------------------------------
        // onNodeCreated — inject a video player DOM widget into the node
        // ----------------------------------------------------------------
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);

            const node = this;

            // 1. Outer container that wraps the video player
            const container = document.createElement("div");
            container.style.boxSizing = "border-box";
            container.style.marginTop = "8px";
            container.style.width = "100%";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "4px";

            // 2. Label row (title + refresh button)
            const labelRow = document.createElement("div");
            labelRow.style.display = "flex";
            labelRow.style.justifyContent = "space-between";
            labelRow.style.alignItems = "center";

            const titleLabel = document.createElement("span");
            titleLabel.innerText = "🎬 Saved Video Preview";
            titleLabel.style.color = "#ddd";
            titleLabel.style.fontSize = "13px";
            titleLabel.style.fontFamily = "sans-serif";
            titleLabel.style.fontWeight = "bold";

            // Refresh / reload button for the video player
            const refreshBtn = document.createElement("button");
            refreshBtn.innerText = "🔄 Reload";
            refreshBtn.style.padding = "2px 8px";
            refreshBtn.style.cursor = "pointer";
            refreshBtn.style.backgroundColor = "#333";
            refreshBtn.style.color = "#ccc";
            refreshBtn.style.border = "1px solid #555";
            refreshBtn.style.borderRadius = "4px";
            refreshBtn.style.fontSize = "11px";

            labelRow.appendChild(titleLabel);
            labelRow.appendChild(refreshBtn);

            // 3. Video element container (fixed area)
            const videoContainer = document.createElement("div");
            videoContainer.style.position = "relative";
            videoContainer.style.width = "100%";
            videoContainer.style.minHeight = "260px";
            videoContainer.style.backgroundColor = "#000";
            videoContainer.style.overflow = "hidden";
            videoContainer.style.borderRadius = "4px";

            const videoEl = document.createElement("video");
            videoEl.controls = true;
            videoEl.loop = true;
            videoEl.style.width = "100%";
            videoEl.style.height = "100%";
            videoEl.style.display = "block";
            videoEl.style.objectFit = "contain";

            // Overlay label shown before a video is loaded
            const placeholderLabel = document.createElement("div");
            placeholderLabel.style.position = "absolute";
            placeholderLabel.style.top = "50%";
            placeholderLabel.style.left = "50%";
            placeholderLabel.style.transform = "translate(-50%, -50%)";
            placeholderLabel.style.color = "#666";
            placeholderLabel.style.fontSize = "14px";
            placeholderLabel.style.fontFamily = "sans-serif";
            placeholderLabel.style.pointerEvents = "none";
            placeholderLabel.style.textAlign = "center";
            placeholderLabel.innerText = "Render to preview saved video";

            videoContainer.appendChild(videoEl);
            videoContainer.appendChild(placeholderLabel);

            // 4. Filename label (bottom of player)
            const filenameLabel = document.createElement("div");
            filenameLabel.style.color = "#aaa";
            filenameLabel.style.fontSize = "12px";
            filenameLabel.style.fontFamily = "monospace";
            filenameLabel.style.textAlign = "center";
            filenameLabel.innerText = "";

            // Assemble the container
            container.appendChild(labelRow);
            container.appendChild(videoContainer);
            container.appendChild(filenameLabel);

            // 5. Register as a ComfyUI DOM widget
            const domWidget = this.addDOMWidget(
                "VideoPlayer",
                "Video Player 🎬",
                container,
                { hideOnZoom: false },
                app.canvas
            );

            if (domWidget) {
                domWidget.serialize = false;
            }

            // Store references on node for onExecuted to reach
            node._videoEl = videoEl;
            node._placeholderLabel = placeholderLabel;
            node._filenameLabel = filenameLabel;
            node._currentVideoPath = null;
            node._refreshBtn = refreshBtn;

            // Helper: set video source and hide placeholder
            const setVideoFromPath = (absPath, fname) => {
                node._currentVideoPath = absPath;
                videoEl.src = `/handyTool/view_saved_video?path=${encodeURIComponent(absPath)}`;
                videoEl.load();
                placeholderLabel.style.display = "none";
                if (fname) filenameLabel.innerText = fname;

                refreshBtn.onclick = () => {
                    if (node._currentVideoPath) {
                        videoEl.src =
                            `/handyTool/view_saved_video?path=${encodeURIComponent(node._currentVideoPath)}`
                            + "#" + Date.now();
                        videoEl.load();
                        videoEl.play();
                    }
                };
            };

            // 6. onExecuted — called when ComfyUI finishes running this node
            const origOnExecuted = this.onExecuted;
            this.onExecuted = function (message) {
                if (origOnExecuted) origOnExecuted.apply(this, arguments);

                console.log("[HandyToolVideoSaver] onExecuted message:", message.video_player);

                let vp = message.video_player;

                // Handle both array and plain-object payloads from the backend
                if (Array.isArray(vp) && vp.length > 0) {
                    vp = vp[0];
                }

                if (vp && vp.path) {
                    console.log("[HandyToolVideoSaver] Setting video source:", vp.path);
                    setVideoFromPath(vp.path, vp.filename);
                    videoEl.addEventListener(
                        "canplaythrough",
                        () => { videoEl.play().catch(() => {}); },
                        { once: true }
                    );
                } else {
                    console.warn("[HandyToolVideoSaver] No valid video_player data in message");
                }
            };

            // Ensure minimum node height for the player
            this.setSize([this.size[0], Math.max(this.size[1], 420)]);
        };
    },
});
