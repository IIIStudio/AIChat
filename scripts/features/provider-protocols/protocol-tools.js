        // ============================================================
        //  供应商协议 — 工具调用兼容
        // ============================================================
        /**
         * 【供应商协议/工具适配】【函数提取】从 OpenAI Chat 工具定义中提取函数描述
         * @param {Object} tool - 原始工具定义
         * @returns {Object|null} - 标准函数描述，无法提取时返回 null
         */
        function extractToolFunctionSpec(tool) {
            if (!tool) return null;
            const fn = tool.function || tool;
            if (!fn.name) return null;
            return {
                name: fn.name,
                description: fn.description || '',
                parameters: fn.parameters || { type: 'object', properties: {} }
            };
        }

        /**
         * 【供应商协议/工具适配】【参数序列化】把工具参数转换为内部统一字符串
         * @param {string|Object} args - 工具参数
         * @returns {string} - JSON 字符串形式参数
         */
        function serializeToolArguments(args) {
            if (typeof args === 'string') return args;
            if (!args || typeof args !== 'object') return '{}';
            try {
                return JSON.stringify(args);
            } catch(e) {
                return '{}';
            }
        }

        /**
         * 【供应商协议/工具适配】【参数解析】把内部工具参数字符串转换为对象
         * @param {string|Object} args - 内部工具参数
         * @returns {Object} - 参数对象
         */
        function parseToolArgumentsObject(args) {
            if (args && typeof args === 'object') return args;
            if (!args || typeof args !== 'string') return {};
            try {
                return JSON.parse(args);
            } catch(e) {
                return {};
            }
        }

        /**
         * 【供应商协议/工具适配】【结果解析】把工具结果转换为 Gemini functionResponse 对象
         * @param {string} content - 工具执行结果
         * @returns {Object} - Gemini functionResponse.response 对象
         */
        function parseToolResultForGemini(content) {
            if (!content) return { result: '' };
            try {
                const parsed = JSON.parse(content);
                return parsed && typeof parsed === 'object' ? { result: parsed } : { result: parsed };
            } catch(e) {
                return { result: content };
            }
        }

        /**
         * 【供应商协议/工具适配】【调用归一】创建 OpenAI Chat 形态的内部工具调用
         * @param {string} id - 工具调用 ID
         * @param {string} name - 工具名称
         * @param {string|Object} args - 工具参数
         * @param {number} index - 工具调用序号
         * @returns {Object} - 内部统一工具调用
         */
        function createNormalizedToolCall(id, name, args, index = 0) {
            return {
                id: id || `call_${Date.now()}_${index}`,
                type: 'function',
                function: {
                    name: name || '',
                    arguments: serializeToolArguments(args)
                }
            };
        }

        /**
         * 【供应商协议/工具适配】【协议能力】判断当前协议是否支持应用内工具适配
         * @param {string} protocol - 供应商协议
         * @returns {boolean} - 是否支持工具声明和调用解析
         */
        function supportsProtocolTools(protocol) {
            return ['openai', 'openai-response', 'anthropic', 'gemini'].includes(protocol);
        }

        /**
         * 【供应商协议/工具适配】【声明转换】把内部工具定义转换为目标协议工具声明
         * @param {string} protocol - 供应商协议
         * @param {Array<Object>} tools - 内部 OpenAI Chat 形态工具定义
         * @returns {Array<Object>} - 目标协议工具声明
         */
        function buildProtocolTools(protocol, tools) {
            const specs = (tools || []).map(extractToolFunctionSpec).filter(Boolean);
            if (specs.length === 0) return [];
            if (protocol === 'openai') return tools;
            if (protocol === 'openai-response') {
                return specs.map(spec => ({
                    type: 'function',
                    name: spec.name,
                    description: spec.description,
                    parameters: spec.parameters
                }));
            }
            if (protocol === 'anthropic') {
                return specs.map(spec => ({
                    name: spec.name,
                    description: spec.description,
                    input_schema: spec.parameters
                }));
            }
            if (protocol === 'gemini') {
                return [{
                    functionDeclarations: specs.map(spec => ({
                        name: spec.name,
                        description: spec.description,
                        parameters: spec.parameters
                    }))
                }];
            }
            return [];
        }

        /**
         * 【供应商协议/工具适配】【状态回填】把协议原始状态写入内部 assistant 消息
         * @param {Object} message - 内部 assistant 消息
         * @param {string} protocol - 供应商协议
         * @param {Object|null} protocolState - 响应解析阶段提取的协议状态
         * @returns {void}
         */
        function attachProtocolStateToAssistantMessage(message, protocol, protocolState) {
            if (!message || !protocolState) return;
            if (protocol === 'openai-response' && Array.isArray(protocolState.openaiResponseOutput)) {
                message.openai_response_output = protocolState.openaiResponseOutput;
            }
            if (protocol === 'anthropic' && Array.isArray(protocolState.anthropicContent)) {
                message.anthropic_content = protocolState.anthropicContent;
            }
            if (protocol === 'gemini' && protocolState.geminiContent) {
                message.gemini_content = protocolState.geminiContent;
            }
        }
