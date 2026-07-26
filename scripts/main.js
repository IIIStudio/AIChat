        // ============================================================
        //  初始化入口
        // ============================================================
        window.addEventListener('DOMContentLoaded', async () => {
            try {
                const saved = localStorage.getItem('webSearchSettings');
                if (saved) {
                    webSearchSettings = { ...webSearchSettings, ...JSON.parse(saved) };
                }
            } catch(e) {}
            updateSearchBtnUI();
            await loadWebDavSettings();

            if (window.mermaid) {
                mermaid.initialize(getMermaidConfig());
            }
            await loadProviders();
            updateModelDisplay();
            renderModelDropdown();
            await loadPresets();
            renderPresetTags();
            await loadSessionsFromStorage();
            await loadFavorites();
            loadImageGenMode();  // 恢复生图模式状态（UI 已在 initModeSync 中同步）
            loadThinkingLevel(); // 恢复思考等级选择
            updateSendBtnState(); // 初始化发送按钮状态
            // 收藏模式下不调用 switchChat（会重置模式），直接渲染收藏页和侧边栏
            if (favMode) {
                renderSidebar();
                favRenderedOnce = true;
                renderFavorites();
            } else {
                switchChat(getCurrentId());
            }
        });
