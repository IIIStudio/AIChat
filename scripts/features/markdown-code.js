        function getCodeFenceCount(text) {
            if (!text) return 0;
            return (text.match(/```/g) || []).length;
        }

        /**
         * 【流式渲染/系统】【闭合触发】判断是否需要渲染刚闭合的代码块
         * @param {string} rawText - 当前已经接收的完整 Markdown 文本
         * @param {number} renderedFenceCount - 上一次已经触发渲染的围栏数量
         * @returns {boolean} - 是否存在新闭合的代码块
         */
        function shouldRenderClosedCodeFence(rawText, renderedFenceCount) {
            const fenceCount = getCodeFenceCount(rawText);
            return fenceCount > renderedFenceCount && fenceCount % 2 === 0;
        }

        /**
         * 【流式渲染/系统】【语言识别】获取代码块语言
         * @param {HTMLElement} codeEl - 待识别的 code 元素
         * @returns {string|null} - 代码语言名称，无法识别时返回 null
         */
        function getCodeBlockLanguage(codeEl) {
            if (!codeEl) return null;
            const classNames = Array.from(codeEl.classList || []);
            const languageClass = classNames.find(name => name.startsWith('language-'));
            if (languageClass) return languageClass.replace(/^language-/, '').toLowerCase();
            const rawClass = classNames.find(name => !['hljs', 'mermaid-raw', 'mermaid-source-text'].includes(name));
            return rawClass ? rawClass.toLowerCase() : null;
        }

        /**
         * 【流式渲染/系统】【按钮状态】设置代码块按钮是否可用
         * @param {HTMLElement} button - 待更新的按钮元素
         * @param {boolean} enabled - 是否可用
         * @returns {void}
         */
        function setCodeActionButtonState(button, enabled) {
            if (!button) return;
            button.classList.toggle('disabled', !enabled);
            button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
            if (!enabled) button.onclick = null;
        }

        /**
         * 【流式渲染/系统】【按钮创建】创建代码块操作按钮
         * @param {string} action - 操作类型，支持 copy/run
         * @returns {HTMLSpanElement} - 操作按钮元素
         */
        function createCodeActionButton(action) {
            const button = document.createElement('span');
            button.dataset.codeAction = action;
            if (action === 'run') {
                button.className = 'code-run-btn';
                button.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>运行';
            } else {
                button.className = 'code-copy-btn';
                button.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 复制';
            }
            setCodeActionButtonState(button, false);
            return button;
        }

        /**
         * 【流式渲染/系统】【按钮绑定】为闭合代码块绑定操作按钮功能
         * @param {HTMLElement} wrapper - 代码块包装容器
         * @param {HTMLElement} codeEl - 代码内容元素
         * @param {string|null} lang - 代码语言
         * @returns {void}
         */
        function bindCodeBlockActionButtons(wrapper, codeEl, lang) {
            const copyBtn = wrapper.querySelector('[data-code-action="copy"]');
            setCodeActionButtonState(copyBtn, true);
            if (copyBtn) {
                copyBtn.onclick = () => {
                    const text = codeEl.textContent;
                    navigator.clipboard.writeText(text).then(() => {
                        copyBtn.classList.add('copied');
                        copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 已复制';
                        setTimeout(() => {
                            copyBtn.classList.remove('copied');
                            copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 复制';
                        }, 2000);
                    }).catch(() => showToast('复制失败'));
                };
            }
            const runBtn = wrapper.querySelector('[data-code-action="run"]');
            if (runBtn && lang === 'html') {
                setCodeActionButtonState(runBtn, true);
                runBtn.onclick = () => {
                    // 调用执行器打开沙箱
                    const htmlContent = codeEl.textContent;
                    openHtmlExecutor(htmlContent);
                };
            }
        }

        /**
         * 【流式渲染/系统】【外壳渲染】确保代码块眉头、分割线和按钮外观已渲染
         * @param {HTMLElement} codeEl - 待处理的代码元素
         * @param {boolean} enabled - 操作按钮是否立即启用
         * @returns {HTMLElement|null} - 代码块包装容器
         */
        function ensureCodeBlockShell(codeEl, enabled = false) {
            const pre = codeEl?.parentElement;
            if (!pre || pre.tagName !== 'PRE') return null;
            if (pre.closest('.mermaid-code') || pre.closest('.mermaid-wrapper')) return null;
            const lang = getCodeBlockLanguage(codeEl);
            let wrapper = pre.parentElement?.classList.contains('code-block-wrapper') ? pre.parentElement : null;
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
            }
            let header = wrapper.querySelector('.code-block-header');
            if (!header) {
                header = document.createElement('div');
                header.className = 'code-block-header';
                wrapper.insertBefore(header, pre);
            }
            let langLabel = header.querySelector('.code-lang');
            if (!langLabel) {
                langLabel = document.createElement('span');
                langLabel.className = 'code-lang';
                header.insertBefore(langLabel, header.firstChild);
            }
            langLabel.textContent = lang || '代码';
            let actions = header.querySelector('.code-block-actions');
            if (!actions) {
                actions = document.createElement('div');
                actions.className = 'code-block-actions';
                header.appendChild(actions);
            }
            const existingRunBtn = actions.querySelector('[data-code-action="run"]');
            if (lang === 'html' && !existingRunBtn) {
                actions.insertBefore(createCodeActionButton('run'), actions.firstChild);
            } else if (lang !== 'html' && existingRunBtn) {
                existingRunBtn.remove();
            }
            if (!actions.querySelector('[data-code-action="copy"]')) {
                actions.appendChild(createCodeActionButton('copy'));
            }
            if (enabled) {
                bindCodeBlockActionButtons(wrapper, codeEl, lang);
            } else {
                actions.querySelectorAll('[data-code-action]').forEach(button => setCodeActionButtonState(button, false));
            }
            return wrapper;
        }

        /**
         * 【流式渲染/系统】【外壳同步】渲染代码块可见外壳，未闭合时不绑定按钮功能
         * @param {HTMLElement} container - 待处理的消息容器
         * @param {boolean} skipLast - 是否把最后一个未闭合代码块视为禁用状态
         * @returns {void}
         */
        function renderCodeBlockShells(container, skipLast = false) {
            if (!container) return;
            const codeEls = Array.from(container.querySelectorAll('pre > code:not(.mermaid-source-text)'));
            const end = codeEls.length;
            for (let i = 0; i < end; i++) {
                const el = codeEls[i];
                const pre = el.parentElement;
                if (!pre || pre.closest('.mermaid-code') || pre.closest('.mermaid-wrapper')) continue;
                const isLastOpen = skipLast && i === end - 1 && !isCodeBlockClosed(el);
                ensureCodeBlockShell(el, !isLastOpen);
            }
        }

        /**
         * 【流式渲染/系统】【增量渲染】渲染已闭合的 Markdown 增强内容
         * @param {HTMLElement} container - 待处理的消息容器
         * @param {boolean} skipLast - 是否跳过最后一个未闭合代码块
         * @returns {void}
         */
        function renderCompletedMarkdownBlocks(container, skipLast = false) {
            renderCodeBlockShells(container, skipLast);
            renderMermaid(container, skipLast);
            highlightCodeBlocks(container, skipLast);
            renderMath(container, skipLast);
        }

        /**
         * 【流式渲染/系统】【辅助函数】判断代码块是否已闭合
         * @param {HTMLElement} codeEl - 待判断的 code 元素
         * @returns {boolean} - 是否已闭合
         */
        function isCodeBlockClosed(codeEl) {
            const pre = codeEl.parentElement;
            if (!pre || pre.tagName !== 'PRE') return false;
            // 1. 如果 pre 后面还有任何兄弟节点，说明已输出后续内容，该代码块必然已闭合
            if (pre.nextSibling) return true;
            
            // 2. 增量检查：从消息容器的 data-raw 属性中获取完整的已收文本
            const container = codeEl.closest('[data-raw]');
            if (container) {
                const raw = container.getAttribute('data-raw') || '';
                // 3. 统计代码块定界符的数量
                const count = getCodeFenceCount(raw);
                // 4. 如果定界符数量为偶数，说明当前消息的所有代码块均已闭合
                if (count > 0 && count % 2 === 0) {
                    return true;
                }
            }
            return false;
        }

        // ============================================================
        //  代码高亮 — 统一处理 marked 与 smd 两条路径的代码块
        // ============================================================
        /**
         * 【流式渲染/系统】【代码高亮】处理代码块高亮、语言标签和操作按钮
         * @param {HTMLElement} container - 待处理的 DOM 容器
         * @param {boolean} skipLast - 是否跳过最后一个未闭合代码块
         * @returns {void}
         */
        function highlightCodeBlocks(container, skipLast = false) {
            if (!container || !window.hljs) return;
            // 1.收集未着色的代码块
            const codeEls = Array.from(container.querySelectorAll('pre > code:not(.hljs):not(.mermaid-source-text)'));
            const end = codeEls.length;
            for (let i = 0; i < end; i++) {
                const el = codeEls[i];
                const pre = el.parentElement;
                if (!pre || pre.closest('.mermaid-code') || pre.closest('.mermaid-wrapper')) continue;
                // 2.skipLast 模式下，若为最后一块且尚未闭合，则跳过（流式输出中可能尚未完成）
                if (skipLast && i === end - 1 && !isCodeBlockClosed(el)) {
                    continue;
                }
                // 3. 提取语言名：兼容 marked 的 language-xxx 和 smd 的直接语言名
                const lang = getCodeBlockLanguage(el);
                try {
                    if (lang && hljs.getLanguage(lang)) {
                        el.innerHTML = hljs.highlight(el.textContent, { language: lang }).value;
                    } else {
                        el.innerHTML = hljs.highlightAuto(el.textContent).value;
                    }
                    el.classList.add('hljs');
                } catch(e) { continue; }
                // 4.代码块闭合后启用外壳按钮
                ensureCodeBlockShell(el, true);
            }
        }

        // ============================================================
        //  数学公式预处理 — 剥离包裹公式的反引号
