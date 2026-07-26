        // ============================================================
        //  HTML 沙箱执行器逻辑
        // ============================================================
        // 存储当前执行器中已注入的 CDN 地址
        let injectedCdnUrls = [];

        /**
         * 打开 HTML 执行器并装载代码
         * @param {string} htmlContent - 待执行的 HTML 源代码
         * @returns {void}
         */
        window.openHtmlExecutor = function(htmlContent) {
            injectedCdnUrls = [];
            const cdnInput = document.getElementById('cdnInput');
            if (cdnInput) cdnInput.value = '';
            
            const sourceTextarea = document.getElementById('executorSource');
            if (sourceTextarea) sourceTextarea.value = htmlContent;
            updateExecutorHighlight();

            // 1. 恢复双栏的初始状态
            const leftPanel = document.getElementById('executorLeftPanel');
            const toggleBtn = document.getElementById('btnToggleFullPreview');
            if (leftPanel) leftPanel.classList.remove('collapsed');
            if (toggleBtn) toggleBtn.textContent = '全屏预览';

            const modal = document.getElementById('htmlExecutorModal');
            if (modal) modal.style.display = 'flex';
            
            // 2. 启动沙箱渲染
            runSandboxHtml();
        };

        /**
         * 关闭 HTML 执行器并清空沙箱
         * @returns {void}
         */
        window.closeHtmlExecutor = function() {
            const modal = document.getElementById('htmlExecutorModal');
            if (modal) modal.style.display = 'none';
            
            // 1. 清空 iframe 以释放内存并停止脚本执行
            const iframe = document.getElementById('executorIframe');
            if (iframe) iframe.srcdoc = '';
        };

        /**
         * 向沙箱中注入外部 CDN 库
         * @returns {void}
         */
        window.injectCdnLibrary = function() {
            const urlInput = document.getElementById('cdnInput');
            if (!urlInput) return;
            const url = urlInput.value.trim();
            
            if (!url) {
                showToast('请输入有效的 CDN URL');
                return;
            }
            if (injectedCdnUrls.includes(url)) {
                showToast('该 CDN 已经注入过');
                return;
            }
            
            // 1. 记录要注入的 CDN 地址
            injectedCdnUrls.push(url);
            showToast('注入成功，正在刷新沙箱');
            urlInput.value = '';
            
            // 2. 重新载入运行结果
            runSandboxHtml();
        };

        /**
         * 拼接源码和 CDN 脚本，加载并运行沙箱 iframe
         * @returns {void}
         */
        window.runSandboxHtml = function() {
            const sourceTextarea = document.getElementById('executorSource');
            const iframe = document.getElementById('executorIframe');
            if (!sourceTextarea || !iframe) return;

            const source = sourceTextarea.value;

            // 1. 生成 CDN script 引入标签
            let scriptsHtml = '';
            injectedCdnUrls.forEach(url => {
                scriptsHtml += '<script src="' + url + '"></' + 'script>\n';
            });

            let iframeContent = '';
            
            // 2. 检查是否有完整的 HTML 结构，若有则注入 head，若无则补充完整模板
            if (source.includes('<html') || source.includes('<body')) {
                if (source.includes('</head>')) {
                    iframeContent = source.replace('</head>', `${scriptsHtml}</head>`);
                } else if (source.includes('<body>')) {
                    iframeContent = source.replace('<body>', `<body>\n${scriptsHtml}`);
                } else {
                    iframeContent = scriptsHtml + source;
                }
            } else {
                iframeContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
    ${scriptsHtml}
</head>
<body>
    ${source}
</body>
</html>`;
            }

            // 3. 将拼接好的内容作为 srcdoc 传给沙箱 iframe 执行
            iframe.srcdoc = iframeContent;
        };

        /**
         * 切换全屏预览与左右双栏模式
         * @returns {void}
         */
        window.toggleFullPreview = function() {
            const leftPanel = document.getElementById('executorLeftPanel');
            const toggleBtn = document.getElementById('btnToggleFullPreview');
            if (!leftPanel || !toggleBtn) return;

            const isCollapsed = leftPanel.classList.toggle('collapsed');
            
            // 1. 更新切换按钮的文案提示
            if (isCollapsed) {
                toggleBtn.textContent = '双栏模式';
                showToast('已进入全屏预览模式');
            } else {
                toggleBtn.textContent = '全屏预览';
            }
        };


        // ============================================================
        //  HTML 源码编辑器语法高亮（textarea 叠加 hljs 着色层）
        // ============================================================
        // 同步源码到背后的 <pre> 着色层，并同步滚动位置
        function updateExecutorHighlight() {
            const ta = document.getElementById('executorSource');
            const codeEl = document.querySelector('#executorHighlight code');
            if (!ta || !codeEl) return;
            const src = ta.value || '';
            if (window.hljs) {
                try {
                    codeEl.innerHTML = hljs.highlight(src, { language: 'xml' }).value;
                } catch(e) {
                    try { codeEl.innerHTML = hljs.highlightAuto(src).value; }
                    catch(e2) { codeEl.textContent = src; }
                }
            } else {
                codeEl.textContent = src;
            }
            const pre = document.getElementById('executorHighlight');
            if (pre) {
                pre.scrollTop = ta.scrollTop;
                pre.scrollLeft = ta.scrollLeft;
            }
        }

        (function setupExecutorHighlightSync() {
            const ta = document.getElementById('executorSource');
            if (!ta) return;
            ta.addEventListener('input', updateExecutorHighlight);
            ta.addEventListener('scroll', function() {
                const pre = document.getElementById('executorHighlight');
                if (pre) {
                    pre.scrollTop = ta.scrollTop;
                    pre.scrollLeft = ta.scrollLeft;
                }
            });
        })();
