        // ============================================================
        //  SSE 流式读取
        // ============================================================
        /**
         * 【流式渲染/系统】【协议读取】读取 SSE 流并统一累积正文、思考过程和工具调用
         * @param {ReadableStream} body - 响应流
         * @param {HTMLElement} el - 正文展示元素
         * @param {string} [protocol='openai'] - 供应商协议
         * @param {Object|null} [metricsTracker=null] - 响应指标跟踪器
         * @returns {Promise<Object>} - 原始 Markdown 文本、思考文本、工具调用与响应指标
         */
        async function readSSEStream(body, el, protocol = 'openai', metricsTracker = null) {
            const reader = body.getReader();
            const decoder = new TextDecoder();
            let full = '', thoughtFull = '', buf = '';
            let toolCalls = []; // 【网络搜索/TinyFish】【智能代理】收集流式 tool_calls 增量
            // 1.定位思考过程展示元素与容器
            const thoughtEl = el.closest('.message-block')?.querySelector('.thought-content');
            const thoughtProcessEl = el.closest('.message-block')?.querySelector('.thought-process');
            let thoughtStarted = false;
            let shouldThoughtAutoScroll = true;
            let thoughtStartAt = null;
            let thoughtEndAt = null;
            let thoughtSettled = false;
            let contentStarted = false;
            // 2.创建流式 markdown 解析器：正文与思考各一个
            const useSmd = !!window.smd;
            let contentParser = null, thoughtParser = null;
            if (useSmd) {
                contentParser = window.smd.parser(window.smd.default_renderer(el));
                if (thoughtEl) thoughtParser = window.smd.parser(window.smd.default_renderer(thoughtEl));
            } else {
                // 回退：纯文本需要保留换行
                el.style.whiteSpace = 'pre-wrap';
                if (thoughtEl) thoughtEl.style.whiteSpace = 'pre-wrap';
            }

            // 思考内容自动滚动：用户滚动离开底部时关闭，回到底部时开启
            if (thoughtEl) {
                thoughtEl.addEventListener('scroll', () => {
                    const atBottom = thoughtEl.scrollHeight - thoughtEl.scrollTop - thoughtEl.clientHeight <= 30;
                    shouldThoughtAutoScroll = atBottom;
                });
            }

            // 思考结束：把"思考中"动效替换为"思考过程(用时xx)"
            function settleThoughtBar() {
                if (thoughtSettled || !thoughtStarted || !thoughtProcessEl) return;
                thoughtSettled = true;
                thoughtEndAt = performance.now();
                const durationText = formatThoughtDuration(thoughtEndAt - thoughtStartAt);
                const bar = thoughtProcessEl.querySelector('.thought-bar');
                if (bar) bar.innerHTML = `<span class="thought-label">思考过程(${durationText})</span><svg class="thought-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            }

            // 动态指标标签：创建（如不存在）并启动定时更新
            const actionsEl = el.closest('.message-block')?.querySelector('.message-actions');
            let metricsTag = actionsEl?.querySelector('.msg-metrics-tag');
            if (!metricsTag && actionsEl) {
                metricsTag = document.createElement('span');
                metricsTag.className = 'msg-metrics-tag';
                const modelTag = actionsEl.querySelector('.msg-model-tag');
                if (modelTag) modelTag.after(metricsTag);
                else actionsEl.appendChild(metricsTag);
            }
            const metricsTimer = setInterval(() => {
                if (!metricsTag || !metricsTracker) return;
                const elapsed = performance.now() - metricsTracker.startedAt;
                if (!metricsTracker.firstTokenAt) {
                    metricsTag.textContent = `首字 ${formatMetricDuration(Math.round(elapsed))}`;
                } else {
                    const firstMs = Math.round(metricsTracker.firstTokenAt - metricsTracker.startedAt);
                    const genMs = performance.now() - metricsTracker.firstTokenAt;
                    const charCount = (metricsTracker.outputText || '').length;
                    const tokens = estimateTokenCount(metricsTracker.outputText);
                    const tps = genMs > 0 ? Number((tokens / (genMs / 1000)).toFixed(1)) : 0;
                    metricsTag.textContent = `首字 ${formatMetricDuration(firstMs)} · ${charCount}字 · 约 ${tps} token/s`;
                }
            }, 200);

            // 3.流式增强节流：每 600ms 对已完成代码块补充渲染一次
            let lastHighlightTime = 0;
            let contentRenderedFenceCount = 0;
            let thoughtRenderedFenceCount = 0;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const payload = line.slice(6).trim();
                        if (!payload || payload === '[DONE]') continue;
                        try {
                            const deltaObj = parseProviderStreamChunk(protocol, JSON.parse(payload));
                            if (!deltaObj) continue;
                            // 4.累积并增量渲染思考内容
                            if (deltaObj.thought) {
                                markChatMetricFirstToken(metricsTracker, deltaObj.thought);
                                // 首次收到思考内容时：标签从"请求中"改为"思考中"，保留跳动点动效
                                if (!thoughtStarted) {
                                    thoughtStarted = true;
                                    thoughtStartAt = performance.now();
                                    if (thoughtEl) thoughtEl.innerHTML = '';
                                    if (thoughtProcessEl) {
                                        thoughtProcessEl.classList.add('thinking');
                                        // 更新 bar：标签从"请求中"改为"思考中"，保留跳动点动效
                                        const bar = thoughtProcessEl.querySelector('.thought-bar');
                                        if (bar) bar.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span><span class="thought-label">思考中</span>';
                                    }
                                }
                                thoughtFull += deltaObj.thought;
                                if (thoughtEl) {
                                    thoughtEl.setAttribute('data-raw', thoughtFull);
                                    if (thoughtParser) {
                                        window.smd.parser_write(thoughtParser, unwrapMathFromCode(deltaObj.thought));
                                        // 【流式渲染/系统】【眉头优先】写入后立即渲染代码块外壳，避免内容先于眉头出现
                                        renderCodeBlockShells(thoughtEl, true);
                                    } else {
                                        thoughtEl.textContent = thoughtFull;
                                    }
                                    if (shouldRenderClosedCodeFence(thoughtFull, thoughtRenderedFenceCount)) {
                                        thoughtRenderedFenceCount = getCodeFenceCount(thoughtFull);
                                        renderCompletedMarkdownBlocks(thoughtEl, true);
                                    }
                                    // 思考内容自动滚动到底部
                                    if (shouldThoughtAutoScroll) {
                                        thoughtEl.scrollTop = thoughtEl.scrollHeight;
                                    }
                                }
                            }
                            // 5.累积并增量渲染正文内容
                            if (deltaObj.content) {
                                markChatMetricFirstToken(metricsTracker, deltaObj.content);
                                appendChatMetricOutput(metricsTracker, deltaObj.content);
                                // 思考→正文切换：首次收到正文时，结算思考状态
                                if (!contentStarted) {
                                    contentStarted = true;
                                    if (thoughtProcessEl) {
                                        if (!thoughtStarted) {
                                            thoughtProcessEl.remove();
                                        } else {
                                            settleThoughtBar();
                                        }
                                    }
                                }
                                full += deltaObj.content;
                                el.setAttribute('data-raw', full);
                                if (contentParser) {
                                    window.smd.parser_write(contentParser, unwrapMathFromCode(deltaObj.content));
                                    // 【流式渲染/系统】【眉头优先】写入后立即渲染代码块外壳，避免内容先于眉头出现
                                    renderCodeBlockShells(el, true);
                                } else {
                                    el.textContent = full;
                                }
                                if (shouldRenderClosedCodeFence(full, contentRenderedFenceCount)) {
                                    contentRenderedFenceCount = getCodeFenceCount(full);
                                    renderCompletedMarkdownBlocks(el, true);
                                }
                            }
                            // 【网络搜索/TinyFish】【智能代理】收集流式 tool_calls 增量数据
                            if (deltaObj.toolCallsDelta && deltaObj.toolCallsDelta.length > 0) {
                                deltaObj.toolCallsDelta.forEach(tc => {
                                    const idx = Number.isInteger(tc.index) ? tc.index : toolCalls.length;
                                    if (!toolCalls[idx]) {
                                        toolCalls[idx] = {
                                            id: tc.id || '',
                                            type: tc.type || 'function',
                                            function: {
                                                name: tc.function?.name || '',
                                                arguments: tc.function?.arguments || ''
                                            }
                                        };
                                    } else {
                                        if (tc.id) toolCalls[idx].id = tc.id;
                                        if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                                        if (tc.function?.arguments) {
                                            if (tc.argumentsDone) {
                                                toolCalls[idx].function.arguments = tc.function.arguments;
                                            } else {
                                                toolCalls[idx].function.arguments += tc.function.arguments;
                                            }
                                        }
                                    }
                                });
                            }
                        } catch(e) {}
                    }
                    // 【流式渲染/系统】【增量渲染】6. 增量渲染节流：每 600ms 对已闭合的代码高亮、数学公式与 Mermaid 视图进行中途渲染
                    const now = Date.now();
                    if (useSmd && now - lastHighlightTime > 600) {
                        lastHighlightTime = now;
                        renderCompletedMarkdownBlocks(el, true);
                        if (thoughtEl) {
                            renderCompletedMarkdownBlocks(thoughtEl, true);
                        }
                    }
                    // 流式输出时持续滚动到底部（受自动滚动标志控制）
                    if (shouldAutoScroll) {
                        requestChatAutoScroll();
                    }
                }
            } catch(streamErr) {
                // abort 或其他错误：确保已收集内容能返回
                if (streamErr.name !== 'AbortError') throw streamErr;
            }
            // 7.结束流，刷新剩余未闭合的 markdown 标记
            clearInterval(metricsTimer);
            if (contentParser) window.smd.parser_end(contentParser);
            if (thoughtParser) window.smd.parser_end(thoughtParser);
            // 【流式渲染/系统】【思考清除】8. 结束流后，结算思考状态
            if (thoughtProcessEl) {
                if (!thoughtStarted) {
                    thoughtProcessEl.remove();
                } else {
                    settleThoughtBar();
                    thoughtProcessEl.classList.remove('thinking');
                }
            }
            // 9.流结束后最终代码高亮、数学公式与 Mermaid 渲染（含最后一个代码块）
            renderCompletedMarkdownBlocks(el);
            if (thoughtEl) {
                renderCompletedMarkdownBlocks(thoughtEl);
            }
            return { content: full, thought: thoughtFull, toolCalls: toolCalls.filter(Boolean), metrics: completeChatMetrics(metricsTracker, full || thoughtFull), thoughtDurationMs: (thoughtStartAt && thoughtEndAt) ? Math.round(thoughtEndAt - thoughtStartAt) : null };
        }
