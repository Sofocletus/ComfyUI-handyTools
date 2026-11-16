# Technical Reference: Video Pipeline & Processing Architecture

This reference outlines the technical specification of the **Minimax Video Clipper** node for ComfyUI. It details media loading, proxy workflows, frame-rate conforming, preview rendering, and export compilation.

---

## 1. System Architecture & Topology

The node uses a decoupled client-server architecture:
* **Backend (`minimax_videoClipper.py`):** Runs on Python/Aiohttp within ComfyUI’s `PromptServer`. It inspects media containers via `ffprobe`, executes slicing/conforming pipelines via `ffmpeg`, and handles file serving and JSON-based state persistence.
* **Frontend (`web/videoClipper/`):** Injected as an HTML/CSS/JS DOM widget inside the ComfyUI canvas. It manages an interactive HTML5 video stage, frame/audio canvas drawing, non-blocking seek queues, and real-time framing previews.

---

## 2. Media Ingestion & Video Serving

### Directory Resolution
The backend queries directories designated by `folder_paths.get_input_directory()` (or a user-supplied custom path) for common video containers (`.mp4`, `.webm`, `.mkv`, `.mov`, `.avi`).

### Streaming Endpoints
* **Full File Serving (`/video_clipper/serve_video`):** Serves target files via `aiohttp.web.FileResponse`. When previewing large, high-bitrate, or intra-frame-sparse files, seeking speed depends on container keyframe cadence.
* **Audio Waveform Generation (`/video_clipper/audio_peaks`):** Runs a headless FFmpeg process downsampling the first audio channel to 8-bit unsigned PCM (`-ac 1 -filter:a aresample=1000 -f u8 -c:a pcm_u8`). Peaks are normalized to $[-1.0, 1.0]$ floats for canvas waveform visualization.

---

## 3. Proxy Generation & Utilization

To eliminate playback lag and timeline scrubbing latency on high-resolution source material (such as 4K ProRes or H.265/HEVC), the node includes an integrated proxy system.

### Proxy Specifications
* **Storage Path:** `<project_dir>/_clips/_temp/<source_name>_proxy.mp4`
* **Transcode Parameters:**
  ```bash
  ffmpeg -y -i <source> \
    -vf "scale=-2:360" \
    -c:v libx264 -preset ultrafast -tune fastdecode \
    -g 2 -crf 26 -pix_fmt yuv420p \
    -c:a copy <proxy_output>
  ```
* **Key Configuration Details:**
  * **Scale:** Conforms vertical resolution to `360p` (`scale=-2:360`), matching the display canvas height and maintaining native aspect ratio.
  * **Intra-frame Interval (`-g 2`):** Forces an I-frame (keyframe) at least every 2 frames. This allows near-instantaneous scrubbing along the playhead without decoder lag.
  * **Decoder Optimization (`-tune fastdecode`):** Strips advanced predictive inter-frame dependencies (cabac, deblocking loop filters).
  * **Audio (`-c:a copy`):** Preserves original audio timing and track count without re-encoding.

### Seamless Switching
When a proxy is created or active, the frontend `<video>` source switches between the raw media and the proxy file while preserving the current playback time (`currentTime`). The active export pipeline **always uses the original source media**, never the proxy.

---

## 4. Frame Calculations & Temporal Standards

The tool prepares training slices for video diffusion models (specifically Minimax / Hailuo topologies) that require conditioning frame counts matching:

$$\text{Frames} = 22 + (n \times 17) \quad \text{for } n \ge 0 \quad (22, 39, 56, 73, 90, 107, 124, \dots)$$

### Time & Frame Conversions
Internally, the timeline maps seconds to discrete frames using a conformed 24 fps timebase:
* $\text{Frame} = \text{round}(\text{Time} \times 24)$
* $\text{Time} = \frac{\text{Frame}}{24}$

