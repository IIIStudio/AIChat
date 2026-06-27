        // ============================================================
        //  网络搜索配置 — 数据管理
        // ============================================================
        let webSearchSettings = {
            enabled: false,
            provider: 'tinyfish',
            apiKey: '',
            apiUrl: 'https://agent.tinyfish.ai',
            location: 'US',
            language: 'en',
            fetchCount: 2
        };

        function toggleSearchState() {
            webSearchSettings.enabled = !webSearchSettings.enabled;
            try {
                localStorage.setItem('webSearchSettings', JSON.stringify(webSearchSettings));
            } catch(e) {}
            updateSearchBtnUI();
            if (webSearchSettings.enabled) {
                showToast('已启用网络搜索');
            } else {
                showToast('已关闭网络搜索');
            }
        }

        function updateSearchBtnUI() {
            const btn = document.getElementById('searchInfo');
            const label = document.getElementById('searchLabel');
            const toggleBtn = document.getElementById('searchPanelToggle');
            if (!btn || !label) return;
            if (webSearchSettings.enabled) {
                btn.classList.add('active');
                label.textContent = '搜索开';
                if (toggleBtn) toggleBtn.style.display = 'inline-flex';
            } else {
                btn.classList.remove('active');
                label.textContent = '搜索关';
                if (toggleBtn) toggleBtn.style.display = 'none';
                toggleSearchSidebar(false);
            }
        }
