        // ============================================================
        //  供应商协议 — 非流式响应解析
        // ============================================================
        /**
         * 【供应商协议/响应解析】【Responses 文本】从 Responses output 中提取文本
         * @param {Object} data - Responses API 响应体
         * @returns {string} - 合并后的文本
         */
        function extractOpenAIResponseText(data) {
            if (data?.output_text) return data.output_text;
            const parts = [];
            (data?.output || []).forEach(item => {
                (item.content || []).forEach(content => {
                    if (content.type === 'output_text' && content.text) parts.push(content.text);
                    if (content.type === 'text' && content.text) parts.push(content.text);
                });
            });
            return parts.join('');
        }

        /**
         * 【供应商协议/响应解析】【Responses 思考】从 Responses output 中提取思考摘要
         * @param {Object} data - Responses API 响应体
         * @returns {string} - 合并后的思考文本
         */
        function extractOpenAIResponseThought(data) {
            const parts = [];
            (data?.output || []).forEach(item => {
                (item.content || []).forEach(content => {
                    if ((content.type === 'reasoning_text' || content.type === 'summary_text') && content.text) {
                        parts.push(content.text);
                    }
                });
                (item.summary || []).forEach(summary => {
                    if (summary.text) parts.push(summary.text);
                });
            });
            return parts.join('\n\n');
        }

        /**
         * 【供应商协议/响应解析】【Responses工具】从 Responses output 中提取函数调用
         * @param {Object} data - Responses API 响应体
         * @returns {Array<Object>} - 内部统一工具调用列表
         */
        function extractOpenAIResponseToolCalls(data) {
            const calls = [];
            (data?.output || []).forEach((item, index) => {
                if (item.type !== 'function_call') return;
                calls.push(createNormalizedToolCall(item.call_id || item.id, item.name, item.arguments, index));
            });
            return calls;
        }

        /**
         * 【供应商协议/响应解析】【Gemini 内容】从 Gemini candidates 中提取正文、思考与工具调用
         * @param {Object} data - Gemini 响应体
         * @returns {Object} - 正文、思考、工具调用与协议状态
         */
        function extractGeminiContent(data) {
            const contentParts = [];
            const thoughtParts = [];
            const toolCalls = [];
            let firstContent = null;
            (data?.candidates || []).forEach(candidate => {
                if (!firstContent && candidate.content) firstContent = candidate.content;
                (candidate.content?.parts || []).forEach((part, index) => {
                    if (part.text && part.thought) {
                        thoughtParts.push(part.text);
                    } else if (part.text) {
                        contentParts.push(part.text);
                    }
                    const functionCall = part.functionCall || part.function_call;
                    if (functionCall) {
                        toolCalls.push(createNormalizedToolCall(
                            functionCall.id || '',
                            functionCall.name,
                            functionCall.args || functionCall.arguments || {},
                            index
                        ));
                    }
                });
            });
            return {
                content: contentParts.join(''),
                thought: thoughtParts.join('\n\n'),
                toolCalls,
                protocolState: firstContent ? { geminiContent: firstContent } : null
            };
        }

        /**
         * 【供应商协议/响应解析】【Anthropic 内容】从 Anthropic content 中提取正文与思考
         * @param {Object} data - Anthropic 响应体
         * @returns {Object} - 正文、思考和工具调用
         */
        function extractAnthropicContent(data) {
            const contentParts = [];
            const thoughtParts = [];
            const toolCalls = [];
            (data?.content || []).forEach(part => {
                if (part.type === 'text' && part.text) contentParts.push(part.text);
                if ((part.type === 'thinking' || part.type === 'reasoning') && part.thinking) thoughtParts.push(part.thinking);
                if (part.type === 'tool_use') {
                    toolCalls.push(createNormalizedToolCall(part.id, part.name, part.input || {}, toolCalls.length));
                }
            });
            return {
                content: contentParts.join(''),
                thought: thoughtParts.join('\n\n'),
                toolCalls,
                protocolState: Array.isArray(data?.content) ? { anthropicContent: data.content } : null
            };
        }

        /**
         * 【供应商协议/响应解析】【统一入口】按协议解析非流式聊天响应
         * @param {string} protocol - 供应商协议
         * @param {Object} data - 响应 JSON
         * @returns {Object} - 统一格式的正文、思考和工具调用
         */
        function parseProviderChatResponse(protocol, data) {
            if (protocol === 'openai-response') {
                return {
                    content: extractOpenAIResponseText(data),
                    thought: extractOpenAIResponseThought(data),
                    toolCalls: extractOpenAIResponseToolCalls(data),
                    protocolState: Array.isArray(data?.output) ? { openaiResponseOutput: data.output } : null
                };
            }
            if (protocol === 'gemini') {
                return extractGeminiContent(data);
            }
            if (protocol === 'anthropic') {
                return extractAnthropicContent(data);
            }
            const message = data?.choices?.[0]?.message || {};
            return {
                content: message.content || '',
                thought: message.reasoning_content || '',
                toolCalls: message.tool_calls || []
            };
        }
