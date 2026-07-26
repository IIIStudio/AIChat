        // ============================================================
        //  回到最新位置悬浮按钮逻辑
        // ============================================================
        /**
         * 平滑滚动到聊天窗口最底部并重置自动滚动状态
         * @returns {void}
         */
        window.scrollToBottomSmoothly = function() {
            enableChatAutoScroll('smooth');
        };

        /**
         * 判定当前滚动状态，并动态控制悬浮按钮的显隐
         * @returns {void}
         */
        function updateScrollDownBtnVisibility() {
            const chatContainer = document.getElementById('chatContainer');
            const btn = document.getElementById('scrollDownBtn');
            if (!chatContainer || !btn) return;

            // 1. 判断当前滚动条是否偏离底部
            const isAtBottom = isChatAtBottom();
            
            // 2. 只有在 AI 响应中且手动向上偏离，或者日常查看历史且偏离底部较远时才显示按钮
            const shouldShow = (isResponding && !shouldAutoScroll) || (!isAtBottom && chatContainer.scrollTop > 200);

            if (shouldShow) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        }

        /**
         * 检测用户的主动滚动行为（滚轮或触摸拖动）
         * @param {WheelEvent|TouchEvent} e - 用户滚动事件
         * @returns {void}
         */
        function handleUserScrollAction(e) {
            const chatContainer = document.getElementById('chatContainer');
            if (!chatContainer) return;
            
            // 1. 只在 AI 输出期间拦截用户查看历史的意图
            if (!isResponding) return;

            // 2. 鼠标滚轮向上表示用户要离开底部，必须立即锁定，不能等 scrollTop 变化后再判断
            if (e.type === 'wheel' && e.deltaY < 0) {
                lockChatAutoScroll();
                return;
            }

            // 3. 触摸向下拖动会让内容向上滚动，同样立即锁定
            if (e.type === 'touchmove' && e.touches && e.touches.length > 0 && touchScrollStartY != null) {
                const currentY = e.touches[0].clientY;
                if (currentY > touchScrollStartY + 4) {
                    lockChatAutoScroll();
                    return;
                }
            }

            // 4. 拖动滚动条等场景没有明确方向事件，离开底部后也要锁定
            if (!isChatAtBottom()) {
                lockChatAutoScroll();
            }
        }

        /**
         * 【聊天/滚动控制】【触摸起点】记录触摸滚动起点，用于识别向上查看历史的手势
         * @param {TouchEvent} e - 触摸开始事件
         * @returns {void}
         */
        function handleChatTouchStart(e) {
            touchScrollStartY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : null;
        }

        // 挂载滚轮、触控与常规滚动事件监听
        window.addEventListener('DOMContentLoaded', () => {
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) {
                chatContainer.addEventListener('wheel', handleUserScrollAction, { passive: true });
                chatContainer.addEventListener('touchstart', handleChatTouchStart, { passive: true });
                chatContainer.addEventListener('touchmove', handleUserScrollAction, { passive: true });
                chatContainer.addEventListener('scroll', () => {
                    const isAtBottom = isChatAtBottom();
                    if (isProgrammaticChatScroll) {
                        updateScrollDownBtnVisibility();
                        return;
                    }

                    // 1. AI 输出期间，用户离开底部就锁定自动滚动
                    if (isResponding && !isAtBottom) {
                        lockChatAutoScroll();
                        return;
                    }

                    // 2. 用户手动回到底部时恢复跟随；程序滚动不会走到这里
                    if (isAtBottom) {
                        shouldAutoScroll = true;
                    }
                    updateScrollDownBtnVisibility();
                });
            }
        });
