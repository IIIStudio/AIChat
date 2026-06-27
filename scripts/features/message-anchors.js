        // ============================================================
        //  消息锚点导航条
        // ============================================================
        const messageAnchors = document.getElementById('messageAnchors');
        const anchorTooltip = document.getElementById('anchorTooltip');
        let anchorObserver = null;
        let anchorTexts = [];

        let hideTooltipTimeout = null;

        function bindTooltipClicks() {
            anchorTooltip.querySelectorAll('.anchor-tooltip-item').forEach(item => {
                item.addEventListener('click', () => {
                    const idx = parseInt(item.getAttribute('data-idx'));
                    const blocks = chatInner.querySelectorAll('.user-block');
                    if (blocks[idx]) {
                        blocks[idx].scrollIntoView({ block: 'start' });
                    }
                });
            });
        }

        function buildTooltipHTML(currentIndex) {
            if (anchorTexts.length === 0) return '';
            let html = '';
            anchorTexts.forEach((text, i) => {
                const cls = i === currentIndex ? ' anchor-tooltip-item current' : 'anchor-tooltip-item';
                html += `<div class="${cls}" data-idx="${i}"><span class="anchor-text">${escapeHtml(text)}</span><span class="anchor-dash">—</span></div>`;
            });
            return html;
        }

        function positionTooltip(refRect) {
            if (!anchorTooltip) return;
            let left = refRect.left - anchorTooltip.offsetWidth - 14;
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
            bindTooltipClicks();
        }

        function hideAnchorTooltip(delayed) {
            if (!anchorTooltip) return;
            if (delayed) {
                clearTimeout(hideTooltipTimeout);
                hideTooltipTimeout = setTimeout(() => {
                    anchorTooltip.classList.remove('show');
                }, 150);
            } else {
                clearTimeout(hideTooltipTimeout);
                anchorTooltip.classList.remove('show');
            }
        }

        // 整个锚点条带和 tooltip 区域协同显示/隐藏
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
            const allBlocks = chatInner.querySelectorAll('.message-block');
            const blocks = Array.from(allBlocks).filter(b => b.classList.contains('user-block'));
            messageAnchors.innerHTML = '';

            // 收集所有用户消息文本
            anchorTexts = blocks.map(block => {
                const contentEl = block.querySelector('.message-content');
                return contentEl ? (contentEl.textContent || contentEl.getAttribute('data-raw') || '').substring(0, 20).trim() : '';
            });

            // 每次更新时清空 tooltip 内容
            if (anchorTooltip) anchorTooltip.innerHTML = '';

            if (blocks.length === 0) {
                messageAnchors.classList.add('hidden');
                if (anchorObserver) anchorObserver.disconnect();
                return;
            }
            messageAnchors.classList.remove('hidden');

            blocks.forEach((block, i) => {
                block.setAttribute('data-anchor-index', i);
                const dot = document.createElement('div');
                dot.className = 'anchor-dot';
                dot.title = '你的消息';
                // 悬停时更新当前高亮项
                dot.addEventListener('mouseenter', () => {
                    if (anchorTooltip && anchorTooltip.classList.contains('show')) {
                        anchorTooltip.innerHTML = buildTooltipHTML(i);
                        bindTooltipClicks();
                    }
                });
                dot.addEventListener('click', () => {
                    block.scrollIntoView({ block: 'start' });
                });
                messageAnchors.appendChild(dot);
            });

            // 重建 observer
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
                if (bestIdx >= 0 && dots[bestIdx]) {
                    dots[bestIdx].classList.add('active');
                }
            }, { root: chatContainer, threshold: [0, 0.25, 0.5, 0.75, 1] });

            blocks.forEach(b => anchorObserver.observe(b));
        }
