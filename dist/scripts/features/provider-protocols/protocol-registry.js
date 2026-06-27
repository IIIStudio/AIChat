        // ============================================================
        //  供应商协议 — 注册表
        // ============================================================
        var PROVIDER_PROTOCOLS = [
            { value: 'openai', label: 'OpenAI' },
            { value: 'openai-response', label: 'OpenAI-Response' },
            { value: 'gemini', label: 'Gemini' },
            { value: 'anthropic', label: 'Anthropic' }
        ];

        var PROVIDER_THINKING_FORMATS = [
            { value: 'auto', label: '自动兼容' },
            { value: 'disabled', label: '不发送' },
            { value: 'deepseek-thinking', label: 'DeepSeek thinking.type' },
            { value: 'openai-chat-reasoning-effort', label: 'OpenAI Chat reasoning_effort' },
            { value: 'string', label: 'thinking 字符串' },
            { value: 'object', label: '旧网关 thinking 对象' },
            { value: 'reasoning', label: 'OpenAI Responses reasoning' },
            { value: 'anthropic-thinking', label: 'Anthropic thinking' },
            { value: 'gemini-thinking', label: 'Gemini thinkingConfig' }
        ];

        /**
         * 【供应商协议/配置】【协议校验】判断协议值是否为已支持协议
         * @param {string} protocol - 待校验的协议值
         * @returns {boolean} - 是否为有效协议
         */
        function isKnownProviderProtocol(protocol) {
            return PROVIDER_PROTOCOLS.some(item => item.value === protocol);
        }

        /**
         * 【供应商协议/配置】【思考格式校验】判断思考参数格式是否为已支持格式
         * @param {string} format - 待校验的思考参数格式
         * @returns {boolean} - 是否为有效格式
         */
        function isKnownThinkingFormat(format) {
            return PROVIDER_THINKING_FORMATS.some(item => item.value === format);
        }

        /**
         * 【供应商协议/配置】【协议文案】获取协议展示名称
         * @param {string} protocol - 协议值
         * @returns {string} - 协议展示名称
         */
        function getProviderProtocolLabel(protocol) {
            const found = PROVIDER_PROTOCOLS.find(item => item.value === protocol);
            return found ? found.label : 'OpenAI';
        }

        /**
         * 【供应商协议/配置】【思考文案】获取思考参数格式展示名称
         * @param {string} format - 思考参数格式
         * @returns {string} - 格式展示名称
         */
        function getThinkingFormatLabel(format) {
            const found = PROVIDER_THINKING_FORMATS.find(item => item.value === format);
            return found ? found.label : '自动兼容';
        }

        /**
         * 【供应商协议/配置】【兼容补全】补全旧供应商配置中的新字段
         * @param {Object} provider - 待规范化的供应商配置
         * @returns {Object} - 已补全默认协议、思考格式和模型列表的供应商配置
         */
        function normalizeProviderConfig(provider) {
            if (!provider) return provider;
            if (provider.model && !provider.models) {
                provider.models = [provider.model];
                delete provider.model;
            }
            if (!provider.models) provider.models = [];
            if (!isKnownProviderProtocol(provider.protocol)) provider.protocol = 'openai';
            if (!isKnownThinkingFormat(provider.thinkingFormat)) provider.thinkingFormat = 'auto';
            return provider;
        }

        /**
         * 【供应商协议/配置】【批量兼容】补全供应商列表中的新字段
         * @param {Array} providerList - 供应商配置列表
         * @returns {Array} - 已规范化的供应商配置列表
         */
        function normalizeProviderConfigs(providerList) {
            if (!Array.isArray(providerList)) return [];
            return providerList.map(provider => normalizeProviderConfig(provider));
        }
