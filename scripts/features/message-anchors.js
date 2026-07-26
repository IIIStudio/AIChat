        // ============================================================
        //  消息锚点导航条
        // ============================================================
        const messageAnchors = document.getElementById('messageAnchors');
        const anchorTooltip = document.getElementById('anchorTooltip');
        let anchorObserver = null;
        let anchorTexts = [];
        let hideTooltipTimeout = null;

        // 事件委托：tooltip 点击
        if (anchorTooltip) {
            anchorTooltip.addEventListener('click', (e) => {
                const item = e.target.closest('.anchor-tooltip-item');
                if (!item) return;
                const idx = parseInt(item.getAttribute('data-idx'));
                const blocks = chatInner.querySelectorAll('.user-block');
                if (blocks[idx]) blocks[idx].scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        }

        // 事件委托：锚点点击
        if (messageAnchors) {
            messageAnchors.addEventListener('click', (e) => {
                const dot = e.target.closest('.anchor-dot');
                if (!dot) return;
                const idx = parseInt(dot.getAttribute('data-idx'));
                const blocks = chatInner.querySelectorAll('.user-block');
                if (blocks[idx]) blocks[idx].scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        }

        function buildTooltipHTML(currentIndex) {
            if (anchorTexts.length === 0) return '';
            let html = '';
            anchorTexts.forEach((text, i) => {
                const cls = i === currentIndex ? 'anchor-tooltip-item current' : 'anchor-tooltip-item';
                html += `<div class="${cls}" data-idx="${i}"><span class="anchor-num">${i + 1}</span><span class="anchor-text">${escapeHtml(text)}</span></div>`;
            });
            return html;
        }

        function positionTooltip(refRect) {
            if (!anchorTooltip) return;
            let left = refRect.left - anchorTooltip.offsetWidth - 12;
            let top = refRect.top + refRect.height / 2 - anchorTooltip.offsetHeight / 2;
            if (left < 8) left = 8;
            if (top < 8) top = 8;
            if (top + anchorTooltip.offsetHeight > window.innerHeight - 8) {
                top = window.innerHeight - anchorTooltip.offsetHeight - 8;
            }
            anchorTooltip.style.left = left + 'px';
            anchorTooltip.style.top = top + 'px';
        }

        function showAnchorTooltipAt(refRect, currentIndex) {
            if (!anchorTooltip || anchorTexts.length === 0) return;
            anchorTooltip.innerHTML = buildTooltipHTML(currentIndex);
            anchorTooltip.classList.add('show');
            positionTooltip(refRect);
        }

        function hideAnchorTooltip(delayed) {
            if (!anchorTooltip) return;
            clearTimeout(hideTooltipTimeout);
            if (delayed) {
                hideTooltipTimeout = setTimeout(() => anchorTooltip.classList.remove('show'), 150);
            } else {
                anchorTooltip.classList.remove('show');
            }
        }

        // 锚点条和 tooltip 协同显示/隐藏
        if (messageAnchors) {
            messageAnchors.addEventListener('mouseenter', () => {
                clearTimeout(hideTooltipTimeout);
                showAnchorTooltipAt(messageAnchors.getBoundingClientRect(), -1);
            });
            messageAnchors.addEventListener('mouseleave', () => hideAnchorTooltip(true));
        }
        if (anchorTooltip) {
            anchorTooltip.addEventListener('mouseenter', () => {
                clearTimeout(hideTooltipTimeout);
                anchorTooltip.classList.add('show');
            });
            anchorTooltip.addEventListener('mouseleave', () => hideAnchorTooltip(true));
        }

        function updateMessageAnchors() {
            if (!messageAnchors) return;
            hideAnchorTooltip();
            const blocks = chatInner.querySelectorAll('.user-block');
            messageAnchors.innerHTML = '';

            // 收集所有用户消息文本
            anchorTexts = [];
            blocks.forEach(block => {
                const contentEl = block.querySelector('.message-content');
                const text = contentEl ? (contentEl.textContent || contentEl.getAttribute('data-raw') || '').substring(0, 24).trim() : '';
                anchorTexts.push(text);
            });

            if (anchorTooltip) anchorTooltip.innerHTML = '';

            if (blocks.length === 0) {
                messageAnchors.classList.add('hidden');
                if (anchorObserver) anchorObserver.disconnect();
                return;
            }
            messageAnchors.classList.remove('hidden');

            // 创建锚点（使用事件委托，不逐个绑定）
            const fragment = document.createDocumentFragment();
            blocks.forEach((block, i) => {
                block.setAttribute('data-anchor-index', i);
                const dot = document.createElement('div');
                dot.className = 'anchor-dot';
                dot.setAttribute('data-idx', i);
                // 悬停时更新 tooltip 高亮
                dot.addEventListener('mouseenter', () => {
                    if (anchorTooltip && anchorTooltip.classList.contains('show')) {
                        anchorTooltip.innerHTML = buildTooltipHTML(i);
                    }
                });
                fragment.appendChild(dot);
            });
            messageAnchors.appendChild(fragment);

            // 重建 observer（减少阈值数量降低触发频率）
            if (anchorObserver) anchorObserver.disconnect();
            anchorObserver = new IntersectionObserver((entries) => {
                let bestIdx = -1, bestRatio = 0;
                entries.forEach(e => {
                    if (e.intersectionRatio > bestRatio && e.isIntersecting) {
                        bestRatio = e.intersectionRatio;
                        bestIdx = parseInt(e.target.getAttribute('data-anchor-index'));
                    }
                });
                const dots = messageAnchors.querySelectorAll('.anchor-dot');
                dots.forEach(d => d.classList.remove('active'));
                if (bestIdx >= 0 && dots[bestIdx]) dots[bestIdx].classList.add('active');
            }, { root: chatContainer, threshold: [0, 0.5, 1] });

            blocks.forEach(b => anchorObserver.observe(b));
        }
