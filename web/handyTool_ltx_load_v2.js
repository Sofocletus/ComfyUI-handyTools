import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

app.registerExtension({
    name: "HandyTools.LoadLatentV2",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "HandyToolLTXLoadLatentsV2") {
            
            nodeType.prototype.onNodeCreated = function () {
                const node = this;

                // 1. Create the UI Container
                const container = document.createElement("div");
                container.style.boxSizing = "border-box";
                container.style.marginTop = "50px"; 
                container.style.display = "flex";
                container.style.flexDirection = "column";
                container.style.width = "100%";
                container.style.height = "calc(100% - 50px)"; 
                container.style.gap = "5px";

                // Top Bar for Refresh Button
                const topBar = document.createElement("div");
                topBar.style.display = "flex";
                topBar.style.justifyContent = "flex-end";
                topBar.style.width = "100%";

                const refreshBtn = document.createElement("button");
                refreshBtn.innerText = "🔄 Refresh Directory";
                refreshBtn.style.padding = "4px 10px";
                refreshBtn.style.cursor = "pointer";
                refreshBtn.style.backgroundColor = "#333";
                refreshBtn.style.color = "#fff";
                refreshBtn.style.border = "1px solid #555";
                refreshBtn.style.borderRadius = "4px";
                refreshBtn.style.fontSize = "12px";

                topBar.appendChild(refreshBtn);

                // Thumbnail Strip 
                const thumbContainer = document.createElement("div");
                thumbContainer.style.display = "flex";
                thumbContainer.style.overflowX = "auto";
                thumbContainer.style.height = "120px"; 
                thumbContainer.style.minHeight = "120px"; 
                thumbContainer.style.backgroundColor = "#111";
                thumbContainer.style.padding = "5px";
                thumbContainer.style.gap = "8px";

                // Main Video Container
                const mainVideoContainer = document.createElement("div");
                mainVideoContainer.style.position = "relative";
                mainVideoContainer.style.width = "100%";
                mainVideoContainer.style.flex = "1"; 
                mainVideoContainer.style.minHeight = "0"; 
                mainVideoContainer.style.backgroundColor = "#000";
                mainVideoContainer.style.overflow = "hidden";

                const mainVideo = document.createElement("video");
                mainVideo.controls = true;
                mainVideo.style.width = "100%";
                mainVideo.style.height = "100%";
                mainVideo.style.objectFit = "contain";

                // Main Video Label
                const mainVideoLabel = document.createElement("div");
                mainVideoLabel.style.position = "absolute";
                mainVideoLabel.style.top = "10px";
                mainVideoLabel.style.left = "10px";
                mainVideoLabel.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
                mainVideoLabel.style.color = "#fff";
                mainVideoLabel.style.padding = "4px 10px";
                mainVideoLabel.style.borderRadius = "4px";
                mainVideoLabel.style.fontSize = "14px";
                mainVideoLabel.style.fontFamily = "sans-serif";
                mainVideoLabel.style.pointerEvents = "none";
                mainVideoLabel.innerText = "Select a video to preview";

                mainVideoContainer.appendChild(mainVideo);
                mainVideoContainer.appendChild(mainVideoLabel);

                container.appendChild(topBar);
                container.appendChild(thumbContainer);
                container.appendChild(mainVideoContainer);

                this.addDOMWidget("VideoPlayer", "DOM", container);

                const updateSequenceString = () => {
                    const seqWidget = node.widgets.find(w => w.name === "take_sequence");
                    if (!seqWidget) return;

                    const checkedTakes = [];
                    Array.from(thumbContainer.children).forEach(wrapper => {
                        const cb = wrapper.querySelector("input[type='checkbox']");
                        if (cb && cb.checked && wrapper.dataset.takeNum) {
                            checkedTakes.push(parseInt(wrapper.dataset.takeNum, 10));
                        }
                    });

                    if (checkedTakes.length > 0) {
                        seqWidget.value = checkedTakes.join(", ");
                    } else {
                        seqWidget.value = "0"; 
                    }
                };

                // 2. Logic to load videos
                const loadVideos = async (dirPath) => {
                    // Graceful handling of empty default paths
                    if (!dirPath || dirPath.trim() === "") {
                        thumbContainer.innerHTML = "<small style='color:#888; margin: auto;'>Please enter a folder path to scan for previews.</small>";
                        mainVideo.src = "";
                        mainVideoLabel.innerText = "Waiting for path...";
                        return;
                    }

                    thumbContainer.innerHTML = "<span style='color:#888; margin: auto;'>Scanning takes...</span>";
                    mainVideo.src = "";
                    mainVideoLabel.innerText = "Select a video to preview";
                    
                    try {
                        const response = await api.fetchApi(`/handyTool/video_list?dir=${encodeURIComponent(dirPath)}`);
                        const data = await response.json();
                        
                        thumbContainer.innerHTML = "";
                        if (!data.videos || data.videos.length === 0) {
                            thumbContainer.innerHTML = "<small style='color:#ff5555; margin: auto;'>No valid preview videos found in folder.</small>";
                            return;
                        }

                        const seqWidget = node.widgets.find(w => w.name === "take_sequence");
                        const currentSequenceRaw = seqWidget ? seqWidget.value : "0";
                        const currentSequence = currentSequenceRaw.split(",")
                                                                  .map(s => parseInt(s.trim(), 10))
                                                                  .filter(n => !isNaN(n));

                        data.videos.forEach(vid => {
                            const filenameOnly = vid.split('/').pop();
                            const nameWithoutExt = filenameOnly.replace(/\.[^/.]+$/, "");
                            
                            const match = vid.match(/_take(\d+)/);
                            const takeNum = match ? parseInt(match[1], 10) : null;

                            const thumbWrapper = document.createElement("div");
                            thumbWrapper.style.position = "relative";
                            thumbWrapper.style.height = "100%";
                            thumbWrapper.style.minWidth = "170px"; 
                            thumbWrapper.style.cursor = "pointer";
                            thumbWrapper.style.flexShrink = "0";
                            thumbWrapper.style.borderRadius = "4px";
                            thumbWrapper.style.overflow = "hidden";
                            thumbWrapper.style.border = "2px solid transparent";
                            thumbWrapper.dataset.takeNum = takeNum;

                            const checkbox = document.createElement("input");
                            checkbox.type = "checkbox";
                            checkbox.style.position = "absolute";
                            checkbox.style.top = "8px";
                            checkbox.style.left = "8px";
                            checkbox.style.transform = "scale(1.5)"; 
                            checkbox.style.zIndex = "10";
                            checkbox.style.cursor = "pointer";
                            
                            if (takeNum !== null && currentSequence.includes(takeNum)) {
                                checkbox.checked = true;
                            }

                            checkbox.onclick = (e) => {
                                e.stopPropagation(); 
                                updateSequenceString();
                            };

                            const thumb = document.createElement("video");
                            const url = `/handyTool/view_video?dir=${encodeURIComponent(dirPath)}&file=${encodeURIComponent(vid)}`;
                            thumb.src = url;
                            thumb.style.width = "100%";
                            thumb.style.height = "100%";
                            thumb.style.objectFit = "cover";
                            thumb.muted = true;

                            const thumbLabel = document.createElement("div");
                            thumbLabel.style.position = "absolute";
                            thumbLabel.style.bottom = "0";
                            thumbLabel.style.left = "0";
                            thumbLabel.style.right = "0";
                            thumbLabel.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
                            thumbLabel.style.color = "#fff";
                            thumbLabel.style.fontSize = "12px"; 
                            thumbLabel.style.fontFamily = "sans-serif";
                            thumbLabel.style.padding = "4px 6px";
                            thumbLabel.style.whiteSpace = "nowrap";
                            thumbLabel.style.overflow = "hidden";
                            thumbLabel.style.textOverflow = "ellipsis";
                            thumbLabel.style.pointerEvents = "none";
                            thumbLabel.innerText = nameWithoutExt;

                            thumbWrapper.onmouseenter = () => thumb.play();
                            thumbWrapper.onmouseleave = () => thumb.pause();

                            thumbWrapper.onclick = () => {
                                Array.from(thumbContainer.children).forEach(c => c.style.border = "2px solid transparent");
                                thumbWrapper.style.border = "2px solid #4CAF50"; 

                                mainVideo.src = url;
                                mainVideo.play();
                                mainVideoLabel.innerText = nameWithoutExt;
                            };

                            thumbWrapper.appendChild(checkbox);
                            thumbWrapper.appendChild(thumb);
                            thumbWrapper.appendChild(thumbLabel);
                            thumbContainer.appendChild(thumbWrapper);
                        });

                        if (data.videos.length > 0) {
                            thumbContainer.children[0].click();
                        }

                    } catch (e) {
                        thumbContainer.innerHTML = "<span style='color:#ff5555; margin: auto;'>Error loading folder</span>";
                    }
                };

                // 3. Bind the scanner to the text box and the refresh button
                const dirWidget = this.widgets.find(w => w.name === "folder_path");
                
                if (dirWidget) {
                    dirWidget.callback = (value) => loadVideos(value);
                    setTimeout(() => loadVideos(dirWidget.value), 300);
                }

                refreshBtn.onclick = () => {
                    if (dirWidget && dirWidget.value) {
                        loadVideos(dirWidget.value);
                    }
                };

                this.setSize([500, 580]); // Slightly taller to accommodate the top bar
            };
        }
    }
});