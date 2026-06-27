        // ============================================================
        //  供应商协议 — 流式响应解析
        // ============================================================
        /**
         * 【供应商协议/流式解析】【OpenAI】解析 Chat Completions SSE 数据
         * @param {Object} data - SSE data JSON
         * @returns {Object} - 统一增量数据
         */
        function parseOpenAIStreamChunk(data) {
            const delta = data?.choices?.[0]?.delta || {};
            return {
                content: delta.content || '',
                thought: delta.reasoning_content || '',
                toolCallsDelta: delta.tool_calls || []
            };
        }

        /**
         * 【供应商协议/流式解析】【Responses】解析 Responses SSE 数据
         * @param {Object} data - SSE data JSON
         * @returns {Object} - 统一增量数据
         */
        function parseOpenAIResponseStreamChunk(data) {
            if (data.type === 'response.output_text.delta') {
                return { content: data.delta || '', thought: '', toolCallsDelta: [] };
            }
            if (data.type === 'response.reasoning_text.delta' || data.type === 'response.reasoning_summary_text.delta') {
                return { content: '', thought: data.delta || '', toolCallsDelta: [] };
            }
            if (data.type === 'response.output_item.added' && data.item?.type === 'function_call') {
                return {
                    content: '',
                    thought: '',
                    toolCallsDelta: [{
                        index: data.output_index || 0,
                        id: data.item.call_id || data.item.id || '',
                        type: 'function',
                        function: {
                            name: data.item.name || '',
                            arguments: data.item.arguments || ''
                        }
                    }]
                };
            }
            if (data.type === 'response.function_call_arguments.delta') {
                return {
                    content: '',
                    thought: '',
                    toolCallsDelta: [{
                        index: data.output_index || 0,
                        id: data.call_id || data.item_id || '',
                        type: 'function',
                        function: { name: data.name || '', arguments: data.delta || '' }
                    }]
                };
            }
            if (data.type === 'response.function_call_arguments.done') {
                return {
                    content: '',
                    thought: '',
                    toolCallsDelta: [{
                        index: data.output_index || 0,
                        id: data.call_id || data.item_id || '',
                        type: 'function',
                        argumentsDone: true,
                        function: { name: data.name || '', arguments: data.arguments || '' }
                    }]
                };
            }
            return { content: '', thought: '', toolCallsDelta: [] };
        }

        /**
         * 【供应商协议/流式解析】【Gemini】解析 Gemini SSE 数据
         * @param {Object} data - SSE data JSON
         * @returns {Object} - 统一增量数据
         */
        function parseGeminiStreamChunk(data) {
            const parts = [];
            const thoughtParts = [];
            const toolCallsDelta = [];
            (data?.candidates || []).forEach(candidate => {
                (candidate.content?.parts || []).forEach((part, index) => {
                    if (part.text && part.thought) {
                        thoughtParts.push(part.text);
                    } else if (part.text) {
                        parts.push(part.text);
                    }
                    const functionCall = part.functionCall || part.function_call;
                    if (functionCall) {
                        toolCallsDelta.push({
                            index,
                            id: functionCall.id || '',
                            type: 'function',
                            argumentsDone: true,
                            function: {
                                name: functionCall.name || '',
                                arguments: serializeToolArguments(functionCall.args || functionCall.arguments || {})
                            }
                        });
                    }
                });
            });
            return { content: parts.join(''), thought: thoughtParts.join(''), toolCallsDelta };
        }

        /**
         * 【供应商协议/流式解析】【Anthropic】解析 Anthropic SSE 数据
         * @param {Object} data - SSE data JSON
         * @returns {Object} - 统一增量数据
         */
        function parseAnthropicStreamChunk(data) {
            if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                return {
                    content: '',
                    thought: '',
                    toolCallsDelta: [{
                        index: data.index || 0,
                        id: data.content_block.id || '',
                        type: 'function',
                        function: {
                            name: data.content_block.name || '',
                            arguments: ''
                        }
                    }]
                };
            }
            if (data.type === 'content_block_delta') {
                const delta = data.delta || {};
                if (delta.type === 'text_delta') {
                    return { content: delta.text || '', thought: '', toolCallsDelta: [] };
                }
                if (delta.type === 'thinking_delta') {
                    return { content: '', thought: delta.thinking || '', toolCallsDelta: [] };
                }
                if (delta.type === 'input_json_delta') {
                    return {
                        content: '',
                        thought: '',
                        toolCallsDelta: [{
                            index: data.index || 0,
                            id: '',
                            type: 'function',
                            function: {
                                name: '',
                                arguments: delta.partial_json || ''
                            }
                        }]
                    };
                }
            }
            return { content: '', thought: '', toolCallsDelta: [] };
        }

        /**
         * 【供应商协议/流式解析】【统一入口】按协议解析 SSE data 数据
         * @param {string} protocol - 供应商协议
         * @param {Object} data - SSE data JSON
         * @returns {Object} - 统一增量数据
         */
        function parseProviderStreamChunk(protocol, data) {
            if (protocol === 'openai-response') return parseOpenAIResponseStreamChunk(data);
            if (protocol === 'gemini') return parseGeminiStreamChunk(data);
            if (protocol === 'anthropic') return parseAnthropicStreamChunk(data);
            return parseOpenAIStreamChunk(data);
        }
