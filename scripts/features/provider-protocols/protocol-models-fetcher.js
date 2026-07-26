        // ============================================================
        //  供应商协议 — 模型获取
        // ============================================================
        /**
         * 【供应商协议/模型获取】【请求构造】构造 OpenAI 模型列表请求
         * @param {Object} provider - 供应商配置
         * @returns {Object} - 请求配置
         */
        function buildOpenAIModelsRequest(provider) {
            const baseUrl = stripApiUrlSuffixes(provider.apiUrl, ['/chat/completions', '/responses', '/models']);
            return {
                url: `${baseUrl}/models`,
                headers: { 'Authorization': `Bearer ${provider.apiKey || ''}` }
            };
        }

        /**
         * 【供应商协议/模型获取】【请求构造】构造 Gemini 模型列表请求
         * @param {Object} provider - 供应商配置
         * @returns {Object} - 请求配置
         */
        function buildGeminiModelsRequest(provider) {
            const baseUrl = stripGeminiGenerationUrl(provider.apiUrl);
            const url = appendQueryParam(`${baseUrl}/models`, 'key', provider.apiKey || '');
            return { url, headers: {} };
        }

        /**
         * 【供应商协议/模型获取】【请求构造】构造 Anthropic 模型列表请求
         * @param {Object} provider - 供应商配置
         * @returns {Object} - 请求配置
         */
        function buildAnthropicModelsRequest(provider) {
            const baseUrl = stripApiUrlSuffixes(provider.apiUrl, ['/v1/messages', '/messages', '/v1/models', '/models']);
            return {
                url: `${baseUrl}/models`,
                headers: {
                    'x-api-key': provider.apiKey || '',
                    'anthropic-version': provider.anthropicVersion || '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            };
        }

        /**
         * 【供应商协议/模型获取】【ID 提取】从通用模型响应中提取模型 ID
         * @param {Object|Array} data - 模型列表响应
         * @returns {Array<string>} - 模型 ID 列表
         */
        function extractModelIdsFromResponse(data) {
            if (Array.isArray(data?.data)) {
                return data.data.map(item => item.id || item.name || item).filter(Boolean);
            }
            if (Array.isArray(data?.models)) {
                return data.models.map(item => item.id || item.name || item).filter(Boolean);
            }
            if (Array.isArray(data)) {
                return data.map(item => item.id || item.name || item).filter(Boolean);
            }
            return [];
        }

        /**
         * 【供应商协议/模型获取】【ID 清理】统一清理模型 ID 展示格式
         * @param {Array<string>} modelIds - 原始模型 ID 列表
         * @param {string} protocol - 供应商协议
         * @returns {Array<string>} - 去重后的模型 ID 列表
         */
        function normalizeFetchedModelIds(modelIds, protocol) {
            const cleaned = modelIds.map(id => {
                const text = String(id || '').trim();
                if (protocol === 'gemini') return text.replace(/^models\//, '');
                return text;
            }).filter(Boolean);
            return Array.from(new Set(cleaned));
        }

        /**
         * 【供应商协议/模型获取】【统一入口】按协议获取模型候选列表
         * @param {Object} provider - 供应商配置
         * @returns {Promise<Array<string>>} - 模型候选列表
         */
        async function fetchProviderModelCandidates(provider) {
            const normalizedProvider = normalizeProviderConfig(provider);
            const protocol = resolveProviderProtocol(normalizedProvider);
            let request;
            if (protocol === 'gemini') {
                request = buildGeminiModelsRequest(normalizedProvider);
            } else if (protocol === 'anthropic') {
                request = buildAnthropicModelsRequest(normalizedProvider);
            } else {
                request = buildOpenAIModelsRequest(normalizedProvider);
            }
            const res = await fetch(request.url, { headers: request.headers });
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 100) : ''}`);
            }
            const data = await res.json();
            return normalizeFetchedModelIds(extractModelIdsFromResponse(data), protocol);
        }