### Playhead & Seek Engine
* The native browser `video.fastSeek()` is bypassed in favor of explicit `video.currentTime = targetTime` assignments. This prevents the browser from snapping backwards to distant I-frames.
* A serialized seek queue prevents race conditions. In-flight `timeupdate` events emitted by the HTML5 video engine while seeking are suppressed to avoid overriding active clip selections on clip boundaries.

---

## 5. Frame-Rate Conforming ("Load as 24fps")

To train temporal layers in video diffusion models, **duplicate frames must be avoided**. Duplicate frames introduce motion judder, ruin temporal optical flow, and teach diffusion backbones to generate static freeze-frames.

When **"Load as 24fps"** is enabled (default), the backend probes the raw stream rate via `ffprobe` (`r_frame_rate`) and applies a dynamic filter pipeline:

```
                     ┌───────────────────────┐
                     │   Source Frame Rate   │
                     └───────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       High FPS (≥ 45 fps)              Near 24 fps (< 45 fps)
     (e.g., 50, 59.94, 60)              (e.g., 23.976, 25, 30)
                 │                               │
                 ▼                               ▼
      Decimate by 2 (Drop alt)           Retimed with setpts
   select='not(mod(n\,2))'                setpts=N/(24*TB)
                 │                               │
                 ▼                               ▼
        Retimed with setpts                Speed shifted
         setpts=N/(24*TB)               (e.g., 25fps = 4% slow)
                 │                               │
                 ▼                               ▼
           Speed shifted                  Pitch-preserved
      (e.g., 60fps = 20% slow)           Audio time-stretch
                 │                        atempo=24/src_fps
                 ▼
          Pitch-preserved
        Audio time-stretch
      atempo=24/(src_fps/2)
```

### 1. High Frame Rates ($\ge 45\text{ fps}$, e.g., 50, 59.94, 60 fps)
* **Step 1: Decimation:** Drops every second frame (`select='not(mod(n\,2))'`). A 60 fps input is decimated down to 30 unique, consecutive photographic samples per second without frame interpolation or duplication.
* **Step 2: Timebase Re-timing:** Splays the remaining frames onto a strict 24.0 fps container (`setpts=N/(24*TB)` with container flag `-r 24`).
* **Playback Effect:** A 60 fps video plays back at $0.8\times$ real-time speed (a smooth 20% cinematic slow-down).
* **Audio Handling:** The audio track is time-stretched using `atempo=24/(src_fps / 2)` (for 60 fps: `atempo=0.8`). This maintains synchronization with the video while preserving vocal pitch.

### 2. Standard / Near-24 Frame Rates ($23.976, 25, 29.97, 30\text{ fps}$)
* **Frame Retiming:** Consecutive frames are preserved without decimation. Frames are re-stamped using `setpts=N/(24*TB) -r 24`.
* **Audio Handling:** Audio is time-stretched with `atempo=24/src_fps` (e.g., 25 fps PAL footage is slowed by 4.17%, matching standard film telecine transfer).

### 3. Disabled ("Load as 24fps" Unchecked)
The video filter chain retains the native container speed and original frame cadence.

---

## 6. Framing, Aspect Ratios, and Canvas Modes

The node manages aspect ratio adjustments, pixel scaling, and crop overlays across two operational modes:

### Mode 1: Crop Mode
* **Viewer Behavior:** The source footage displays at its native aspect ratio using `object-fit: contain`. A vector crop overlay reflects the framed sub-window.
* **Boundary Guard (Red Warning Frame):**
  * When the user-selected resolution fits entirely within the native frame, the bounding box renders in **green** (`#55ff88`).
  * If the target crop rectangle extends beyond the photographic boundaries of the source file (for example, attempting a $16:9$ crop ($960 \times 544$) over a $1:1$ square video ($512 \times 512$)), the bounding frame turns **red** (`#ff4444`) with an illuminated glow, extending over the letterbox/pillarbox void.
