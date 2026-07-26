        // ============================================================
        // 模型常以 `$...$` 或 `$$...$$` 形式输出公式，反引号会被 markdown
        // 解析为行内代码 <code>，导致 KaTeX 扩展无法识别其中的 $ 定界符
        // 此函数把包裹公式的反引号剥离，使 $...$ / $$...$$ 暴露给公式解析器
        // 传参：text 为原始 markdown 文本
        // 返回：剥离反引号后的文本
        function unwrapMathFromCode(text) {
            if (!text) return text;
            // 匹配 `$$...$$` 或 `$...$` 形式，反引号紧贴 $ 前后
            // 注意 $$ 优先于 $ 匹配，避免误拆
            return text
                .replace(/`(\$\$[^`]*?\$\$)`/g, '$1')
                .replace(/`(\$[^`]*?\$)`/g, '$1');
        }

        // ============================================================
        //  公式占位保护 — 防止 marked.parse 破坏公式定界符
        //  marked 会消费 \(\) 转义序列、拆分 $...$ 中的强调字符
        //  方案：marked 前用占位符替换公式，marked 后在文本节点中还原
        // ============================================================

        /**
         * 提取文本中的数学公式并替换为占位符，防止 marked.parse 破坏定界符
         * @param {string} text - 原始 markdown 文本
         * @returns {{text: string, mathMap: string[]}} - 占位后的文本和公式映射表
         */
        function protectMath(text) {
            if (!text) return { text: text, mathMap: [] };
            const mathMap = [];
            const pattern = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^\n$]*?\$)/g;
            const protectedText = text.replace(pattern, (match) => {
                const idx = mathMap.length;
                mathMap.push(match);
                return '@@MATH' + idx + '@@';
            });
            return { text: protectedText, mathMap: mathMap };
        }

        /**
         * 在 DOM 容器的文本节点中还原被占位的数学公式
         * @param {HTMLElement} container - 已设置 innerHTML 的 DOM 容器
         * @param {string[]} mathMap - protectMath 返回的公式映射表
         * @returns {void}
         */
        function restoreMathPlaceholders(container, mathMap) {
            if (!container || !mathMap || mathMap.length === 0) return;
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    return /@@MATH\d+@@/.test(node.nodeValue || '')
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            });
            const textNodes = [];
            let node = walker.nextNode();
            while (node) {
                textNodes.push(node);
                node = walker.nextNode();
            }
            textNodes.forEach(node => {
                node.nodeValue = node.nodeValue.replace(/@@MATH(\d+)@@/g, (match, idx) => {
                    return mathMap[parseInt(idx)] || match;
                });
            });
        }

        // ============================================================
        //  数学公式渲染 — 候选成功后替换
        // ============================================================
        const MATH_DELIMITER_CONFIGS = [
            { left: '$$', right: '$$', displayMode: true },
            { left: '\\[', right: '\\]', displayMode: true },
            { left: '\\(', right: '\\)', displayMode: false },
            { left: '$', right: '$', displayMode: false }
        ];
        const MATH_IGNORED_SELECTOR = 'script,noscript,style,textarea,pre,code,option,svg,.katex,.math-render,.mermaid-wrapper,.mermaid-code';

        /**
         * 【流式渲染/系统】【公式解析】判断定界符当前位置是否被反斜杠转义
         * @param {string} text - 待检查的文本
         * @param {number} index - 定界符起始位置
         * @returns {boolean} - 是否处于转义状态
         */
        function isEscapedDelimiter(text, index) {
            let slashCount = 0;
            for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) {
                slashCount++;
            }
            return slashCount % 2 === 1;
        }

        /**
         * 【流式渲染/系统】【公式解析】查找未转义的公式定界符
         * @param {string} text - 待搜索的文本
         * @param {string} delimiter - 公式定界符
         * @param {number} startIndex - 搜索起始位置
         * @returns {number} - 命中的定界符位置，未命中时返回 -1
         */
        function findUnescapedDelimiter(text, delimiter, startIndex) {
            let idx = text.indexOf(delimiter, startIndex);
            while (idx !== -1) {
                if (!isEscapedDelimiter(text, idx)) return idx;
                idx = text.indexOf(delimiter, idx + delimiter.length);
            }
            return -1;
        }

        /**
         * 【流式渲染/系统】【公式解析】从文本中查找下一段完整公式候选
         * @param {string} text - 待处理的文本
         * @param {number} startIndex - 搜索起始位置
         * @returns {Object|null} - 公式候选信息，未找到时返回 null
         */
        function findNextMathCandidate(text, startIndex) {
            let best = null;
            MATH_DELIMITER_CONFIGS.forEach(config => {
                let searchFrom = startIndex;
                while (searchFrom < text.length) {
                    const leftIndex = findUnescapedDelimiter(text, config.left, searchFrom);
                    if (leftIndex === -1) return;
                    if (config.left === '$' && text[leftIndex + 1] === '$') {
                        searchFrom = leftIndex + 1;
                        continue;
                    }

                    const contentStart = leftIndex + config.left.length;
                    const rightIndex = findUnescapedDelimiter(text, config.right, contentStart);
                    if (rightIndex === -1) return;
                    const tex = text.slice(contentStart, rightIndex);
                    if (!tex.trim()) {
                        searchFrom = contentStart;
                        continue;
                    }

                    const candidate = {
                        start: leftIndex,
                        end: rightIndex + config.right.length,
                        tex,
                        displayMode: config.displayMode
                    };
                    if (!best || candidate.start < best.start || (candidate.start === best.start && candidate.end > best.end)) {
                        best = candidate;
                    }
                    return;
                }
            });
            return best;
        }

        /**
         * 【流式渲染/系统】【公式渲染】创建 KaTeX 渲染成功后的公式元素
         * @param {string} tex - 公式源码
         * @param {boolean} displayMode - 是否使用块级公式模式
         * @returns {HTMLElement|null} - 渲染后的公式元素，失败时返回 null
         */
        function createMathRenderElement(tex, displayMode) {
            const el = document.createElement('span');
            el.className = displayMode ? 'math-render math-render-block' : 'math-render math-render-inline';
            try {
                katex.render(tex, el, { displayMode, throwOnError: false });
                el.setAttribute('data-katex', '1');
                return el;
            } catch(e) {
                return null;
            }
        }

        /**
         * 【流式渲染/系统】【公式渲染】判断节点后方是否还有已渲染内容
         * @param {Node} root - 搜索边界根节点
         * @param {Node} node - 当前候选节点
         * @returns {boolean} - 当前节点后方是否还有兄弟内容
         */
        function hasFollowingRenderedNode(root, node) {
            let cur = node;
            while (cur && cur !== root) {
                if (cur.nextSibling) return true;
                cur = cur.parentNode;
            }
            return false;
        }

        /**
         * 【流式渲染/系统】【公式渲染】判断文本节点是否允许在当前阶段渲染公式
         * @param {HTMLElement} container - 待处理的消息容器
         * @param {Text} node - 待判断的文本节点
         * @param {boolean} skipLast - 是否跳过末尾仍可能继续写入的内容
         * @returns {boolean} - 是否允许渲染
         */
        function canRenderMathTextNode(container, node, skipLast) {
            const parent = node.parentElement;
            if (!parent || parent.closest(MATH_IGNORED_SELECTOR)) return false;
            if (!/[\\$]/.test(node.nodeValue || '')) return false;
            if (skipLast && !hasFollowingRenderedNode(container, node)) return false;
            return !!findNextMathCandidate(node.nodeValue || '', 0);
        }

        /**
         * 【流式渲染/系统】【公式渲染】替换单个文本节点中的完整公式候选
         * @param {Text} node - 待替换的文本节点
         * @returns {void}
         */
        function renderMathTextNode(node) {
            const text = node.nodeValue || '';
            const fragment = document.createDocumentFragment();
            let cursor = 0;
            let changed = false;
            let candidate = findNextMathCandidate(text, cursor);

            while (candidate) {
                if (candidate.start > cursor) {
                    fragment.appendChild(document.createTextNode(text.slice(cursor, candidate.start)));
                }
                const mathEl = createMathRenderElement(candidate.tex, candidate.displayMode);
                if (mathEl) {
                    fragment.appendChild(mathEl);
                    changed = true;
                } else {
                    fragment.appendChild(document.createTextNode(text.slice(candidate.start, candidate.end)));
                }
                cursor = candidate.end;
                candidate = findNextMathCandidate(text, cursor);
            }

            if (!changed) return;
            if (cursor < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(cursor)));
            }
            node.parentNode.replaceChild(fragment, node);
        }

        /**
         * 【流式渲染/系统】【公式渲染】渲染 streaming-markdown 输出的 equation 元素
         * @param {HTMLElement} container - 待处理的消息容器
         * @param {Element} equationEl - equation-inline 或 equation-block 元素
         * @param {boolean} displayMode - 是否使用块级公式模式
         * @param {boolean} skipLast - 是否跳过末尾仍可能继续写入的内容
         * @returns {void}
         */
        function renderEquationElement(container, equationEl, displayMode, skipLast) {
            if (!equationEl || equationEl.hasAttribute('data-katex')) return;
            if (skipLast && !hasFollowingRenderedNode(container, equationEl)) return;
            const tex = equationEl.textContent || '';
            if (!tex.trim()) return;
            const mathEl = createMathRenderElement(tex, displayMode);
            if (mathEl) {
                equationEl.replaceWith(mathEl);
            }
        }

        /**
         * 【流式渲染/系统】【公式渲染】按候选成功后替换的方式渲染数学公式
         * @param {HTMLElement} container - 待渲染的 DOM 容器
         * @param {boolean} skipLast - 是否跳过末尾仍可能继续写入的内容
         * @returns {void}
         */
        function renderMath(container, skipLast = false) {
            if (!container || !window.katex) return;
            // 1. 先处理 streaming-markdown 生成的公式元素
            Array.from(container.querySelectorAll('equation-inline:not([data-katex])')).forEach(el => {
                renderEquationElement(container, el, false, skipLast);
            });
            Array.from(container.querySelectorAll('equation-block:not([data-katex])')).forEach(el => {
                renderEquationElement(container, el, true, skipLast);
            });

            // 2. 再处理 marked 路径残留在文本节点中的公式定界符
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    return canRenderMathTextNode(container, node, skipLast)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            });
            const textNodes = [];
            let node = walker.nextNode();
            while (node) {
                textNodes.push(node);
                node = walker.nextNode();
            }
            textNodes.forEach(renderMathTextNode);
        }
