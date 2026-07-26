        // ============================================================
        //  备份恢复 — 数据格式
        // ============================================================
        /**
         * 【备份恢复/数据】【运营商兼容】规范化备份中的运营商结构
         * @param {Array} rawProviders - 备份文件中的运营商列表
         * @returns {Array} - 已兼容旧 model 字段的运营商列表
         */
        function normalizeBackupProviders(rawProviders) {
            return normalizeProviderConfigs(rawProviders);
        }

        /**
         * 【备份恢复/数据】【导出组装】组装本地导出与 WebDAV 备份共用的数据格式
         * @returns {Object} - 备份数据对象
         */
        function buildBackupPayload() {
            const exportSessions = deepClone(sessions);
            return {
                providers,
                activeProviderId,
                activeModel,
                webSearchSettings,
                paramPresets,
                activePresetId,
                sessions: exportSessions,
                favorites,
                currentChatSessionId,
                currentGenSessionId,
                exportedAt: new Date().toISOString()
            };
        }

        /**
         * 【备份恢复/数据】【基础校验】校验备份文件是否包含可恢复的基础结构
         * @param {Object} data - 待校验的备份数据
         * @returns {void}
         */
        function validateBackupPayload(data) {
            if (!data || !data.providers || !Array.isArray(data.providers)) {
                throw new Error('无效格式');
            }
        }

        /**
         * 【备份恢复/数据】【会话校验】恢复会话当前 ID 并保证指向存在的会话
         * @returns {void}
         */
        function normalizeCurrentSessionIds() {
            if (!sessions.find(s => s.id === currentChatSessionId)) {
                currentChatSessionId = sessions.find(s => s.type === 'chat')?.id || sessions[0]?.id || null;
            }
            if (!sessions.find(s => s.id === currentGenSessionId)) {
                currentGenSessionId = sessions.find(s => s.type === 'gen')?.id || null;
            }
        }

        /**
         * 【备份恢复/数据】【应用恢复】把备份数据写入当前运行状态并持久化
         * @param {Object} data - 解析后的备份数据
         * @returns {Promise<Object>} - 恢复后的统计信息
         */
        async function applyBackupData(data) {
            validateBackupPayload(data);

            // 1. 恢复模型供应商配置
            providers = normalizeBackupProviders(data.providers);
            activeProviderId = data.activeProviderId || providers[0]?.id || null;
            activeModel = data.activeModel || (providers[0]?.models && providers[0].models[0]) || '';
            if (!providers.find(p => p.id === activeProviderId)) {
                activeProviderId = providers[0]?.id || null;
                activeModel = (providers[0]?.models && providers[0].models[0]) || '';
            }
            editingProviderId = activeProviderId;
            await saveProvidersToStorage();

            // 2. 恢复网络搜索配置
            if (data.webSearchSettings) {
                webSearchSettings = { ...webSearchSettings, ...data.webSearchSettings };
                try {
                    localStorage.setItem('webSearchSettings', JSON.stringify(webSearchSettings));
                } catch(e) {}
                updateSearchBtnUI();
            }

            // 3. 恢复参数预设
            if (data.paramPresets && Array.isArray(data.paramPresets)) {
                paramPresets = data.paramPresets;
                activePresetId = data.activePresetId || paramPresets[0]?.id || null;
                if (!paramPresets.find(p => p.id === activePresetId)) activePresetId = paramPresets[0]?.id || null;
                await savePresets();
                renderPresetTags();
            }

            // 4. 恢复会话历史
            if (data.sessions && Array.isArray(data.sessions)) {
                sessions = data.sessions;
                sessions.forEach(s => s._loaded = true);
                currentChatSessionId = data.currentChatSessionId || sessions[0]?.id || null;
                currentGenSessionId = data.currentGenSessionId || null;
                normalizeCurrentSessionIds();
                // 导入时保存所有会话
                await saveSessionsToStorage(sessions.map(s => s.id));
                lastRenderedSessionId = null;
                switchChat(getCurrentId());
            }

            // 5. 恢复收藏夹
            if (data.favorites && Array.isArray(data.favorites)) {
                favorites = data.favorites.map(f => {
                    if (!f.tags) f.tags = [];
                    return f;
                });
                await saveFavorites();
                // 重置渲染标记并立即刷新，确保切换到收藏页时能显示最新数据
                favRenderedOnce = false;
                renderFavorites();
            }

            updateModelDisplay();
            renderModelDropdown();
            renderSettingsPanels();

            return {
                providers: providers.length,
                sessions: sessions.length,
                favorites: favorites.length
            };
        }
