import { app } from "../../scripts/app.js";

function chainCallback(object, property, callback) {
    if (object == null) return;
    let old = object[property];
    object[property] = function (...args) {
        let r = old ? old.apply(this, args) : undefined;
        callback.apply(this, args);
        return r;
    };
}

app.registerExtension({
    name: "HandyTools.DynamicPrompt",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "HandyToolDynamicPrompt") {

            console.log("✅ HandyTool Dynamic Prompt UI extension loaded");

            chainCallback(nodeType.prototype, "onNodeCreated", function () {
                // Create display container
                const container = document.createElement("div");
                container.className = "handyTool-dynamic-preview";
                container.style.marginTop = "10px";
                container.style.padding = "8px";
                container.style.backgroundColor = "#1e1e1e";
                container.style.border = "1px solid #444";
                container.style.borderRadius = "4px";
                container.style.minHeight = "60px";
                container.style.whiteSpace = "pre-wrap";
                container.style.fontSize = "13px";
                container.style.lineHeight = "1.4";

                const label = document.createElement("div");
                label.textContent = "Current Prompt:";
                label.style.fontSize = "12px";
                label.style.color = "#aaa";
                label.style.marginBottom = "4px";

                const textDisplay = document.createElement("div");
                textDisplay.style.color = "#ddd";

                container.appendChild(label);
                container.appendChild(textDisplay);

                // Add as DOM widget
                this.dynamicPromptWidget = this.addDOMWidget("resolved_prompt", "preview", container, {
                    serialize: false,
                    hideOnZoom: false,
                });

                this.dynamicPromptText = textDisplay;
            });

            // Update display when node executes
            chainCallback(nodeType.prototype, "onExecuted", function (message) {
                if (message?.text?.length > 0 && this.dynamicPromptText) {
                    this.dynamicPromptText.textContent = message.text[0];
                }
            });
        }
    }
});