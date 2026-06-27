        // ============================================================
        //  输入框事件
        // ============================================================
        const userInput = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendBtn');

        userInput.addEventListener('input', function() {
            this.style.height = '24px';
            let scrollHeight = this.scrollHeight;
            this.style.height = (scrollHeight > 150 ? 150 : scrollHeight) + 'px';
            if(scrollHeight > 150) this.style.overflowY = 'auto';
            else this.style.overflowY = 'hidden';
            updateSendBtnState();
        });

        userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!isResponding) sendMessage(); }
        });

        // 粘贴图片：监听 textarea 的 paste 事件
        userInput.addEventListener('paste', handlePaste);

        // Escape 关闭灯箱
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeImgLightbox();
        });

        /**
         * 【流式渲染/系统】【围栏统计】统计 Markdown 代码围栏数量
         * @param {string} text - 原始 Markdown 文本
         * @returns {number} - 三反引号代码围栏出现次数
         */
