        // ============================================================
        //  生图模式
        // ============================================================
        let genControlImage = null; // { base64, name }

        function handleGenControlFile(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                if (!file.type.startsWith('image/')) { showToast('仅支持图片文件'); input.value = ''; return; }
                const reader = new FileReader();
                reader.onload = (e) => {
                    genControlImage = { base64: e.target.result, name: file.name };
                    document.getElementById('genControlPreviewImg').src = e.target.result;
                    document.getElementById('genControlPreviewName').textContent = file.name;
                    document.getElementById('genControlPreview').style.display = 'flex';
                };
                reader.readAsDataURL(file);
                input.value = '';
            }
        }

        function clearGenControlImage() {
            genControlImage = null;
            document.getElementById('genControlPreview').style.display = 'none';
            document.getElementById('genControlPreviewImg').src = '';
            document.getElementById('genControlFileInput').value = '';
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
            // 切换模式时强制重置渲染标记，确保侧边栏按新模式重新渲染
            if (mode !== 'fav') {
                lastRenderedSessionId = null;
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
            const steps = document.getElementById('genSteps').value;
            if (steps != 9) parts.push('步' + steps);
            const gs = document.getElementById('genGuidanceScale').value;
            if (gs != 1) parts.push('引导' + gs);
            const ctrl = document.getElementById('genControlMode').value;
            if (ctrl) parts.push(ctrl);
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
            const mode = document.getElementById('genControlMode').value;
            const row = document.getElementById('genControlUploadRow');
            if (mode) {
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
                if (genControlImage) clearGenControlImage();
            }
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
            const ids = ['genNegativePrompt','genSteps','genSeed',
                'genGuidanceScale','genImageScale','genSizePreset','genWidth','genHeight',
                'genControlMode','genControlScale'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', saveGenSettings);
                    el.addEventListener('change', () => {
                        saveGenSettings();
                        if (id === 'genSizePreset') onGenSizeChange();
                        if (id === 'genControlMode') updateGenControlUploadVisibility();
                    });
                }
            });
        })();

        // 尺寸预设按钮点击
        (function() {
            document.querySelectorAll('.gen-size-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const hidden = document.getElementById('genSizePreset');
                    hidden.value = btn.dataset.value;
                    hidden.dispatchEvent(new Event('change'));
                });
            });
            onGenSizeChange(); // 初始化默认高亮
        })();

        // 持久化生图设置
        function saveGenSettings() {
            try {
                const s = {
                    np: document.getElementById('genNegativePrompt').value,
                    steps: document.getElementById('genSteps').value,
                    seed: document.getElementById('genSeed').value,
                    guidance: document.getElementById('genGuidanceScale').value,
                    imgScale: document.getElementById('genImageScale').value,
                    size: document.getElementById('genSizePreset').value,
                    w: document.getElementById('genWidth').value,
                    h: document.getElementById('genHeight').value,
                    ctrl: document.getElementById('genControlMode').value,
                    ctrlScale: document.getElementById('genControlScale').value,
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
                if (s.steps) { document.getElementById('genSteps').value = s.steps; document.getElementById('genStepsVal').textContent = s.steps; }
                if (s.seed) document.getElementById('genSeed').value = s.seed;
                if (s.guidance) { document.getElementById('genGuidanceScale').value = s.guidance; document.getElementById('genGuidanceScaleVal').textContent = s.guidance; }
                if (s.imgScale) { document.getElementById('genImageScale').value = s.imgScale; document.getElementById('genImageScaleVal').textContent = s.imgScale; }
                if (s.size) { document.getElementById('genSizePreset').value = s.size; onGenSizeChange(); }
                if (s.w) document.getElementById('genWidth').value = s.w;
                if (s.h) document.getElementById('genHeight').value = s.h;
                if (s.ctrl) { document.getElementById('genControlMode').value = s.ctrl; updateGenControlUploadVisibility(); }
                if (s.ctrlScale) { document.getElementById('genControlScale').value = s.ctrlScale; document.getElementById('genControlScaleVal').textContent = s.ctrlScale; }
            } catch(e) {}
        }
