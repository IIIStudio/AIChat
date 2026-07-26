        // ============================================================
        //  WebDAV 备份恢复
        // ============================================================
        let webDavSettings = {
            baseUrl: '',
            username: '',
            password: '',
            remotePath: 'AIChat/backup.json'
        };

        /**
         * 【WebDAV备份/配置】【加载】从 IndexedDB 读取 WebDAV 配置
         * @returns {Promise<void>}
         */
        async function loadWebDavSettings() {
            try {
                const saved = await dbGet('webDavSettings');
                if (saved) webDavSettings = { ...webDavSettings, ...saved };
            } catch(e) {}
        }

        /**
         * 【WebDAV备份/配置】【保存】把 WebDAV 配置写入 IndexedDB
         * @returns {Promise<void>}
         */
        async function saveWebDavSettings() {
            try { await dbSet('webDavSettings', webDavSettings); } catch(e) {}
        }

        /**
         * 【WebDAV备份/配置】【同步表单】从当前 WebDAV 表单读取配置
         * @returns {void}
         */
        function flushWebDavSettings() {
            const baseUrlEl = document.getElementById('editWebDavBaseUrl');
            const usernameEl = document.getElementById('editWebDavUsername');
            const passwordEl = document.getElementById('editWebDavPassword');
            const pathEl = document.getElementById('editWebDavRemotePath');

            // 1. 只读取当前 WebDAV 路由中存在的表单元素
            if (baseUrlEl) webDavSettings.baseUrl = baseUrlEl.value.trim();
            if (usernameEl) webDavSettings.username = usernameEl.value.trim();
            if (passwordEl) webDavSettings.password = passwordEl.value;
            if (pathEl) webDavSettings.remotePath = pathEl.value.trim() || 'AIChat/backup.json';
        }

        /**
         * 【WebDAV备份/配置】【渲染】渲染 WebDAV 备份恢复配置页面
         * @returns {void}
         */
        function renderWebDavSettings() {
            const panel = document.getElementById('settingsWebDavPanel');
            if (!panel) return;
            const s = webDavSettings;
            panel.innerHTML = `
                <div class="settings-section-title">WebDAV 备份恢复</div>
                <div class="webdav-settings-desc">配置 WebDAV 后可把当前配置、会话和收藏备份到远程 JSON 文件，或从远程文件恢复。</div>
                <div class="settings-field-group">
                    <label>连接配置</label>
                    <label>WebDAV 地址</label>
                    <input type="text" id="editWebDavBaseUrl" value="${escapeHtml(s.baseUrl || '')}" placeholder="https://dav.example.com/remote.php/dav/files/user">
                    <div style="display:flex;gap:10px;">
                        <div style="flex:1;">
                            <label>用户名</label>
                            <input type="text" id="editWebDavUsername" value="${escapeHtml(s.username || '')}" placeholder="WebDAV 用户名">
                        </div>
                        <div style="flex:1;">
                            <label>密码或应用密码</label>
                            <input type="password" id="editWebDavPassword" value="${escapeHtml(s.password || '')}" placeholder="WebDAV 密码">
                        </div>
                    </div>
                    <label>远程备份文件路径</label>
                    <input type="text" id="editWebDavRemotePath" value="${escapeHtml(s.remotePath || 'AIChat/backup.json')}" placeholder="AIChat/backup.json">
                </div>
                <div class="webdav-help">浏览器直连 WebDAV 需要服务端允许跨域请求，尤其是 OPTIONS 预检和 PROPFIND、MKCOL、PUT、GET 方法。WebDAV 凭据只保存在本地浏览器，不会写入备份 JSON。</div>
                <div class="webdav-actions">
                    <button type="button" onclick="testWebDavConnection()">测试连接</button>
                    <button type="button" onclick="backupToWebDav()">立即备份</button>
                    <button type="button" class="danger" onclick="restoreFromWebDav()">从 WebDAV 恢复</button>
                </div>
                <div class="webdav-status" id="webDavStatus">尚未执行操作</div>
            `;
        }

        /**
         * 【WebDAV备份/请求】【认证头】构造 WebDAV 请求头
         * @returns {Object} - fetch 请求头
         */
        function buildWebDavHeaders() {
            const headers = {};
            if (webDavSettings.username || webDavSettings.password) {
                const raw = `${webDavSettings.username || ''}:${webDavSettings.password || ''}`;
                headers.Authorization = `Basic ${btoa(unescape(encodeURIComponent(raw)))}`;
            }
            return headers;
        }

        /**
         * 【WebDAV备份/路径】【编码】对 WebDAV 路径逐段编码
         * @param {string} remotePath - 远程相对路径
         * @returns {string} - 编码后的路径
         */
        function encodeWebDavPath(remotePath) {
            return (remotePath || '')
                .split('/')
                .filter(Boolean)
                .map(part => encodeURIComponent(part))
                .join('/');
        }

        /**
         * 【WebDAV备份/路径】【文件地址】获取远程备份文件 URL
         * @returns {string} - 远程备份文件 URL
         */
        function getWebDavFileUrl() {
            const baseUrl = webDavSettings.baseUrl.trim().replace(/\/+$/, '');
            const remotePath = encodeWebDavPath(webDavSettings.remotePath);
            return `${baseUrl}/${remotePath}`;
        }

        /**
         * 【WebDAV备份/路径】【目录地址】获取远程备份目录 URL
         * @returns {string} - 远程备份目录 URL
         */
        function getWebDavDirectoryUrl() {
            const baseUrl = webDavSettings.baseUrl.trim().replace(/\/+$/, '');
            const parts = (webDavSettings.remotePath || '').split('/').filter(Boolean).slice(0, -1);
            if (parts.length === 0) return baseUrl;
            return `${baseUrl}/${parts.map(part => encodeURIComponent(part)).join('/')}`;
        }

        /**
         * 【WebDAV备份/配置】【校验】校验 WebDAV 配置是否完整
         * @returns {void}
         */
        function validateWebDavSettings() {
            if (!webDavSettings.baseUrl) throw new Error('请填写 WebDAV 地址');
            if (!webDavSettings.remotePath) throw new Error('请填写远程备份文件路径');
            if (!/^https?:\/\//i.test(webDavSettings.baseUrl)) throw new Error('WebDAV 地址必须以 http:// 或 https:// 开头');
        }

        /**
         * 【WebDAV备份/状态】【显示】更新 WebDAV 操作状态
         * @param {string} message - 状态文本
         * @param {string} [type='muted'] - 状态类型，支持 muted、success、error
         * @returns {void}
         */
        function setWebDavStatus(message, type = 'muted') {
            const statusEl = document.getElementById('webDavStatus');
            if (!statusEl) return;
            statusEl.className = `webdav-status ${type}`;
            statusEl.textContent = message;
        }

        /**
         * 【WebDAV备份/错误】【诊断】把浏览器网络错误转换为可执行的诊断文案
         * @param {Error} err - fetch 捕获到的错误
         * @param {string} action - 当前执行的动作名称
         * @returns {string} - 面向用户的错误说明
         */
        function formatWebDavError(err, action) {
            const message = err?.message || '未知错误';
            if (message === 'Failed to fetch' || message.includes('NetworkError')) {
                return `${action}失败：浏览器无法访问 WebDAV 服务。常见原因是 WebDAV 服务没有为当前页面域名开启 CORS，或没有正确响应 OPTIONS 预检。请在 WebDAV 服务端允许来源 ${window.location.origin}，并允许 OPTIONS、PROPFIND、MKCOL、PUT、GET 方法。`;
            }
            return message;
        }

        /**
         * 【WebDAV备份/目录】【创建】按远程路径逐级创建 WebDAV 目录
         * @returns {Promise<void>}
         */
        async function ensureWebDavDirectories() {
            const baseUrl = webDavSettings.baseUrl.trim().replace(/\/+$/, '');
            const parts = (webDavSettings.remotePath || '').split('/').filter(Boolean).slice(0, -1);
            let currentUrl = baseUrl;
            const headers = buildWebDavHeaders();

            // 1. 没有子目录时无需创建
            if (parts.length === 0) return;

            // 2. 按路径逐级 MKCOL，已存在时忽略
            for (const part of parts) {
                currentUrl += `/${encodeURIComponent(part)}`;
                const res = await fetch(currentUrl, { method: 'MKCOL', headers });
                if (![200, 201, 405, 409].includes(res.status)) {
                    throw new Error(`创建目录失败，HTTP ${res.status}`);
                }
            }
        }

        /**
         * 【WebDAV备份/连接】【测试】测试当前 WebDAV 配置是否可访问
         * @returns {Promise<void>}
         */
        async function testWebDavConnection() {
            try {
                flushWebDavSettings();
                validateWebDavSettings();
                setWebDavStatus('正在测试连接...');
                await saveWebDavSettings();
                const headers = { ...buildWebDavHeaders(), Depth: '0' };
                const res = await fetch(getWebDavDirectoryUrl(), { method: 'PROPFIND', headers });
                if (![200, 207].includes(res.status)) {
                    throw new Error(`连接失败，HTTP ${res.status}`);
                }
                setWebDavStatus('连接成功', 'success');
                showToast('WebDAV 连接成功');
            } catch (err) {
                const message = formatWebDavError(err, '连接');
                setWebDavStatus(message, 'error');
                showToast('WebDAV 连接失败: ' + message);
            }
        }

        /**
         * 【WebDAV备份/上传】【备份】把当前数据上传到 WebDAV 远程文件
         * @returns {Promise<void>}
         */
        async function backupToWebDav() {
            try {
                flushWebDavSettings();
                validateWebDavSettings();
                setWebDavStatus('正在上传备份...');
                await saveWebDavSettings();
                await ensureWebDavDirectories();
                const payload = buildBackupPayload();
                const headers = { ...buildWebDavHeaders(), 'Content-Type': 'application/json' };
                const res = await fetch(getWebDavFileUrl(), {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload, null, 2)
                });
                if (!res.ok) throw new Error(`备份失败，HTTP ${res.status}`);
                setWebDavStatus(`备份成功：${webDavSettings.remotePath}`, 'success');
                showToast('WebDAV 备份成功');
            } catch (err) {
                const message = formatWebDavError(err, '备份');
                setWebDavStatus(message, 'error');
                showToast('WebDAV 备份失败: ' + message);
            }
        }

        /**
         * 【WebDAV备份/下载】【恢复】从 WebDAV 下载备份文件并恢复到当前浏览器
         * @returns {Promise<void>}
         */
        async function restoreFromWebDav() {
            try {
                flushWebDavSettings();
                validateWebDavSettings();
                if (!window.confirm('从 WebDAV 恢复会覆盖当前配置、会话和收藏，是否继续？')) return;
                setWebDavStatus('正在下载备份...');
                await saveWebDavSettings();
                const res = await fetch(getWebDavFileUrl(), { method: 'GET', headers: buildWebDavHeaders() });
                if (!res.ok) throw new Error(`恢复失败，HTTP ${res.status}`);
                const data = await res.json();
                const stats = await applyBackupData(data);
                setWebDavStatus(`恢复成功：${stats.providers} 个运营商，${stats.sessions} 个会话，${stats.favorites} 个收藏`, 'success');
                showToast('WebDAV 恢复成功');
            } catch (err) {
                const message = formatWebDavError(err, '恢复');
                setWebDavStatus(message, 'error');
                showToast('WebDAV 恢复失败: ' + message);
            }
        }
