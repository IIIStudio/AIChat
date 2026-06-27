        // ============================================================
        //  侧边栏 & 响应式布局
        // ============================================================
        const sidebar = document.getElementById('sidebar');
        const showSidebarBtn = document.getElementById('showSidebarBtn');
        function toggleSidebar() {
            const isMobile = window.innerWidth <= 768;
            sidebar.classList.toggle('hidden');
            const mobileOverlay = document.getElementById('sidebarMobileOverlay');
            
            if (isMobile) {
                // 移动端用 transform 滑出/滑入
                if (sidebar.classList.contains('hidden')) {
                    if (mobileOverlay) mobileOverlay.classList.remove('show');
                } else {
                    if (mobileOverlay) mobileOverlay.classList.add('show');
                }
            } else {
                // 桌面端原有逻辑
                if (sidebar.classList.contains('hidden')) {
                    showSidebarBtn.style.display = 'block';
                    setTimeout(() => showSidebarBtn.style.opacity = '1', 50);
                } else {
                    showSidebarBtn.style.opacity = '0';
                    setTimeout(() => showSidebarBtn.style.display = 'none', 200);
                }
                // 确保桌面端 overlay 不显示
                if (mobileOverlay) mobileOverlay.classList.remove('show');
            }
        }

        // 窗口大小变化时处理响应式切换
        window.addEventListener('resize', () => {
            const mobileOverlay = document.getElementById('sidebarMobileOverlay');
            if (window.innerWidth > 768) {
                // 切换到桌面端，隐藏 overlay
                if (mobileOverlay) mobileOverlay.classList.remove('show');
                // 确保桌面端侧边栏正常显示
                if (!sidebar.classList.contains('hidden')) {
                    showSidebarBtn.style.opacity = '0';
                    showSidebarBtn.style.display = 'none';
                }
            }
        });

        // ============================================================
        //  复制消息
        // ============================================================
        function copyMessageText(btnElement) {
            const block = btnElement.closest('.message-block');
            const contentEl = block.querySelector('.message-content');
            // 优先复制原始 Markdown 内容（存在 data-raw 属性时）
            let content = contentEl.getAttribute('data-raw');
            if (!content) {
                // 回退：从 data-index 获取消息内容
                const idx = parseInt(contentEl.getAttribute('data-index'));
                if (!isNaN(idx)) {
                    const session = sessions.find(s => s.id === getCurrentId());
                    if (session && session.messages[idx]) {
                        const msg = session.messages[idx];
                        // 生图消息：复制提示词而非 HTML
                        if (msg.isHtml && msg.genPrompt) {
                            content = msg.genPrompt;
                        } else if (Array.isArray(msg.content)) {
                            content = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
                        } else {
                            content = msg.content;
                        }
                    }
                }
                if (!content) {
                    content = contentEl.textContent;
                }
            }
            content = content.replace(/\n{3,}/g, '\n\n').trim();
            navigator.clipboard.writeText(content).then(() => { showToast('已复制到剪贴板'); })
            .catch(() => { showToast('复制失败，请重试'); });
        }
