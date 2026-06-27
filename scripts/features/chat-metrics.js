        // ============================================================
        //  聊天响应指标
        // ============================================================
        /**
         * 【聊天指标/响应统计】【计时开始】创建一次响应的指标跟踪器
         * @returns {Object} - 指标跟踪器
         */
        function createChatMetricsTracker() {
            return {
                startedAt: performance.now(),
                firstTokenAt: null,
                completedAt: null,
                outputText: ''
            };
        }

        /**
         * 【聊天指标/响应统计】【首字记录】记录首次输出正文或思考内容的时间
         * @param {Object} tracker - 指标跟踪器
         * @param {string} text - 当前输出片段
         * @returns {void}
         */
        function markChatMetricFirstToken(tracker, text) {
            if (!tracker || tracker.firstTokenAt !== null || !text) return;
            tracker.firstTokenAt = performance.now();
        }

        /**
         * 【聊天指标/响应统计】【内容累积】累积响应文本用于估算 token 数
         * @param {Object} tracker - 指标跟踪器
         * @param {string} text - 当前输出片段
         * @returns {void}
         */
        function appendChatMetricOutput(tracker, text) {
            if (!tracker || !text) return;
            tracker.outputText += text;
        }

        /**
         * 【聊天指标/响应统计】【token 估算】根据中英文混合文本估算 token 数
         * @param {string} text - 响应文本
         * @returns {number} - 估算 token 数
         */
        function estimateTokenCount(text) {
            const raw = String(text || '');
            const cjkMatches = raw.match(/[\u4e00-\u9fff]/g) || [];
            const nonCjkText = raw.replace(/[\u4e00-\u9fff]/g, ' ');
            const wordMatches = nonCjkText.match(/[A-Za-z0-9_]+/g) || [];
            const symbolCount = (nonCjkText.match(/[^\sA-Za-z0-9_]/g) || []).length;
            return Math.max(1, cjkMatches.length + wordMatches.length + Math.ceil(symbolCount / 4));
        }

        /**
         * 【聊天指标/响应统计】【计时结束】生成可持久化的响应指标
         * @param {Object} tracker - 指标跟踪器
         * @param {string} finalText - 最终响应正文
         * @returns {Object|null} - 响应指标
         */
        function completeChatMetrics(tracker, finalText) {
            if (!tracker) return null;
            const now = performance.now();
            if (tracker.firstTokenAt === null && finalText) {
                tracker.firstTokenAt = now;
            }
            tracker.completedAt = now;
            const outputText = finalText || tracker.outputText || '';
            const tokenCount = estimateTokenCount(outputText);
            const durationMs = Math.max(1, tracker.completedAt - tracker.startedAt);
            const generationMs = Math.max(1, tracker.completedAt - (tracker.firstTokenAt || tracker.startedAt));
            return {
                firstTokenMs: tracker.firstTokenAt ? Math.round(tracker.firstTokenAt - tracker.startedAt) : null,
                totalMs: Math.round(durationMs),
                outputTokens: tokenCount,
                tokensPerSecond: Number((tokenCount / (generationMs / 1000)).toFixed(1))
            };
        }

        /**
         * 【聊天指标/展示格式】【时长格式】格式化毫秒时长
         * @param {number|null} ms - 毫秒时长
         * @returns {string} - 展示文本
         */
        function formatMetricDuration(ms) {
            if (ms == null) return '-';
            if (ms < 1000) return `${ms}ms`;
            return `${(ms / 1000).toFixed(1)}s`;
        }

        /**
         * 【聊天指标/展示格式】【指标文案】格式化响应指标展示文本
         * @param {Object} metrics - 响应指标
         * @returns {string} - 展示文本
         */
        function formatChatMetrics(metrics) {
            if (!metrics) return '';
            const first = formatMetricDuration(metrics.firstTokenMs);
            const speed = metrics.tokensPerSecond != null ? metrics.tokensPerSecond : 0;
            return `首字 ${first} · 约 ${speed} token/s`;
        }

        /**
         * 【聊天指标/展示格式】【标签渲染】渲染聊天响应指标标签
         * @param {Object} metrics - 响应指标
         * @returns {string} - 指标标签 HTML
         */
        function renderChatMetricsTag(metrics) {
            const text = formatChatMetrics(metrics);
            if (!text) return '';
            return `<span class="msg-metrics-tag">${escapeHtml(text)}</span>`;
        }
