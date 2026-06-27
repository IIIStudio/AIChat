        // ============================================================
        //  设置面板 — 运营商编辑
        // ============================================================
        /**
         * 【设置面板/运营商配置】【表单同步】把当前运营商编辑表单同步回临时配置
         * @returns {void}
         */
        function flushEditingProvider() {
            const p = providers.find(p => p.id === editingProviderId);
            if (!p) return;
            const nameEl = document.getElementById('editPname');
            const urlEl = document.getElementById('editPurl');
            const keyEl = document.getElementById('editPkey');
            const protocolEl = document.getElementById('editPprotocol');
            const thinkingFormatEl = document.getElementById('editPthinkingFormat');
            if (nameEl) p.name = nameEl.value.trim() || p.name;
            if (urlEl) p.apiUrl = urlEl.value.trim();
            if (keyEl) p.apiKey = keyEl.value.trim();
            if (protocolEl && isKnownProviderProtocol(protocolEl.value)) p.protocol = protocolEl.value;
            if (thinkingFormatEl && isKnownThinkingFormat(thinkingFormatEl.value)) p.thinkingFormat = thinkingFormatEl.value;
        }

        /**
         * 【设置面板/配置路由】【网络搜索】从网络搜索表单同步临时配置
         * @returns {void}
         */
        function flushWebSearchSettings() {
            const provEl = document.getElementById('editSearchProvider');
            const urlEl = document.getElementById('editSearchUrl');
            const keyEl = document.getElementById('editSearchKey');
            const locEl = document.getElementById('editSearchLocation');
            const langEl = document.getElementById('editSearchLanguage');
            const countEl = document.getElementById('editSearchFetchCount');

            // 1. 只读取当前网络搜索路由内存在的表单元素
            if (provEl) webSearchSettings.provider = provEl.value;
            if (urlEl) webSearchSettings.apiUrl = urlEl.value.trim();
            if (keyEl) webSearchSettings.apiKey = keyEl.value.trim();
            if (locEl) webSearchSettings.location = locEl.value.trim() || 'US';
            if (langEl) webSearchSettings.language = langEl.value.trim() || 'en';
            if (countEl) {
                const count = parseInt(countEl.value, 10) || 2;
                webSearchSettings.fetchCount = Math.max(1, Math.min(5, count));
            }
        }

        /**
         * 【设置面板/配置路由】【状态同步】根据当前路由同步正在编辑的表单
         * @returns {void}
         */
        function flushCurrentSettingsRoute() {
            if (settingsRoute === 'web-search') {
                flushWebSearchSettings();
                return;
            }
            if (settingsRoute === 'webdav') {
                flushWebDavSettings();
                return;
            }
            flushEditingProvider();
        }

        /**
         * 【设置面板/运营商配置】【左侧渲染】渲染运营商列表并标记当前编辑项
         * @returns {void}
         */
        function renderSettingsLeft() {
            const list = document.getElementById('settingsLeftList');
            if (!list) return;
            list.innerHTML = '';
            providers.forEach(p => {
                const item = document.createElement('div');
                const isEditing = p.id === editingProviderId;
                const isActive = p.id === activeProviderId;
                item.className = 'provider-nav-item' + (isEditing ? ' selected' : '') + (isActive && !isEditing ? ' active' : '');
                item.innerHTML = `<span>${escapeHtml(p.name)}</span>${isActive ? '<span class="nav-badge">当前</span>' : ''}`;
                item.title = p.name;
                item.onclick = () => selectProviderForEdit(p.id);
                list.appendChild(item);
            });

        }

        /**
         * 【设置面板/运营商配置】【右侧渲染】渲染运营商基础字段、协议字段、模型列表和候选模型区
         * @returns {void}
         */
        function renderSettingsRight() {
            const panel = document.getElementById('settingsRightPanel');
            if (!panel) return;

            const p = providers.find(p => p.id === editingProviderId);
            if (!p) {
                panel.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding-top:60px;">请从左侧选择一个运营商</div>';
                return;
            }
            normalizeProviderConfig(p);
            const isActive = p.id === activeProviderId;
            const protocolOptionsHtml = PROVIDER_PROTOCOLS.map(item => {
                const selected = item.value === p.protocol ? 'selected' : '';
                return `<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`;
            }).join('');
            const thinkingOptionsHtml = PROVIDER_THINKING_FORMATS.map(item => {
                const selected = item.value === p.thinkingFormat ? 'selected' : '';
                return `<option value="${escapeHtml(item.value)}" ${selected}>${escapeHtml(item.label)}</option>`;
            }).join('');
            const modelsHtml = (p.models || []).map((m, i) => {
                const mLogo = getModelDevLogo(p.name, p.apiUrl, m);
                const mLogoHtml = renderLogoHtml(mLogo, true);
                return `<span class="model-tag">${mLogoHtml}${escapeHtml(m)}<span class="tag-x" onclick="removeModelFromEditing(${i})">×</span></span>`;
            }).join('');

            panel.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                    <label style="margin:0;white-space:nowrap;">运营商名称</label>
                    <input type="text" id="editPname" value="${escapeHtml(p.name)}" placeholder="运营商名称" style="flex:1;">
                    ${isActive ? '<span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">✓ 当前使用</span>' : '<button class="set-active-from-modal" onclick="setActiveFromModal()">设为当前</button>'}
                </div>
                <label>API URL</label>
                <input type="text" id="editPurl" value="${escapeHtml(p.apiUrl || '')}" placeholder="API 端点地址">
                <label>API Key</label>
                <input type="password" id="editPkey" value="${escapeHtml(p.apiKey || '')}" placeholder="sk-...">
                <div class="provider-protocol-grid">
                    <div>
                        <label>协议类型</label>
                        <select id="editPprotocol">
                            ${protocolOptionsHtml}
                        </select>
                    </div>
                    <div>
                        <label>思考字段类型</label>
                        <select id="editPthinkingFormat">
                            ${thinkingOptionsHtml}
                        </select>
                    </div>
                </div>
                <div class="provider-protocol-tip">自动兼容会按协议转换思考参数；DeepSeek 会发送 thinking.type 与 reasoning_effort。</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <label style="margin:0;">模型列表</label>
                    <button class="set-active-from-modal" onclick="fetchModels()" style="font-size:11px;padding:2px 10px;">获取模型</button>
                </div>
                <div class="models-section">
                    <div class="models-list" id="editModelsList">
                        ${modelsHtml}
                        <button class="tag-add-btn" onclick="showAddModelInput()">+ 添加</button>
                    </div>
                </div>
                ${renderModelCandidatePicker(p)}
                <div class="settings-right-actions">
                    <button class="del-btn" onclick="deleteProviderFromModal()" ${providers.length <= 1 ? 'disabled' : ''}>删除此运营商</button>
                </div>
            `;
        }

        /**
         * 【设置面板/配置路由】【页面状态】刷新模型配置、网络搜索和 WebDAV 备份路由的可见状态
         * @returns {void}
         */
        function renderSettingsRouteTabs() {
            const isSearchRoute = settingsRoute === 'web-search';
            const isWebDavRoute = settingsRoute === 'webdav';
            const isModelsRoute = settingsRoute === 'models';
            const modelsTab = document.getElementById('settingsRouteModels');
            const searchTab = document.getElementById('settingsRouteWebSearch');
            const webDavTab = document.getElementById('settingsRouteWebDav');
            const modelPanels = document.getElementById('settingsModelPanels');
            const searchPanel = document.getElementById('settingsSearchPanel');
            const webDavPanel = document.getElementById('settingsWebDavPanel');
            const title = document.getElementById('settingsModalTitle');
            const exportBtns = document.getElementById('settingsExportImportBtns');

            // 1. 同步页签选中态
            if (modelsTab) modelsTab.classList.toggle('active', isModelsRoute);
            if (searchTab) searchTab.classList.toggle('active', isSearchRoute);
            if (webDavTab) webDavTab.classList.toggle('active', isWebDavRoute);

            // 2. 切换路由对应的编辑面板
            if (modelPanels) modelPanels.style.display = isModelsRoute ? 'flex' : 'none';
            if (searchPanel) searchPanel.style.display = isSearchRoute ? 'flex' : 'none';
            if (webDavPanel) webDavPanel.style.display = isWebDavRoute ? 'flex' : 'none';
            if (title) {
                title.textContent = isWebDavRoute ? 'WebDAV 备份恢复' : (isSearchRoute ? '网络搜索配置' : '模型 API 配置');
            }
            if (exportBtns) exportBtns.style.display = isModelsRoute ? 'flex' : 'none';
        }

        /**
         * 【设置面板/配置路由】【网络搜索】渲染网络搜索配置页面
         * @returns {void}
         */
        function renderWebSearchSettings() {
            const panel = document.getElementById('settingsSearchPanel');
            if (!panel) return;
            const s = webSearchSettings;
            panel.innerHTML = `
                <div style="font-weight:600;font-size:14px;margin-bottom:2px;">网络搜索配置</div>
                <label>搜索服务供应商</label>
                <select id="editSearchProvider">
                    <option value="tinyfish" ${s.provider === 'tinyfish' ? 'selected' : ''}>TinyFish</option>
                </select>
                <label>API URL</label>
                <input type="text" id="editSearchUrl" value="${escapeHtml(s.apiUrl || '')}" placeholder="https://agent.tinyfish.ai">
                <label>API Key</label>
                <input type="password" id="editSearchKey" value="${escapeHtml(s.apiKey || '')}" placeholder="sk-tinyfish-...">
                <div style="display:flex;gap:10px;">
                    <div style="flex:1;">
                        <label>地区 (Location)</label>
                        <input type="text" id="editSearchLocation" value="${escapeHtml(s.location || 'US')}" placeholder="US">
                    </div>
                    <div style="flex:1;">
                        <label>语言 (Language)</label>
                        <input type="text" id="editSearchLanguage" value="${escapeHtml(s.language || 'en')}" placeholder="en">
                    </div>
                </div>
                <label>提取网页内容数量 (Fetch Count, 1-5)</label>
                <input type="number" id="editSearchFetchCount" value="${s.fetchCount || 2}" min="1" max="5" placeholder="2">
            `;
        }

        /**
         * 【设置面板/配置路由】【整页渲染】根据当前路由渲染对应配置页面
         * @returns {void}
         */
        function renderSettingsPanels() {
            renderSettingsRouteTabs();
            if (settingsRoute === 'web-search') {
                renderWebSearchSettings();
                return;
            }
            if (settingsRoute === 'webdav') {
                renderWebDavSettings();
                return;
            }
            if (!providers.find(p => p.id === editingProviderId)) {
                editingProviderId = activeProviderId || providers[0]?.id || null;
            }
            renderSettingsLeft();
            renderSettingsRight();
        }

        /**
         * 【设置面板/配置路由】【页面切换】切换模型配置或网络搜索配置页面
         * @param {string} route - 目标配置路由，支持 models、web-search 与 webdav
         * @returns {void}
         */
        function switchSettingsRoute(route) {
            if (!['models', 'web-search', 'webdav'].includes(route) || route === settingsRoute) return;
            flushCurrentSettingsRoute();
            settingsRoute = route;
            renderSettingsPanels();
        }

        function selectProviderForEdit(id) {
            flushEditingProvider();
            editingProviderId = id;
            renderSettingsPanels();
        }

        function addModelToEditing() {
            const p = providers.find(p => p.id === editingProviderId);
            if (!p) return;
            if (!p.models) p.models = [];
            p.models.push('');
            renderSettingsRight();
        }

        function removeModelFromEditing(idx) {
            flushEditingProvider();
            const p = providers.find(p => p.id === editingProviderId);
            if (!p || !p.models) return;
            p.models.splice(idx, 1);
            renderSettingsRight();
        }

        function showAddModelInput() {
            const list = document.getElementById('editModelsList');
            if (!list) return;
            const btn = list.querySelector('.tag-add-btn');
            if (btn) btn.style.display = 'none';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tag-add-input';
            input.placeholder = '输入模型名';
            let committed = false;
            const commit = () => { if (committed) return; committed = true; commitNewModel(input); };
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
            input.addEventListener('blur', () => { setTimeout(commit, 120); });
            list.appendChild(input);
            input.focus();
        }

        function commitNewModel(input) {
            flushEditingProvider();
            const val = input.value.trim();
            if (val) {
                const p = providers.find(p => p.id === editingProviderId);
                if (p) { if (!p.models) p.models = []; p.models.push(val); }
            }
            renderSettingsRight();
        }

        /**
         * 【设置面板/模型候选】【远程获取】按当前协议获取远程模型列表并展示为候选模型
         * @returns {Promise<void>}
         */
        async function fetchModels() {
            flushEditingProvider();
            const p = providers.find(p => p.id === editingProviderId);
            if (!p) { showToast('请先选择一个运营商'); return; }
            try {
                const modelIds = await fetchProviderModelCandidates(p);
                if (modelIds.length === 0) { showToast('未获取到模型列表'); return; }
                setModelCandidateList(p.id, modelIds);
                renderSettingsRight();
                showToast(`已获取 ${modelIds.length} 个候选模型`);
            } catch (err) {
                showToast('获取失败: ' + (err.message || '未知错误'));
            }
        }

        function setActiveFromModal() {
            if (!editingProviderId) return;
            const p = providers.find(p => p.id === editingProviderId);
            activeProviderId = editingProviderId;
            activeModel = p?.models?.[0] || '';
            renderSettingsPanels();
            updateModelDisplay();
        }

        function deleteProviderFromModal() {
            if (providers.length <= 1) return;
            const pid = editingProviderId;
            providers = providers.filter(p => p.id !== pid);
            if (activeProviderId === pid) {
                activeProviderId = providers[0]?.id || null;
                activeModel = (providers[0]?.models && providers[0].models[0]) || '';
            }
            editingProviderId = providers[0]?.id || null;
            renderSettingsPanels();
            updateModelDisplay();
        }

        /**
         * 【设置面板/运营商配置】【新增运营商】创建一个默认 OpenAI 协议的新运营商
         * @returns {void}
         */
        function addProviderInModal() {
            const newId = Date.now();
            providers.push({ id: newId, name: '新运营商', apiUrl: '', apiKey: '', protocol: 'openai', thinkingFormat: 'auto', models: [] });
            editingProviderId = newId;
            settingsRoute = 'models';
            clearModelCandidateList();
            renderSettingsPanels();
        }

        // ============================================================
        //  设置面板 — 打开/关闭/保存
        // ============================================================
        /**
         * 【设置面板/配置路由】【打开弹窗】打开设置弹窗并进入指定配置路由
         * @param {string} [route='models'] - 初始配置路由，支持 models、web-search 与 webdav
         * @returns {void}
         */
        function openSettings(route = 'models') {
            providersBackup = deepClone({ providers, activeProviderId, activeModel, webSearchSettings, webDavSettings });
            editingProviderId = activeProviderId || providers[0]?.id || null;
            settingsRoute = ['models', 'web-search', 'webdav'].includes(route) ? route : 'models';
            renderSettingsPanels();
            document.getElementById('settingsModal').style.display = 'flex';
        }

        /**
         * 【设置面板/配置路由】【取消弹窗】关闭设置弹窗并恢复打开前的配置快照
         * @returns {void}
         */
        function closeSettings() {
            if (providersBackup) {
                const restored = deepClone(providersBackup);
                providers = restored.providers;
                activeProviderId = restored.activeProviderId;
                activeModel = restored.activeModel;
                if (restored.webSearchSettings) {
                    webSearchSettings = restored.webSearchSettings;
                }
                if (restored.webDavSettings) {
                    webDavSettings = restored.webDavSettings;
                }
                providersBackup = null;
                updateModelDisplay();
                renderModelDropdown();
                updateSearchBtnUI();
            }
            document.getElementById('settingsModal').style.display = 'none';
        }

        /**
         * 【设置面板/配置路由】【保存配置】保存模型供应商配置与网络搜索配置
         * @returns {void}
         */
        async function saveSettings() {
            flushCurrentSettingsRoute();
            // 如果当前运营商编辑后不再包含原有激活模型，自动切换为第一个模型
            const ap = providers.find(p => p.id === activeProviderId);
            if (ap && ap.models && ap.models.length > 0 && !ap.models.includes(activeModel)) {
                activeModel = ap.models[0];
            }
            providersBackup = null;
            saveProvidersToStorage();

            // 保存网络搜索配置
            try {
                localStorage.setItem('webSearchSettings', JSON.stringify(webSearchSettings));
            } catch(e) {}
            updateSearchBtnUI();

            // 保存 WebDAV 备份恢复配置
            await saveWebDavSettings();

            updateModelDisplay();
            renderModelDropdown();
            document.getElementById('settingsModal').style.display = 'none';
            showToast('配置已保存');
        }

        // ============================================================
        //  导入导出
        // ============================================================
        function exportProviders() {
            flushCurrentSettingsRoute();
            const data = buildBackupPayload();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat-providers-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast(`已导出 (${providers.length}个运营商, ${sessions.length}个会话, ${favorites.length}个收藏)`);
        }

        function importProviders(input) {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const stats = await applyBackupData(data);
                    providersBackup = deepClone({ providers, activeProviderId, activeModel, webSearchSettings, webDavSettings });
                    showToast(`已导入 (${stats.providers}个运营商, ${stats.sessions}个会话, ${stats.favorites}个收藏)`);
                } catch(err) {
                    showToast('导入失败: JSON 格式不正确');
                }
            };
            reader.readAsText(file);
            input.value = '';
        }
