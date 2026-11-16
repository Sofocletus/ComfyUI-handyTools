export class VideoCompositor {
    constructor(container, stateManager) {
        this.stateManager = stateManager;
        
        container.style.position = "relative"; 
        container.style.display = "flex";
        container.style.justifyContent = "center";
        container.style.alignItems = "center";
        
        this.canvasWrapper = document.createElement("div");
        this.canvasWrapper.style.cssText = "position: relative; max-width: 100%; max-height: 100%; display: flex; border: 2px solid #555; box-sizing: border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.5); overflow: hidden; border-radius: 2px;";
        
        this.canvas = document.createElement("canvas");
        this.canvas.style.maxWidth = "100%";
        this.canvas.style.maxHeight = "100%";
        this.canvas.style.backgroundColor = "#000";
        this.canvas.style.display = "block";
        
        this.canvasWrapper.appendChild(this.canvas);
        container.appendChild(this.canvasWrapper);
        
        this._initWebGL();
        this._buildPreviewUI(this.canvasWrapper);

        this.isPlaying = false;
        this.loopMode = false; 
        this.currentTime = 0;
        this.lastTickTime = 0;
        this.isPreviewing = false; 

        this.pool = [
            this._createHiddenVideo(), this._createHiddenVideo(),
            this._createHiddenVideo(), this._createHiddenVideo()
        ];
        
        this.imageCache = {};
        this.wmCache = {}; 
        
        this.stateManager.subscribe((state) => {
            if (this.canvas.width !== state.resolution[0] || this.canvas.height !== state.resolution[1]) {
                this.canvas.width = state.resolution[0];
                this.canvas.height = state.resolution[1];
                this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            }
            if (!this.isPlaying && !this.isPreviewing) this.drawFrame();
        });
        
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);

        window.addEventListener('ht_preview_mode', (e) => this._startPreviewMode(e.detail));
    }

    _buildPreviewUI(container) {
        this.previewOverlay = document.createElement("div");
        this.previewOverlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none; pointer-events: none; z-index: 50;";
        
        this.vidBefore = document.createElement("video");
        this.vidBefore.muted = true; this.vidBefore.loop = true; this.vidBefore.playsInline = true;
        this.vidBefore.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;";
        
        this.vidAfter = document.createElement("video");
        this.vidAfter.muted = true; this.vidAfter.loop = true; this.vidAfter.playsInline = true;
        this.vidAfter.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; clip-path: inset(0 0 0 50%);";
        
        this.divider = document.createElement("div");
        this.divider.style.cssText = "position: absolute; top: 0; bottom: 0; left: 50%; width: 4px; background: white; cursor: ew-resize; pointer-events: auto; transform: translateX(-50%); box-shadow: 0 0 10px rgba(0,0,0,0.5);";
        
        const handle = document.createElement("div");
        handle.style.cssText = "position: absolute; top: 50%; left: 50%; width: 12px; height: 30px; background: white; border-radius: 2px; transform: translate(-50%, -50%); box-shadow: 0 0 5px rgba(0,0,0,0.5);";
        this.divider.appendChild(handle);

        const lblStyle = "position: absolute; bottom: 12px; font-family: sans-serif; font-weight: bold; color: white; text-shadow: 1px 1px 4px rgba(0,0,0,0.8); font-size: 11px; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px;";
        const lblBefore = document.createElement("div"); lblBefore.innerText = "Original"; lblBefore.style.cssText = lblStyle + "left: 12px;";
        const lblAfter = document.createElement("div"); lblAfter.innerText = "Processed"; lblAfter.style.cssText = lblStyle + "right: 12px;";

        const controlBar = document.createElement("div");
        controlBar.style.cssText = "position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; pointer-events: auto;";

        this.btnPlayPreview = document.createElement("button");
        this.btnPlayPreview.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        this.btnPlayPreview.style.cssText = "background: #2196F3; color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5);";
        this.btnPlayPreview.onclick = () => this._togglePreviewPlayback();

        const btnClose = document.createElement("button");
        btnClose.innerText = "Exit Preview";
        btnClose.style.cssText = "background: #F44336; color: white; border: none; padding: 0 16px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);";
        btnClose.onclick = () => this._stopPreviewMode();

        controlBar.appendChild(this.btnPlayPreview);
        controlBar.appendChild(btnClose);

        this.previewOverlay.appendChild(this.vidBefore);
        this.previewOverlay.appendChild(this.vidAfter);
        this.previewOverlay.appendChild(this.divider);
        this.previewOverlay.appendChild(lblBefore);
        this.previewOverlay.appendChild(lblAfter);
        this.previewOverlay.appendChild(controlBar);
        
        container.appendChild(this.previewOverlay);

        let isDragging = false;
        this.divider.onmousedown = () => isDragging = true;
        window.addEventListener('mouseup', () => isDragging = false);
        window.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.isPreviewing) return;
            const rect = this.previewOverlay.getBoundingClientRect();
            let pct = ((e.clientX - rect.left) / rect.width) * 100;
            pct = Math.max(0, Math.min(100, pct));
            this.divider.style.left = `${pct}%`;
            this.vidAfter.style.clipPath = `inset(0 0 0 ${pct}%)`;
        });
    }

    _startPreviewMode(detail) {
        this.pause(); 
        this.isPreviewing = true;
        this.vidBefore.src = detail.pathBefore;
        this.vidAfter.src = detail.pathAfter;
        this.previewOverlay.style.display = "block";
        this.vidBefore.play();
        this.vidAfter.play();
        this.btnPlayPreview.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    }

    _stopPreviewMode() {
        this.isPreviewing = false;
        this.previewOverlay.style.display = "none";
        this.vidBefore.pause(); this.vidAfter.pause();
        this.vidBefore.src = ""; this.vidAfter.src = "";
        this.drawFrame(); 
    }
    
    _togglePreviewPlayback() {
        if (this.vidBefore.paused) {
            this.vidBefore.play(); this.vidAfter.play();
            this.btnPlayPreview.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        } else {
            this.vidBefore.pause(); this.vidAfter.pause();
            this.btnPlayPreview.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        }
    }

    _initWebGL() {
        this.gl = this.canvas.getContext("webgl", { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true }) || this.canvas.getContext("experimental-webgl");
        const gl = this.gl;
        
        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        const fsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            
            uniform float u_opacity;
            uniform float u_contrast;
            uniform float u_saturation;
            uniform float u_brightness;
            uniform vec3 u_tint;
            uniform vec3 u_shadows;
            uniform vec3 u_midtones;
            uniform vec3 u_highlights;
            
            uniform float u_time;
            uniform float u_blur;
            uniform float u_sharpen;
            uniform float u_vignette_amount;
            uniform float u_vignette_curve;
            uniform float u_grain;
            
            float rand(vec2 co) {
                vec2 p = fract(co * vec2(0.1031, 0.1030));
                p += dot(p, p.yx + 33.33);
                return fract((p.x + p.y) * p.x);
            }
            
            vec3 applyColor(vec3 c) {
                float Y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
                float U = -0.14713 * c.r - 0.28886 * c.g + 0.436 * c.b;
                float V = 0.615 * c.r - 0.51499 * c.g - 0.10001 * c.b;

                Y = (Y - 0.5) * u_contrast + 0.5 + (u_brightness - 1.0);
                U = U * u_saturation;
                V = V * u_saturation;

                c.r = Y + 1.13983 * V;
                c.g = Y - 0.39465 * U - 0.58060 * V;
                c.b = Y + 2.03211 * U;
                
                c *= u_tint;
                
                float lightness = (min(c.r, min(c.g, c.b)) + max(c.r, max(c.g, c.b))) / 2.0;
                float s_mask = clamp((lightness - 0.333) / -0.25 + 0.5, 0.0, 1.0);
                float h_mask = clamp((lightness - 0.666) / 0.25 + 0.5, 0.0, 1.0);
                float m_mask = clamp((lightness - 0.333) / 0.25 + 0.5, 0.0, 1.0) * clamp((lightness - 0.666) / -0.25 + 0.5, 0.0, 1.0);
                
                c += (u_shadows - 1.0) * s_mask;
                c += (u_midtones - 1.0) * m_mask;
                c += (u_highlights - 1.0) * h_mask;
                
                return c;
            }
            
            void main() {
                vec4 baseColor = texture2D(u_image, v_texCoord);
                
                if (u_blur > 0.0) {
                    float b = u_blur / 1000.0;
                    baseColor = (baseColor + 
                             texture2D(u_image, v_texCoord + vec2(b, 0.0)) + 
                             texture2D(u_image, v_texCoord + vec2(-b, 0.0)) + 
                             texture2D(u_image, v_texCoord + vec2(0.0, b)) + 
                             texture2D(u_image, v_texCoord + vec2(0.0, -b))) / 5.0;
                }

                vec4 color = vec4(applyColor(baseColor.rgb), baseColor.a);
                
                if (u_sharpen > 0.0) {
                    float o = 1.0 / 1000.0;
                    vec4 raw_nBlur = (
                        texture2D(u_image, v_texCoord + vec2(o, 0)) + 
                        texture2D(u_image, v_texCoord + vec2(-o, 0)) + 
                        texture2D(u_image, v_texCoord + vec2(0, o)) + 
                        texture2D(u_image, v_texCoord + vec2(0, -o))
                    ) / 4.0;
                    
                    vec3 cc_nBlur = applyColor(raw_nBlur.rgb);
                    color.rgb = color.rgb * (1.0 + u_sharpen) - (cc_nBlur * u_sharpen);
                }

                if (u_vignette_amount > 0.0) {
                    float dist = distance(v_texCoord, vec2(0.5)) * 1.414;
                    float curve = pow(dist, u_vignette_curve);
                    color.rgb -= color.rgb * clamp(curve * u_vignette_amount, 0.0, 1.0);
                }

                if (u_grain > 0.0) {
                    vec2 seed = v_texCoord * 200.0 + vec2(fract(u_time * 1.234), fract(u_time * 0.789));
                    float noise = rand(seed);
                    color.rgb += (noise - 0.5) * u_grain;
                }
                
                color.rgb = clamp(color.rgb, 0.0, 1.0);
                color.a *= u_opacity;
                
                gl_FragColor = color;
            }
        `;
        
        const wmFsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            void main() {
                gl_FragColor = texture2D(u_image, v_texCoord);
            }
        `;

        const compileShader = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        };

        const vs = compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
        const wmFs = compileShader(gl.FRAGMENT_SHADER, wmFsSource);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        
        this.wmProgram = gl.createProgram();
        gl.attachShader(this.wmProgram, vs);
        gl.attachShader(this.wmProgram, wmFs);
        gl.linkProgram(this.wmProgram);

        gl.useProgram(this.program);
        this.posAttr = gl.getAttribLocation(this.program, "a_position");
        this.texAttr = gl.getAttribLocation(this.program, "a_texCoord");
        this.uImage = gl.getUniformLocation(this.program, "u_image");
        
        this.uOpacity = gl.getUniformLocation(this.program, "u_opacity");
        this.uContrast = gl.getUniformLocation(this.program, "u_contrast");
        this.uSaturation = gl.getUniformLocation(this.program, "u_saturation");
        this.uBrightness = gl.getUniformLocation(this.program, "u_brightness");
        this.uTint = gl.getUniformLocation(this.program, "u_tint");
        this.uShadows = gl.getUniformLocation(this.program, "u_shadows");
        this.uMidtones = gl.getUniformLocation(this.program, "u_midtones");
        this.uHighlights = gl.getUniformLocation(this.program, "u_highlights");
        this.uTime = gl.getUniformLocation(this.program, "u_time");
        this.uBlur = gl.getUniformLocation(this.program, "u_blur");
        this.uSharpen = gl.getUniformLocation(this.program, "u_sharpen");
        this.uVignetteAmount = gl.getUniformLocation(this.program, "u_vignette_amount");
        this.uVignetteCurve = gl.getUniformLocation(this.program, "u_vignette_curve");
        this.uGrain = gl.getUniformLocation(this.program, "u_grain");
        
        this.wmPosAttr = gl.getAttribLocation(this.wmProgram, "a_position");
        this.wmTexAttr = gl.getAttribLocation(this.wmProgram, "a_texCoord");
        this.uWmImage = gl.getUniformLocation(this.wmProgram, "u_image");

        this.posBuffer = gl.createBuffer();
        this.texBuffer = gl.createBuffer();
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0
        ]), gl.STATIC_DRAW);
        
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    _createHiddenVideo() {
        const vid = document.createElement("video");
        vid.muted = true;
        vid.preload = "auto";
        vid.crossOrigin = "anonymous";
        vid.addEventListener("seeked", () => { if (!this.isPlaying && !this.isPreviewing) this.drawFrame(); });
        vid.addEventListener("loadeddata", () => { if (!this.isPlaying && !this.isPreviewing) this.drawFrame(); });
        return { element: vid, loadedClipId: null };
    }

    _safePlay(vid) { if (vid.paused) vid.play().catch(() => {}); }
    _safePause(vid) { if (!vid.paused) vid.pause(); }

    getExactDuration() { return Math.max(0.1, this.stateManager.getTimelineDuration()); }
    getProjectDuration() { return Math.max(10, Math.ceil(this.getExactDuration()) + 1); }

    stepFrame(direction) {
        if (this.isPreviewing) return; 
        this.pause();
        const fps = this.stateManager.getState().fps || 30;
        this.seek(this.currentTime + ((1 / fps) * direction));
    }

    play() {
        if (this.isPlaying || this.isPreviewing) return;
        if (this.currentTime >= this.getExactDuration() - 0.05) this.currentTime = 0;

        this.isPlaying = true;
        this.lastTickTime = performance.now();
        
        this._getActiveClips().forEach(clip => {
            if (!this._isImage(clip.filename)) {
                const player = this._getAssignedPlayer(clip);
                if (player) {
                    let targetTime = clip.source_in + (this.currentTime - clip.timeline_start);
                    targetTime = Math.min(targetTime, clip.source_out);
                    if (!player.element.seeking && Math.abs(player.element.currentTime - targetTime) > 0.05) {
                        player.element.currentTime = targetTime;
                    }
                    player.element.muted = clip.muted || false;
                    this._safePlay(player.element);
                }
            }
        });
    }

    pause() {
        this.isPlaying = false;
        if (this.previewData && this.playPauseIcon) {
            this.playPauseIcon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        }
        this.pool.forEach(p => this._safePause(p.element));
    }

    seek(timeInSeconds) {
        if (this.isPreviewing) return;
        this.currentTime = Math.max(0, Math.min(timeInSeconds, this.getProjectDuration()));
        this._getActiveClips().forEach(clip => {
            if (!this._isImage(clip.filename)) {
                const player = this._getAssignedPlayer(clip);
                if (player) {
                    let targetTime = clip.source_in + (this.currentTime - clip.timeline_start);
                    targetTime = Math.min(targetTime, clip.source_out);
                    if (!player.element.seeking && Math.abs(player.element.currentTime - targetTime) > 0.03) {
                        player.element.currentTime = targetTime;
                    }
                }
            }
        });
        if (!this.isPlaying) this.drawFrame();
    }

    togglePlayback() { this.isPlaying ? this.pause() : this.play(); }

    _loop() {
        if (this.isPreviewing) {
            if (!this.vidBefore.paused && !this.vidAfter.paused) {
                if (Math.abs(this.vidBefore.currentTime - this.vidAfter.currentTime) > 0.05) {
                    this.vidAfter.currentTime = this.vidBefore.currentTime;
                }
            }
        } else if (this.isPlaying) {
            const now = performance.now();
            const deltaMs = Math.min(now - this.lastTickTime, 100);
            this.lastTickTime = now;
            this.currentTime += deltaMs / 1000;
            
            const exactDur = this.getExactDuration();
            if (this.currentTime >= exactDur) {
                if (this.loopMode) this.currentTime = this.currentTime % exactDur;
                else { this.pause(); this.currentTime = exactDur; }
            }
            this.drawFrame();
        }
        requestAnimationFrame(this._loop);
    }

    _getActiveClips() {
        return this.stateManager.getState().clips.filter(c => 
            this.currentTime >= c.timeline_start && this.currentTime < c.timeline_end
        );
    }

    _isImage(filename) {
        if (!filename) return false;
        const ext = filename.split('.').pop().toLowerCase();
        return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext);
    }

    _getAssignedImage(clip) {
        if (!this.imageCache[clip.id]) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = `/handytools/media?path=${encodeURIComponent(clip.filename)}`;
            img.onload = () => { if (!this.isPlaying && !this.isPreviewing) this.drawFrame(); };
            this.imageCache[clip.id] = img;
        }
        return this.imageCache[clip.id];
    }
    
    _getAssignedWatermark(path) {
        if (!this.wmCache[path]) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = `/handytools/media?path=${encodeURIComponent(path)}`;
            img.onload = () => {
                const gl = this.gl;
                img.glTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, img.glTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                if (!this.isPlaying && !this.isPreviewing) this.drawFrame();
            };
            this.wmCache[path] = img;
        }
        return this.wmCache[path];
    }
    
    _renderToWebGL(mediaSource, clipData, sourceWidth, sourceHeight) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.enableVertexAttribArray(this.texAttr);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
        gl.vertexAttribPointer(this.texAttr, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mediaSource);
        gl.uniform1i(this.uImage, 0);
        
        const color = clipData.color || {};
        const cEnabled = color.enabled !== false; 
        
        gl.uniform1f(this.uOpacity, cEnabled && color.opacity !== undefined ? color.opacity : 1.0);
        gl.uniform1f(this.uContrast, cEnabled && color.contrast !== undefined ? color.contrast : 1.0);
        gl.uniform1f(this.uSaturation, cEnabled && color.saturation !== undefined ? color.saturation : 1.0);
        gl.uniform1f(this.uBrightness, cEnabled && color.brightness !== undefined ? color.brightness : 1.0);
        
        const tint = cEnabled && color.tint ? color.tint : { r: 1, g: 1, b: 1 };
        gl.uniform3f(this.uTint, tint.r, tint.g, tint.b);

        const sh = cEnabled && color.shadows ? color.shadows : { r: 1, g: 1, b: 1 };
        const md = cEnabled && color.midtones ? color.midtones : { r: 1, g: 1, b: 1 };
        const hi = cEnabled && color.highlights ? color.highlights : { r: 1, g: 1, b: 1 };
        gl.uniform3f(this.uShadows, sh.r, sh.g, sh.b);
        gl.uniform3f(this.uMidtones, md.r, md.g, md.b);
        gl.uniform3f(this.uHighlights, hi.r, hi.g, hi.b);

        let fxBlur = 0, fxSharpen = 0, fxVignetteAmount = 0, fxVignetteCurve = 3.0, fxGrain = 0;
        if (clipData.effects && clipData.effects.enabled) {
            clipData.effects.stack.forEach(fx => {
                if (this.previewData && this.previewData.fxId !== 'all' && this.previewData.fxId === fx.id) return;
                if (fx.type === 'blur') fxBlur += fx.radius;
                if (fx.type === 'sharpen') fxSharpen += fx.intensity;
                if (fx.type === 'vignette') { fxVignetteAmount += fx.amount; fxVignetteCurve = fx.curve !== undefined ? fx.curve : 3.0; }
                if (fx.type === 'grain') fxGrain += fx.strength;
            });
        }
        
        gl.uniform1f(this.uTime, performance.now() / 1000.0);
        gl.uniform1f(this.uBlur, fxBlur);
        gl.uniform1f(this.uSharpen, fxSharpen);
        gl.uniform1f(this.uVignetteAmount, fxVignetteAmount);
        gl.uniform1f(this.uVignetteCurve, fxVignetteCurve);
        gl.uniform1f(this.uGrain, fxGrain);
        
        const crop = clipData.crop || {};
        const cW = this.canvas.width;
        const cH = this.canvas.height;
        const cropW = crop.w !== undefined ? crop.w : sourceWidth;
        const cropH = crop.h !== undefined ? crop.h : sourceHeight;
        const scale = crop.scale !== undefined ? crop.scale : 1.0;
        
        const finalW = cropW * scale;
        const finalH = cropH * scale;
        const offsetX = crop.x !== undefined ? crop.x : 0;
        const offsetY = crop.y !== undefined ? crop.y : 0;
        
        const finalX = (cW - finalW) / 2 + offsetX;
        const finalY = (cH - finalH) / 2 + offsetY;
        
        const x1 = (finalX / cW) * 2.0 - 1.0;
        const x2 = ((finalX + finalW) / cW) * 2.0 - 1.0;
        const y1 = 1.0 - (finalY / cH) * 2.0;
        const y2 = 1.0 - ((finalY + finalH) / cH) * 2.0;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            x1, y1, x1, y2, x2, y1, x2, y2
        ]), gl.DYNAMIC_DRAW);
        
        gl.enableVertexAttribArray(this.posAttr);
        gl.vertexAttribPointer(this.posAttr, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawFrame() {
        const gl = this.gl;
        const activeClips = this._getActiveClips();
        const activeIds = activeClips.map(c => c.id);

        this.pool.forEach(p => {
            if (!activeIds.includes(p.loadedClipId)) {
                if (!p.element.muted) p.element.muted = true;
                this._safePause(p.element);
            }
        });
        
        const videoClip = activeClips.find(c => c.track === 0);
        const audioClip = activeClips.find(c => c.track === 1);

        // --- ANTI-FLICKER LOCK ---
        // Prevents wiping the canvas to black if the active HTML5 video is asynchronously seeking
        let isImg = false;
        let img = null;
        let vid = null;

        if (videoClip) {
            isImg = this._isImage(videoClip.filename);
            if (isImg) {
                img = this._getAssignedImage(videoClip);
                if (!img.complete || img.naturalWidth === 0) return; 
            } else {
                const player = this._getAssignedPlayer(videoClip);
                vid = player.element;
                if (vid.readyState < 2 || vid.videoWidth === 0) return; 
            }
        }

        // Safe to clear the canvas now that we know we have a valid frame or an empty timeline gap
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (this.previewData) {
            let expectedTime = this.currentTime - this.previewData.loopStart;
            if (this.isPlaying) {
                if (this.vidBefore.paused) this._safePlay(this.vidBefore);
                if (Math.abs(this.vidBefore.currentTime - expectedTime) > 0.03) {
                    this.vidBefore.currentTime = expectedTime;
                }
            } else {
                if (Math.abs(this.vidBefore.currentTime - expectedTime) > 0.01) {
                    this.vidBefore.currentTime = expectedTime;
                }
            }
        }

        if (audioClip) {
            const player = this._getAssignedPlayer(audioClip);
            const aVid = player.element;
            let targetTime = audioClip.source_in + (this.currentTime - audioClip.timeline_start);
            targetTime = Math.min(targetTime, audioClip.source_out);
            
            if (!this.isPlaying && Math.abs(aVid.currentTime - targetTime) > 0.05 && !aVid.seeking) {
                aVid.currentTime = targetTime;
            }
            if (this.isPlaying) {
                aVid.muted = false;
                aVid.volume = Math.max(0, Math.min(1.0, audioClip.volume !== undefined ? audioClip.volume : 1.0));
                if (targetTime >= audioClip.source_out) this._safePause(aVid);
                else this._safePlay(aVid);
            } else {
                this._safePause(aVid);
            }
        }

        if (videoClip) {
            if (isImg) {
                this._renderToWebGL(img, videoClip, img.naturalWidth, img.naturalHeight);
            } else {
                if (this.isPlaying) {
                    vid.muted = videoClip.muted || false;
                    vid.volume = Math.max(0, Math.min(1.0, videoClip.volume !== undefined ? videoClip.volume : 1.0));
                    let targetTime = videoClip.source_in + (this.currentTime - videoClip.timeline_start);
                    if (targetTime >= videoClip.source_out) this._safePause(vid);
                    else this._safePlay(vid);
                }
                this._renderToWebGL(vid, videoClip, vid.videoWidth, vid.videoHeight);
            }
        }

        const state = this.stateManager.getState();
        if (state.watermark && state.watermark.enabled && state.watermark.path) {
            const wmImg = this._getAssignedWatermark(state.watermark.path);
            if (wmImg && wmImg.complete && wmImg.naturalWidth > 0 && wmImg.glTexture) {
                gl.useProgram(this.wmProgram);
                gl.enableVertexAttribArray(this.wmTexAttr);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
                gl.vertexAttribPointer(this.wmTexAttr, 2, gl.FLOAT, false, 0, 0);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, wmImg.glTexture);
                gl.uniform1i(this.uWmImage, 0);

                const cW = this.canvas.width;
                const cH = this.canvas.height;
                const wmScale = state.watermark.scale !== undefined ? state.watermark.scale : 1.0;
                const wW = wmImg.naturalWidth * wmScale;
                const wH = wmImg.naturalHeight * wmScale;
                const wmX = state.watermark.x !== undefined ? state.watermark.x : 20.0;
                const wmY = state.watermark.y !== undefined ? state.watermark.y : 20.0;

                const finalX = cW - wW - wmX;
                const finalY = cH - wH - wmY;

                const x1 = (finalX / cW) * 2.0 - 1.0;
                const x2 = ((finalX + wW) / cW) * 2.0 - 1.0;
                const y1 = 1.0 - (finalY / cH) * 2.0;
                const y2 = 1.0 - ((finalY + wH) / cH) * 2.0;

                gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                    x1, y1, x1, y2, x2, y1, x2, y2
                ]), gl.DYNAMIC_DRAW);
                
                gl.enableVertexAttribArray(this.wmPosAttr);
                gl.vertexAttribPointer(this.wmPosAttr, 2, gl.FLOAT, false, 0, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        }
    }

    _getAssignedPlayer(clip) {
        let player = this.pool.find(p => p.loadedClipId === clip.id);
        if (!player) {
            const activeClips = this._getActiveClips();
            player = this.pool.find(p => !activeClips.some(ac => ac.id === p.loadedClipId));
            if (!player) player = this.pool[0]; 
            
            player.element.src = `/handytools/media?path=${encodeURIComponent(clip.filename)}`;
            player.loadedClipId = clip.id;
            player.element.load();
        }
        return player;
    }
}