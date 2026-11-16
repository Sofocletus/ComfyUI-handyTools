import { app } from "/scripts/app.js";
import { EditorState } from "./editor_state.js";
import { VideoCompositor } from "./video_compositor.js";
import { TimelineController } from "./timeline_ui.js";
import { MediaGallery } from "./media_gallery.js";
import { PropertyInspector } from "./property_inspector.js";
import { ProjectSettings } from "./project_settings.js";

app.registerExtension({
    name: "HandyTools.VideoEditor",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        
        if (nodeData.name === "HandyToolVideoTimeline") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                const node = this;

                const stateWidget = node.widgets.find(w => w.name === "timeline_data");
                if (stateWidget) {
                    stateWidget.type = "hidden";
                    stateWidget.computeSize = () => [0, 0];
                } else {
                    console.error("[HandyTools] Could not find timeline_data widget!");
                    return r;
                }

                const appContainer = document.createElement("div");
                // FIX: Added height: 100% so the UI stretches to fill the ComfyUI node perfectly
                appContainer.style.cssText = `
                    display: flex; flex-direction: column; width: 100%; height: 100%;
                    font-family: sans-serif; background: #1e1e1e;
                    border-radius: 4px; overflow: hidden;
                `;

                const topSection = document.createElement("div");
                topSection.style.cssText = "display: flex; flex-direction: row; width: 100%; height: 480px;";

                const leftPanel = document.createElement("div");
                leftPanel.style.cssText = "flex: 0 0 280px; background: #1a1a1a; padding: 15px; border-right: 1px solid #444; box-sizing: border-box; overflow-y: auto;";
                
                const centerViewport = document.createElement("div");
                centerViewport.style.cssText = "flex: 1; position: relative; background: #111; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box;";
                
                const rightPanel = document.createElement("div");
                rightPanel.style.cssText = "flex: 0 0 280px; background: #1a1a1a; padding: 15px; border-left: 1px solid #444; box-sizing: border-box; overflow-y: auto;";

                topSection.appendChild(leftPanel);
                topSection.appendChild(centerViewport);
                topSection.appendChild(rightPanel);

                const timelineContainer = document.createElement("div");
                timelineContainer.style.cssText = "width: 100%; display: flex; flex-direction: column;";
                
                const galleryContainer = document.createElement("div");
                galleryContainer.style.cssText = "width: 100%;";

                appContainer.appendChild(topSection);
                appContainer.appendChild(timelineContainer);
                appContainer.appendChild(galleryContainer);

                const stateManager = new EditorState(stateWidget);
                const compositor = new VideoCompositor(centerViewport, stateManager);
                
                const inspector = new PropertyInspector(leftPanel, stateManager);
                const settings = new ProjectSettings(rightPanel, stateManager);
                const ui = new TimelineController(timelineContainer, stateManager, compositor);
                
                const gallery = new MediaGallery(galleryContainer, stateManager, compositor);

                const domWidget = node.addDOMWidget("VideoEditorUI", "DOM", appContainer);
                
                node.computeSize = function(width) {
                    // FIX: Dropped the height to 800 so it perfectly hugs our UI panels without dead space
                    return [1180, 800];
                };
                node.size = node.computeSize();

                node.onRemoved = function () {
                    compositor.pause(); 
                    if(onNodeCreated) onNodeCreated.apply(this, arguments);
                };

                return r;
            };
        }
    }
});