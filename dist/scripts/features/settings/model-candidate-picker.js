        // ============================================================
        //  设置面板 — 模型候选选择
        // ============================================================
        var modelCandidatePickerState = {
            providerId: null,
            models: [],
            selected: [],
            filter: ''
        };

        /**
         * 【设置面板/模型候选】【状态写入】设置当前供应商的候选模型列表
         * @param {number|string} providerId - 供应商 ID
         * @param {Array<string>} models - 候选模型列表
         * @returns {void}
         */
        function setModelCandidateList(providerId, models) {
            modelCandidatePickerState = {
                providerId,
                models: Array.from(new Set((models || []).filter(Boolean))),
                selected: [],
                filter: ''
            };
        }

        /**
         * 【设置面板/模型候选】【状态清理】清空当前候选模型列表
         * @returns {void}
         */
        function clearModelCandidateList() {
            modelCandidatePickerState = {
                providerId: null,
                models: [],
                selected: [],
                filter: ''
            };
        }

        /**
         * 【设置面板/模型候选】【过滤列表】获取当前过滤后的候选模型列表
         * @returns {Array<string>} - 过滤后的候选模型列表
         */
        function getFilteredModelCandidates() {
            const filterText = (modelCandidatePickerState.filter || '').trim().toLowerCase();
            if (!filterText) return modelCandidatePickerState.models;
            return modelCandidatePickerState.models.filter(model => model.toLowerCase().includes(filterText));
        }

        /**
         * 【设置面板/模型候选】【选中判断】判断候选模型是否已选中
         * @param {string} model - 模型名称
         * @returns {boolean} - 是否已选中
         */
        function isModelCandidateSelected(model) {
            return modelCandidatePickerState.selected.includes(model);
        }

        /**
         * 【设置面板/模型候选】【渲染 HTML】渲染候选模型选择器
         * @param {Object} provider - 当前编辑的供应商
         * @returns {string} - 候选模型选择器 HTML
         */
        function renderModelCandidatePicker(provider) {
            if (!provider || modelCandidatePickerState.providerId !== provider.id || modelCandidatePickerState.models.length === 0) {
                return '';
            }
            const filtered = getFilteredModelCandidates();
            const selectedCount = modelCandidatePickerState.selected.length;
            const totalCount = modelCandidatePickerState.models.length;
            const listHtml = filtered.map(model => {
                const checked = isModelCandidateSelected(model) ? 'checked' : '';
                const existing = (provider.models || []).includes(model);
                const existingText = existing ? '<span class="model-candidate-existing">已添加</span>' : '';
                return `
                    <label class="model-candidate-item ${existing ? 'added' : ''}">
                        <input type="checkbox" data-model="${escapeHtml(model)}" onchange="toggleModelCandidateByInput(this)" ${checked} ${existing ? 'disabled' : ''}>
                        <span>${escapeHtml(model)}</span>
                        ${existingText}
                    </label>
                `;
            }).join('');
            return `
                <div class="model-candidate-panel">
                    <div class="model-candidate-header">
                        <div>
                            <div class="model-candidate-title">候选模型</div>
                            <div class="model-candidate-desc">已获取 ${totalCount} 个模型，已选择 ${selectedCount} 个</div>
                        </div>
                        <button type="button" class="model-candidate-link" onclick="clearFetchedModelCandidates()">关闭</button>
                    </div>
                    <input type="text" class="model-candidate-search" id="modelCandidateSearch" value="${escapeHtml(modelCandidatePickerState.filter)}" placeholder="搜索候选模型" oninput="filterModelCandidates(this.value)">
                    <div class="model-candidate-actions">
                        <button type="button" onclick="selectAllModelCandidates()">全选当前</button>
                        <button type="button" onclick="clearSelectedModelCandidates()">清空选择</button>
                        <button type="button" onclick="addSelectedModelCandidates()">添加已选</button>
                        <button type="button" onclick="addAllModelCandidates()">全部添加</button>
                    </div>
                    <div class="model-candidate-list thin-scrollbar">
                        ${filtered.length > 0 ? listHtml : '<div class="model-candidate-empty">没有匹配的模型</div>'}
                    </div>
                </div>
            `;
        }

        /**
         * 【设置面板/模型候选】【筛选变更】更新候选模型搜索关键词
         * @param {string} value - 搜索关键词
         * @returns {void}
         */
        function filterModelCandidates(value) {
            modelCandidatePickerState.filter = value || '';
            renderSettingsRight();
            const search = document.getElementById('modelCandidateSearch');
            if (search) {
                search.focus();
                search.setSelectionRange(search.value.length, search.value.length);
            }
        }

        /**
         * 【设置面板/模型候选】【选择切换】根据复选框切换模型选中状态
         * @param {HTMLInputElement} input - 候选模型复选框
         * @returns {void}
         */
        function toggleModelCandidateByInput(input) {
            const model = input.getAttribute('data-model');
            if (!model) return;
            const selected = new Set(modelCandidatePickerState.selected);
            if (input.checked) selected.add(model);
            else selected.delete(model);
            modelCandidatePickerState.selected = Array.from(selected);
            renderSettingsRight();
        }

        /**
         * 【设置面板/模型候选】【批量选择】选择当前过滤结果中的所有未添加模型
         * @returns {void}
         */
        function selectAllModelCandidates() {
            const p = providers.find(item => item.id === editingProviderId);
            if (!p) return;
            const selected = new Set(modelCandidatePickerState.selected);
            getFilteredModelCandidates().forEach(model => {
                if (!(p.models || []).includes(model)) selected.add(model);
            });
            modelCandidatePickerState.selected = Array.from(selected);
            renderSettingsRight();
        }

        /**
         * 【设置面板/模型候选】【清空选择】清空当前候选模型选择
         * @returns {void}
         */
        function clearSelectedModelCandidates() {
            modelCandidatePickerState.selected = [];
            renderSettingsRight();
        }

        /**
         * 【设置面板/模型候选】【追加模型】向当前供应商追加模型并去重
         * @param {Array<string>} models - 需要追加的模型列表
         * @returns {number} - 实际新增数量
         */
        function appendModelsToEditingProvider(models) {
            flushEditingProvider();
            const p = providers.find(item => item.id === editingProviderId);
            if (!p) return 0;
            if (!p.models) p.models = [];
            const before = p.models.length;
            const merged = new Set(p.models);
            (models || []).forEach(model => {
                if (model) merged.add(model);
            });
            p.models = Array.from(merged);
            return p.models.length - before;
        }

        /**
         * 【设置面板/模型候选】【添加已选】把已选候选模型追加到当前供应商
         * @returns {void}
         */
        function addSelectedModelCandidates() {
            const added = appendModelsToEditingProvider(modelCandidatePickerState.selected);
            modelCandidatePickerState.selected = [];
            renderSettingsRight();
            showToast(added > 0 ? `已添加 ${added} 个模型` : '没有新增模型');
        }

        /**
         * 【设置面板/模型候选】【全部添加】把候选模型全部追加到当前供应商
         * @returns {void}
         */
        function addAllModelCandidates() {
            const added = appendModelsToEditingProvider(modelCandidatePickerState.models);
            modelCandidatePickerState.selected = [];
            renderSettingsRight();
            showToast(added > 0 ? `已添加 ${added} 个模型` : '没有新增模型');
        }

        /**
         * 【设置面板/模型候选】【关闭面板】关闭候选模型选择器
         * @returns {void}
         */
        function clearFetchedModelCandidates() {
            clearModelCandidateList();
            renderSettingsRight();
        }
