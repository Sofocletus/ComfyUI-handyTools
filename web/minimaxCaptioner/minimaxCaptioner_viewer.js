export class CaptionerViewer {
    constructor(ctx) {
        this.ctx = ctx;
        this.el = document.createElement("div");
        this.el.className = "vc-video-wrapper";
        this.el.style.cssText = "width:640px; height:360px; background:#000; display:flex; justify-content:center; align-items:center; border:1px solid #444; border-radius:4px; overflow:hidden; flex-shrink:0;";
        
        this.ctx.video.controls = false; 
        this.ctx.video.style.cssText = "width:100%; height:100%; object-fit:contain;";
        this.el.appendChild(this.ctx.video);
    }
}