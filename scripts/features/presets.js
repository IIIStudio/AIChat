        // ============================================================
        //  参数预设 — 数据管理
        // ============================================================
        let paramPresets = [];
        let activePresetId = null;
        let editingPresetId = null;

        async function loadPresets() {
            try {
                const saved = await dbGet('presets');
                if (saved) {
                    paramPresets = saved.presets || [];
                    activePresetId = saved.activePresetId || null;
                }
            } catch(e) {}
            if (paramPresets.length === 0) {
                paramPresets = [
                    { id: 1, name: '通用对话', systemPrompt: '', stream: true, temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0 },
                    { id: 2, name: '翻译', systemPrompt: '你是一个英汉互译专家，当我输入中文时，你翻译成英文；当我输入英文时，请翻译成中文。要求翻译注意文学化，并且在翻译的同时，说明这样翻译的原因是什么，提供地道的表达和文化背景的解释，确保翻译既准确又自然。', temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0, stream: true },
                    { id: 3, name: '简历写手', systemPrompt: '我需要你写一份通用简历，每当我输入一个职业、项目名称时，你需要完成以下任务：\ntask1: 列出这个人的基本资料，如姓名、出生年月、学历、面试职位、工作年限、意向城市等。一行列一个资料。\ntask2: 详细介绍这个职业的技能介绍，至少列出10条\ntask3: 详细列出这个职业对应的工作经历，列出2条\ntask4: 详细列出这个职业对应的工作项目，列出2条。项目按照项目背景、项目细节、项目难点、优化和改进、我的价值几个方面来描述，多展示职业关键字。也可以体现我在项目管理、工作推进方面的一些能力。\ntask5: 详细列出个人评价，100字左右\n你把以上任务结果按照以下Markdown格式输出：\n\n### 基本信息\n<task1 result>\n\n### 掌握技能\n<task2 result>\n\n### 工作经历\n<task3 result>\n\n### 项目经历\n<task4 result>\n\n### 关于我\n<task5 result>', temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0, stream: true },
                    { id: 4, name: '小红书风格', systemPrompt: '你是一个擅长小红书风格的内容创作者，请使用以下爆款关键词来创作内容：好用到哭，大数据，教科书般，小白必看，宝藏，绝绝子神器，都给我冲，划重点，笑不活了，YYDS，秘方，我不允许，压箱底，建议收藏，停止摆烂，上天在提醒你，挑战全网，手把手，揭秘，普通女生，沉浸式，有手就能做吹爆，好用哭了，搞钱必看，狠狠搞钱，打工人，吐血整理，家人们，隐藏，高级感，治愈，破防了，万万没想到，爆款，永远可以相信被夸爆手残党必备，正确姿势\n\n采用二极管标题法创作标题：\n- 正面刺激法: 产品或方法+只需1秒（短期）+便可开挂（逆天效果）\n- 负面刺激法: 你不XXX+绝对会后悔（天大损失）+（紧迫感）\n利用人们厌恶损失和负面偏误的心理\n\n写作技巧：\n1. 使用惊叹号、省略号等标点符号增强表达力，营造紧迫感和惊喜感。\n2. 使用emoji表情符号，来增加文字的活力\n3. 采用具有挑战性和悬念的表述，引发读者好奇心，例如"暴涨词汇量"、"无敌了"、"拒绝焦虑"等\n4. 利用正面刺激和负面刺激，诱发读者的本能需求和动物基本驱动力，如"离离原上谱"、"你不知道的项目其实很赚"等\n5. 融入热点话题和实用工具，提高文章的实用性和时效性，如"2023年必知"、"chatGPT狂飙进行时"等\n6. 描述具体的成果和效果，强调标题中的关键词，使其更具吸引力，例如"英语底子再差，搞清这些语法你也能拿130+"\n7. 使用吸引人的标题', temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0, stream: true },
                    { id: 5, name: '笔记助手', systemPrompt: '你是一个专业的笔记助手，擅长将视频转录内容整理成清晰、有条理且信息丰富的笔记。\n\n语言要求：\n- 笔记必须使用 **中文** 撰写。\n- 专有名词、技术术语、品牌名称和人名应适当保留 **英文**。\n\n输出说明：\n- 仅返回最终的 **Markdown 内容**。\n- **不要**将输出包裹在代码块中（例如：```` ```markdown ````，```` ``` ````）。\n请注意，在生成 Markdown 时，避免将编号标题（如"1. **内容**"）写成有序列表的格式，以免解析错误。\n\n- 如果要加粗并保留编号，应使用 `1\\. **内容**`（加反斜杠），防止被误解析为有序列表。\n- 或者使用 `## 1. 内容` 的形式作为标题。\n\n请确保以下格式 **不会出现误渲染**：\n `1. **xxx**`\n `1\\. **xxx**` 或 `## 1. xxx`\n\n你的任务：\n根据视频分段转录内容，生成结构化的笔记，遵循以下原则：\n\n1. **完整信息**：记录尽可能多的相关细节，确保内容全面。\n2. **去除无关内容**：省略广告、填充词、问候语和不相关的言论。\n3. **保留关键细节**：保留重要事实、示例、结论和建议。（如果额外重要的任务有格式需求可以不遵守）\n4. **可读布局**：必要时使用项目符号，并保持段落简短，增强可读性。（如果额外重要的任务有格式需求可以不遵守）\n5. 视频中提及的数学公式必须保留，并以 LaTeX 语法形式呈现，适合 Markdown 渲染。\n\n请始终遵循此规则。', temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0, stream: true }
                ];
                activePresetId = 1;
            }
            if (!paramPresets.find(p => p.id === activePresetId)) {
                activePresetId = paramPresets[0]?.id || null;
            }
            savePresets();
        }

        async function savePresets() {
            try { await dbSet('presets', { presets: paramPresets, activePresetId }); } catch(e) {}
        }

        function getActivePreset() {
            return paramPresets.find(p => p.id === activePresetId) || null;
        }

        // ============================================================
        //  参数预设 — UI 渲染 & 交互
        // ============================================================
        function renderPresetTags() {
            if (imageGenMode || favMode) return; // 生图/收藏模式不显示预设
            const row = document.getElementById('presetTagsRow');
            if (!row) return;
            row.innerHTML = '';
            paramPresets.forEach(p => {
                const tag = document.createElement('span');
                tag.className = 'preset-tag' + (p.id === activePresetId ? ' active' : '');
                tag.textContent = p.name;
                tag.addEventListener('click', () => selectPreset(p.id));
                tag.addEventListener('contextmenu', (e) => { e.preventDefault(); openPresetEdit(p.id); });
                row.appendChild(tag);
            });
            const addTag = document.createElement('span');
            addTag.className = 'preset-tag';
            addTag.textContent = '+ 添加';
            addTag.style.cssText = 'border-style:dashed;';
            addTag.addEventListener('click', () => openPresetEdit(null));
            row.appendChild(addTag);
        }

        function selectPreset(id) {
            if (imageGenMode || favMode) return; // 生图/收藏模式不操作预设
            activePresetId = id;
            const sess = sessions.find(s => s.id === getCurrentId());
            if (sess) sess.presetId = id;
            savePresets();
            saveSessionsToStorage();
            renderPresetTags();
            const p = getActivePreset();
            if (p) showToast(`已选择预设: ${p.name}`);
        }

        function selectStream(v) {
            document.getElementById('presetEditStream').value = v ? 'true' : 'false';
            document.getElementById('streamYes').classList.toggle('active', v);
            document.getElementById('streamNo').classList.toggle('active', !v);
        }

        // ============================================================
        //  参数预设 — 编辑器弹窗
        // ============================================================
        function openPresetEdit(id) {
            editingPresetId = id;
            const p = id ? paramPresets.find(p => p.id === id) : null;
            document.getElementById('presetEditTitle').textContent = id ? '编辑参数预设' : '新建参数预设';
            document.getElementById('presetEditName').value = p ? p.name : '';
            document.getElementById('presetEditSysPrompt').value = p ? (p.systemPrompt || '') : '';
            const t = p ? p.temperature : 0.7;
            document.getElementById('presetEditTemp').value = t;
            document.getElementById('tempVal').textContent = t;
            const tp = p ? p.top_p : 1;
            document.getElementById('presetEditTopP').value = tp;
            document.getElementById('topPVal').textContent = tp;
            const fp = p ? p.frequency_penalty : 0;
            document.getElementById('presetEditFp').value = fp;
            document.getElementById('fpVal').textContent = fp;
            const pp = p ? p.presence_penalty : 0;
            document.getElementById('presetEditPp').value = pp;
            document.getElementById('ppVal').textContent = pp;
            const stream = p ? p.stream : false;
            selectStream(stream);
            document.getElementById('presetDeleteBtn').style.display = id ? '' : 'none';
            document.getElementById('presetEditModal').style.display = 'flex';
        }

        function closePresetEdit() {
            document.getElementById('presetEditModal').style.display = 'none';
            editingPresetId = null;
        }

        // 提示词放大编辑
        function openPromptExpand() {
            const src = document.getElementById('presetEditSysPrompt');
            const overlay = document.getElementById('promptExpandOverlay');
            const textarea = document.getElementById('promptExpandTextarea');
            textarea.value = src.value;
            overlay.classList.add('show');
            setTimeout(() => textarea.focus(), 100);
        }

        function closePromptExpand() {
            const overlay = document.getElementById('promptExpandOverlay');
            const textarea = document.getElementById('promptExpandTextarea');
            document.getElementById('presetEditSysPrompt').value = textarea.value;
            overlay.classList.remove('show');
        }

        function savePreset() {
            const name = document.getElementById('presetEditName').value.trim() || '未命名';
            const systemPrompt = document.getElementById('presetEditSysPrompt').value.trim();
            const temperature = parseFloat(document.getElementById('presetEditTemp').value) || 0.7;
            const top_p = parseFloat(document.getElementById('presetEditTopP').value) || 1;
            const frequency_penalty = parseFloat(document.getElementById('presetEditFp').value) || 0;
            const presence_penalty = parseFloat(document.getElementById('presetEditPp').value) || 0;
            const stream = document.getElementById('presetEditStream').value === 'true';

            if (editingPresetId) {
                const p = paramPresets.find(p => p.id === editingPresetId);
                if (p) Object.assign(p, { name, systemPrompt, temperature, top_p, frequency_penalty, presence_penalty, stream });
            } else {
                const newId = (paramPresets.length > 0 ? Math.max(...paramPresets.map(p => p.id)) : 0) + 1;
                paramPresets.push({ id: newId, name, systemPrompt, temperature, top_p, frequency_penalty, presence_penalty, stream });
                if (!activePresetId) activePresetId = newId;
            }
            savePresets();
            renderPresetTags();
            closePresetEdit();
            showToast('预设已保存');
        }

        function deletePreset() {
            if (!editingPresetId || paramPresets.length <= 1) { showToast('至少保留一个预设'); return; }
            paramPresets = paramPresets.filter(p => p.id !== editingPresetId);
            if (activePresetId === editingPresetId) activePresetId = paramPresets[0]?.id || null;
            savePresets();
            renderPresetTags();
            closePresetEdit();
            showToast('预设已删除');
        }

        // ============================================================
        //  预设标签行拖拽滚动
        // ============================================================
        function initPresetDrag() {
            const row = document.getElementById('presetTagsRow');
            if (!row) return;
            let isDown = false, startX, scrollLeft;
            row.addEventListener('mousedown', (e) => {
                if (e.target.closest('.preset-tag')) return;
                isDown = true; row.classList.add('dragging');
                startX = e.pageX - row.offsetLeft; scrollLeft = row.scrollLeft;
            });
            row.addEventListener('mouseleave', () => { isDown = false; row.classList.remove('dragging'); });
            row.addEventListener('mouseup', () => { isDown = false; row.classList.remove('dragging'); });
            row.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - row.offsetLeft;
                row.scrollLeft = scrollLeft - (x - startX) * 1.5;
            });
        }
        window.addEventListener('DOMContentLoaded', initPresetDrag);
