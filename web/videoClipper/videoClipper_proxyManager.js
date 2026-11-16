export async function handleProxyCreation(ctx, ui) {
    const { proxyBtn, proxyBtnText, proxyAllCheck, updateProxyBtnStatus } = ui;

    if (!ctx.state.currentDir) return;

    const getTaskId = () => 'task_' + Math.random().toString(36).substring(2, 11) + Date.now();

    // ==========================================
    // CANCELLATION HANDLER
    // ==========================================
    if (ctx.isProxyProcessing) {
        if (ctx.proxyAbortController) {
            ctx.proxyAbortController.abort();
        }
        if (ctx.proxyTaskId) {
            ctx.api.fetchApi("/video_clipper/cancel_task", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task_id: ctx.proxyTaskId })
            }).catch(() => {});
        }
        ctx.isProxyProcessing = false;
        
        proxyBtn.style.backgroundColor = "";
        proxyBtn.style.borderColor = "";
        proxyBtn.style.color = "";
        proxyBtn.className = "vc-btn vc-btn-subtle";
        proxyBtnText.innerText = "Cancelling...";
        return;
    }

    // ==========================================
    // BATCH ALL PROXY CREATION
    // ==========================================
    if (proxyAllCheck.checked) {
        ctx.isProxyProcessing = true;
        ctx.proxyAbortController = new AbortController();
        
        proxyBtnText.innerText = "Scanning...";
        const threshold = ctx.state.appSettings.proxyThresholdMb || 250;

        try {
            const listRes = await ctx.api.fetchApi(`/video_clipper/video_list?dir=${encodeURIComponent(ctx.state.currentDir)}`);
            const listData = await listRes.json();
            const videos = listData.videos || [];

            if (videos.length === 0) {
                proxyBtnText.innerText = "No videos found";
                ctx.isProxyProcessing = false;
                setTimeout(() => updateProxyBtnStatus(), 2000);
                return;
            }

            const toProcess = [];
            for (const vid of videos) {
                const infoRes = await ctx.api.fetchApi(`/video_clipper/file_info?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(vid)}`);
                const infoData = await infoRes.json();
                
                if (!infoData.hasProxy && (infoData.sizeMb >= threshold || infoData.needsProxyFormat)) {
                    toProcess.push(vid);
                }
            }

            if (toProcess.length === 0) {
                proxyBtnText.innerText = "None required";
                ctx.isProxyProcessing = false;
                setTimeout(() => updateProxyBtnStatus(), 2500);
                return;
            }

            let wasAborted = false;
            for (let i = 0; i < toProcess.length; i++) {
                if (!ctx.isProxyProcessing) { wasAborted = true; break; }
                const vid = toProcess[i];
                ctx.proxyTaskId = getTaskId();
                
                // Clear the orange warning colors so the red danger class works
                proxyBtn.style.backgroundColor = "";
                proxyBtn.style.borderColor = "";
                proxyBtn.style.color = "";
                proxyBtn.className = "vc-btn vc-btn-danger";
                
                proxyBtnText.innerText = `Making Proxy ${i + 1} of ${toProcess.length}, Click to Cancel.`;
                
                try {
                    const batchRes = await ctx.api.fetchApi("/video_clipper/create_proxy", {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "X-Task-ID": ctx.proxyTaskId
                        },
                        body: JSON.stringify({ 
                            directory: ctx.state.currentDir, 
                            filename: vid, 
                            skip_existing: true,
                            hw_encoder: ctx.state.appSettings.hwEncoder 
                        }),
                        signal: ctx.proxyAbortController.signal
                    });
                    const batchData = await batchRes.json();
                    
                    if (batchData.status === "success" || batchData.status === "skipped") {
                        if (ctx.gallery && ctx.gallery.setFileHasProxy) {
                            ctx.gallery.setFileHasProxy(vid, true);
                        }
                    }
                } catch (err) {
                    if (err.name === 'AbortError') { wasAborted = true; break; }
                    console.error(err);
                }
            }

            ctx.isProxyProcessing = false;
            proxyBtn.className = "vc-btn vc-btn-subtle";
            
            if (wasAborted) {
                proxyBtnText.innerText = "⚠ Cancelled";
            } else {
                proxyBtnText.innerText = `✔ ${toProcess.length} Done`;
            }
            
            if (ctx.state.currentFile) {
                ctx.checkProxyStatus(ctx.state.currentFile);
            }
            setTimeout(() => updateProxyBtnStatus(), 3000);
            
        } catch (err) {
            ctx.isProxyProcessing = false;
            proxyBtnText.innerText = "Batch Failed";
            setTimeout(() => updateProxyBtnStatus(), 3000);
        }
        return;
    }

    // ==========================================
    // SINGLE VIDEO PROXY
    // ==========================================
    if (!ctx.state.currentFile) return;

    if (ctx.state.isProxyActive) {
        ctx.state.isProxyActive = false;
        proxyBtn.className = "vc-btn vc-btn-subtle";
        proxyBtnText.innerText = "Create Proxy";
        ctx.player.setVideoSource(false);
        ctx.saveUiState();
        updateProxyBtnStatus();
        return;
    }

    const res = await ctx.api.fetchApi(`/video_clipper/check_proxy?dir=${encodeURIComponent(ctx.state.currentDir)}&filename=${encodeURIComponent(ctx.state.currentFile)}`);
    const check = await res.json();
    if (check.exists) {
        ctx.state.isProxyActive = true;
        proxyBtn.className = "vc-btn vc-btn-success";
        proxyBtnText.innerText = "Proxy Active";
        ctx.player.setVideoSource(true);
        if (ctx.gallery && ctx.gallery.setFileHasProxy) {
            ctx.gallery.setFileHasProxy(ctx.state.currentFile, true);
        }
        ctx.saveUiState();
        return;
    }

    ctx.isProxyProcessing = true;
    ctx.proxyAbortController = new AbortController();
    ctx.proxyTaskId = getTaskId();
    
    // Clear orange warning colors
    proxyBtn.style.backgroundColor = "";
    proxyBtn.style.borderColor = "";
    proxyBtn.style.color = "";
    proxyBtn.className = "vc-btn vc-btn-danger";
    proxyBtnText.innerText = "Making Proxy, Click to Cancel.";

    try {
        const genRes = await ctx.api.fetchApi("/video_clipper/create_proxy", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-Task-ID": ctx.proxyTaskId
            },
            body: JSON.stringify({ 
                directory: ctx.state.currentDir, 
                filename: ctx.state.currentFile,
                hw_encoder: ctx.state.appSettings.hwEncoder
            }),
            signal: ctx.proxyAbortController.signal
        });
        
        const result = await genRes.json();
        if (result.status === "success" || result.status === "skipped") {
            ctx.state.isProxyActive = true;
            proxyBtn.className = "vc-btn vc-btn-success";
            proxyBtnText.innerText = "Proxy Active";
            ctx.player.setVideoSource(true);
            ctx.loadAudioPeaks(ctx.state.currentFile, true);
            
            if (ctx.gallery && ctx.gallery.setFileHasProxy) {
                ctx.gallery.setFileHasProxy(ctx.state.currentFile, true);
            }
            ctx.saveUiState();
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            proxyBtn.className = "vc-btn vc-btn-subtle";
            proxyBtnText.innerText = "⚠ Cancelled";
        } else {
            proxyBtn.className = "vc-btn vc-btn-danger";
            proxyBtnText.innerText = "Failed";
        }
        setTimeout(() => updateProxyBtnStatus(), 3000);
    } finally {
        ctx.isProxyProcessing = false;
    }
}