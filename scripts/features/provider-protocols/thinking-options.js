        // ============================================================
        //  供应商协议 — 思考参数兼容
        // ============================================================
        var THINKING_TOKEN_BUDGETS = {
            max: 8192,
            xhigh: 6144,
            high: 4096,
            medium: 2048,
            low: 1024
        };

        /**
         * 【供应商协议/思考参数】【等级映射】把界面思考等级转换为 reasoning effort
         * @param {string} level - 界面选择的思考等级
         * @returns {string} - reasoning effort 等级
         */
        function mapThinkingLevelToReasoningEffort(level) {
            if (level === 'low') return 'low';
            if (level === 'medium') return 'medium';
            if (level === 'none') return 'minimal';
            return 'high';
        }

        /**
         * 【供应商协议/思考参数】【DeepSeek映射】把界面思考等级转换为 DeepSeek 支持的 effort
         * @param {string} level - 界面选择的思考等级
         * @returns {string} - DeepSeek reasoning_effort 等级
         */
        function mapThinkingLevelToDeepSeekEffort(level) {
            if (level === 'max' || level === 'xhigh') return 'max';
            return 'high';
        }

        /**
         * 【供应商协议/思考参数】【预算映射】把界面思考等级转换为 token 预算
         * @param {string} level - 界面选择的思考等级
         * @returns {number} - 思考 token 预算
         */
        function mapThinkingLevelToBudget(level) {
            return THINKING_TOKEN_BUDGETS[level] || THINKING_TOKEN_BUDGETS.medium;
        }

        /**
         * 【供应商协议/思考参数】【自动模式】根据协议和供应商特征推断实际思考参数格式
         * @param {Object} provider - 供应商配置
         * @param {string} protocol - 供应商协议
         * @param {string} model - 当前模型名称
         * @returns {string} - 实际思考参数格式
         */
        function resolveEffectiveThinkingFormat(provider, protocol, model) {
            const configured = provider?.thinkingFormat || 'auto';
            if (isDeepSeekProvider(provider, model) && configured !== 'disabled') return 'deepseek-thinking';
            if (configured !== 'auto') return configured;
            if (protocol === 'openai-response') return 'reasoning';
            if (protocol === 'anthropic') return 'anthropic-thinking';
            if (protocol === 'gemini') return 'gemini-thinking';
            return 'string';
        }

        /**
         * 【供应商协议/思考参数】【通用对象】向请求体写入 thinking 对象
         * @param {Object} body - 请求体对象
         * @param {string} level - 界面选择的思考等级
         * @returns {void}
         */
        function applyGenericThinkingObject(body, level) {
            if (level === 'none') {
                body.thinking = { enabled: false };
                return;
            }
            body.thinking = {
                enabled: true,
                level,
                budget_tokens: mapThinkingLevelToBudget(level)
            };
        }

        /**
         * 【供应商协议/思考参数】【DeepSeek】向 DeepSeek OpenAI 格式请求体写入思考配置
         * @param {Object} body - 请求体对象
         * @param {string} level - 界面选择的思考等级
         * @returns {void}
         */
        function applyDeepSeekThinking(body, level) {
            if (level === 'none') {
                body.thinking = { type: 'disabled' };
                delete body.reasoning_effort;
                return;
            }
            body.thinking = { type: 'enabled' };
            body.reasoning_effort = mapThinkingLevelToDeepSeekEffort(level);
        }

        /**
         * 【供应商协议/思考参数】【OpenAI Chat】向 Chat Completions 请求体写入 reasoning_effort
         * @param {Object} body - 请求体对象
         * @param {string} level - 界面选择的思考等级
         * @returns {void}
         */
        function applyOpenAIChatReasoningEffort(body, level) {
            if (level === 'none') return;
            body.reasoning_effort = mapThinkingLevelToReasoningEffort(level);
        }

        /**
         * 【供应商协议/思考参数】【Anthropic】向 Anthropic 请求体写入扩展思考配置
         * @param {Object} body - 请求体对象
         * @param {string} level - 界面选择的思考等级
         * @returns {void}
         */
        function applyAnthropicThinking(body, level) {
            if (level === 'none') return;
            const budget = mapThinkingLevelToBudget(level);
            body.max_tokens = Math.max(body.max_tokens || 4096, budget + 1024);
            body.thinking = {
                type: 'enabled',
                budget_tokens: budget
            };
        }

        /**
         * 【供应商协议/思考参数】【Gemini】向 Gemini 请求体写入 thinkingConfig 配置
         * @param {Object} body - 请求体对象
         * @param {string} level - 界面选择的思考等级
         * @returns {void}
         */
        function applyGeminiThinking(body, level) {
            if (!body.generationConfig) body.generationConfig = {};
            body.generationConfig.thinkingConfig = {
                thinkingBudget: level === 'none' ? 0 : mapThinkingLevelToBudget(level)
            };
        }

        /**
         * 【供应商协议/思考参数】【请求适配】按供应商配置向请求体写入思考参数
         * @param {Object} body - 请求体对象
         * @param {Object} provider - 供应商配置
         * @param {string} protocol - 供应商协议
         * @param {string} model - 当前模型名称
         * @param {string} level - 界面选择的思考等级
         * @returns {void}
         */
        function applyThinkingOptions(body, provider, protocol, model, level) {
            if (!level || level === 'auto') return;
            const format = resolveEffectiveThinkingFormat(provider, protocol, model);
            if (format === 'disabled') return;
            if (format === 'string') {
                body.thinking = level;
                return;
            }
            if (format === 'object') {
                applyGenericThinkingObject(body, level);
                return;
            }
            if (format === 'deepseek-thinking') {
                applyDeepSeekThinking(body, level);
                return;
            }
            if (format === 'openai-chat-reasoning-effort') {
                applyOpenAIChatReasoningEffort(body, level);
                return;
            }
            if (format === 'reasoning') {
                body.reasoning = { effort: mapThinkingLevelToReasoningEffort(level) };
                return;
            }
            if (format === 'anthropic-thinking') {
                applyAnthropicThinking(body, level);
                return;
            }
            if (format === 'gemini-thinking') {
                applyGeminiThinking(body, level);
            }
        }
