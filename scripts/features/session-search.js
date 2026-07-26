        // ============================================================
        //  会话重命名
        // ============================================================
        let renamingSessionId = null;
        function openRenameModal(id, currentTitle, event) {
            event.stopPropagation();
            renamingSessionId = id;
            document.getElementById('renameInput').value = currentTitle;
            document.getElementById('renameModal').style.display = 'flex';
        }
        function closeRenameModal() { document.getElementById('renameModal').style.display = 'none'; }
        function saveRename() {
            const newTitle = document.getElementById('renameInput').value.trim();
            if (newTitle && renamingSessionId !== null) {
                const session = sessions.find(s => s.id === renamingSessionId);
                if (session) { session.title = newTitle; renderSidebar(); saveSessionsToStorage(renamingSessionId); showToast('已重命名'); }
            }
            closeRenameModal();
        }

        // ============================================================
        //  搜索会话
        // ============================================================
        function openSearchModal() {
            document.getElementById('searchModal').style.display = 'flex';
            document.getElementById('searchInput').value = '';
            document.getElementById('searchResults').innerHTML = '<div style="color:var(--text-muted);padding:20px 0;font-size:13px;text-align:center;">输入关键词搜索会话</div>';
            document.getElementById('searchClearBtn').style.display = 'none';
            document.getElementById('searchStats').style.display = 'none';
            setTimeout(() => document.getElementById('searchInput').focus(), 100);
        }

        function closeSearchModal() {
            document.getElementById('searchModal').style.display = 'none';
        }

        // Escape 键关闭搜索弹窗
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('searchModal').style.display === 'flex') {
                closeSearchModal();
            }
        });

        function clearSearch() {
            const input = document.getElementById('searchInput');
            input.value = '';
            input.focus();
            performSearch();
        }

        async function performSearch() {
            const query = document.getElementById('searchInput').value.trim().toLowerCase();
            const resultsDiv = document.getElementById('searchResults');
            const clearBtn = document.getElementById('searchClearBtn');
            const statsDiv = document.getElementById('searchStats');

            clearBtn.style.display = query ? 'block' : 'none';

            if (!query) {
                resultsDiv.innerHTML = '<div style="color:var(--text-muted);padding:20px 0;font-size:13px;text-align:center;">输入关键词搜索会话</div>';
                statsDiv.style.display = 'none';
                return;
            }

            // 搜索前确保所有会话消息已加载
            for (const s of sessions) {
                if (!s._loaded) await ensureSessionLoaded(s.id);
            }

            const results = [];
            sessions.forEach(session => {
                const titleMatch = (session.title || '').toLowerCase().includes(query);
                if (titleMatch) {
                    results.push({ sessionId: session.id, title: session.title, isTitleMatch: true });
                }
                session.messages.forEach(msg => {
                    let text = '';
                    if (Array.isArray(msg.content)) {
                        text = msg.content.filter(c => c.type === 'text').map(c => c.text).join(' ');
                    } else if (typeof msg.content === 'string') {
                        text = msg.content;
                    }
                    const idx = text.toLowerCase().indexOf(query);
                    if (idx !== -1) {
                        const existing = results.find(r => r.sessionId === session.id && !r.isTitleMatch);
                        if (!existing) {
                            const titleIdx = results.findIndex(r => r.sessionId === session.id && r.isTitleMatch);
                            if (titleIdx !== -1) results.splice(titleIdx, 1);
                            const start = Math.max(0, idx - 40);
                            const end = Math.min(text.length, idx + query.length + 50);
                            let preview = (start > 0 ? '…' : '') + text.substring(start, end) + (end < text.length ? '…' : '');
                            results.push({ sessionId: session.id, title: session.title, preview, isTitleMatch: false, role: msg.role });
                        }
                    }
                });
            });

            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="color:var(--text-muted);padding:20px 0;font-size:13px;text-align:center;">未找到匹配结果</div>';
                statsDiv.style.display = 'none';
                return;
            }

            resultsDiv.innerHTML = results.map(r => {
                const iconHTML = r.isTitleMatch
                    ? '<div class="search-result-icon" style="font-weight:700;">#</div>'
                    : (r.role === 'user'
                        ? '<div class="search-result-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg></div>'
                        : '<div class="search-result-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>');
                const roleTag = r.isTitleMatch ? '' : `<span class="search-result-role">${r.role === 'user' ? '你' : 'AI'}</span>`;
                const previewHTML = r.isTitleMatch ? ''
                    : `<div class="search-result-preview">${highlightText(escapeHtml(r.preview), query)}</div>`;
                return `
                    <div class="search-result-item" onclick="navigateToSession('${r.sessionId}')">
                        <div class="search-result-header">
                            ${iconHTML}
                            <span class="search-result-title">${highlightText(escapeHtml(r.title), query)}</span>
                            ${roleTag}
                        </div>
                        ${previewHTML}
                    </div>`;
            }).join('');

            statsDiv.style.display = 'flex';
            statsDiv.innerHTML = `
                <span class="stats-count">找到 ${results.length} 条结果</span>
                <span class="stats-close" onclick="closeSearchModal()">Esc 关闭</span>`;
        }

        function highlightText(text, query) {
            if (!query) return text;
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
        }

        function navigateToSession(id) {
            closeSearchModal();
            const numId = Number(id);
            const s = sessions.find(s => s.id === numId);
            if (!s) return;
            // 如果目标会话模式与当前不同，先设置对应模式 ID，再切换到该模式
            if (s.type === 'gen' && !imageGenMode) {
                currentGenSessionId = numId;
                setMode('gen');
            } else if (s.type === 'chat' && imageGenMode) {
                currentChatSessionId = numId;
                setMode('chat');
            } else {
                switchChat(numId);
            }
        }
