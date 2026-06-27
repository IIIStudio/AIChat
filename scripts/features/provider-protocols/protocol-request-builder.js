        // ============================================================
        //  供应商协议 — 请求构造
        // ============================================================
        /**
         * 【供应商协议/消息转换】【文本提取】把消息内容提取为纯文本
         * @param {string|Array} content - 原始消息内容
         * @returns {string} - 提取后的文本
         */
        function extractMessageText(content) {
            if (Array.isArray(content)) {
                return content
                    .filter(item => item && item.type === 'text')
                    .map(item => item.text || '')
                    .join('\n');
            }
            return typeof content === 'string' ? content : String(content || '');
        }

        /**
         * 【供应商协议/消息转换】【图片解析】从 data URL 中解析媒体类型和 base64 数据
         * @param {string} url - 图片 URL 或 data URL
         * @returns {Object|null} - 图片数据对象，无法解析时返回 null
         */
        function parseDataImageUrl(url) {
            const match = String(url || '').match(/^data:([^;]+);base64,(.+)$/);
            if (!match) return null;
            return { mimeType: match[1], data: match[2] };
        }

        /**
         * 【供应商协议/消息转换】【Responses 内容块】把通用消息内容转换为 Responses content 数组
         * @param {string} role - Responses 消息角色
         * @param {string|Array} content - 原始消息内容
         * @returns {Array<Object>} - Responses content 数组
         */
        function convertContentToOpenAIResponseParts(role, content) {
            const contentType = role === 'assistant' ? 'output_text' : 'input_text';
            const parts = [];
            if (!Array.isArray(content)) {
                const text = extractMessageText(content);
                if (text) parts.push({ type: contentType, text });
                return parts;
            }
            content.forEach(item => {
                // 1.文本内容按照消息角色转换为 Responses 支持的文本块
                if (item && item.type === 'text' && item.text) {
                    parts.push({ type: contentType, text: item.text });
                    return;
                }
                // 2.图片内容只允许放在用户消息中，保持 Responses API 的合法输入结构
                if (role === 'user' && item && item.type === 'image_url' && item.image_url?.url) {
                    parts.push({
                        type: 'input_image',
                        image_url: item.image_url.url
                    });
                }
            });
            return parts;
        }

        /**
         * 【供应商协议/消息转换】【Gemini 内容】把通用消息转换为 Gemini contents
         * @param {Array} messages - 通用消息列表
         * @returns {Object} - Gemini systemInstruction 与 contents
         */
        function convertMessagesToGemini(messages) {
            const systemParts = [];
            const contents = [];
            messages.forEach(msg => {
                if (msg.role === 'system') {
                    const text = extractMessageText(msg.content);
                    if (text) systemParts.push({ text });
                    return;
                }
                if (msg.role === 'tool') {
                    contents.push({
                        role: 'function',
                        parts: [{
                            functionResponse: {
                                name: msg.name || 'tool_result',
                                response: parseToolResultForGemini(msg.content || '')
                            }
                        }]
                    });
                    return;
                }
                if (msg.role === 'assistant' && msg.gemini_content) {
                    contents.push({
                        role: 'model',
                        parts: msg.gemini_content.parts || []
                    });
                    return;
                }
                const parts = [];
                if (Array.isArray(msg.content)) {
                    msg.content.forEach(item => {
                        if (item.type === 'text' && item.text) {
                            parts.push({ text: item.text });
                        } else if (item.type === 'image_url') {
                            const image = parseDataImageUrl(item.image_url?.url);
                            if (image) {
                                parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
                            }
                        }
                    });
                } else {
                    const text = extractMessageText(msg.content);
                    if (text) parts.push({ text });
                }
                if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
                    msg.tool_calls.forEach(toolCall => {
                        parts.push({
                            functionCall: {
                                name: toolCall.function?.name || '',
                                args: parseToolArgumentsObject(toolCall.function?.arguments)
                            }
                        });
                    });
                }
                if (parts.length === 0) return;
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts
                });
            });
            return {
                systemInstruction: systemParts.length > 0 ? { parts: systemParts } : null,
                contents
            };
        }

        /**
         * 【供应商协议/消息转换】【Anthropic 内容】把通用消息转换为 Anthropic messages
         * @param {Array} messages - 通用消息列表
         * @returns {Object} - Anthropic system 与 messages
         */
        function convertMessagesToAnthropic(messages) {
            const system = [];
            const converted = [];
            messages.forEach(msg => {
                if (msg.role === 'system') {
                    const text = extractMessageText(msg.content);
                    if (text) system.push(text);
                    return;
                }
                if (msg.role === 'tool') {
                    converted.push({
                        role: 'user',
                        content: [{
                            type: 'tool_result',
                            tool_use_id: msg.tool_call_id,
                            content: msg.content || ''
                        }]
                    });
                    return;
                }
                if (msg.role === 'assistant' && Array.isArray(msg.anthropic_content)) {
                    converted.push({
                        role: 'assistant',
                        content: msg.anthropic_content
                    });
                    return;
                }
                const content = [];
                if (Array.isArray(msg.content)) {
                    msg.content.forEach(item => {
                        if (item.type === 'text' && item.text) {
                            content.push({ type: 'text', text: item.text });
                        } else if (item.type === 'image_url') {
                            const image = parseDataImageUrl(item.image_url?.url);
                            if (image) {
                                content.push({
                                    type: 'image',
                                    source: { type: 'base64', media_type: image.mimeType, data: image.data }
                                });
                            }
                        }
                    });
                } else {
                    const text = extractMessageText(msg.content);
                    if (text) content.push({ type: 'text', text });
                }
                if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
                    msg.tool_calls.forEach(toolCall => {
                        content.push({
                            type: 'tool_use',
                            id: toolCall.id,
                            name: toolCall.function?.name || '',
                            input: parseToolArgumentsObject(toolCall.function?.arguments)
                        });
                    });
                }
                if (content.length === 0) return;
                converted.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content
                });
            });
            return { system: system.join('\n\n'), messages: converted };
        }

        /**
         * 【供应商协议/消息转换】【Responses 内容】把通用消息转换为 OpenAI Responses input
         * @param {Array} messages - 通用消息列表
         * @returns {Array} - Responses input 列表
         */
        function convertMessagesToOpenAIResponses(messages) {
            const input = [];
            messages.forEach(msg => {
                if (msg.role === 'system') return;
                if (Array.isArray(msg.openai_response_output)) {
                    msg.openai_response_output.forEach(item => input.push(item));
                    return;
                }
                if (msg.role === 'tool') {
                    input.push({
                        type: 'function_call_output',
                        call_id: msg.tool_call_id,
                        output: msg.content || ''
                    });
                    return;
                }
                if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
                    const content = convertContentToOpenAIResponseParts('assistant', msg.content);
                    if (content.length > 0) {
                        input.push({
                            type: 'message',
                            role: 'assistant',
                            content
                        });
                    }
                    msg.tool_calls.forEach(toolCall => {
                        input.push({
                            type: 'function_call',
                            call_id: toolCall.id,
                            name: toolCall.function?.name || '',
                            arguments: serializeToolArguments(toolCall.function?.arguments)
                        });
                    });
                    return;
                }
                const role = msg.role === 'assistant' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user');
                const content = convertContentToOpenAIResponseParts(role, msg.content);
                if (content.length === 0) return;
                input.push({
                    type: 'message',
                    role,
                    content
                });
            });
            return input;
        }

        /**
         * 【供应商协议/消息转换】【Responses 指令】提取系统消息作为 Responses 顶层 instructions
         * @param {Array} messages - 通用消息列表
         * @returns {string} - 合并后的系统指令
         */
        function extractOpenAIResponseInstructions(messages) {
            return (messages || [])
                .filter(msg => msg && msg.role === 'system')
                .map(msg => extractMessageText(msg.content))
                .filter(Boolean)
                .join('\n\n');
        }

        /**
         * 【供应商协议/请求构造】【基础参数】构造通用 OpenAI Chat 请求体
         * @param {Object} options - 请求上下文
         * @returns {Object} - OpenAI Chat 请求体
         */
        function buildOpenAIChatBody(options) {
            const body = {
                model: options.model,
                messages: options.messages,
                stream: options.stream,
                temperature: options.preset ? options.preset.temperature : 0.7,
                top_p: options.preset ? options.preset.top_p : 1,
                frequency_penalty: options.preset ? options.preset.frequency_penalty : 0,
                presence_penalty: options.preset ? options.preset.presence_penalty : 0
            };
            const tools = buildProtocolTools('openai', options.searchTools);
            if (options.webSearchEnabled && tools.length > 0) body.tools = tools;
            return body;
        }

        /**
         * 【供应商协议/请求构造】【OpenAI】构造 Chat Completions 请求
         * @param {Object} provider - 供应商配置
         * @param {Object} options - 请求上下文
         * @returns {Object} - 请求配置
         */
        function buildOpenAIChatRequest(provider, options) {
            const body = buildOpenAIChatBody(options);
            applyThinkingOptions(body, provider, 'openai', options.model, options.thinkingLevel);
            return {
                protocol: 'openai',
                url: normalizeApiUrl(provider.apiUrl),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${provider.apiKey || ''}`
                },
                body
            };
        }

        /**
         * 【供应商协议/请求构造】【OpenAI Responses】构造 Responses 请求
         * @param {Object} provider - 供应商配置
         * @param {Object} options - 请求上下文
         * @returns {Object} - 请求配置
         */
        function buildOpenAIResponseRequest(provider, options) {
            const baseUrl = stripApiUrlSuffixes(provider.apiUrl, ['/chat/completions', '/responses']);
            const instructions = extractOpenAIResponseInstructions(options.messages);
            const body = {
                model: options.model,
                input: convertMessagesToOpenAIResponses(options.messages),
                stream: options.stream
            };
            if (instructions) body.instructions = instructions;
            const tools = buildProtocolTools('openai-response', options.searchTools);
            if (options.webSearchEnabled && tools.length > 0) body.tools = tools;
            applyThinkingOptions(body, provider, 'openai-response', options.model, options.thinkingLevel);
            return {
                protocol: 'openai-response',
                url: `${baseUrl}/responses`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${provider.apiKey || ''}`
                },
                body
            };
        }

        /**
         * 【供应商协议/请求构造】【Gemini】构造 generateContent 请求
         * @param {Object} provider - 供应商配置
         * @param {Object} options - 请求上下文
         * @returns {Object} - 请求配置
         */
        function buildGeminiRequest(provider, options) {
            const converted = convertMessagesToGemini(options.messages);
            const suffix = options.stream ? ':streamGenerateContent' : ':generateContent';
            const cleanedModel = String(options.model || '').replace(/^models\//, '');
            let url = (provider.apiUrl || '').trim().replace(/\/+$/, '');
            if (url.includes(':generateContent') || url.includes(':streamGenerateContent')) {
                url = url
                    .replace(':streamGenerateContent', suffix)
                    .replace(':generateContent', suffix);
            } else {
                const baseUrl = stripGeminiGenerationUrl(url);
                url = `${baseUrl}/models/${encodeURIComponent(cleanedModel)}${suffix}`;
            }
            if (options.stream) url = appendQueryParam(url, 'alt', 'sse');
            url = appendQueryParam(url, 'key', provider.apiKey || '');
            const body = {
                contents: converted.contents,
                generationConfig: {
                    temperature: options.preset ? options.preset.temperature : 0.7,
                    topP: options.preset ? options.preset.top_p : 1
                }
            };
            const tools = buildProtocolTools('gemini', options.searchTools);
            if (options.webSearchEnabled && tools.length > 0) body.tools = tools;
            if (converted.systemInstruction) body.system_instruction = converted.systemInstruction;
            applyThinkingOptions(body, provider, 'gemini', options.model, options.thinkingLevel);
            return {
                protocol: 'gemini',
                url,
                headers: { 'Content-Type': 'application/json' },
                body
            };
        }

        /**
         * 【供应商协议/请求构造】【Anthropic】构造 Messages 请求
         * @param {Object} provider - 供应商配置
         * @param {Object} options - 请求上下文
         * @returns {Object} - 请求配置
         */
        function buildAnthropicRequest(provider, options) {
            const converted = convertMessagesToAnthropic(options.messages);
            const baseUrl = stripApiUrlSuffixes(provider.apiUrl, ['/v1/messages', '/messages']);
            const body = {
                model: options.model,
                messages: converted.messages,
                max_tokens: Number(provider.maxTokens) || 4096,
                stream: options.stream,
                temperature: options.preset ? options.preset.temperature : 0.7,
                top_p: options.preset ? options.preset.top_p : 1
            };
            if (converted.system) body.system = converted.system;
            const tools = buildProtocolTools('anthropic', options.searchTools);
            if (options.webSearchEnabled && tools.length > 0) body.tools = tools;
            applyThinkingOptions(body, provider, 'anthropic', options.model, options.thinkingLevel);
            return {
                protocol: 'anthropic',
                url: `${baseUrl}/messages`,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': provider.apiKey || '',
                    'anthropic-version': provider.anthropicVersion || '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body
            };
        }

        /**
         * 【供应商协议/请求构造】【统一入口】按供应商协议构造聊天请求
         * @param {Object} options - 请求上下文
         * @returns {Object} - 请求配置
         */
        function buildProviderChatRequest(options) {
            const provider = normalizeProviderConfig(options.provider);
            const protocol = resolveProviderProtocol(provider);
            const normalizedOptions = {
                ...options,
                webSearchEnabled: options.webSearchEnabled && supportsProtocolTools(protocol)
            };
            if (protocol === 'openai-response') return buildOpenAIResponseRequest(provider, normalizedOptions);
            if (protocol === 'gemini') return buildGeminiRequest(provider, normalizedOptions);
            if (protocol === 'anthropic') return buildAnthropicRequest(provider, normalizedOptions);
            return buildOpenAIChatRequest(provider, normalizedOptions);
        }
