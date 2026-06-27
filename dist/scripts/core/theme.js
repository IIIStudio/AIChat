        // ============================================================
        //  暗色模式
        // ============================================================
        const sunIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        const moonIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

        function toggleDarkMode() {
            const html = document.documentElement;
            const btn = document.querySelector('.dark-mode-btn');
            
            const currentTheme = html.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                html.removeAttribute('data-theme');
                btn.innerHTML = moonIcon;
                btn.title = '切换深色模式';
                localStorage.setItem('theme', 'light');
                // 切换代码高亮主题为亮色
                document.getElementById('hljsLightTheme').disabled = false;
                document.getElementById('hljsDarkTheme').disabled = true;
            } else {
                html.setAttribute('data-theme', 'dark');
                btn.innerHTML = sunIcon;
                btn.title = '切换浅色模式';
                localStorage.setItem('theme', 'dark');
                // 切换代码高亮主题为暗色
                document.getElementById('hljsLightTheme').disabled = true;
                document.getElementById('hljsDarkTheme').disabled = false;
            }
            // 重新初始化并应用 Mermaid 主题，然后刷新聊天区域
            if (window.mermaid) {
                mermaid.initialize(getMermaidConfig());
            }
            renderChatArea({ preserveScroll: true });
        }

        // 初始化主题
        (function initTheme() {
            if (localStorage.getItem('theme') === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                const btn = document.querySelector('.dark-mode-btn');
                btn.innerHTML = sunIcon;
                btn.title = '切换浅色模式';
                document.getElementById('hljsLightTheme').disabled = true;
                document.getElementById('hljsDarkTheme').disabled = false;
            } else {
                document.getElementById('hljsLightTheme').disabled = false;
                document.getElementById('hljsDarkTheme').disabled = true;
            }
        })();
