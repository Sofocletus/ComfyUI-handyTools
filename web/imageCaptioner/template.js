import {
    ICON_SORT, ICON_GRID, ICON_LIST, ICON_REFRESH, ICON_TRASH, ICON_PLUS,
    ICON_SORT_A_UP, ICON_SORT_A_DOWN, ICON_SORT_CLOCK_UP, ICON_SORT_CLOCK_DOWN, 
    ICON_SORT_W_UP, ICON_SORT_W_DOWN, ICON_SORT_H_UP, ICON_SORT_H_DOWN,
    ICON_ARROW_UP, ICON_ARROW_DOWN, ICON_FILTER, ICON_SEARCH, ICON_TAG, 
    ICON_FLAG, ICON_TEXT, ICON_INVERT, ICON_CHECK_SQUARE, ICON_SELECT_ALL, 
    ICON_SELECT_NONE, ICON_MISSING,
    ICON_CROP, ICON_ZOOM_FIT, ICON_ZOOM_100, ICON_SAVE, ICON_AUTO_RESIZE, ICON_WAND, ICON_LOADER, ICON_RESIZE, ICON_LINK
} from "./icons.js";

export function getCaptionerHTML() {
    return `
        <div id="ht-custom-prompt" class="ht-modal-overlay ht-hidden">
            <div class="ht-modal-box">
                <div id="ht-prompt-message"></div>
                <input type="text" id="ht-prompt-input" class="ht-input">
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button class="ht-btn" id="ht-prompt-cancel" style="background: #333; color: #aaa;">Cancel</button>
                    <button class="ht-btn" id="ht-prompt-ok">OK</button>
                </div>
            </div>
        </div>

        <div id="ht-confirm-prompt" class="ht-modal-overlay ht-hidden">
            <div class="ht-modal-box">
                <div id="ht-confirm-message" style="font-size: 13px; color: #ffaaaa;"></div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                    <button class="ht-btn" id="ht-confirm-cancel" style="background: #333; color: #aaa;">Cancel</button>
                    <button class="ht-btn danger" id="ht-confirm-ok" style="background: #551111; color: #ffaaaa; border: 1px solid #ff4444;">Proceed</button>
                </div>
            </div>
        </div>

        <div id="ht-gallery-ctx-menu" class="ht-hidden" style="position: absolute; background: #161616; border: 1px solid #444; border-radius: 4px; padding: 4px; z-index: 2000; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 2px; width: 140px;">
            <button class="ht-tool-btn" id="ht-ctx-sel-all" style="width: 100%; justify-content: flex-start; padding: 6px 8px; font-size: 11px; height: auto;">${ICON_SELECT_ALL} <span style="margin-left:8px;">Select All</span></button>
            <button class="ht-tool-btn" id="ht-ctx-sel-none" style="width: 100%; justify-content: flex-start; padding: 6px 8px; font-size: 11px; height: auto;">${ICON_SELECT_NONE} <span style="margin-left:8px;">Select None</span></button>
            <button class="ht-tool-btn" id="ht-ctx-sel-inv" style="width: 100%; justify-content: flex-start; padding: 6px 8px; font-size: 11px; height: auto;">${ICON_INVERT} <span style="margin-left:8px;">Invert Selection</span></button>
            <div style="border-top: 1px solid #333; margin: 2px 0;"></div>
            <button class="ht-tool-btn danger" id="ht-ctx-delete" style="width: 100%; justify-content: flex-start; padding: 6px 8px; font-size: 11px; height: auto;">${ICON_TRASH} <span style="margin-left:8px;">Delete Image</span></button>
        </div>

        <div class="ht-left-section">
            <div class="ht-toolbar" style="justify-content: space-between; gap: 0;">
                <button class="ht-tool-btn" id="ht-btn-filter" title="Filter Menu">${ICON_FILTER}</button>
                <button class="ht-tool-btn" id="ht-btn-sort" title="Sort Gallery"></button>
                <button class="ht-tool-btn" id="ht-btn-select" title="Selection Menu">${ICON_CHECK_SQUARE}</button>
                <button class="ht-tool-btn" id="ht-btn-refresh" title="Refresh Folder">${ICON_REFRESH}</button>
                <button class="ht-tool-btn" id="ht-btn-toggle-columns" title="Toggle Grid View">${ICON_GRID}</button>
                <button class="ht-tool-btn danger" id="ht-btn-delete" title="Move to Trash">${ICON_TRASH}</button>
                
                <div class="ht-sort-menu ht-hidden" id="ht-sort-menu">
                    <span style="font-size:12px; color:#aaa; margin-bottom:2px;">Sort Gallery</span>
                    <div style="display: flex; gap: 6px;">
                        <button class="ht-tool-btn gal-sort-opt" data-mode="alpha" data-inv="false" title="A-Z">${ICON_SORT_A_DOWN}</button>
                        <button class="ht-tool-btn gal-sort-opt" data-mode="alpha" data-inv="true" title="Z-A">${ICON_SORT_A_UP}</button>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="ht-tool-btn gal-sort-opt" data-mode="new" data-inv="false" title="Newest First">${ICON_SORT_CLOCK_DOWN}</button>
                        <button class="ht-tool-btn gal-sort-opt" data-mode="new" data-inv="true" title="Oldest First">${ICON_SORT_CLOCK_UP}</button>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="ht-tool-btn gal-sort-opt" data-mode="width" data-inv="false" title="Width Descending">${ICON_SORT_W_DOWN}</button>
                        <button class="ht-tool-btn gal-sort-opt" data-mode="width" data-inv="true" title="Width Ascending">${ICON_SORT_W_UP}</button>
                        <button class="ht-tool-btn gal-sort-opt" data-mode="height" data-inv="false" title="Height Descending">${ICON_SORT_H_DOWN}</button>
                        <button class="ht-tool-btn gal-sort-opt" data-mode="height" data-inv="true" title="Height Ascending">${ICON_SORT_H_UP}</button>
                    </div>
                </div>
                
                <div class="ht-selection-menu ht-hidden" id="ht-selection-menu">
                    <span style="font-size:12px; color:#aaa; margin-bottom:2px;">Selection Options</span>
                    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                        <button class="ht-tool-btn" id="ht-sel-all" title="Select All Visible">${ICON_SELECT_ALL}</button>
                        <button class="ht-tool-btn" id="ht-sel-none" title="Select None">${ICON_SELECT_NONE}</button>
                        <button class="ht-tool-btn" id="ht-sel-inv" title="Invert Selection (Visible)">${ICON_INVERT}</button>
                    </div>
                    <div style="font-size:12px; color:#aaa; margin-bottom:2px;">Selection Sets:</div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <select id="ht-sel-preset-select" class="ht-input" style="padding:2px 4px; font-size:11px; height:24px; min-width:110px;">
                            <option value="">-- Sets --</option>
                        </select>
                        <button class="ht-tool-btn" id="ht-sel-preset-save" title="Save Selection Set" style="width:24px; height:24px; padding:4px;">${ICON_PLUS}</button>
                        <button class="ht-tool-btn danger" id="ht-sel-preset-del" title="Delete Selection Set" style="width:24px; height:24px; padding:4px;">${ICON_TRASH}</button>
                    </div>
                </div>

                <div class="ht-search-menu ht-hidden" id="ht-search-menu">
                    <div class="ht-filter-row">
                        <span style="font-size: 11px; color: #888;">Select one or more filter options:</span>
                        <div style="display: flex; gap: 4px; margin-left: auto;">
                            <button class="ht-tool-btn" id="ht-filter-search" title="Filter by Search Keyword">${ICON_SEARCH}</button>
                            <button class="ht-tool-btn" id="ht-filter-tags" title="Filter by Tags">${ICON_TAG}</button>
                            <button class="ht-tool-btn" id="ht-filter-flagged" title="Hide Flagged Images">${ICON_FLAG}</button>
                            <button class="ht-tool-btn" id="ht-filter-captioned" title="Hide Captioned Images">${ICON_TEXT}</button>
                            <button class="ht-tool-btn" id="ht-filter-missing" title="Hide Missing Images">${ICON_MISSING}</button>
                            <div style="width: 1px; background: #333; margin: 0 2px;"></div>
                            <button class="ht-tool-btn" id="ht-filter-invert" title="Invert Active Filters">${ICON_INVERT}</button>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size:12px; color:#aaa; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
                            <div style="width: 14px; display: flex; justify-content: center; color: #888;">${ICON_SEARCH}</div>
                            Search Keyword:
                        </span>
                        <input type="text" id="ht-search-input" class="ht-input" placeholder="Keyword..." style="font-size:12px; padding:4px;">
                    </div>
                    
                    <div style="border-top: 1px solid #333; margin: 8px 0;"></div>
                    
                    <div style="font-size:12px; color:#aaa; margin-bottom:4px; display: flex; align-items: center; gap: 4px;">
                        <div style="width: 14px; display: flex; justify-content: center; color: #888;">${ICON_TAG}</div>
                        Search by Tag:
                    </div>
                    <div id="ht-search-tags-selected" style="display: flex; flex-wrap: wrap; gap: 4px; min-height: 36px; background: #111; padding: 6px; border-radius: 4px; border: 1px solid #333; align-content: flex-start;"></div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
                        <span style="font-size:12px; color:#aaa;">All Tags:</span>
                        <div style="display: flex; gap: 4px;">
                            <button class="ht-tool-btn" id="ht-search-sort-alpha" title="Sort A-Z" style="width:24px; height:24px; font-size:11px; font-weight:bold;">A-Z</button>
                            <button class="ht-tool-btn" id="ht-search-sort-count" title="Sort by Count" style="width:24px; height:24px; font-size:11px; font-weight:bold;">#</button>
                            <button class="ht-tool-btn" id="ht-search-sort-dir" title="Toggle Direction" style="width:24px; height:24px; padding:4px;">${ICON_ARROW_DOWN}</button>
                        </div>
                    </div>
                    
                    <div id="ht-search-tags-list" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; flex: 1; min-height: 0; overflow-y: auto; align-content: flex-start; padding-right: 4px;"></div>
                </div>
            </div>
            <div class="ht-gallery-panel" id="ht-gallery"></div>
        </div>
        
        <div class="ht-main-area">
            
            <div class="ht-viewer-toolbar ht-toolbar">
                <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                    <span id="ht-viewer-name" style="font-size:11px; font-weight: bold; color: #82deff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display: block; min-width: 0;"></span>
                    <span id="ht-viewer-dims" style="color: #aaa; font-size:11px; white-space:nowrap; flex-shrink: 0;"></span>
                </div>
                
                <div style="display:flex; align-items:center; gap:6px;">
                    <button class="ht-tool-btn" id="ht-btn-use-orig" title="Use Original Image (from backup)" style="width:48px; font-size:11px; font-weight:bold; font-family:sans-serif;" disabled>Original</button>
                    
                    <div style="position:relative;">
                        <button class="ht-tool-btn" id="ht-btn-ai-edit" title="AI Edit (Workflow)">${ICON_WAND}</button>
                        <div class="ht-aiedit-menu ht-hidden" id="ht-aiedit-menu">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                <span style="font-size:12px; color:#aaa; font-weight:bold;">AI Edit Workflow</span>
                                <div class="ht-help-wrapper" style="position: relative;">
                                    <button class="ht-help-btn" style="width:16px; height:16px; font-size:11px; font-weight:bold; border: 1px solid #666; border-radius: 50%; color: #aaa; background: transparent; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center;">?</button>
                                    <div class="ht-help-tooltip" style="position: absolute; right: 0; top: 22px; width: 300px; background: #222; border: 1px solid #555; padding: 10px; border-radius: 4px; font-size: 11px; color: #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.8); z-index: 1000; line-height: 1.4; display: none;">
                                        Edit workflows should be stored in <b>\\custom_nodes\\ComfyUI-handyTools\\workflows</b>, they must be an API workflow with the filename beginning with <b>"imageEdit_"</b> and must contain the <b>HandyTool Get Text API</b>, <b>HandyTool Load Image API</b> and <b>HandyTool Save Image API</b> nodes.
                                    </div>
                                </div>
                            </div>
                            <textarea id="ht-aiedit-prompt" class="ht-input" placeholder="Edit prompt..." style="font-size: 11px; padding: 4px; min-height: 64px; resize: vertical; margin-top: 4px;"></textarea>
                            <div style="display: flex; gap: 8px; margin-top: 8px;">
                                <select id="ht-aiedit-workflow" class="ht-input" style="font-size:11px; padding:4px; flex: 1;">
                                    <option value="">Loading...</option>
                                </select>
                                <button class="ht-btn" id="ht-aiedit-run-btn" style="flex: 1; padding: 4px 8px; font-size: 11px; white-space: nowrap;">Queue AI Edit</button>
                            </div>
                        </div>
                    </div>

                    <div style="width:1px; height:16px; background:#333; margin:0 4px;"></div>

                    <button class="ht-tool-btn" id="ht-btn-zoom-fit" title="Zoom to Fit">${ICON_ZOOM_FIT}</button>
                    <button class="ht-tool-btn" id="ht-btn-zoom-100" title="Zoom to 100%">${ICON_ZOOM_100}</button>
                    
                    <div style="width:1px; height:16px; background:#333; margin:0 4px;"></div>
                    
                    <button class="ht-tool-btn" id="ht-btn-crop-tool" title="Crop Tool (C)">${ICON_CROP}</button>
                    <label style="font-size:11px; color:#aaa; display:flex; align-items:center; gap:4px; cursor:pointer;" title="Constraint box to multiples of 32px">
                        <input type="checkbox" id="ht-crop-snap-check" checked> Snap
                    </label>
                    
                    <div style="position:relative;">
                        <button class="ht-tool-btn" id="ht-btn-resize-tool" title="Custom Resize">${ICON_RESIZE}</button>
                        <div class="ht-resize-menu ht-hidden" id="ht-resize-menu">
                            <span style="font-size:12px; color:#aaa; margin-bottom:2px; font-weight:bold;">Custom Resize</span>
                            <div style="display: flex; gap: 8px; align-items: flex-end; justify-content: center; margin-top: 8px;">
                                <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                                    <span style="font-size:10px; color:#888; text-align:center;">Width</span>
                                    <input type="number" id="ht-resize-w" class="ht-input" style="font-size:11px; padding:4px; width:50%; margin:0 auto; text-align:center;">
                                </div>
                                <button class="ht-tool-btn active" id="ht-resize-link" style="width:24px; height:24px; margin-bottom:2px;" title="Lock Aspect Ratio">${ICON_LINK}</button>
                                <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                                    <span style="font-size:10px; color:#888; text-align:center;">Height</span>
                                    <input type="number" id="ht-resize-h" class="ht-input" style="font-size:11px; padding:4px; width:50%; margin:0 auto; text-align:center;">
                                </div>
                            </div>
                            <button class="ht-btn" id="ht-resize-apply-btn" style="width: 100%; margin-top: 12px;">Apply Resize</button>
                        </div>
                    </div>
                    
                    <button class="ht-tool-btn" id="ht-btn-viewer-resize" title="Auto Resize (Multiples of 32)">${ICON_AUTO_RESIZE}</button>
                    
                    <div style="width:1px; height:16px; background:#333; margin:0 4px;"></div>
                    
                    <button class="ht-btn" id="ht-btn-viewer-discard" style="padding:4px 8px; font-size:11px; height:26px; background:#ff4444;" title="Discard Unsaved Changes" disabled>Discard</button>
                    <button class="ht-btn" id="ht-btn-viewer-save" style="padding:4px 12px; font-size:11px; height:26px; display:flex; align-items:center; gap:6px; background:#2b76cf;" title="Apply Edit & Overwrite Original" disabled>
                        ${ICON_SAVE} Save
                    </button>
                </div>
            </div>

            <div class="ht-image-viewer" id="ht-viewer">
                <span id="ht-no-image-text" style="color: #444; position:absolute; z-index:0;">No Image Selected</span>
                
                <div id="ht-img-container">
                    <img id="ht-main-img" draggable="false">
                    <div id="ht-crop-box" style="display:none;">
                        <div class="ht-crop-info"></div>
                        <div class="ht-crop-actions">
                            <button class="ht-crop-action-btn cancel" id="ht-crop-cancel" title="Cancel Crop">✖</button>
                            <button class="ht-crop-action-btn accept" id="ht-crop-accept" title="Apply Crop">✔</button>
                        </div>
                        <div class="ht-crop-handle nw" data-handle="nw"></div>
                        <div class="ht-crop-handle ne" data-handle="ne"></div>
                        <div class="ht-crop-handle sw" data-handle="sw"></div>
                        <div class="ht-crop-handle se" data-handle="se"></div>
                    </div>
                </div>

                <div id="ht-viewer-overlay" class="ht-hidden">
                    <div id="ht-edit-loading" style="display:flex; flex-direction:column; align-items:center; gap:12px;">
                        <div style="color:#82deff; font-weight:bold; font-size:14px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">Generating AI Edit...</div>
                        <img id="ht-edit-preview" src="" style="display:none;">
                        <div class="ht-spin-svg" style="color:#82deff; width:24px; height:24px;">${ICON_LOADER}</div>
                    </div>
                </div>
            </div>

        </div>
        
        <div class="ht-side-panel">
            <div class="ht-caption-text">
                <textarea id="ht-caption-input" placeholder="Caption Text..."></textarea>

                <div class="ht-caption-actions">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 12px; color: #aaa; font-weight: bold;">Caption:</span>
                        <div class="ht-caption-tabs">
                            <button class="ht-cap-btn active" data-index="1">1</button>
                            <button class="ht-cap-btn" data-index="2">2</button>
                            <button class="ht-cap-btn" data-index="3">3</button>
                            <button class="ht-cap-btn" data-index="4">4</button>
                        </div>
                    </div>
                    
                    <div style="position: absolute; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;">
                        <button class="ht-nav-btn" id="ht-nav-prev" title="Previous Image (Left Arrow)">◀ Prev</button>
                        <button class="ht-nav-btn" id="ht-nav-next" title="Next Image (Right Arrow)">Next ▶</button>
                    </div>

                    <div style="display: flex; gap: 8px; margin-left: auto;">
                        <button class="ht-btn ht-hidden" id="ht-discard-cap-btn" style="padding: 6px 16px; background: #551111; color: #ffaaaa; border: 1px solid #ff4444;" title="Discard Temporary Caption">Discard</button>
                        <button class="ht-btn" id="ht-save-btn" style="padding: 6px 16px;" title="Ctrl+S">Save Caption</button>
                    </div>
                </div>
            </div>
            
            <div class="ht-tools-panel">
                <div class="ht-tabs-header">
                    <button class="ht-tab-btn active" data-tab="tab-project">Project</button>
                    <button class="ht-tab-btn" data-tab="tab-dataset">Dataset</button>
                    <button class="ht-tab-btn" data-tab="tab-tools">Tools</button>
                    <button class="ht-tab-btn" data-tab="tab-tags">Tags</button>
                    <button class="ht-tab-btn" data-tab="tab-vlm">VLM</button>
                </div>
                
                <div class="ht-tabs-content">
                    
                    <div class="ht-tab-pane active" id="tab-project">
                        <div class="ht-sr-container">
                            
                            <div class="ht-sr-header" style="margin-bottom: 10px;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">Project Management</span>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                <span style="font-size: 12px; color: #aaa; white-space: nowrap;">Project folder:</span>
                                <input type="text" id="ht-folder-input" class="ht-input" placeholder="Dataset Folder Path" style="height: 28px; padding: 4px 8px;">
                                <button class="ht-btn" id="ht-load-btn" style="height: 28px; width: 64px; padding: 0; font-size: 12px; display: flex; align-items: center; justify-content: center;">Start</button>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 12px; color: #aaa; white-space: nowrap;">Image Source Folder (relative or absolute):</span>
                                <input type="text" id="ht-setting-source" class="ht-input" placeholder="_source" style="height: 28px; padding: 4px 8px;">
                                <button class="ht-btn" id="ht-btn-apply-source" style="height: 28px; width: 64px; padding: 0; font-size: 12px; display: flex; align-items: center; justify-content: center;">Apply</button>
                            </div>
                            
                            <div style="border-top: 1px solid #333; margin: 8px 0 6px 0;"></div>
                            
                            <div class="ht-sr-header" style="margin-bottom: 10px;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">File Management</span>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 12px; color: #aaa; white-space: nowrap;">Backup project:</span>
                                <select id="ht-backup-select" class="ht-input" style="height: 28px; padding: 4px 8px; flex: none; width: 25%;">
                                    <option value="">-- Select Backup --</option>
                                </select>
                                <button class="ht-tool-btn" id="ht-btn-create-backup" title="Create New JSON Backup" style="width: 28px; height: 28px; flex-shrink: 0; padding: 4px;">${ICON_SAVE}</button>
                                <button class="ht-tool-btn" id="ht-btn-load-backup" title="Restore from Backup" style="width: 28px; height: 28px; flex-shrink: 0; padding: 4px;">${ICON_REFRESH}</button>
                                
                                <div style="width: 1px; height: 16px; background: #333; margin: 0 4px;"></div>
                                
                                <button class="ht-btn" id="ht-btn-cleanup" style="font-size: 11px; background: #551111; border: 1px solid #ff4444; color: #ffaaaa; flex: 1; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Safely removes Missing Images from the project index">Remove Missing Images</button>
                            </div>
                        
                        </div>
                    </div>
                    
                    <div class="ht-tab-pane" id="tab-dataset">
                        <div class="ht-sr-container">
                            <div class="ht-sr-header" style="margin-bottom: 12px;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">Create Dataset</span>
                            </div>
                            
                            <div style="display: flex; gap: 12px;">
                                <div style="flex: 5; display: flex; flex-direction: column; gap: 10px;">
                                    
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 96px; flex-shrink: 0;">Use:</span>
                                        <select id="ht-ds-scope" class="ht-input" style="padding: 4px 8px; font-size: 11px; height: 28px; flex: 1;">
                                            <option value="all">All Unflagged images</option>
                                            <option value="selected">Selected Images</option>
                                        </select>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 96px; flex-shrink: 0;">Use Caption(s):</span>
                                        <div class="ht-caption-tabs" style="padding: 2px;">
                                            <button class="ht-ds-cap-btn active" data-index="1">1</button>
                                            <button class="ht-ds-cap-btn" data-index="2">2</button>
                                            <button class="ht-ds-cap-btn" data-index="3">3</button>
                                            <button class="ht-ds-cap-btn" data-index="4">4</button>
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="width: 96px; flex-shrink: 0;"></div>
                                        <div style="display: flex; align-items: center; gap: 4px; flex: 1;">
                                            <select id="ht-ds-preset-select" class="ht-input" style="padding:2px 4px; font-size:11px; height:28px; flex: 1;">
                                                <option value="">-- Presets --</option>
                                            </select>
                                            <button class="ht-tool-btn" id="ht-ds-preset-save" title="Save New Preset" style="width:28px; height:28px; padding:4px; flex-shrink: 0;">${ICON_PLUS}</button>
                                            <button class="ht-tool-btn danger" id="ht-ds-preset-del" title="Delete Preset" style="width:28px; height:28px; padding:4px; flex-shrink: 0;">${ICON_TRASH}</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div style="flex: 3; display: flex; flex-direction: column;">
                                    <textarea id="ht-ds-sizes" class="ht-input" placeholder="Sizes (e.g. 1024, 1024x768)" style="flex: 1; resize: none; margin: 0; min-height: 90px;"></textarea>
                                </div>
                            </div>
                            
                            <div style="display: flex; gap: 12px; margin-top: 8px;">
                                <div style="flex: 5; display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 96px; flex-shrink: 0;">Dataset name:</span>
                                    <input type="text" id="ht-ds-name" class="ht-input" placeholder="Dataset Name" style="height: 32px; padding: 4px 8px; flex: 1;">
                                </div>
                                <div style="flex: 3; display: flex;">
                                    <button class="ht-btn" id="ht-ds-create" style="width: 100%; height: 32px; font-size: 13px; font-weight: bold;">Create Dataset(s)</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="ht-tab-pane" id="tab-tools">
                        <div class="ht-sr-container">
                            <div class="ht-sr-header" style="margin-bottom: 4px;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">Batch Rename</span>
                            </div>
                            
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1; display: flex; gap: 8px;">
                                    <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; text-align: center;">Base Name</span>
                                        <input type="text" id="ht-rename-base" class="ht-input" placeholder="e.g. imageSet" style="height: 28px; padding: 4px 8px; text-align: center;">
                                    </div>
                                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold;">Digits</span>
                                        <select id="ht-rename-digits" class="ht-input" style="padding: 0; font-size: 11px; height: 28px; width: 32px; text-align: center;">
                                            <option value="2">2</option>
                                            <option value="3" selected>3</option>
                                            <option value="4">4</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div style="width: 1px; background: #333; margin: 2px 0;"></div>
                                
                                <div style="flex: 1; display: flex; gap: 8px;">
                                    <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; text-align: center;">Sort Order</span>
                                        <select id="ht-rename-sort" class="ht-input" style="padding: 4px 8px; font-size: 11px; height: 28px; text-align: center;">
                                            <option value="name">Name (A-Z)</option>
                                            <option value="newest">Newest First</option>
                                            <option value="oldest">Oldest First</option>
                                        </select>
                                    </div>
                                    <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; text-align: center;">Scope</span>
                                        <select id="ht-rename-scope" class="ht-input" style="padding: 4px 8px; font-size: 11px; height: 28px; text-align: center;">
                                            <option value="all">All Images</option>
                                            <option value="selected">Selected Images</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: center; margin-top: 8px;">
                                <button class="ht-btn" id="ht-rename-btn" style="width: 200px; height: 32px; font-size: 13px; font-weight: bold;">Rename Files</button>
                            </div>
                        </div>

                        <div class="ht-sr-container">
                            <div class="ht-sr-header" style="margin-bottom: 12px;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">Batch Resize</span>
                            </div>
                            
                            <div style="display: flex; gap: 12px;">
                                <div style="flex: 5; display: flex; flex-direction: column; gap: 10px;">
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                        <input type="radio" name="ht-resize-mode" value="longest_edge" checked style="accent-color: #82deff; width: 14px; height: 14px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 110px;">By longest edge:</span>
                                        <input type="number" id="ht-batch-resize-size" class="ht-input" value="1024" style="height: 28px; padding: 4px 8px; flex: 1; text-align: center;">
                                    </label>
                                    
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                        <input type="radio" name="ht-resize-mode" value="preset" style="accent-color: #82deff; width: 14px; height: 14px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 110px;">Preset:</span>
                                        <select id="ht-batch-resize-preset" class="ht-input" style="padding: 4px 8px; font-size: 11px; height: 28px; flex: 1;" disabled>
                                            <option value="">-- Loading --</option>
                                        </select>
                                    </label>
                                    
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                        <input type="radio" name="ht-resize-mode" value="custom" style="accent-color: #82deff; width: 14px; height: 14px;">
                                        <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 110px;">Custom:</span>
                                        <span style="font-size: 11px; color: #888;">Type dimensions in the box -></span>
                                    </label>
                                </div>
                                
                                <div style="flex: 3; display: flex; flex-direction: column;">
                                    <textarea id="ht-batch-resize-preset-text" class="ht-input" readonly placeholder="Sizes (e.g. 1024, 1024x768)" style="flex: 1; resize: none; margin: 0; min-height: 90px; background: #111; border-color: #444;"></textarea>
                                </div>
                            </div>
                            
                            <div style="display: flex; gap: 12px; margin-top: 8px;">
                                <div style="flex: 5; display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 12px; color: #aaa; font-weight: bold; white-space: nowrap; width: 110px; flex-shrink: 0; margin-left: 22px;">Apply to:</span>
                                    <select id="ht-batch-resize-scope" class="ht-input" style="padding: 4px 8px; font-size: 11px; height: 28px; flex: 1;">
                                        <option value="all">All Images</option>
                                        <option value="selected">Selected Images</option>
                                    </select>
                                </div>
                                <div style="flex: 3; display: flex;">
                                    <button class="ht-btn" id="ht-batch-resize-btn" style="width: 100%; height: 32px; font-size: 13px; font-weight: bold;">Resize</button>
                                </div>
                            </div>
                        </div>

                        <div class="ht-sr-container">
                            <div class="ht-sr-header">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">Search and Replace</span>
                                <select id="ht-sr-scope" class="ht-input" style="padding: 2px 4px; font-size: 11px; height: 22px; width: auto;">
                                    <option value="current">Current Image</option>
                                    <option value="selected">Selected Images</option>
                                    <option value="all">All Images</option>
                                </select>
                            </div>
                            <div style="font-size: 11px; color: #aaa; margin-top:4px;">
                                Operates within the currently active Caption Tab (1-4).
                            </div>
                            <div class="ht-sr-row" style="margin-top: 4px;">
                                <span style="font-size: 12px; color: #aaa;">Find:</span>
                                <input type="text" id="ht-sr-find" class="ht-input">
                                <span style="font-size: 12px; color: #aaa; margin-left: 4px;">Replace:</span>
                                <input type="text" id="ht-sr-replace" class="ht-input">
                                <button class="ht-btn" id="ht-sr-btn">Replace</button>
                            </div>
                        </div>
                    </div>

                    <div class="ht-tab-pane" id="tab-tags">
                        <div class="ht-sr-container" style="position: relative; z-index: 20;">
                            <div class="ht-sr-header" style="display: flex; align-items: center;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff; flex: 1;">Image Tags</span>
                                
                                <div class="ht-tag-input-wrapper">
                                    <input type="text" id="ht-tag-input" class="ht-input" placeholder="New tag (Enter)" style="width: 100%; max-width: 175px; padding: 4px 8px; font-size: 12px; text-align: center; font-weight: bold;">
                                    <div id="ht-tag-autocomplete" class="ht-autocomplete-list"></div>
                                </div>

                                <div style="flex: 1; display: flex; justify-content: flex-end;">
                                    <button class="ht-btn" id="ht-tag-add-btn" style="padding: 4px 8px; font-size: 11px;">Add all to Caption</button>
                                </div>
                            </div>
                            <div id="ht-tags-container" style="display: flex; flex-wrap: wrap; margin-top: 8px; gap: 6px;">
                                <!-- Colored pills populate here -->
                            </div>
                        </div>
                        
                        <div class="ht-sr-container" style="flex: 1; min-height: 0; position: relative; z-index: 10;">
                            <div class="ht-sr-header" style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">All Tags</span>
                                
                                <div style="display: flex; gap: 4px;">
                                    <button class="ht-tool-btn" id="ht-tag-sort-alpha" title="Sort A-Z" style="width:24px; height:24px; font-size:11px; font-weight:bold;">A-Z</button>
                                    <button class="ht-tool-btn" id="ht-tag-sort-count" title="Sort by Count" style="width:24px; height:24px; font-size:11px; font-weight:bold;">#</button>
                                    <button class="ht-tool-btn" id="ht-tag-sort-dir" title="Toggle Direction" style="width:24px; height:24px; padding:4px;">${ICON_ARROW_DOWN}</button>
                                </div>
                            </div>
                            <div id="ht-all-tags-container" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; overflow-y: auto; align-content: flex-start;">
                                <!-- Global tags populate here -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="ht-tab-pane" id="tab-vlm">
                        <div class="ht-sr-container">
                            <div class="ht-sr-header">
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">Auto-Caption (VLM)</span>
                                <select id="ht-vlm-scope" class="ht-input" style="padding: 2px 4px; font-size: 11px; height: 22px; width: auto;">
                                    <option value="current">Current Image</option>
                                    <option value="selected">Selected Images</option>
                                    <option value="all">All Unflagged</option>
                                </select>
                            </div>
                            <div style="font-size: 11px; color: #aaa; margin-top:4px;">
                                Queues the background API workflow for the selected images. Outputs to active Caption Tab.
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; color: #aaa; width: 70px;">Preset:</span>
                                    <select id="ht-vlm-preset" class="ht-input" style="font-size: 11px; padding: 4px;">
                                        <option value="Character Dataset">Character Dataset</option>
                                        <option value="Character and Clothing Dataset">Character and Clothing Dataset</option>
                                        <option value="Clothing Item Dataset">Clothing Item Dataset</option>
                                        <option value="General Use">General Use</option>
                                        <option value="Object Dataset">Object Dataset</option>
                                        <option value="Tagging">Tagging</option>
                                    </select>
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; color: #aaa; width: 70px;">Trigger:</span>
                                    <input type="text" id="ht-vlm-trigger" class="ht-input" placeholder="e.g. chr_bob(male)" style="font-size: 11px; padding: 4px;">
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; color: #aaa; width: 70px;">Style Focus:</span>
                                    <label style="font-size: 11px; color: #fff; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                                        <input type="checkbox" id="ht-vlm-style"> Enable
                                    </label>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                                    <span style="font-size: 11px; color: #aaa;">Manual Append:</span>
                                    <textarea id="ht-vlm-append" class="ht-input" placeholder="Extra text..." style="font-size: 11px; padding: 4px; min-height: 40px; resize: vertical;"></textarea>
                                </div>
                                
                                <button class="ht-btn" id="ht-vlm-run-btn" style="width: 100%; margin-top: 4px;">Queue Generation</button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;
}
