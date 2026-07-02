        // ============================================================
        //  聊天区域渲染
        // ============================================================
        const chatContainer = document.getElementById('chatContainer');
        const chatInner = document.getElementById('chatInner');
        const welcomeScreen = document.getElementById('welcomeScreen');
        let suppressMessageAutoScroll = false;

        /**
         * 【聊天/滚动控制】【消息定位】按消息索引查找当前渲染出的消息块
         * @param {number} msgIndex - 会话消息数组中的消息索引
         * @returns {HTMLElement|null} - 当前消息块 DOM，未找到时返回 null
         */
        function getRenderedMessageBlockByIndex(msgIndex) {
            if (msgIndex == null || !chatInner) return null;
            const contentEl = chatInner.querySelector(`.message-content[data-index="${msgIndex}"]`);
            return contentEl ? contentEl.closest('.message-block') : null;
        }

        /**
         * 【聊天/滚动控制】【消息定位】获取指定消息块相对视口的顶部位置
         * @param {number} msgIndex - 会话消息数组中的消息索引
         * @returns {number|null} - 消息块顶部坐标，未找到时返回 null
         */
        function getRenderedMessageTop(msgIndex) {
            const block = getRenderedMessageBlockByIndex(msgIndex);
            return block ? block.getBoundingClientRect().top : null;
        }

        /**
         * 重新渲染当前会话的聊天区域，并按选项控制滚动位置
         * @param {Object} [options] - 渲染选项
         * @param {boolean} [options.preserveScroll=false] - 是否保留当前聊天滚动位置
         * @param {number} [options.anchorIndex] - 需要保持视口位置不变的消息索引
         * @returns {void}
         */
        function renderChatArea(options = {}) {
            const session = sessions.find(s => s.id === getCurrentId());
            const preserveScroll = options.preserveScroll === true;
            const anchorIndex = Number.isInteger(options.anchorIndex) ? options.anchorIndex : null;
            const shouldPreserveScroll = preserveScroll || anchorIndex !== null;
            const previousScrollTop = chatContainer ? chatContainer.scrollTop : 0;
            const previousAutoScroll = shouldAutoScroll;
            const previousSuppressAutoScroll = suppressMessageAutoScroll;
            const previousAnchorTop = anchorIndex !== null ? getRenderedMessageTop(anchorIndex) : null;

            if (shouldPreserveScroll) {
                suppressMessageAutoScroll = true;
            }

            try {
                // 1. 清空除了 welcomeScreen 以外的所有消息块
                Array.from(chatInner.children).forEach(child => {
                    if(child.id !== 'welcomeScreen') child.remove();
                });

                if (session.messages.length === 0) {
                    welcomeScreen.style.display = 'block';
                    updateMessageAnchors();
                } else {
                    welcomeScreen.style.display = 'none';
                    session.messages.forEach((msg, idx) => {
                        // 【网络搜索/TinyFish】【消息渲染】跳过中间过渡的工具调用、系统角色消息或无内容的过渡助手消息，只渲染用户和最终的助手回复
                        if (msg.role === 'tool' || msg.role === 'system' || (msg.role === 'assistant' && !msg.content && msg.tool_calls && msg.tool_calls.length > 0)) {
                            return;
                        }
                        let displayContent, imageUrl;
                        let displayModel = msg.model;
                        let displayThought = msg.thought;
                        let displayPresetId = msg.presetId;
                        let displayGenImages = msg.images || null;
                        let displayGenParams = msg.genParams || null;
                        let displayMetrics = msg.metrics || null;
                        let displayThoughtDuration = msg.thoughtDurationMs;
                        // 2. 如果有版本历史且正在查看旧版本，使用旧版本内容
                        let displayIsHtml = msg.isHtml || false;
                        if (msg.role === 'assistant' && msg.versions && msg.versions.length > 0) {
                            const dv = msg.displayVersionIdx || 0;
                            if (dv > 0 && msg.versions[dv - 1]) {
                                const ver = msg.versions[dv - 1];
                                displayContent = ver.content;
                                displayModel = ver.model || msg.model;
                                displayThought = ver.thought || msg.thought;
                                displayPresetId = ver.presetId != null ? ver.presetId : msg.presetId;
                                displayIsHtml = ver.isHtml != null ? ver.isHtml : displayIsHtml;
                                displayGenImages = ver.images || displayGenImages;
                                displayGenParams = ver.genParams || displayGenParams;
                                displayMetrics = ver.metrics || null;
                                displayThoughtDuration = ver.thoughtDurationMs != null ? ver.thoughtDurationMs : displayThoughtDuration;
                            } else if (Array.isArray(msg.content)) {
                                const textPart = msg.content.find(c => c.type === 'text');
                                displayContent = textPart ? textPart.text : '';
                            } else {
                                displayContent = msg.content;
                            }
                        } else if (Array.isArray(msg.content)) {
                            const textPart = msg.content.find(c => c.type === 'text');
                            displayContent = textPart ? textPart.text : '';
                            // 3. 提取所有图片 URL，支持多图显示
                            const imgParts = msg.content.filter(c => c.type === 'image_url');
                            imageUrl = imgParts.length > 0 ? imgParts.map(p => p.image_url.url) : null;
                        } else {
                            displayContent = msg.content;
                        }
                        appendMessageDOM(msg.role, displayContent, displayThought, imageUrl, displayModel, idx, displayPresetId, displayIsHtml, displayGenImages, displayGenParams, displayMetrics, displayThoughtDuration);
                    });
                }
                updateMessageAnchors();
                // 【网络搜索/TinyFish】【恢复历史】每次重绘聊天区时，根据最新消息历史恢复右侧搜索面板状态
                restoreSearchProcess();
            } finally {
                suppressMessageAutoScroll = previousSuppressAutoScroll;
            }

            if (shouldPreserveScroll && chatContainer) {
                requestAnimationFrame(() => {
                    // 【聊天/滚动控制】4. 优先按消息锚点恢复视口，避免内容高度变化造成跳动
                    if (anchorIndex !== null && previousAnchorTop !== null) {
                        const nextAnchorTop = getRenderedMessageTop(anchorIndex);
                        if (nextAnchorTop !== null) {
                            chatContainer.scrollTop += nextAnchorTop - previousAnchorTop;
                        } else {
                            chatContainer.scrollTop = previousScrollTop;
                        }
                    } else {
                        chatContainer.scrollTop = previousScrollTop;
                    }
                    shouldAutoScroll = previousAutoScroll;
                    updateScrollDownBtnVisibility();
                });
            }
        }

        function regenerateMessage(btn) {
            const block = btn.closest('.message-block');
            const allBlocks = Array.from(chatInner.querySelectorAll('.message-block'));
            const index = allBlocks.indexOf(block);
            if (index === -1) return;

            const currentSession = sessions.find(s => s.id === getCurrentId());
            const msg = currentSession.messages[index];
            // 保存当前回复到版本历史
            if (msg && msg.role === 'assistant') {
                pendingVersions = (msg.versions || []).slice();
                pendingVersions.push({ content: msg.content, thought: msg.thought, model: msg.model, presetId: msg.presetId, isHtml: msg.isHtml, images: msg.images, genParams: msg.genParams, metrics: msg.metrics, thoughtDurationMs: msg.thoughtDurationMs });
            }
            // 生图模式：保留当前用户消息作为提示词，不额外添加用户消息
            if (imageGenMode) {
                const userMsg = currentSession.messages[index - 1];
                if (userMsg && userMsg.role === 'user') {
                    const prompt = typeof userMsg.content === 'string' ? userMsg.content : '';
	                    if (prompt) {
	                        currentSession.messages = currentSession.messages.slice(0, index);
	                        saveSessionsToStorage();
	                        enableChatAutoScroll();
	                        renderChatArea();
	                        sendImageGeneration(prompt, true);
	                        return;
                    }
                }
	            }
	            currentSession.messages = currentSession.messages.slice(0, index);
	            saveSessionsToStorage();
	            enableChatAutoScroll();
	            renderChatArea();
	            fetchAIResponse();
        }

        // ============================================================
        //  消息编辑 (inline) / 删除 / 版本切换
        // ============================================================
        let editingMessageIndex = null;
        let pendingVersions = null;

        /**
         * 编辑用户已发送的聊天消息
         * @param {HTMLElement} btnEl - 触发编辑操作的按钮元素
         * @returns {void}
         */
        function editMessage(btnEl) {
            // 1. 获取当前消息块和关联的数据索引
            const block = btnEl.closest('.message-block');
            const contentEl = block.querySelector('.message-content');
            const idx = parseInt(contentEl.getAttribute('data-index'));
            if (isNaN(idx)) return;
            
            editingMessageIndex = idx;
            const session = sessions.find(s => s.id === getCurrentId());
            if (!session) return;
            const msg = session.messages[idx];
            if (!msg) return;
            
            // 2. 提取出当前消息的原始纯文本内容
            const originalContent = Array.isArray(msg.content)
                ? msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
                : (msg.content || '');
            
            // 3. 标记消息为编辑状态，扩大气泡宽度
            const msgDiv = block.querySelector('.message.user');
            if (msgDiv) msgDiv.classList.add('editing');

            // 4. 创建用于编辑的 textarea 并配置与底部输入框一致的样式
            const textarea = document.createElement('textarea');
            textarea.id = 'editingTextarea';
            textarea.value = originalContent;
            Object.assign(textarea.style, {
                width: '100%',
                minHeight: '40px',
                padding: '12px 16px',
                border: 'none',
                borderRadius: '18px',
                fontSize: '15px',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                background: 'var(--bg-gray)',
                lineHeight: '1.6',
                color: 'var(--text-main)',
                overflowY: 'hidden'
            });
            
            // 4. 绑定自适应高度与键盘快捷键事件
            const adjustHeight = () => {
                textarea.style.height = 'auto';
                textarea.style.height = textarea.scrollHeight + 'px';
            };
            textarea.oninput = adjustHeight;
            textarea.onkeydown = (e) => {
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            };
            
            // 5. 替换原有消息内容 DOM 并使编辑框获得焦点
            const wrapper = contentEl.closest('.collapse-wrapper');
            const targetParent = wrapper || contentEl.parentElement;
            if (wrapper) {
                wrapper.classList.remove('collapsed');
                const toggleBtn = wrapper.parentElement.querySelector('.collapse-toggle');
                if (toggleBtn) toggleBtn.style.display = 'none';
            }
            targetParent.replaceChild(textarea, contentEl);
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            
            // 6. 异步延迟确保渲染完成后再计算初始高度
            setTimeout(adjustHeight, 0);
            
            // 7. 更新操作按钮区域，提供“取消”和“保存”功能
            const actionsDiv = block.querySelector('.message-actions');
            actionsDiv.setAttribute('data-original-html', actionsDiv.innerHTML);
            actionsDiv.innerHTML = `
                <span onclick="cancelEdit()" style="cursor:pointer;font-size:13px;color:var(--text-muted);border:1px solid var(--border-color);border-radius:18px;padding:6px 14px;user-select:none;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--text-main)';this.style.color='var(--text-main)';this.style.background='rgba(128,128,128,0.05)'" onmouseout="this.style.borderColor='';this.style.color='';this.style.background=''">取消</span>
                <span onclick="saveEdit()" style="cursor:pointer;font-size:13px;background:var(--black-btn);color:var(--text-on-dark);border-radius:18px;padding:6px 16px;user-select:none;transition:all 0.2s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">保存并重新生成</span>
            `;
        }

        /**
         * 【聊天/消息编辑】【取消编辑】退出消息编辑状态并保持当前阅读位置
         * @returns {void}
         */
        function cancelEdit() {
            const anchorIndex = editingMessageIndex;
            editingMessageIndex = null;
            renderChatArea({ preserveScroll: true, anchorIndex });
        }

        function saveEdit() {
            if (editingMessageIndex === null) return;
            const textarea = document.getElementById('editingTextarea');
            if (!textarea) return;
            const newText = textarea.value.trim();
            if (!newText) { showToast('内容不能为空'); return; }
            
            const session = sessions.find(s => s.id === getCurrentId());
            if (!session) return;
            const msg = session.messages[editingMessageIndex];
            if (!msg) return;
            
            // 如果原消息包含图片，保留图片部分
            if (Array.isArray(msg.content)) {
                const imgParts = msg.content.filter(c => c.type === 'image_url');
                msg.content = imgParts.length > 0
                    ? [{ type: 'text', text: newText }, ...imgParts]
                    : newText;
            } else {
                msg.content = newText;
            }
            
            // 保存原助手回复到版本历史
            const oldAsIdx = editingMessageIndex + 1;
            const oldAs = session.messages[oldAsIdx];
            if (oldAs && oldAs.role === 'assistant') {
                pendingVersions = (oldAs.versions || []).slice();
                pendingVersions.push({ content: oldAs.content, thought: oldAs.thought, model: oldAs.model, presetId: oldAs.presetId, isHtml: oldAs.isHtml, images: oldAs.images, metrics: oldAs.metrics, thoughtDurationMs: oldAs.thoughtDurationMs });
            }
            // 截断消息列表，仅保留到当前编辑的用户消息及之前的消息
            session.messages = session.messages.slice(0, editingMessageIndex + 1);
            
	            editingMessageIndex = null;
	            saveSessionsToStorage();
	            enableChatAutoScroll();
	            renderChatArea();
            showToast('已保存，正在重新生成...');
            // 生图模式走生图接口（用户消息已编辑好，无需再添加）
            if (imageGenMode) {
                sendImageGeneration(newText, true);
                return;
            }
            fetchAIResponse();
        }

        function deleteMessage(btnEl) {
            const block = btnEl.closest('.message-block');
            const contentEl = block.querySelector('.message-content');
            const idx = parseInt(contentEl.getAttribute('data-index'));
            if (isNaN(idx)) return;
            
            const session = sessions.find(s => s.id === getCurrentId());
            if (!session) return;
            
            if (block.classList.contains('user-block')) {
                // 【会话管理/系统】【安全删除】删除用户消息以及其后关联的所有过渡消息和助手回答，直至遇到下一条用户消息
                let removeCount = 1;
                while (idx + removeCount < session.messages.length && session.messages[idx + removeCount].role !== 'user') {
                    removeCount++;
                }
                session.messages.splice(idx, removeCount);
            } else {
                const msg = session.messages[idx];
                // 有版本历史时，仅删除当前正在查看的版本
                if (msg && msg.versions && msg.versions.length > 0) {
                    const dv = msg.displayVersionIdx || 0;
                    if (dv === 0) {
                        // 删除当前最新版本，用上一个版本替换
                        const last = msg.versions.pop();
                        msg.content = last.content;
                        msg.thought = last.thought;
                        msg.model = last.model;
                        msg.metrics = last.metrics || null;
                        msg.displayVersionIdx = 0;
                        if (msg.versions.length === 0) delete msg.versions;
                        if (msg.displayVersionIdx === 0) delete msg.displayVersionIdx;
                        
                        // 【会话管理/系统】【安全删除】退回上一个版本时，连带清除当前最新版本生成期间的过渡工具调用消息
                        let startDelIdx = idx;
                        while (startDelIdx > 0 && session.messages[startDelIdx - 1].role !== 'user') {
                            startDelIdx--;
                        }
                        if (startDelIdx < idx) {
                            session.messages.splice(startDelIdx, idx - startDelIdx);
                        }
                    } else {
                        // 删除旧版本
                        msg.versions.splice(dv - 1, 1);
                        msg.displayVersionIdx = Math.min(msg.displayVersionIdx, msg.versions.length);
                        if (msg.versions.length === 0) delete msg.versions;
                        if (msg.displayVersionIdx === 0) delete msg.displayVersionIdx;
                    }
                    saveSessionsToStorage();
                    renderChatArea();
                    showToast('版本已删除');
                    return;
                }
                // 无版本历史，删除整条助手消息及相关的过渡工具消息
                let startDelIdx = idx;
                while (startDelIdx > 0 && session.messages[startDelIdx - 1].role !== 'user') {
                    startDelIdx--;
                }
                // 【会话管理/系统】【安全删除】删除当前助手回答并连带清理对应的所有过渡工具调用消息
                session.messages.splice(startDelIdx, idx - startDelIdx + 1);
            }
            
            if (session.messages.length === 0) {
                session.title = '新会话';
            }
            
            saveSessionsToStorage();
            renderChatArea();
            showToast('消息已删除');
        }

        function switchVersion(spanEl, direction) {
            const nav = spanEl.closest('.version-nav');
            const idx = parseInt(nav.getAttribute('data-msg-idx'));
            if (isNaN(idx)) return;
            const session = sessions.find(s => s.id === getCurrentId());
            if (!session) return;
            const msg = session.messages[idx];
            if (!msg || !msg.versions) return;
            if (msg.displayVersionIdx == null) msg.displayVersionIdx = 0;
            msg.displayVersionIdx += direction;
            const maxIdx = msg.versions.length;
            if (msg.displayVersionIdx < 0) msg.displayVersionIdx = 0;
            if (msg.displayVersionIdx > maxIdx) msg.displayVersionIdx = maxIdx;
            saveSessionsToStorage();
            renderChatArea();
        }

        // ============================================================
        //  消息 DOM 构建 & 长内容折叠
        // ============================================================
        const COLLAPSE_THRESHOLD = 300; // 内容超过此字符数时自动折叠

        function appendMessageDOM(role, content, thought = null, imageUrl = null, msgModel = null, msgIndex = null, msgPresetId = null, isHtml = false, genImages = null, genParams = null, msgMetrics = null, thoughtDurationMs = null) {
            welcomeScreen.style.display = 'none';
            
            const blockDiv = document.createElement('div');
            blockDiv.className = `message-block ${role}-block`;

            if (role === 'assistant' && thought) {
                const thoughtDiv = document.createElement('div');
                thoughtDiv.className = 'thought-process';
                // __thinking__ 标记：显示思考中动效（跳动点 + 思考中文案），不显示折叠箭头
                const isThinking = thought === '__thinking__';
                let thoughtHtml, thoughtMathMap;
                if (isThinking) {
                    thoughtHtml = '';
                } else if (thought.trimStart().startsWith('<')) {
                    thoughtHtml = thought;
                } else {
                    const pr = protectMath(unwrapMathFromCode(thought));
                    thoughtHtml = marked.parse(pr.text);
                    thoughtMathMap = pr.mathMap;
                }
                const durationText = thoughtDurationMs != null ? `(${formatThoughtDuration(thoughtDurationMs)})` : '';
                const barInner = isThinking
                    ? '<span class="thinking-dots"><span></span><span></span><span></span></span><span class="thought-label">请求中</span>'
                    : `<span class="thought-label">思考过程${durationText}</span><svg class="thought-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                thoughtDiv.innerHTML = `
                    <div class="thought-bar">
                        ${barInner}
                    </div>
                    <div class="thought-content">${thoughtHtml}</div>
                `;
                if (thoughtMathMap && thoughtMathMap.length > 0) {
                    const tcEl = thoughtDiv.querySelector('.thought-content');
                    if (tcEl) restoreMathPlaceholders(tcEl, thoughtMathMap);
                }
                if (isThinking) thoughtDiv.classList.add('thinking');
                blockDiv.appendChild(thoughtDiv);
            }

            let safeContent = content;
            if (Array.isArray(content)) {
                const textItem = content.find(c => c.type === 'text');
                safeContent = textItem ? textItem.text : '';
            } else if (typeof content !== 'string') {
                safeContent = String(content || '');
            }

            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${role}`;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            // 保存原始内容（Markdown 格式）
            contentDiv.setAttribute('data-raw', safeContent);
            if (msgIndex != null) contentDiv.setAttribute('data-index', msgIndex);
            if (safeContent) {
                if (isHtml) {
                    let displayHtml = safeContent;
                    // 生图占位符替换：src="" data-gen-idx="N" data-gen-src="" → src="data:..."
                    if (role === 'assistant' && genImages && genImages.length > 0) {
                        genImages.forEach((img, i) => {
                            const dataUrl = 'data:' + (img.type || 'image/png') + ';base64,' + img.b64;
                            displayHtml = displayHtml.split('src="" data-gen-idx="' + i + '" data-gen-src=""').join('src="' + dataUrl + '"');
                        });
                    }
                    contentDiv.innerHTML = displayHtml;
                } else if (role === 'user') {
                    contentDiv.innerHTML = escapeHtml(safeContent);
                } else {
                    const pr = protectMath(unwrapMathFromCode(safeContent));
                    contentDiv.innerHTML = marked.parse(pr.text).trim();
                    restoreMathPlaceholders(contentDiv, pr.mathMap);
                }
            } else {
                contentDiv.textContent = '';
            }

            // 长内容自动折叠（仅对 user 消息生效，默认折叠，不持久化）
            if (role === 'user' && content && content.length > COLLAPSE_THRESHOLD && msgIndex != null) {
                const wrapper = document.createElement('div');
                wrapper.className = 'collapse-wrapper collapsed';
                wrapper.appendChild(contentDiv);
                
                const toggleBtn = document.createElement('span');
                toggleBtn.className = 'collapse-toggle';
                const updateToggleLabel = () => {
                    toggleBtn.textContent = wrapper.classList.contains('collapsed') ? '展开全文 ▼' : '收起 ▲';
                };
                updateToggleLabel();
                toggleBtn.onclick = () => {
                    wrapper.classList.toggle('collapsed');
                    updateToggleLabel();
                };
                
                msgDiv.appendChild(wrapper);
                msgDiv.appendChild(toggleBtn);
            } else {
                msgDiv.appendChild(contentDiv);
            }
            if (imageUrl) {
                // imageUrl 可以是单个 base64 字符串或数组（多图）
                const urls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
                for (const url of urls) {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'user-image';
                    img.onclick = () => window.open(url, '_blank');
                    msgDiv.appendChild(img);
                }
            }
            blockDiv.appendChild(msgDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            if (role === 'user') {
                actionsDiv.innerHTML = `
                    <svg onclick="editMessage(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="编辑"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    <svg onclick="copyMessageText(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="复制"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <svg onclick="deleteMessage(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="删除"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                `;
            } else {
                const session = sessions.find(s => s.id === getCurrentId());
                const fallbackPresetId = (msgPresetId != null) ? msgPresetId : (session?.presetId);
                const msgPreset = (fallbackPresetId != null) ? paramPresets.find(p => p.id === fallbackPresetId) : getActivePreset();
                const presetName = (!imageGenMode && msgPreset?.name) || '';
                const presetTagHtml = presetName ? `<span class="msg-preset-tag">${escapeHtml(presetName)}</span>` : '';
                const displayModel = msgModel || activeModel;
                const msgLogo = msgModel ? getLogoForModel(msgModel) : getActiveLogo();
                const msgLogoHtml = renderLogoHtml(msgLogo, true);
                const metricsHtml = renderChatMetricsTag(msgMetrics);
                // 版本切换导航
                const msg = (session && msgIndex != null) ? session.messages[msgIndex] : null;
                const versions = (msg && msg.versions) ? msg.versions : [];
                const dv = (msg && msg.displayVersionIdx != null) ? msg.displayVersionIdx : 0;
                const totalVersions = versions.length + 1;
                let versionNavHtml = '';
                if (totalVersions > 1) {
                    const currentVer = totalVersions - dv;
                    versionNavHtml = `<span class="version-nav" data-msg-idx="${msgIndex}" style="display:inline-flex;align-items:center;gap:3px;user-select:none;flex-shrink:0;">
                        <svg onclick="event.stopPropagation();switchVersion(this,1)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="cursor:pointer;opacity:0.4;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='0.4'"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        <span style="font-size:12px;color:var(--text-muted);">${currentVer}/${totalVersions}</span>
                        <svg onclick="event.stopPropagation();switchVersion(this,-1)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="cursor:pointer;opacity:0.4;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='0.4'"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>`;
                }
                const delTitle = totalVersions > 1 ? '删除此版本' : '删除此回复';
                // 生图消息不显示复制按钮（HTML 内容无意义）
                const copyBtn = isHtml ? '' : `<svg onclick="copyMessageText(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="复制"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                // 生图消息：在删除按钮右边添加下载和收藏
                const isFavd = isHtml && isGenMsgFavorited(msg);
                const favHeartSvg = isFavd
                    ? `<svg onclick="favGenBlockImages(this)" width="14" height="14" viewBox="0 0 24 24" stroke="none" style="fill:#e74c3c;color:#e74c3c;cursor:pointer;" title="已收藏"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
                    : `<svg onclick="favGenBlockImages(this)" width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="fill:none;" title="收藏图片"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
                // 生图参数摘要
                let genParamsHtml = '';
                if (isHtml && genParams) {
                    const gp = genParams;
                    const parts = [];
                    parts.push(gp.size);
                    if (gp.steps && gp.steps !== 9) parts.push('步' + gp.steps);
                    if (gp.guidance && gp.guidance !== 1) parts.push('引导' + gp.guidance);
                    if (gp.seed) parts.push('种' + gp.seed);
                    if (gp.control) parts.push(gp.control);
                    parts.push('图尺' + gp.imgScale);
                    genParamsHtml = `<span class="msg-genparams-tag">${escapeHtml(parts.join(' · '))}</span>`;
                }
                const genExtraBtns = isHtml ? `
                    <svg onclick="downloadGenBlockImages(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="下载全部图片"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    ${favHeartSvg}
                ` : '';
                actionsDiv.innerHTML = `
                    <svg onclick="regenerateMessage(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="重新生成"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    ${copyBtn}
                    <svg onclick="deleteMessage(this)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" title="${delTitle}"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    ${genExtraBtns}
                    ${versionNavHtml}
                    <span class="msg-model-tag" onclick="event.stopPropagation(); retryWithDropdown(this.closest('.message-block'))">${msgLogoHtml}${escapeHtml(displayModel)}<svg class="msg-model-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
                    ${metricsHtml}
                    ${genParamsHtml}
                    ${presetTagHtml}
                `;
            }
            blockDiv.appendChild(actionsDiv);

            chatInner.appendChild(blockDiv);
            // 代码高亮、数学公式与 Mermaid 渲染（思考段与正文段统一处理）
            renderCompletedMarkdownBlocks(blockDiv);
            // 【聊天/滚动控制】添加新消息后按当前跟随状态滚动到底部，主题重绘期间跳过该副作用
            if (!suppressMessageAutoScroll && shouldAutoScroll) {
                requestChatAutoScroll();
            }
            updateMessageAnchors();
            return contentDiv; 
        }
