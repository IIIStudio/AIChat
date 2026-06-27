        // ============================================================
        //  聊天会话管理 (CRUD)
        // ============================================================
        let sessions = [];
        let currentChatSessionId = null;
        let currentGenSessionId = null;
        let lastRenderedSessionId = null; // 避免切模式时无意义重建聊天区

        function getCurrentId() {
            return imageGenMode ? currentGenSessionId : currentChatSessionId;
        }

        async function saveSessionsToStorage() {
            try {
                await dbSet('sessions', { sessions, currentChatSessionId, currentGenSessionId });
            } catch(e) {}
        }

        async function loadSessionsFromStorage() {
            try {
                const saved = await dbGet('sessions');
                if (saved) {
                    sessions = saved.sessions || [];
                    currentChatSessionId = saved.currentChatSessionId || null;
                    currentGenSessionId = saved.currentGenSessionId || null;
                }
            } catch(e) {}
            // 确保每种模式至少有一个会话
            const hasChat = sessions.some(s => s.type === 'chat');
            const hasGen = sessions.some(s => s.type === 'gen');
            if (!hasChat) {
                const id = Date.now();
                sessions.unshift({ id, title: "新会话", messages: [], presetId: activePresetId, pinned: false, type: 'chat' });
                currentChatSessionId = id;
            }
            if (!hasGen) {
                const id = Date.now() + 1;
                sessions.unshift({ id, title: "新会话", messages: [], presetId: null, pinned: false, type: 'gen' });
                currentGenSessionId = id;
            }
            // 校验当前 ID 存在
            if (!sessions.find(s => s.id === currentChatSessionId)) {
                currentChatSessionId = sessions.find(s => s.type === 'chat')?.id || null;
            }
            if (!sessions.find(s => s.id === currentGenSessionId)) {
                currentGenSessionId = sessions.find(s => s.type === 'gen')?.id || null;
            }
        }

        function createNewChat() {
            const newId = Date.now();
            const sType = imageGenMode ? 'gen' : 'chat';
            sessions.unshift({ id: newId, title: "新会话", messages: [], presetId: sType === 'chat' ? activePresetId : null, pinned: false, type: sType });
            switchChat(newId);
            saveSessionsToStorage();
            closeSidebarOnMobile();
        }

        function deleteChat(id, event) {
            event.stopPropagation(); 
            const deletedType = sessions.find(s => s.id === id)?.type;
            sessions = sessions.filter(s => s.id !== id);
            const modeSessions = sessions.filter(s => s.type === (imageGenMode ? 'gen' : 'chat'));
            if (modeSessions.length === 0) createNewChat();
            else if (getCurrentId() === id) switchChat(modeSessions[0].id);
            else renderSidebar();
            saveSessionsToStorage();
            showToast('会话已删除');
        }

        function togglePin(id, event) {
            event.stopPropagation();
            const session = sessions.find(s => s.id === id);
            if (!session) return;
            session.pinned = !session.pinned;
            saveSessionsToStorage();
            renderSidebar();
            showToast(session.pinned ? '已置顶' : '已取消置顶');
        }

        function switchChat(id) {
            // 收藏模式下点击会话，先切换到对应模式
            if (favMode) {
                const s = sessions.find(s => s.id === id);
                if (s) setMode(s.type === 'gen' ? 'gen' : 'chat');
                else setMode('chat');
                return;
            }
            // 同一个 session 则跳过
            const prevId = getCurrentId();
            if (id === prevId && id === lastRenderedSessionId) return;
            const s = sessions.find(s => s.id === id);
            if (s) {
                if (s.type === 'gen') currentGenSessionId = id;
                else currentChatSessionId = id;
            }
            // 不在切模式时写 IndexedDB（session 内容未变，只改当前 ID）
            // 同步该会话的预设
            if (s && s.presetId != null && paramPresets.find(p => p.id === s.presetId)) {
                activePresetId = s.presetId;
                savePresets();
                renderPresetTags();
            }
            renderSidebar();
            // 只有会话 ID 变化才重建聊天区（避免 base64 图片重新解码）
            if (id !== lastRenderedSessionId) {
                lastRenderedSessionId = id;
                renderChatArea();
            }
            // 移动端选择会话后自动收起侧边栏
            closeSidebarOnMobile();
        }

        function closeSidebarOnMobile() {
            if (window.innerWidth <= 768) {
                const mobileOverlay = document.getElementById('sidebarMobileOverlay');
                if (!sidebar.classList.contains('hidden')) {
                    sidebar.classList.add('hidden');
                }
                if (mobileOverlay) mobileOverlay.classList.remove('show');
            }
        }

        // ============================================================
        //  侧边栏渲染
        // ============================================================
        // ============================================================
        //  多选模式
        // ============================================================
        let multiSelectMode = false;
        const selectedSessions = new Set();

        function toggleMultiSelect() {
            multiSelectMode = !multiSelectMode;
            if (!multiSelectMode) selectedSessions.clear();
            document.getElementById('sidebar').classList.toggle('multi-select-mode', multiSelectMode);
            document.getElementById('multiSelectBar').classList.toggle('show', multiSelectMode);
            renderSidebar();
            updateMultiSelectCount();
        }

        // 全选/取消全选：当前模式所有会话
        function selectAll() {
            const modeType = imageGenMode ? 'gen' : 'chat';
            const modeSessions = sessions.filter(s => s.type === modeType);
            const allSelected = modeSessions.every(s => selectedSessions.has(s.id));
            if (allSelected) modeSessions.forEach(s => selectedSessions.delete(s.id));
            else modeSessions.forEach(s => selectedSessions.add(s.id));
            renderSidebar();
            updateMultiSelectCount();
        }

        function toggleSessionSelection(id) {
            if (selectedSessions.has(id)) selectedSessions.delete(id);
            else selectedSessions.add(id);
            renderSidebar();
            updateMultiSelectCount();
        }

        function updateMultiSelectCount() {
            document.getElementById('msCount').textContent = `已选 ${selectedSessions.size} 项`;
        }

        function batchDelete() {
            if (selectedSessions.size === 0) { showToast('未选择会话'); return; }
            const count = selectedSessions.size;
            const deletedCurrent = selectedSessions.has(getCurrentId());
            sessions = sessions.filter(s => !selectedSessions.has(s.id));
            selectedSessions.clear();
            const modeSessions = sessions.filter(s => s.type === (imageGenMode ? 'gen' : 'chat'));
            if (modeSessions.length === 0) createNewChat();
            else if (deletedCurrent) switchChat(modeSessions[0].id);
            else renderSidebar();
            saveSessionsToStorage();
            updateMultiSelectCount();
            showToast(`已删除 ${count} 个会话`);
        }

        function batchPin() {
            if (selectedSessions.size === 0) { showToast('未选择会话'); return; }
            sessions.forEach(s => { if (selectedSessions.has(s.id)) s.pinned = true; });
            saveSessionsToStorage();
            renderSidebar();
            showToast(`已置顶 ${selectedSessions.size} 个会话`);
        }

        function batchUnpin() {
            if (selectedSessions.size === 0) { showToast('未选择会话'); return; }
            sessions.forEach(s => { if (selectedSessions.has(s.id)) s.pinned = false; });
            saveSessionsToStorage();
            renderSidebar();
            showToast(`已取消置顶 ${selectedSessions.size} 个会话`);
        }

        function renderSidebar() {
            const list = document.getElementById('chatList');
            list.innerHTML = '';
            const modeType = imageGenMode ? 'gen' : 'chat';
            const modeSessions = sessions.filter(s => s.type === modeType);
            const sortedSessions = [...modeSessions].sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return 0;
            });
            sortedSessions.forEach(session => {
                const item = document.createElement('div');
                const isSelected = selectedSessions.has(session.id);
                item.className = `chat-history-item ${session.id === getCurrentId() ? 'active' : ''} ${isSelected ? 'selected' : ''}`;
                // 多选模式下点击切换选中，非多选模式切换会话
                item.onclick = () => {
                    if (multiSelectMode) toggleSessionSelection(session.id);
                    else switchChat(session.id);
                };

                const checkbox = document.createElement('div');
                checkbox.className = `chat-checkbox ${isSelected ? 'checked' : ''}`;

                const title = document.createElement('span');
                title.className = 'chat-title';
                title.textContent = session.title;

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'chat-history-icons';
                
                const pinIcon = document.createElement('div');
                const isPinned = session.pinned;
                pinIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" style="color:${isPinned?'#d4a017':'inherit'}"><path d="M16 3v5c0 .8.3 1.6.9 2.2l1.1 1.1V13H6v-1.7l1.1-1.1c.6-.6.9-1.3.9-2.2V3h8z"></path><line x1="12" y1="13" x2="12" y2="21"></line><line x1="8" y1="21" x2="16" y2="21"></line></svg>`;
                pinIcon.style.cursor = 'pointer';
                pinIcon.title = isPinned ? '取消置顶' : '置顶';
                pinIcon.onclick = (e) => togglePin(session.id, e);

                const editIcon = document.createElement('div');
                editIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
                editIcon.onclick = (e) => openRenameModal(session.id, session.title, e);

                const delIcon = document.createElement('div');
                delIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
                delIcon.onclick = (e) => deleteChat(session.id, e);

                actionsDiv.appendChild(pinIcon);
                actionsDiv.appendChild(editIcon);
                actionsDiv.appendChild(delIcon);
                item.appendChild(checkbox);
                item.appendChild(title);
                item.appendChild(actionsDiv);
                list.appendChild(item);
            });
        }
