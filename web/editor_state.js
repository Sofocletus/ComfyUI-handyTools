export class EditorState {
    constructor(widget) {
        this.widget = widget;
        this.subscribers = [];
        this.selectedClipId = null;
        
        this.state = {
            projectName: "My_Composition",
            resolution: [1920, 1080],
            fps: 30,
            clips: [],
            savePath: "",
            galleryMode: "drag", 
            galleryFolder: ""
        };

        this.past = [];
        this.future = [];
        this.maxHistory = 10;
        this._lastActionTime = 0;
        
        this.colorRegistry = new Map();

        this._loadFromWidget();
    }

    _loadFromWidget() {
        if (this.widget && this.widget.value) {
            try {
                const parsed = JSON.parse(this.widget.value);
                if (parsed && typeof parsed === 'object') {
                    this.state = { ...this.state, ...parsed };
                }
            } catch (e) {
                console.warn("[HandyTools] Failed to parse state widget value", e);
            }
        }
    }

    _syncToWidget() {
        if (this.widget) {
            this.widget.value = JSON.stringify(this.state);
        }
    }

    getState() { return this.state; }
    subscribe(callback) { this.subscribers.push(callback); }
    notify(event = null) { this.subscribers.forEach(cb => cb(this.state, event)); }

    getSelectedClip() {
        return this.state.clips.find(c => c.id === this.selectedClipId) || null;
    }

    setSelectedClip(id) {
        this.selectedClipId = id;
        this.notify();
    }

    getTimelineDuration() {
        let maxTime = 0;
        this.state.clips.forEach(c => {
            if (c.timeline_end > maxTime) maxTime = c.timeline_end;
        });
        return maxTime;
    }
    
    getColorForFile(filename) {
        if (!filename) return { border: "#555", bg: "rgba(85,85,85,0.45)" };
        if (!this.colorRegistry.has(filename)) {
            let hash = 0;
            for (let i = 0; i < filename.length; i++) {
                hash = filename.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash) % 360;
            const border = `hsl(${hue}, 54%, 46%)`;
            const bg = `hsla(${hue}, 54%, 46%, 0.45)`;
            this.colorRegistry.set(filename, { border, bg });
        }
        return this.colorRegistry.get(filename);
    }

    pushHistory() {
        const now = Date.now();
        const currentStr = JSON.stringify(this.state);
        if (this._lastActionTime && (now - this._lastActionTime) < 600) {
            this._lastActionTime = now;
            return;
        }
        const lastStr = this.past.length > 0 ? JSON.stringify(this.past[this.past.length - 1]) : null;
        if (currentStr !== lastStr) {
            this.past.push(JSON.parse(currentStr));
            if (this.past.length > this.maxHistory) this.past.shift();
            this.future = []; 
        }
        this._lastActionTime = now;
    }

    undo() {
        if (this.past.length > 0) {
            this.future.push(JSON.parse(JSON.stringify(this.state)));
            this.state = this.past.pop();
            if (this.selectedClipId && !this.state.clips.find(c => c.id === this.selectedClipId)) {
                this.selectedClipId = null;
            }
            this._syncToWidget();
            this.notify();
        }
    }

    redo() {
        if (this.future.length > 0) {
            this.past.push(JSON.parse(JSON.stringify(this.state)));
            this.state = this.future.pop();
            if (this.selectedClipId && !this.state.clips.find(c => c.id === this.selectedClipId)) {
                this.selectedClipId = null;
            }
            this._syncToWidget();
            this.notify();
        }
    }

    clearProject() {
        this.pushHistory();
        this.state.projectName = "New_Composition";
        this.state.savePath = "";
        this.state.clips = [];
        this.selectedClipId = null;
        this._syncToWidget();
        this.notify('NEW_PROJECT');
    }

    setGalleryMode(mode) {
        this.pushHistory();
        this.state.galleryMode = mode;
        this._syncToWidget();
        this.notify('GALLERY_UPDATE');
    }

    setGalleryFolder(path) {
        this.pushHistory();
        this.state.galleryFolder = path;
        this._syncToWidget();
        this.notify('GALLERY_UPDATE');
    }

    addClip(clipData) {
        this.pushHistory();
        const clip = { id: "clip_" + Date.now() + "_" + Math.floor(Math.random() * 1000), ...clipData };
        this.state.clips.push(clip);
        this._syncToWidget();
        this.notify();
    }

    updateClip(id, updates) {
        this.pushHistory();
        const clip = this.state.clips.find(c => c.id === id);
        if (clip) {
            Object.assign(clip, updates);
            this._syncToWidget();
            this.notify();
        }
    }

    removeClip(id) {
        this.pushHistory();
        this.state.clips = this.state.clips.filter(c => c.id !== id);
        if (this.selectedClipId === id) this.selectedClipId = null;
        this._syncToWidget();
        this.notify();
    }
    
    // --- NEW: The Razor Tool Math ---
    splitClip(id, splitTime) {
        const original = this.state.clips.find(c => c.id === id);
        if (!original) return;

        // Ensure the split point is valid (at least 1 frame inside the clip to avoid zero-length ghosts)
        const minGap = 1 / (this.state.fps || 30);
        if (splitTime <= original.timeline_start + minGap || splitTime >= original.timeline_end - minGap) {
            return; 
        }

        this.pushHistory();

        const timeOffset = splitTime - original.timeline_start;
        const newSourceIn = original.source_in + timeOffset;

        // Deep copy ensures properties like crop dictionaries don't share memory references
        const clip2 = { 
            ...JSON.parse(JSON.stringify(original)), 
            id: "clip_" + Date.now() + "_" + Math.floor(Math.random() * 1000) 
        };

        original.timeline_end = splitTime;
        original.source_out = newSourceIn;

        clip2.timeline_start = splitTime;
        clip2.source_in = newSourceIn;

        this.state.clips.push(clip2);
        
        this._syncToWidget();
        this.notify();
    }

    setResolution(w, h) {
        this.pushHistory();
        this.state.resolution = [w, h];
        this._syncToWidget();
        this.notify();
    }
    
    setFps(fps) {
        this.pushHistory();
        this.state.fps = fps;
        this._syncToWidget();
        this.notify();
    }

    setProjectName(name) {
        this.pushHistory();
        this.state.projectName = name;
        this._syncToWidget();
        this.notify();
    }

    setSavePath(path) {
        this.pushHistory();
        this.state.savePath = path;
        this._syncToWidget();
        this.notify();
    }
    
    loadState(newState) {
        this.pushHistory();
        this.state = newState;
        this._syncToWidget();
        this.notify();
    }
}