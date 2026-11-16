import { app } from "/scripts/app.js";
import { ComfyWidgets } from "/scripts/widgets.js";

app.registerExtension({
    name: "HandyTools.SimpleLoadInfo",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "HandyToolLTXLoadLatentSimple") {
            
            const onExecuted = nodeType.prototype.onExecuted;
            
            // This runs immediately after the Python backend finishes its work
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                // If Python sent a "text" message in the UI payload
                if (message.text) {
                    const textStr = message.text.join("\n");
                    
                    // Check if we already created the info widget on a previous run
                    let infoWidget = this.widgets?.find(w => w.name === "latent_info");

                    // If it doesn't exist yet, create it
                    if (!infoWidget) {
                        infoWidget = ComfyWidgets.STRING(this, "latent_info", ["STRING", { multiline: true }], app).widget;
                        // Make it look like a sleek label rather than an input box
                        infoWidget.inputEl.readOnly = true;
                        infoWidget.inputEl.style.backgroundColor = "#222";
                        infoWidget.inputEl.style.color = "#aaa";
                        infoWidget.inputEl.style.textAlign = "center";
                        infoWidget.inputEl.style.border = "none";
                    }
                    
                    // Update the text box with the dimensions
                    infoWidget.value = textStr;
                    
                    // Force the node to resize slightly so the new text box fits
                    this.onResize?.(this.size);
                }
            };
        }
    }
});