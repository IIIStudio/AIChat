        // ============================================================
        //  供应商协议 — 探测与匹配
        // ============================================================
        /**
         * 【供应商协议/探测】【协议解析】读取供应商当前协议
         * @param {Object} provider - 供应商配置
         * @returns {string} - 已支持的协议值
         */
        function resolveProviderProtocol(provider) {
            if (provider && isKnownProviderProtocol(provider.protocol)) return provider.protocol;
            return 'openai';
        }

        /**
         * 【供应商协议/探测】【关键字匹配】判断供应商或模型是否为 DeepSeek
         * @param {Object} provider - 供应商配置
         * @param {string} model - 当前模型名称
         * @returns {boolean} - 是否匹配 DeepSeek
         */
        function isDeepSeekProvider(provider, model) {
            const text = [
                provider?.name || '',
                provider?.apiUrl || '',
                model || ''
            ].join('|').toLowerCase();
            return text.includes('deepseek');
        }

        /**
         * 【供应商协议/探测】【地址处理】移除 URL 尾部常见接口路径
         * @param {string} apiUrl - 原始 API URL
         * @param {Array<string>} suffixes - 需要移除的后缀列表
         * @returns {string} - 清理后的基础 URL
         */
        function stripApiUrlSuffixes(apiUrl, suffixes) {
            let baseUrl = (apiUrl || '').trim().replace(/\/+$/, '');
            suffixes.forEach(suffix => {
                if (baseUrl.endsWith(suffix)) {
                    baseUrl = baseUrl.slice(0, -suffix.length).replace(/\/+$/, '');
                }
            });
            return baseUrl;
        }

        /**
         * 【供应商协议/探测】【查询参数】向 URL 安全追加查询参数
         * @param {string} url - 原始 URL
         * @param {string} name - 查询参数名
         * @param {string} value - 查询参数值
         * @returns {string} - 追加查询参数后的 URL
         */
        function appendQueryParam(url, name, value) {
            if (!value) return url;
            const joiner = url.includes('?') ? '&' : '?';
            return `${url}${joiner}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        }

        /**
         * 【供应商协议/探测】【Gemini 地址】从 Gemini 生成接口地址中还原基础地址
         * @param {string} apiUrl - Gemini API URL
         * @returns {string} - Gemini 基础 URL
         */
        function stripGeminiGenerationUrl(apiUrl) {
            const cleanUrl = (apiUrl || '').trim().replace(/\/+$/, '');
            const marker = '/models/';
            const markerIndex = cleanUrl.indexOf(marker);
            if (markerIndex >= 0) return cleanUrl.slice(0, markerIndex).replace(/\/+$/, '');
            return stripApiUrlSuffixes(cleanUrl, ['/models']);
        }
