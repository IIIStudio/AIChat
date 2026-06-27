        // ============================================================
        //  Mermaid 图表渲染与视图切换
        // ============================================================
        /**
         * 【流式渲染/系统】【主题配置】获取 Mermaid 当前主题配置
         * @returns {Object} - Mermaid 初始化配置
         */
        function getMermaidConfig() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const lightThemeVariables = {
                background: 'transparent',
                primaryColor: '#e0e7ff',
                primaryTextColor: '#312e81',
                primaryBorderColor: '#6366f1',
                lineColor: '#64748b',
                secondaryColor: '#d1fae5',
                secondaryTextColor: '#064e3b',
                secondaryBorderColor: '#10b981',
                tertiaryColor: '#fef3c7',
                tertiaryTextColor: '#78350f',
                tertiaryBorderColor: '#f59e0b',
                nodeBorder: '#6366f1',
                mainBkg: '#e0e7ff',
                clusterBkg: '#fae8ff',
                clusterBorder: '#d946ef',
                edgeLabelBackground: '#f8fafc',
                textColor: '#1e293b',
                labelTextColor: '#1e293b',
                actorBkg: '#e0e7ff',
                actorBorder: '#6366f1',
                actorTextColor: '#312e81',
                signalColor: '#64748b',
                signalTextColor: '#1e293b',
                noteBkgColor: '#ffe4e6',
                noteTextColor: '#881337',
                noteBorderColor: '#f43f5e',
                // Git 流程图分支色彩
                git0: '#6366f1',
                git1: '#10b981',
                git2: '#f59e0b',
                git3: '#ec4899',
                git4: '#8b5cf6',
                git5: '#06b6d4',
                git6: '#f97316',
                git7: '#14b8a6',
                // 饼图扇区色彩
                pie1: '#6366f1',
                pie2: '#10b981',
                pie3: '#f59e0b',
                pie4: '#ec4899',
                pie5: '#8b5cf6',
                pie6: '#06b6d4',
                pie7: '#f97316',
                pie8: '#14b8a6',
                pie9: '#ef4444',
                pie10: '#a855f7',
                pie11: '#3b82f6',
                pie12: '#84cc16'
            };
            const darkThemeVariables = {
                background: 'transparent',
                primaryColor: '#1e293b',
                primaryTextColor: '#e0e7ff',
                primaryBorderColor: '#818cf8',
                lineColor: '#94a3b8',
                secondaryColor: '#064e3b',
                secondaryTextColor: '#d1fae5',
                secondaryBorderColor: '#34d399',
                tertiaryColor: '#78350f',
                tertiaryTextColor: '#fef3c7',
                tertiaryBorderColor: '#fbbf24',
                nodeBorder: '#818cf8',
                mainBkg: '#1e293b',
                clusterBkg: '#2e1065',
                clusterBorder: '#e879f9',
                edgeLabelBackground: '#0f172a',
                textColor: '#e2e8f0',
                labelTextColor: '#e2e8f0',
                actorBkg: '#1e293b',
                actorBorder: '#818cf8',
                actorTextColor: '#e0e7ff',
                signalColor: '#94a3b8',
                signalTextColor: '#e2e8f0',
                noteBkgColor: '#881337',
                noteTextColor: '#ffe4e6',
                noteBorderColor: '#fb7185',
                // Git 流程图分支色彩
                git0: '#818cf8',
                git1: '#34d399',
                git2: '#fbbf24',
                git3: '#f472b6',
                git4: '#a78bfa',
                git5: '#22d3ee',
                git6: '#fb923c',
                git7: '#2dd4bf',
                // 饼图扇区色彩
                pie1: '#818cf8',
                pie2: '#34d399',
                pie3: '#fbbf24',
                pie4: '#f472b6',
                pie5: '#a78bfa',
                pie6: '#22d3ee',
                pie7: '#fb923c',
                pie8: '#2dd4bf',
                pie9: '#f87171',
                pie10: '#c084fc',
                pie11: '#60a5fa',
                pie12: '#a3e635'
            };
            return {
                startOnLoad: false,
                theme: 'base',
                securityLevel: 'loose',
                suppressErrorRendering: true,
                themeVariables: isDark ? darkThemeVariables : lightThemeVariables
            };
        }

        // 切换 Mermaid 视图模式
        window.switchMermaidTab = function(wrapper, mode) {
            if (!wrapper) return;
            const btnPreview = wrapper.querySelector('.mermaid-toolbar .mermaid-tool-btn:nth-child(1)');
            const btnCode = wrapper.querySelector('.mermaid-toolbar .mermaid-tool-btn:nth-child(2)');
            const previewDiv = wrapper.querySelector('.mermaid-preview');
            const codeDiv = wrapper.querySelector('.mermaid-code');

            if (mode === 'preview') {
                btnPreview?.classList.add('active');
                btnCode?.classList.remove('active');
                if (previewDiv) previewDiv.style.display = 'flex';
                if (codeDiv) codeDiv.style.display = 'none';
            } else if (mode === 'code') {
                btnPreview?.classList.remove('active');
                btnCode?.classList.add('active');
                if (previewDiv) previewDiv.style.display = 'none';
                if (codeDiv) codeDiv.style.display = 'block';
            }
        };

        let mermaidRenderSeq = 0;

        /**
         * 【流式渲染/系统】【图表包装】创建 Mermaid 渲染成功后的视图容器
         * @param {string} source - Mermaid 源码
         * @param {string} svg - Mermaid 渲染后的 SVG 字符串
         * @returns {HTMLElement} - Mermaid 图表包装容器
         */
        function createMermaidWrapper(source, svg) {
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-wrapper';

            // 识别甘特图并增加标记
            const trimmed = String(source || '').trim();
            if (trimmed.startsWith('gantt') || trimmed.toLowerCase().startsWith('gantt')) {
                wrapper.classList.add('is-gantt');
            }

            const toolbar = document.createElement('div');
            toolbar.className = 'mermaid-toolbar';

            const btnPreview = document.createElement('span');
            btnPreview.className = 'mermaid-tool-btn active';
            btnPreview.textContent = '图表';
            btnPreview.onclick = () => switchMermaidTab(wrapper, 'preview');

            const btnCode = document.createElement('span');
            btnCode.className = 'mermaid-tool-btn';
            btnCode.textContent = '源码';
            btnCode.onclick = () => switchMermaidTab(wrapper, 'code');

            const btnZoom = document.createElement('span');
            btnZoom.className = 'mermaid-tool-btn';
            btnZoom.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px;vertical-align:middle;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>放大';

            const btnCopy = document.createElement('span');
            btnCopy.className = 'mermaid-tool-copy';
            btnCopy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 4h-8a4 4 0 0 0-4 4v8"></path></svg> 复制';
            btnCopy.onclick = () => {
                navigator.clipboard.writeText(source).then(() => {
                    btnCopy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 已复制';
                    setTimeout(() => {
                        btnCopy.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 4h-8a4 4 0 0 0-4 4v8"></path></svg> 复制';
                    }, 2000);
                });
            };

            const previewDiv = document.createElement('div');
            previewDiv.className = 'mermaid-preview';
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.innerHTML = svg;
            previewDiv.appendChild(mermaidDiv);
            btnZoom.onclick = () => {
                const svgEl = previewDiv.querySelector('svg');
                if (svgEl) {
                    openMermaidViewer(svgEl.outerHTML);
                } else {
                    showToast('图表尚未渲染完成');
                }
            };

            const codeDiv = document.createElement('div');
            codeDiv.className = 'mermaid-code';
            codeDiv.style.display = 'none';
            const preNode = document.createElement('pre');
            const codeNode = document.createElement('code');
            codeNode.className = 'mermaid-source-text hljs';
            if (window.hljs) {
                try { codeNode.innerHTML = hljs.highlightAuto(source).value; }
                catch(e) { codeNode.textContent = source; }
            } else {
                codeNode.textContent = source;
            }
            preNode.appendChild(codeNode);
            codeDiv.appendChild(preNode);

            toolbar.appendChild(btnPreview);
            toolbar.appendChild(btnCode);
            toolbar.appendChild(btnZoom);
            toolbar.appendChild(btnCopy);
            wrapper.appendChild(toolbar);
            wrapper.appendChild(previewDiv);
            wrapper.appendChild(codeDiv);
            return wrapper;
        }

        /**
         * 【流式渲染/系统】【安全替换】Mermaid 渲染成功后才替换旧代码块状态
         * @param {HTMLElement} codeEl - Mermaid 源码代码元素
         * @returns {void}
         */
        function renderMermaidCandidate(codeEl) {
            if (!codeEl || codeEl.__mermaidRendering) return;
            const pre = codeEl.parentElement;
            if (!pre || pre.tagName !== 'PRE') return;
            const source = codeEl.textContent || '';
            if (!source.trim() || codeEl.__mermaidErrorSource === source) return;
            codeEl.__mermaidRendering = true;
            mermaid.initialize(getMermaidConfig());
            const renderId = `mermaid-render-${Date.now()}-${mermaidRenderSeq++}`;
            let renderTask;
            try {
                renderTask = Promise.resolve(mermaid.render(renderId, source));
            } catch (err) {
                codeEl.__mermaidErrorSource = source;
                codeEl.__mermaidRendering = false;
                console.info('【流式渲染/系统】【Mermaid暂缓】Mermaid 渲染暂缓: ', err);
                return;
            }
            renderTask.then(result => {
                if (!pre.isConnected || codeEl.textContent !== source) return;
                const svg = typeof result === 'string' ? result : result.svg;
                if (!svg) return;
                const wrapper = createMermaidWrapper(source, svg);
                const previewDiv = wrapper.querySelector('.mermaid-preview');
                if (result && typeof result.bindFunctions === 'function' && previewDiv) {
                    result.bindFunctions(previewDiv);
                }
                let targetToReplace = pre;
                if (pre.parentNode && pre.parentNode.classList.contains('code-block-wrapper')) {
                    targetToReplace = pre.parentNode;
                }
                if (!targetToReplace.parentNode) return;
                targetToReplace.parentNode.replaceChild(wrapper, targetToReplace);
            }).catch(err => {
                codeEl.__mermaidErrorSource = source;
                console.info('【流式渲染/系统】【Mermaid暂缓】Mermaid 渲染暂缓: ', err);
            }).finally(() => {
                codeEl.__mermaidRendering = false;
            });
        }

        /**
         * 【流式渲染/系统】【图表渲染】将已闭合的 Mermaid 代码块替换为图表预览
         * @param {HTMLElement} container - 待处理的消息容器
         * @param {boolean} skipLast - 是否跳过最后一个未闭合 Mermaid 代码块
         * @returns {void}
         */
        function renderMermaid(container, skipLast = false) {
            if (!container || !window.mermaid) return;
            const codeEls = Array.from(container.querySelectorAll('pre > code.mermaid-raw, pre > code.language-mermaid, pre > code.mermaid'));
            if (codeEls.length === 0) return;

            const end = codeEls.length;
            for (let i = 0; i < end; i++) {
                const el = codeEls[i];
                const pre = el.parentElement;
                if (!pre || pre.tagName !== 'PRE') continue;
                if (pre.closest('.mermaid-code')) continue;
                if (pre.closest('.mermaid-wrapper')) continue;

                // 【流式渲染/系统】【增量渲染】skipLast 模式下，若为最后一个 Mermaid 块且尚未闭合，则跳过中途渲染
                if (skipLast && i === end - 1 && !isCodeBlockClosed(el)) {
                    continue;
                }
                renderMermaidCandidate(el);
            }
        }
