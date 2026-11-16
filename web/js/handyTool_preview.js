import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "HandyTools.preview",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "HandyToolImageBatchLoad") {
            console.log("✅ HandyTools: Preview extension loaded for HandyToolImageBatchLoad");

            // Add preview widget
            const originalOnExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                if (originalOnExecuted) {
                    originalOnExecuted.apply(this, arguments);
                }

                if (message?.images?.length > 0) {
                    const filename = message.images[0];
                    if (filename && !this.handyToolImgWidget) {
                        // Create image element
                        const img = document.createElement("img");
                        img.style.maxWidth = "100%";
                        img.style.maxHeight = "280px";
                        img.style.objectFit = "contain";
                        img.style.border = "1px solid #666";
                        img.style.marginTop = "8px";
                        img.style.borderRadius = "4px";

                        this.handyToolImgWidget = this.addDOMWidget("preview", "preview", img, {
                            serialize: false,
                            hideOnZoom: false
                        });

                        this.handyToolImgWidget.element = img;
                    }

                    if (this.handyToolImgWidget && this.handyToolImgWidget.element) {
                        this.handyToolImgWidget.element.src = `/view?filename=${encodeURIComponent(filename)}`;
                    }
                }
            };
        }
    }
});