* **FFmpeg Padding Engine:** To avoid stretching when exporting out-of-bounds crops, the backend pads the missing canvas with black (`color=black`) before cropping and downscaling:
  ```bash
  pad=w='max(iw,TARGET_W)':h='max(ih,TARGET_H)':x='max(0,(TARGET_W-iw)*OFF_X)':y='max(0,(TARGET_H-ih)*OFF_Y)':color=black, \
  crop=w=TARGET_W:h=TARGET_H:x='max(0,(iw-TARGET_W)*OFF_X)':y='max(0,(ih-TARGET_H)*OFF_Y)', \
  scale=ACTUAL_W:ACTUAL_H
  ```

### Mode 2: Stretch Mode
* **Viewer Behavior:** Bypasses the spatial crop overlay. The `<video>` element dynamically switches to `object-fit: fill` and reshapes to the target aspect ratio, giving the user an instant, live preview of anamorphic distortion.
* **FFmpeg Filter:** Eliminates the `crop` and `pad` filters, scaling the input frame directly to the export dimensions:
  ```bash
  scale=ACTUAL_W:ACTUAL_H
  ```

---

## 7. Audio & Video Export Pipelines

Clips are exported independently via the `/video_clipper/export` endpoint. Each clip contains independent toggles for `include_video` and `include_audio`.

### Pipeline Matrix

| Include Video | Include Audio | Output Format | FFmpeg Processing Strategy |
| :---: | :---: | :---: | :--- |
| **ON** | **ON** | `.mp4` (H.264 / AAC) | Applies crop/pad/scale + 24fps conform. Audio receives pitch-preserving `atempo` adjustment encoded at 192 kbps AAC. |
| **ON** | **OFF** | `.mp4` (H.264 / No Audio)| Mutes and strips all audio streams using `-an`. |
| **OFF** | **ON** | `.wav` (PCM 16-bit) | Disables video encoding using `-vn`. Extracts a clean 16-bit uncompressed audio slice via `-c:a pcm_s16le`. If 24fps conform is enabled, `atempo` is applied so the WAV duration matches the conformed video. |

### Directory Structuring
* Standard video exports are placed in `<project_dir>/_clips/`.
* When **Folder by resolution** is checked, video outputs are grouped into subdirectories matching their dimensions (e.g., `<project_dir>/_clips/960x544/`).
* Standalone audio files are routed to `<project_dir>/_clips/audio/`.

---

## 8. State Persistence Schema

Two layers of state persistence maintain session integrity across UI refreshes, node tab switches, and batch exports:

### Layer 1: Workspace UI State (`ui_state.json`)
Saved at `web/videoClipper/ui_state.json`. It tracks:
* Active project folder directory.
* Currently selected video filename and playhead timestamp (`currentTime`).
* Playhead timeline zoom level ($0\text{--}10$).
* Global UI toggles: `Force 24fps`, `Custom Name`, `Folder by resolution`, `Export Selected`, `All in Gallery`.
* Default crop/aspect-ratio slider positions.

### Layer 2: Clip Edit Files (`_clips/editFiles/<video_name>.json`)
Each source video stores its defined slices alongside its file on disk:
```json
{
  "selectedClipIndex": 0,
  "clips": [
    {
      "id": "Clip001",
      "startFrame": 0,
      "endFrame": 56,
      "ar": "16:9",
      "mp": "0.5",
      "targetWidth": 960,
      "targetHeight": 544,
      "offsetX": 0.5,
      "offsetY": 0.5,
      "cropMode": true,
      "cropScale": 1.0,
      "actualExportW": 960,
      "actualExportH": 544,
      "includeVideo": true,
      "includeAudio": true,
      "selectedForExport": true
    }
  ]
}
```
* **Gallery Visual Indicators:** When `_clips/editFiles/<video_name>.json` contains one or more clips, the gallery thumbnail dynamically receives the `.has-state` class, rendering an outline in green (`#55ff88`). When active, it displays a 3px cyan selection border with a luminous green accent glow. If all clips are deleted, the JSON file is purged and the green indicator is removed.