        // ============================================================
        //  Providers 数据管理 & 模型切换
        // ============================================================
        let providers = [];
        let activeProviderId = null;
        let activeModel = '';
        let providersBackup = null;
        let editingProviderId = null;
        let settingsRoute = 'models';
        let retryBlockEl = null;
        const modelDropdown = document.getElementById('modelDropdown');

        async function loadProviders() {
            try {
                const saved = await dbGet('providers');
                if (saved) {
                    providers = saved.providers || [];
                    activeProviderId = saved.activeProviderId || null;
                    activeModel = saved.activeModel || '';
                    providers = normalizeProviderConfigs(providers);
                }
            } catch(e) {}
            if (providers.length === 0) {
                const defaultId = Date.now();
                providers.push({ id: defaultId, name: '默认', apiUrl: 'https://token-plan-cn.xiaomimimo.com/v1', apiKey: '', protocol: 'openai', thinkingFormat: 'auto', models: ['mimo-v2.5-pro', 'mimo-v2.5'] });
                providers.push({ id: defaultId + 1, name: 'Gitee AI', apiUrl: 'https://ai.gitee.com/v1', apiKey: '', protocol: 'openai', thinkingFormat: 'auto', models: ['z-image-turbo'] });
                activeProviderId = defaultId;
                activeModel = 'mimo-v2.5-pro';
            } else {
                providers = normalizeProviderConfigs(providers);
                if (!providers.find(p => p.id === activeProviderId)) {
                    activeProviderId = providers[0]?.id || null;
                    activeModel = (providers[0]?.models && providers[0].models[0]) || '';
                }
                if (!activeModel) {
                    const ap = providers.find(p => p.id === activeProviderId);
                    activeModel = (ap?.models && ap.models[0]) || '';
                }
            }
            saveProvidersToStorage();
        }

        async function saveProvidersToStorage() {
            try { await dbSet('providers', { providers, activeProviderId, activeModel }); } catch(e) {}
        }

        function getActiveProvider() {
            return providers.find(p => p.id === activeProviderId) || providers[0] || null;
        }

        // 生图专用模型（仅生图模式显示，对话模式隐藏）
        const GEN_ONLY_MODELS = ['z-image-turbo', 'gpt-image-2'];
        function isGenModel(name) {
            return GEN_ONLY_MODELS.includes(name);
        }

        // OpenAI Images 协议模型（gpt-image-2 等），请求体字段与 Flux/StableDiffusion 不同
        const OPENAI_IMAGE_MODELS = ['gpt-image-2'];
        function isOpenAIImageModel(name) {
            return OPENAI_IMAGE_MODELS.includes(name);
        }

        function updateModelDisplay() {
            const el = document.getElementById('displayModelName');
            if (!el) return;
            const logo = getActiveLogo();
            const logoHtml = renderLogoHtml(logo);
            el.innerHTML = `${logoHtml}<span class="model-info-text">${escapeHtml(activeModel || (getActiveProvider()?.models?.[0]) || '未配置')}</span>`;
        }

        function renderModelDropdown(filterText) {
            if (!modelDropdown) return;
            const dropdown = modelDropdown;
            dropdown.innerHTML = '';
            // 1.顶部搜索框
            const searchWrap = document.createElement('div');
            searchWrap.className = 'model-search-wrap';
            searchWrap.innerHTML = '<input type="text" class="model-search-input" placeholder="搜索模型..." value="">';
            dropdown.appendChild(searchWrap);
            const searchInput = searchWrap.querySelector('input');
            searchInput.oninput = () => renderModelDropdownItems(dropdown, searchInput.value);
            // 2.渲染模型列表
            renderModelDropdownItems(dropdown, '');
            // 3.聚焦搜索框
            setTimeout(() => searchInput.focus(), 0);
        }

        // 渲染过滤后的模型列表项
        function renderModelDropdownItems(dropdown, filterText) {
            // 移除旧列表项（保留搜索框）
            Array.from(dropdown.children).forEach(c => { if (!c.classList.contains('model-search-wrap')) c.remove(); });
            const ft = (filterText || '').toLowerCase().trim();
            const filtered = [];
            providers.forEach(p => {
                (p.models || []).forEach(m => {
                    const isGen = isGenModel(m);
                    if (imageGenMode ? isGen : !isGen) {
                        // 搜索过滤：匹配模型名或运营商名
                        if (ft && !m.toLowerCase().includes(ft) && !p.name.toLowerCase().includes(ft)) return;
                        const logo = getModelDevLogo(p.name, p.apiUrl, m);
                        filtered.push({ pid: p.id, pname: p.name, model: m, logo });
                    }
                });
            });
            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'model-dropdown-item';
                empty.style.color = 'var(--text-muted)';
                empty.style.cursor = 'default';
                empty.textContent = '无匹配模型';
                dropdown.appendChild(empty);
                return;
            }
            filtered.forEach(item => {
                const isActive = item.pid === activeProviderId && item.model === activeModel;
                const div = document.createElement('div');
                div.className = 'model-dropdown-item' + (isActive ? ' active' : '');
                const logoHtml = renderLogoHtml(item.logo);
                div.innerHTML = `<div class="dropdown-left">${logoHtml}<span>${escapeHtml(item.model)}</span></div><span class="provider-name">${escapeHtml(item.pname)}</span>`;
                div.onclick = (e) => { e.stopPropagation(); switchModel(item.pid, item.model); };
                dropdown.appendChild(div);
            });
        }

        function switchModel(pid, model) {
            activeProviderId = pid;
            activeModel = model;
            saveProvidersToStorage();
            updateModelDisplay();
            renderModelDropdown();
            closeModelDropdown();
            const p = getActiveProvider();
            if (retryBlockEl) {
                const el = retryBlockEl;
                retryBlockEl = null;
                regenerateMessage(el);
            } else if (p) {
                showToast(`已切换到 ${p.name} / ${model}`);
            }
            if (typeof updateGenSizeButtons === 'function') updateGenSizeButtons();
        }

        function retryWithDropdown(blockEl) {
            retryBlockEl = blockEl;
            toggleModelDropdown();
        }

        function toggleModelDropdown() {
            // 按当前模式统计可用模型数
            let total = 0;
            providers.forEach(p => {
                (p.models || []).forEach(m => {
                    if (imageGenMode ? isGenModel(m) : !isGenModel(m)) total++;
                });
            });
            if (total === 0) { showToast('当前模式无可用的模型'); return; }
            modelDropdown.classList.toggle('show');
            if (modelDropdown.classList.contains('show')) {
                // 移到 body 下，脱离所有父级 stacking context
                document.body.appendChild(modelDropdown);
                renderModelDropdown();
                // 固定定位：对齐模型按钮右下角，向上弹出
                const btn = document.querySelector('.model-info');
                if (btn) {
                    const r = btn.getBoundingClientRect();
                    modelDropdown.style.right = (window.innerWidth - r.right) + 'px';
                    modelDropdown.style.bottom = (window.innerHeight - r.top + 8) + 'px';
                }
            } else {
                // 收回到原始位置
                const switcher = document.querySelector('.model-switcher');
                if (switcher) switcher.appendChild(modelDropdown);
                modelDropdown.style.right = '';
                modelDropdown.style.bottom = '';
            }
        }

        function closeModelDropdown() {
            if (!modelDropdown || !modelDropdown.classList.contains('show')) return;
            modelDropdown.classList.remove('show');
            modelDropdown.style.right = '';
            modelDropdown.style.bottom = '';
            // 移回原始位置
            const switcher = document.querySelector('.model-switcher');
            if (switcher) switcher.appendChild(modelDropdown);
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.model-switcher') && !e.target.closest('.model-dropdown')) closeModelDropdown();
            if (!e.target.closest('.thinking-switcher') && !e.target.closest('.thinking-dropdown')) closeThinkingDropdown();
            
            // 【思考过程/系统】【折叠控制】通过事件委托统一处理所有思考横条的点击折叠/展开
            const bar = e.target.closest('.thought-bar');
            if (bar) {
                const process = bar.closest('.thought-process');
                if (process) {
                    process.classList.toggle('collapsed');
                }
            }
        });

        // ============================================================
        //  思考等级切换 — 覆盖 auto/max/xhigh/high/medium/low/none
        //  auto 为默认，不向请求体注入 thinking 字段，交由模型/接口默认行为
        // ============================================================
        // 思考等级枚举：value 为下发到请求体的 thinking 值，label 为界面展示文案
        const THINKING_LEVELS = [
            { value: 'auto',   label: '自动' },
            { value: 'max',    label: '最高' },
            { value: 'xhigh',  label: '极高' },
            { value: 'high',   label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low',    label: '低' },
            { value: 'none',   label: '关闭' },
        ];
        let thinkingLevel = 'auto';
        let thinkingDropdownEl = null;

        // 从 localStorage 恢复思考等级，校验非法值时回退为 auto
        function loadThinkingLevel() {
            thinkingDropdownEl = document.getElementById('thinkingDropdown');
            try {
                const saved = localStorage.getItem('chatThinkingLevel');
                if (saved && THINKING_LEVELS.some(l => l.value === saved)) thinkingLevel = saved;
            } catch(e) {}
            updateThinkingDisplay();
        }

        // 持久化当前思考等级
        function saveThinkingLevel() {
            try { localStorage.setItem('chatThinkingLevel', thinkingLevel); } catch(e) {}
        }

        // 更新按钮展示文案与选中态
        function updateThinkingDisplay() {
            const labelEl = document.getElementById('thinkingLabel');
            if (labelEl) {
                const found = THINKING_LEVELS.find(l => l.value === thinkingLevel);
                labelEl.textContent = found ? found.label : '自动';
            }
            if (!thinkingDropdownEl) return;
            Array.from(thinkingDropdownEl.children).forEach(child => {
                child.classList.toggle('active', child.dataset.value === thinkingLevel);
            });
        }

        // 渲染思考等级下拉列表
        function renderThinkingDropdown() {
            if (!thinkingDropdownEl) return;
            thinkingDropdownEl.innerHTML = '';
            THINKING_LEVELS.forEach(l => {
                const div = document.createElement('div');
                div.className = 'thinking-dropdown-item' + (l.value === thinkingLevel ? ' active' : '');
                div.dataset.value = l.value;
                // auto 标注“默认”，none 标注“停用”，其余标注 value 原值便于辨识
                const hint = l.value === 'auto' ? '默认' : (l.value === 'none' ? '停用' : l.value);
                div.innerHTML = `<span>${l.label}</span><span class="thinking-hint">${hint}</span>`;
                div.onclick = (e) => { e.stopPropagation(); switchThinkingLevel(l.value); };
                thinkingDropdownEl.appendChild(div);
            });
        }

        // 切换下拉显隐，展开时移至 body 固定定位、对齐按钮右上角向上弹出
        function toggleThinkingDropdown() {
            if (!thinkingDropdownEl) return;
            thinkingDropdownEl.classList.toggle('show');
            if (thinkingDropdownEl.classList.contains('show')) {
                document.body.appendChild(thinkingDropdownEl);
                renderThinkingDropdown();
                const btn = document.getElementById('thinkingInfo');
                if (btn) {
                    const r = btn.getBoundingClientRect();
                    thinkingDropdownEl.style.right = (window.innerWidth - r.right) + 'px';
                    thinkingDropdownEl.style.bottom = (window.innerHeight - r.top + 8) + 'px';
                }
            } else {
                closeThinkingDropdown();
            }
        }

        // 收起下拉并归位到原始容器
        function closeThinkingDropdown() {
            if (!thinkingDropdownEl || !thinkingDropdownEl.classList.contains('show')) return;
            thinkingDropdownEl.classList.remove('show');
            thinkingDropdownEl.style.right = '';
            thinkingDropdownEl.style.bottom = '';
            const switcher = document.querySelector('.thinking-switcher');
            if (switcher) switcher.appendChild(thinkingDropdownEl);
        }

        // 选择某个思考等级：更新状态、持久化、刷新展示并收起下拉
        function switchThinkingLevel(value) {
            thinkingLevel = value;
            saveThinkingLevel();
            updateThinkingDisplay();
            closeThinkingDropdown();
            const found = THINKING_LEVELS.find(l => l.value === value);
            showToast(`思考等级：${found ? found.label : value}`);
        }

        // ============================================================
        //  models.dev Logo 匹配
        // ============================================================
        function getModelDevLogo(providerName, apiUrl, modelName) {
            const k = (providerName || '').toLowerCase() + '|' + (apiUrl || '').toLowerCase() + '|' + (modelName || '').toLowerCase();
            const candidates = [
                ['openai',     ['openai', 'gpt-', 'chatgpt', 'o1', 'o3', 'o4']],
                ['anthropic',  ['anthropic', 'claude']],
                ['google',     ['google', 'gemini', 'gemma', 'generativelanguage', 'palm']],
                ['deepseek',   ['deepseek']],
                ['mistral',    ['mistral', 'ministral', 'codestral']],
                ['meta',       ['meta', 'llama', 'llama3', 'llama4']],
                ['alibaba',    ['alibaba', 'qwen', 'tongyi', 'dashscope', 'z-image']],
                ['zhipuai',    ['zhipu', 'glm', 'chatglm', 'bigmodel']],
                ['moonshot',   ['moonshot', 'kimi']],
                ['xai',        ['x.ai', 'xai', 'grok']],
                ['minimax',    ['minimax']],
                ['baidu',      ['baidu', 'ernie', 'wenxin', 'qianfan']],
                ['bytedance',  ['bytedance', 'doubao', 'volcengine', 'volc', 'ark']],
                ['cohere',     ['cohere', 'command']],
                ['groq',       ['groq']],
                ['fireworks',  ['fireworks']],
                ['perplexity', ['perplexity', 'pplx', 'sonar']],
                ['replicate',  ['replicate']],
                ['together',   ['together']],
                ['cerebras',   ['cerebras']],
                ['upstage',    ['upstage', 'solar']],
                ['xiaomi',     ['xiaomi', 'xiaomimimo', 'mimo']],
                ['nvidia',     ['nvidia', 'nvapi', 'nemotron']],
                ['iflowcn',    ['iflow']],
                ['stepfun',    ['stepfun', 'step-']],
                ['huggingface',['huggingface', 'hf.co']],
                ['tencent',    ['tencent', 'hunyuan', 'hy', 'tencentcloud']],
            ];
            for (const [pid, patterns] of candidates) {
                for (const pat of patterns) {
                    if (k.includes(pat)) {
                        return `https://models.dev/logos/${encodeURIComponent(pid)}.svg`;
                    }
                }
            }
            return null;
        }

        function getLogoForModel(modelName) {
            for (const p of providers) {
                if (p.models && p.models.includes(modelName)) {
                    return getModelDevLogo(p.name, p.apiUrl, modelName);
                }
            }
            return null;
        }

        function getActiveLogo() {
            const p = getActiveProvider();
            if (!p) return null;
            return getModelDevLogo(p.name, p.apiUrl, activeModel);
        }
