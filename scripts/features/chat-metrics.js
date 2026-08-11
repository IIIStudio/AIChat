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
         * 估算口径（贴近主流 BPE tokenizer 的平均换算）：
         * - 中文（CJK）1 个汉字 ≈ 1 token
         * - 英文单词与数字串按约 4 字符 = 1 token（模拟子词切分）
         * - 标点等符号约 2 个 = 1 token
         * @param {string} text - 响应文本
         * @returns {number} - 估算 token 数
         */
        function estimateTokenCount(text) {
            const raw = String(text || '');
            if (!raw.trim()) return 0;
            // 中文（CJK）字符
            const cjkCount = (raw.match(/[\u4e00-\u9fff]/g) || []).length;
            const nonCjkText = raw.replace(/[\u4e00-\u9fff]/g, ' ');
            // 英文单词与数字串：按字符数折算（每约 4 字符 1 token）
            const letterDigitCount = (nonCjkText.match(/[A-Za-z0-9_]/g) || []).length;
            const wordTokens = Math.ceil(letterDigitCount / 4);
            // 标点等符号：每约 2 个 1 token
            const symbolCount = (nonCjkText.match(/[^\sA-Za-z0-9_]/g) || []).length;
            const symbolTokens = Math.ceil(symbolCount / 2);
            return Math.max(1, cjkCount + wordTokens + symbolTokens);
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
         * 【聊天指标/展示格式】【思考时长】格式化思考过程耗时
         * @param {number|null} ms - 毫秒时长
         * @returns {string} - 展示文本，如"用时3秒"或"用时2分15秒"
         */
        function formatThoughtDuration(ms) {
            if (ms == null || ms < 0) return '';
            const totalSec = Math.floor(ms / 1000);
            if (totalSec < 60) return `用时${totalSec}秒`;
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            return `用时${min}分${sec}秒`;
        }


