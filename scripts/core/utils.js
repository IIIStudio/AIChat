        // ============================================================
        //  工具函数
        // ============================================================
        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str || '';
            return div.innerHTML;
        }

        function normalizeApiUrl(url) {
            if (!url) return url;
            url = url.trim().replace(/\/+$/, '');
            if (!url.endsWith('/chat/completions')) {
                url = url + '/chat/completions';
            }
            return url;
        }

        function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

        function renderLogoHtml(logo, sizeSmall = false) {
            if (!logo) return sizeSmall ? '' : '<span class="model-logo-fallback">AI</span>';
            const s = sizeSmall ? ' style="width:14px;height:14px;border-radius:3px;"' : '';
            return `<img class="model-logo" src="${logo}" alt="" onerror="this.style.display='none'"${s}>`;
        }
