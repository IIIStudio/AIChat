        // ============================================================
        //  生图模式
        // ============================================================
        let genControlImage = null; // { base64, name }（保留变量以兼容引用）

        function handleGenControlFile(input) {
            // 控制模式已移除
        }

        function clearGenControlImage() {
            genControlImage = null;
        }

        function setMode(mode) {
            imageGenMode = (mode === 'gen');
            favMode = (mode === 'fav');
            document.documentElement.setAttribute('data-mode', mode);
            const btnChat = document.getElementById('modeBtnChat');
            const btnGen = document.getElementById('modeBtnGen');
            const btnFav = document.getElementById('modeBtnFav');
            const panel = document.getElementById('genControlsPanel');
            const favPage = document.getElementById('favPage');

            // 重置所有按钮
            btnChat.classList.remove('active');
            btnGen.classList.remove('active');
            if (btnFav) btnFav.classList.remove('active');
            panel.classList.remove('show');
            if (mode !== 'fav' && favPage) favPage.classList.remove('show');

            if (mode === 'fav') {
                if (btnFav) btnFav.classList.add('active');
                if (favPage) favPage.classList.add('show');
                userInput.placeholder = '收藏页面';
                clearImagePreview();
                // 瀑布流永不重建：初始化时渲染一次，后续只用原地增删
                if (!favRenderedOnce) { favRenderedOnce = true; renderFavorites(); }
            } else if (imageGenMode) {
                btnChat.classList.remove('active');
                btnGen.classList.add('active');
                loadGenSettings();
                restoreGenCollapse(); // 在 show 之前恢复折叠状态，避免闪烁
                updateGenControlUploadVisibility();
                panel.classList.add('show');
                userInput.placeholder = '输入图片描述词，Enter 发送';
                clearImagePreview();
                if (!isGenModel(activeModel)) autoSelectGenModel();
                updateGenSizeButtons();
            } else {
                saveGenSettings(); // 离开生图时保存设置
                btnChat.classList.add('active');
                btnGen.classList.remove('active');
                panel.classList.remove('show');
                userInput.placeholder = '输入你的问题，Enter 发送，Shift+Enter 换行';
                clearGenControlImage();
                if (isGenModel(activeModel)) autoSelectChatModel();
            }
            renderModelDropdown();
            updateModelDisplay();
            try { localStorage.setItem('chatGenMode', mode); } catch(e) {}
            // 切换模式时强制刷新侧边栏（模式变了会话列表不同），但不重置聊天区渲染标记
            // 避免同一会话的图片被重复渲染
            if (mode !== 'fav') {
                renderSidebar();
                switchChat(getCurrentId());
            }
            else renderSidebar();
        }

        // 在 providers 中查找第一个匹配类型（gen/chat）的模型并切换
        function findFirstModelByType(isGen) {
            for (const p of providers) {
                for (const m of (p.models || [])) {
                    if (isGenModel(m) === isGen) return { pid: p.id, model: m };
                }
            }
            return null;
        }

        function autoSelectGenModel() {
            const found = findFirstModelByType(true);
            if (found) { activeProviderId = found.pid; activeModel = found.model; saveProvidersToStorage(); }
        }

        function autoSelectChatModel() {
            const found = findFirstModelByType(false);
            if (found) { activeProviderId = found.pid; activeModel = found.model; saveProvidersToStorage(); }
        }

        function loadImageGenMode() {
            try {
                const mode = localStorage.getItem('chatGenMode');
                if (mode === 'gen') {
                    imageGenMode = true;
                    document.documentElement.setAttribute('data-mode', 'gen');
                    document.getElementById('modeBtnChat').classList.remove('active');
                    document.getElementById('modeBtnGen').classList.add('active');
                    loadGenSettings();
                    restoreGenCollapse();
                    document.getElementById('genControlsPanel').classList.add('show');
                    userInput.placeholder = '输入图片描述词，Enter 发送';
                    if (!isGenModel(activeModel)) autoSelectGenModel();
                    updateGenSizeButtons();
                } else if (mode === 'fav') {
                    imageGenMode = false;
                    favMode = true;
                    document.documentElement.setAttribute('data-mode', 'fav');
                    document.getElementById('modeBtnChat').classList.remove('active');
                    document.getElementById('modeBtnGen').classList.remove('active');
                    const btnFav = document.getElementById('modeBtnFav');
                    if (btnFav) btnFav.classList.add('active');
                    const favPage = document.getElementById('favPage');
                    if (favPage) favPage.classList.add('show');
                    userInput.placeholder = '收藏页面';
                } else {
                    document.documentElement.setAttribute('data-mode', 'chat');
                    if (isGenModel(activeModel)) autoSelectChatModel();
                }
            } catch(e) {}
        }

        function toggleGenControls(save = true) {
            const body = document.getElementById('genCollapseBody');
            const arrow = document.getElementById('genCollapseArrow');
            const sum = document.getElementById('genCollapseSummary');
            if (!body || !arrow) return;
            body.classList.toggle('collapsed');
            const collapsed = body.classList.contains('collapsed');
            arrow.textContent = collapsed ? '▼' : '▲';
            if (collapsed && sum) {
                sum.style.display = '';
                sum.textContent = buildGenSummary();
            } else if (sum) {
                sum.style.display = 'none';
            }
            if (save) try { localStorage.setItem('chatGenCollapsed', collapsed ? '1' : '0'); } catch(e) {}
        }

        // 确保折叠/展开到指定状态（不触发 toggle）
        function setGenCollapsed(collapsed) {
            const body = document.getElementById('genCollapseBody');
            const arrow = document.getElementById('genCollapseArrow');
            const sum = document.getElementById('genCollapseSummary');
            if (!body || !arrow) return;
            if (collapsed) {
                body.classList.add('collapsed');
                arrow.textContent = '▼';
                if (sum) { sum.style.display = ''; sum.textContent = buildGenSummary(); }
            } else {
                body.classList.remove('collapsed');
                arrow.textContent = '▲';
                if (sum) sum.style.display = 'none';
            }
        }

        function buildGenSummary() {
            const parts = [];
            parts.push(getGenSize());
            return parts.join(', ');
        }

        function restoreGenCollapse() {
            try {
                const wantCollapsed = localStorage.getItem('chatGenCollapsed') === '1';
                setGenCollapsed(wantCollapsed);
            } catch(e) {}
            // 更新摘要
            const body = document.getElementById('genCollapseBody');
            const sum = document.getElementById('genCollapseSummary');
            if (sum && body && body.classList.contains('collapsed')) sum.textContent = buildGenSummary();
        }

        function updateGenControlUploadVisibility() {
            // 控制模式已移除，此函数保留为空操作以兼容调用
        }

        function onGenSizeChange() {
            const preset = document.getElementById('genSizePreset').value;
            const custom = document.getElementById('genCustomSize');
            if (preset === 'custom') {
                custom.style.display = 'flex';
            } else {
                custom.style.display = 'none';
            }
            // 同步按钮高亮
            document.querySelectorAll('.gen-size-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === preset);
            });
        }

        function getGenSize() {
            const preset = document.getElementById('genSizePreset').value;
            if (preset === 'custom') {
                const w = document.getElementById('genWidth').value || 1024;
                const h = document.getElementById('genHeight').value || 1024;
                return `${w}x${h}`;
            }
            return preset;
        }

        // 生图面板所有控件改变时自动持久化
        (function() {
            const ids = ['genNegativePrompt','genSizePreset','genWidth','genHeight'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', saveGenSettings);
                    el.addEventListener('change', () => {
                        saveGenSettings();
                        if (id === 'genSizePreset') onGenSizeChange();
                    });
                }
            });
        })();

        // 尺寸预设定义：Flux/StableDiffusion 风格 vs OpenAI Images 风格
        const GEN_SIZE_OPTIONS_FLUX = [
            { value: '1024x1024', label: '1:1' },
            { value: '1024x768', label: '4:3' },
            { value: '768x1024', label: '3:4' },
            { value: '1024x576', label: '16:9' },
            { value: '576x1024', label: '9:16' },
            { value: 'custom', label: '自定义' },
        ];
        const GEN_SIZE_OPTIONS_OPENAI = [
            { value: '1024x1024', label: '1:1' },
            { value: '1536x1024', label: '16:9' },
            { value: '1024x1536', label: '9:16' },
            { value: 'auto', label: '自动' },
        ];

        function getGenSizeOptions() {
            return isOpenAIImageModel(activeModel) ? GEN_SIZE_OPTIONS_OPENAI : GEN_SIZE_OPTIONS_FLUX;
        }

        // 根据当前模型动态渲染尺寸预设按钮
        function updateGenSizeButtons() {
            const container = document.querySelector('.gen-size-btns');
            const hidden = document.getElementById('genSizePreset');
            if (!container || !hidden) return;
            const opts = getGenSizeOptions();
            container.innerHTML = opts.map(o =>
                `<button type="button" class="gen-size-btn" data-value="${o.value}">${o.label}</button>`
            ).join('');
            // 当前预设值不在新选项内则回退到第一个
            if (!opts.some(o => o.value === hidden.value)) {
                hidden.value = opts[0].value;
            }
            container.querySelectorAll('.gen-size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    hidden.value = btn.dataset.value;
                    hidden.dispatchEvent(new Event('change'));
                });
            });
            onGenSizeChange();
        }

        // 输入框聚焦时展开生图参数，离开时折叠（仅生图模式）
        (function() {
            const input = document.getElementById('userInput');
            if (!input) return;
            input.addEventListener('focus', function() {
                if (imageGenMode) setGenCollapsed(false);
            });
            input.addEventListener('blur', function() {
                if (imageGenMode) setGenCollapsed(true);
            });
        })();

        // 持久化生图设置
        function saveGenSettings() {
            try {
                const s = {
                    np: document.getElementById('genNegativePrompt').value,
                    size: document.getElementById('genSizePreset').value,
                    w: document.getElementById('genWidth').value,
                    h: document.getElementById('genHeight').value,
                };
                localStorage.setItem('chatGenSettings', JSON.stringify(s));
            } catch(e) {}
        }

        function loadGenSettings() {
            try {
                const raw = localStorage.getItem('chatGenSettings');
                if (!raw) return;
                const s = JSON.parse(raw);
                if (s.np !== undefined) document.getElementById('genNegativePrompt').value = s.np;
                if (s.size) { document.getElementById('genSizePreset').value = s.size; onGenSizeChange(); }
                if (s.w) document.getElementById('genWidth').value = s.w;
                if (s.h) document.getElementById('genHeight').value = s.h;
            } catch(e) {}
        }
