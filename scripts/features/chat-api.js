        // ============================================================
        //  API 请求 & AI 响应处理
        // ============================================================
        // 全局中止控制器与响应状态
        let currentAbortController = null;
        let isResponding = false;
        let shouldAutoScroll = true;
        let isProgrammaticChatScroll = false;
        let chatScrollUnlockTimer = null;
        let touchScrollStartY = null;

        /**
         * 【聊天/滚动控制】【底部检测】判断聊天容器是否处于底部附近
         * @param {number} [threshold=80] - 距离底部小于该像素值时视为在底部
         * @returns {boolean} - 是否处于底部附近
         */
        function isChatAtBottom(threshold = 80) {
            if (!chatContainer) return true;
            return chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight <= threshold;
        }

        /**
         * 【聊天/滚动控制】【自动滚动】在自动滚动未锁定时请求滚动到底部
         * @param {ScrollBehavior} [behavior='auto'] - 滚动行为
         * @returns {void}
         */
        function requestChatAutoScroll(behavior = 'auto') {
            if (!chatContainer || !shouldAutoScroll) return;
            requestAnimationFrame(() => {
                // 1. 用户可能在 requestAnimationFrame 执行前已经向上滚动，此时必须放弃自动滚动
                if (!shouldAutoScroll || !chatContainer) return;
                isProgrammaticChatScroll = true;
                if (behavior === 'smooth') {
                    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
                } else {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                clearTimeout(chatScrollUnlockTimer);
                chatScrollUnlockTimer = setTimeout(() => {
                    isProgrammaticChatScroll = false;
                    updateScrollDownBtnVisibility();
                }, behavior === 'smooth' ? 420 : 120);
            });
        }

        /**
         * 【聊天/滚动控制】【恢复跟随】恢复自动跟随输出并滚动到底部
         * @param {ScrollBehavior} [behavior='auto'] - 滚动行为
         * @returns {void}
         */
        function enableChatAutoScroll(behavior = 'auto') {
            shouldAutoScroll = true;
            requestChatAutoScroll(behavior);
            updateScrollDownBtnVisibility();
        }

        /**
         * 【聊天/滚动控制】【用户锁定】用户主动查看历史内容时停止自动跟随输出
         * @returns {void}
         */
        function lockChatAutoScroll() {
            if (!isResponding) return;
            shouldAutoScroll = false;
            updateScrollDownBtnVisibility();
        }

        // 发送按钮点击：响应中则中止，否则发送
        function onSendClick() {
            if (isResponding) {
                if (currentAbortController) currentAbortController.abort();
                return;
            }
            sendMessage();
        }

        // 设置发送按钮为响应中状态（显示停止图标）
        function setResponding(v) {
            isResponding = v;
            updateSendBtnState();
        }

        // 根据输入内容和响应状态更新发送按钮样式
        function updateSendBtnState() {
            const btn = document.getElementById('sendBtn');
            if (!btn) return;
            if (isResponding) {
                btn.classList.add('responding');
                btn.classList.remove('disabled');
                btn.disabled = false;
            } else {
                btn.classList.remove('responding');
                const hasContent = userInput.value.trim().length > 0 || pendingFiles.length > 0;
                if (hasContent) { btn.classList.remove('disabled'); btn.disabled = false; }
                else { btn.classList.add('disabled'); btn.disabled = true; }
            }
        }

        /**
         * 【网络搜索/TinyFish】【显示面板】展开或折叠网络搜索详情侧边栏并持久化状态
         * @param {boolean} show - 是否显示
         */
        function toggleSearchSidebar(show) {
            const sidebar = document.getElementById('searchSidebar');
            if (!sidebar) return;
            if (show) {
                sidebar.classList.remove('hidden');
                localStorage.setItem('searchSidebarExpanded', 'true');
            } else {
                sidebar.classList.add('hidden');
                localStorage.setItem('searchSidebarExpanded', 'false');
            }
            // 【网络搜索/TinyFish】【显示面板】更新输入框旁的详情面板按钮状态
            const toggleBtn = document.getElementById('searchPanelToggle');
            if (toggleBtn) {
                if (show) {
                    toggleBtn.classList.add('active');
                } else {
                    toggleBtn.classList.remove('active');
                }
            }
        }

        /**
         * 【网络搜索/TinyFish】【显示面板】手动点击输入框旁的详情面板按钮时的展开/隐藏响应
         * @returns {void}
         */
        function handleSearchPanelClick() {
            const sidebar = document.getElementById('searchSidebar');
            if (sidebar) {
                const isHidden = sidebar.classList.contains('hidden');
                toggleSearchSidebar(isHidden);
            }
        }

        /**
         * 【网络搜索/TinyFish】【清空面板】清空网络搜索侧边栏的内容
         */
        function clearSearchProcess() {
            const contentDiv = document.getElementById('searchSidebarContent');
            if (contentDiv) {
                contentDiv.innerHTML = '<div class="search-sidebar-empty">当前会话未触发网络搜索。</div>';
            }
        }

        /**
         * 【网络搜索/TinyFish】【渲染状态】向网络搜索侧边栏中追加详细流程卡片
         * @param {string} toolName - 工具名称
         * @param {string} title - 卡片标题
         * @param {string} detail - 详细说明文本
         * @param {Array} results - 搜索网页结果列表
         * @param {boolean} isError - 是否为错误状态
         * @param {Array} urlDetails - 抓取详情列表
         */
        /**
         * 【网络搜索/TinyFish】【渲染状态】向网络搜索侧边栏中追加详细流程卡片
         * @param {string} toolName - 工具名称
         * @param {string} title - 卡片标题
         * @param {string} detail - 详细说明文本
         * @param {Array} results - 搜索网页结果列表
         * @param {boolean} isError - 是否为错误状态
         * @param {Array} urlDetails - 抓取详情列表
         * @param {boolean} silent - 是否为静默模式，若为 true 则不自动展开侧边栏
         */
        function appendSearchProcessCard(toolName, title, detail, results = null, isError = false, urlDetails = null, silent = false) {
            // 【网络搜索/TinyFish】【渲染状态】如果不为静默模式，确保右侧栏展开
            if (!silent) {
                toggleSearchSidebar(true);
            }

            const contentDiv = document.getElementById('searchSidebarContent');
            if (!contentDiv) return;

            // 如果存在空提示，清除它
            const emptyEl = contentDiv.querySelector('.search-sidebar-empty');
            if (emptyEl) {
                contentDiv.innerHTML = '';
            }

            const card = document.createElement('div');
            card.className = 'search-step-card';
            if (isError) {
                card.style.borderColor = '#e06c75';
                card.style.background = 'rgba(224, 108, 117, 0.05)';
            }

            // 卡片头部
            let iconSvg = '';
            if (toolName === 'web_search') {
                iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-main);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
            } else {
                iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-main);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
            }

            card.innerHTML = `
                <div class="search-step-title">
                    ${iconSvg}
                    <span>${escapeHtml(title)}</span>
                </div>
                <div class="search-step-detail">${escapeHtml(detail)}</div>
            `;

            // 如果有搜索结果列表
            if (results && results.length > 0) {
                const listDiv = document.createElement('div');
                listDiv.className = 'search-step-url-list';
                results.forEach((r, idx) => {
                    const item = document.createElement('div');
                    item.className = 'search-step-url-item';
                    item.innerHTML = `
                        <a href="${escapeHtml(r.url)}" target="_blank" class="search-step-url-link">${idx + 1}. [${escapeHtml(r.site_name || '链接')}] ${escapeHtml(r.title)}</a>
                        <span class="search-step-url-status">位置 ${r.position || idx + 1}</span>
                    `;
                    listDiv.appendChild(item);
                });
                card.appendChild(listDiv);
            }

            // 如果有抓取详情列表
            if (urlDetails && urlDetails.length > 0) {
                const listDiv = document.createElement('div');
                listDiv.className = 'search-step-url-list';
                urlDetails.forEach((ud, idx) => {
                    const item = document.createElement('div');
                    item.className = 'search-step-url-item';
                    const lenText = ud.length > 0 ? ` (${ud.length} 字符)` : '';
                    item.innerHTML = `
                        <a href="${escapeHtml(ud.url)}" target="_blank" class="search-step-url-link" style="max-width: 75%;">${idx + 1}. ${escapeHtml(ud.title || ud.url)}</a>
                        <span class="search-step-url-status" style="color: ${ud.status === '成功' ? '#98c379' : '#e06c75'}">${escapeHtml(ud.status)}${lenText}</span>
                    `;
                    listDiv.appendChild(item);
                });
                card.appendChild(listDiv);
            }

            contentDiv.appendChild(card);
            // 滚动到底部
            requestAnimationFrame(() => { contentDiv.scrollTop = contentDiv.scrollHeight; });
        }

        /**
         * 【网络搜索/TinyFish】【恢复历史】根据会话消息历史重新渲染右侧网络搜索侧边栏
         * @returns {void}
         */
        function restoreSearchProcess() {
            clearSearchProcess();
            const session = sessions.find(s => s.id === getCurrentId());
            if (!session || !session.messages || session.messages.length === 0) {
                toggleSearchSidebar(false);
                return;
            }

            // 【网络搜索/TinyFish】【恢复历史】1. 筛选出当前会话中所有的工具执行返回消息
            const toolMsgs = session.messages.filter(m => m.role === 'tool');
            if (toolMsgs.length === 0) {
                toggleSearchSidebar(false);
                return;
            }

            let hasValidSearch = false;
            
            toolMsgs.forEach(toolMsg => {
                // 【网络搜索/TinyFish】【恢复历史】2. 寻找前置 assistant 消息中的工具调用定义以提取调用参数
                const relatedAssistant = session.messages.find(m => 
                    m.role === 'assistant' && 
                    m.tool_calls && 
                    m.tool_calls.some(tc => tc.id === toolMsg.tool_call_id)
                );
                if (!relatedAssistant) return;
                
                const toolCall = relatedAssistant.tool_calls.find(tc => tc.id === toolMsg.tool_call_id);
                if (!toolCall) return;

                let args = {};
                try {
                    args = typeof toolCall.function.arguments === 'string' 
                        ? JSON.parse(toolCall.function.arguments) 
                        : toolCall.function.arguments;
                } catch(e) {}

                let results = null;
                try {
                    results = JSON.parse(toolMsg.content);
                } catch(e) {}

                // 【网络搜索/TinyFish】【恢复历史】3. 根据工具名称静默向侧边栏追加对应的卡片
                if (toolMsg.name === 'web_search') {
                    const query = args.query || '';
                    const detailText = results && results.length > 0 
                        ? `检索到 ${results.length} 条网页记录：` 
                        : '未找到相关结果';
                    appendSearchProcessCard('web_search', `执行搜索: "${query}"`, detailText, results, false, null, true);
                    hasValidSearch = true;
                } else if (toolMsg.name === 'fetch_webpage') {
                    const urls = args.urls || [args.url].filter(Boolean) || [];
                    const pages = Array.isArray(results) ? results : [];
                    const processedPages = urls.map(u => {
                        const p = pages.find(page => page.url === u || page.final_url === u);
                        return {
                            url: u,
                            title: p ? p.title : '未知标题',
                            status: p && p.text ? '成功' : '失败',
                            length: p && p.text ? p.text.length : 0
                        };
                    });
                    appendSearchProcessCard('fetch_webpage', '提取网页正文', '成功抓取到网页正文：', null, false, processedPages, true);
                    hasValidSearch = true;
                }
            });

            // 【网络搜索/TinyFish】【恢复历史】4. 如果开启了网络搜索，则显示详情切换按钮并恢复上次的展开/折叠状态
            const toggleBtn = document.getElementById('searchPanelToggle');
            if (webSearchSettings.enabled) {
                if (toggleBtn) toggleBtn.style.display = 'inline-flex';
                const isExpanded = localStorage.getItem('searchSidebarExpanded') !== 'false';
                toggleSearchSidebar(isExpanded);
            } else {
                if (toggleBtn) toggleBtn.style.display = 'none';
                toggleSearchSidebar(false);
            }
        }

        /**
         * 【网络搜索/TinyFish】【执行搜索】通过 TinyFish 接口检索网络内容并返回链接和摘要
         * @param {string} query - 搜索关键词
         * @returns {Promise<Array>} - 搜索结果列表
         */
        async function performWebSearchOnly(query) {
            const s = webSearchSettings;
            if (!s.apiKey) {
                throw new Error('未配置 TinyFish API Key');
            }
            
            // 【网络搜索/TinyFish】【执行搜索】1. 更新右侧面板状态
            appendSearchProcessCard('web_search', `执行搜索: "${query}"`, '正在发起搜索请求...');

            const searchUrl = `${s.apiUrl.replace(/\/+$/, '')}/v1/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(s.location)}&language=${encodeURIComponent(s.language)}`;
            const searchRes = await fetch(searchUrl, {
                headers: {
                    'X-API-Key': s.apiKey,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!searchRes.ok) {
                const errMsg = `搜索失败 (HTTP ${searchRes.status})`;
                appendSearchProcessCard('web_search', `执行搜索: "${query}"`, errMsg, null, true);
                throw new Error(errMsg);
            }
            
            const searchData = await searchRes.json();
            const results = searchData.results || [];
            
            // 【网络搜索/TinyFish】【执行搜索】2. 渲染结果列表
            const detailText = results.length > 0 
                ? `检索到 ${results.length} 条网页记录：` 
                : '未找到相关结果';
            appendSearchProcessCard('web_search', `执行搜索: "${query}"`, detailText, results);
            
            return results;
        }

        /**
         * 【网络搜索/TinyFish】【执行抓取】通过 TinyFish 接口抓取指定网页列表的正文
         * @param {Array<string>} urls - 网页链接列表
         * @returns {Promise<Array>} - 抓取的正文数据列表
         */
        async function performWebpageFetchOnly(urls) {
            const s = webSearchSettings;
            if (!s.apiKey) {
                throw new Error('未配置 TinyFish API Key');
            }
            
            // 【网络搜索/TinyFish】【执行抓取】1. 更新右侧面板状态
            appendSearchProcessCard('fetch_webpage', '提取网页正文', `正在发起内容提取请求...`);

            let pages = [];
            try {
                const fetchRes = await fetch(`${s.apiUrl.replace(/\/+$/, '')}/v1/fetch`, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': s.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        urls: urls,
                        format: 'markdown'
                    })
                });
                if (fetchRes.ok) {
                    const fetchData = await fetchRes.json();
                    pages = fetchData.results || [];
                } else {
                    throw new Error(`提取失败 (HTTP ${fetchRes.status})`);
                }
            } catch(e) {
                console.error('【网络搜索/TinyFish】【网页抓取】内容抓取失败: ', e);
                appendSearchProcessCard('fetch_webpage', '提取网页正文', `抓取过程中出现异常: ${e.message}`, null, true);
                throw e;
            }

            // 【网络搜索/TinyFish】【执行抓取】2. 渲染抓取结果
            const processedPages = urls.map(u => {
                const p = pages.find(page => page.url === u || page.final_url === u);
                return {
                    url: u,
                    title: p ? p.title : '未知标题',
                    status: p && p.text ? '成功' : '失败',
                    length: p && p.text ? p.text.length : 0
                };
            });

            appendSearchProcessCard('fetch_webpage', '提取网页正文', '成功抓取到网页正文：', null, false, processedPages);
            return pages;
        }

        /**
         * 【AI响应/系统】【对话生成】向模型发起对话请求并流式/非流式获取回复，支持智能代理网络搜索工具的自主调用
         * @returns {Promise<void>}
         */
        async function fetchAIResponse() {
            const provider = getActiveProvider();
            if (!provider) { setResponding(false); return; }

            const currentSession = sessions.find(s => s.id === getCurrentId());
            enableChatAutoScroll();

            const preset = getActivePreset();
            // 【AI响应/系统】【对话生成】fakeThought 为特殊标记，appendMessageDOM 检测后显示思考中动效
            const fakeThought = '__thinking__';
            const msgIdx = currentSession.messages.length;
            const aiMessageElement = appendMessageDOM('assistant', '', fakeThought, null, null, msgIdx);

            let finalReplyText = '';
            let finalThoughtText = '';
            let finalMetrics = null;

            try {
                currentAbortController = new AbortController();
                setResponding(true);

                // 【AI响应/系统】【对话生成】初始化消息历史与工具列表
                let messages = [...currentSession.messages];
                if (preset && preset.systemPrompt) {
                    messages = [{ role: 'system', content: preset.systemPrompt }, ...messages];
                }

                const useStream = preset ? preset.stream : false;
                let loopCount = 0;
                const maxLoops = 5;

                // 【AI响应/系统】【工具定义】声明供 AI 自主调用的 TinyFish 搜索与抓取工具
                const searchTools = [
                    {
                        type: "function",
                        function: {
                            name: "web_search",
                            description: "【网络搜索/TinyFish】搜索互联网以获取网页的最新链接和摘要，包含标题、网址、位置等信息",
                            parameters: {
                                type: "object",
                                properties: {
                                    query: {
                                        type: "string",
                                        description: "搜索查询关键词"
                                    }
                                },
                                required: ["query"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "fetch_webpage",
                            description: "【网络搜索/TinyFish】从给定的 URL 列表中提取并返回 Markdown 格式的网页正文内容，便于细致阅读与分析",
                            parameters: {
                                type: "object",
                                properties: {
                                    urls: {
                                        type: "array",
                                        items: {
                                            type: "string"
                                        },
                                        description: "要抓取的网页链接 URL 数组列表"
                                    }
                                },
                                required: ["urls"]
                            }
                        }
                    }
                ];

                while (loopCount < maxLoops) {
                    const metricsTracker = createChatMetricsTracker();
                    const chatRequest = buildProviderChatRequest({
                        provider,
                        model: activeModel,
                        messages,
                        stream: useStream,
                        preset,
                        thinkingLevel,
                        webSearchEnabled: webSearchSettings.enabled,
                        searchTools
                    });

                    // 【AI响应/系统】【请求模型】发起大模型聊天对话接口请求
                    const response = await fetch(chatRequest.url, {
                        method: 'POST',
                        headers: chatRequest.headers,
                        body: JSON.stringify(chatRequest.body),
                        signal: currentAbortController?.signal
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        let errMsg = `HTTP 状态码 ${response.status}`;
                        try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch(e) {}
                        throw new Error(errMsg);
                    }

                    let aiReply = '', realThought = null, toolCalls = [], responseMetrics = null, responseProtocolState = null;
                    if (useStream && response.body) {
                        // 【AI响应/系统】【读取响应】流式读取 SSE 响应数据并提取 tool_calls 列表
                        const r = await readSSEStream(response.body, aiMessageElement, chatRequest.protocol, metricsTracker);
                        aiReply = r.content;
                        realThought = r.thought || null;
                        toolCalls = r.toolCalls || [];
                        responseMetrics = r.metrics || completeChatMetrics(metricsTracker, aiReply || realThought || '');
                    } else {
                        // 【AI响应/系统】【读取响应】非流式直接读取响应体并提取 tool_calls 列表
                        const data = await response.json();
                        const parsed = parseProviderChatResponse(chatRequest.protocol, data);
                        aiReply = parsed.content || '';
                        realThought = parsed.thought || null;
                        toolCalls = parsed.toolCalls || [];
                        responseProtocolState = parsed.protocolState || null;
                        markChatMetricFirstToken(metricsTracker, aiReply || realThought || (toolCalls.length > 0 ? 'tool_calls' : ''));
                        appendChatMetricOutput(metricsTracker, aiReply || realThought || '');
                        responseMetrics = completeChatMetrics(metricsTracker, aiReply || realThought || '');
                    }

                    // 【AI响应/系统】【工具决策】判断 AI 是否决策并生成了工具调用请求
                    if (toolCalls && toolCalls.length > 0) {
                        // 【AI响应/系统】【工具执行】大模型决策发起工具调用，将 assistant 消息与调用信息追加至会话历史中
                        const assistantMsg = {
                            role: "assistant",
                            content: aiReply || null,
                            tool_calls: toolCalls,
                            model: activeModel,
                            presetId: activePresetId
                        };
                        if (chatRequest.protocol === 'openai' && isDeepSeekProvider(provider, activeModel) && realThought) {
                            assistantMsg.reasoning_content = realThought;
                        }
                        attachProtocolStateToAssistantMessage(assistantMsg, chatRequest.protocol, responseProtocolState);
                        messages.push(assistantMsg);
                        currentSession.messages.push(assistantMsg);

                        // 【AI响应/系统】【工具执行】遍历并并发或依次执行所有发起的工具调用
                        for (const tool of toolCalls) {
                            let resultStr = '';
                            try {
                                let args = tool.function.arguments;
                                if (typeof args === 'string') {
                                    args = JSON.parse(args);
                                }
                                if (tool.function.name === 'web_search') {
                                    const query = args.query;
                                    const results = await performWebSearchOnly(query);
                                    resultStr = JSON.stringify(results);
                                } else if (tool.function.name === 'fetch_webpage') {
                                    const urls = args.urls || [args.url].filter(Boolean);
                                    const pages = await performWebpageFetchOnly(urls);
                                    resultStr = JSON.stringify(pages);
                                } else {
                                    resultStr = "未知的工具名称";
                                }
                            } catch (err) {
                                resultStr = `工具执行失败: ${err.message}`;
                            }

                            // 【AI响应/系统】【工具执行】将工具调用的执行返回结果追加至会话历史中
                            const toolMsg = {
                                role: "tool",
                                tool_call_id: tool.id,
                                name: tool.function.name,
                                content: resultStr
                            };
                            messages.push(toolMsg);
                            currentSession.messages.push(toolMsg);
                        }

                        saveSessionsToStorage();
                        loopCount++;
                        
                        // 【AI响应/系统】【工具执行】更新聊天气泡中的过渡状态文字
                        aiMessageElement.innerHTML = `<span style="color:var(--text-muted);font-size:13px;display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> 搜索完毕，正在解析数据并生成回答...</span>`;
                        continue;
                    }

                    // 【AI响应/系统】【对话生成】大模型未决策工具调用，代表生成最终回答，跳出循环
                    finalReplyText = aiReply;
                    finalThoughtText = realThought || '';
                    finalMetrics = responseMetrics;
                    break;
                }

                // 【AI响应/系统】【保存消息】将大模型最终文本输出追加至消息列表中并保存
                currentSession.messages.push({
                    role: "assistant",
                    content: finalReplyText,
                    thought: finalThoughtText,
                    model: activeModel,
                    presetId: activePresetId,
                    metrics: finalMetrics
                });

                if (pendingVersions !== null) {
                    currentSession.messages[currentSession.messages.length - 1].versions = pendingVersions;
                    pendingVersions = null;
                }

                saveSessionsToStorage();
                renderChatArea();

            } catch (error) {
                // 【AI响应/系统】【对话生成】捕获生成异常并做出容错处理
                if (error.name === 'AbortError') {
                    if (finalReplyText || finalThoughtText) {
                        currentSession.messages.push({ role: "assistant", content: finalReplyText || '(已中止)', thought: finalThoughtText || '', model: activeModel, presetId: activePresetId, metrics: finalMetrics });
                        pendingVersions = null;
                        saveSessionsToStorage();
                    }
                    renderChatArea();
                    return;
                }
                const msg = error.message || '';
                if (msg.toLowerCase().includes('image') || msg.includes('图片')) {
                    // 【AI响应/系统】【对话生成】容错处理：当模型不支持图片时，过滤图片字段后重试
                    let filtered = false;
                    currentSession.messages.forEach(m => {
                        if (m.role === 'user' && Array.isArray(m.content)) {
                            const textOnly = m.content.filter(c => c.type === 'text');
                            if (textOnly.length === 1) m.content = textOnly[0].text;
                            else if (textOnly.length === 0) m.content = '';
                            else m.content = textOnly;
                            filtered = true;
                        }
                    });
                    if (filtered) {
                        saveSessionsToStorage();
                        const tipMsg = '提示：该模型不支持图片输入，已自动转为纯文字发送';
                        currentSession.messages.push({ role: "assistant", content: tipMsg, presetId: activePresetId });
                        saveSessionsToStorage();
                        renderChatArea();
                        setTimeout(() => fetchAIResponse(), 100);
                    } else {
                        const errMsg = '该模型不支持图片输入，请移除图片或切换到支持多模态的模型后重试。';
                        currentSession.messages.push({ role: "assistant", content: errMsg, presetId: activePresetId });
                        pendingVersions = null;
                        saveSessionsToStorage();
                        renderChatArea();
                    }
                } else {
                    const errFull = `请求失败: ${msg}`;
                    currentSession.messages.push({ role: "assistant", content: errFull, presetId: activePresetId });
                    pendingVersions = null;
                    saveSessionsToStorage();
                    renderChatArea();
                }
            } finally {
                currentAbortController = null;
                setResponding(false);
                // 【AI响应/系统】【对话生成】滚动容器到聊天底部（受自动滚动标志控制）
                if (shouldAutoScroll) {
                    requestChatAutoScroll();
                }
            }
        }
