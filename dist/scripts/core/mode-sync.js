        // ============================================================
        //  同步初始化：防止刷新时闪烁（先于任何 DOM 渲染）
        // ============================================================
        let imageGenMode = false;
        let favMode = false;
        (function initModeSync() {
            try {
                const mode = localStorage.getItem('chatGenMode');
                if (mode === 'gen') {
                    imageGenMode = true;
                    document.documentElement.setAttribute('data-mode', 'gen');
                    const btnChat = document.getElementById('modeBtnChat');
                    const btnGen = document.getElementById('modeBtnGen');
                    const panel = document.getElementById('genControlsPanel');
                    const input = document.getElementById('userInput');
                    if (btnChat) btnChat.classList.remove('active');
                    if (btnGen) btnGen.classList.add('active');
                    if (panel) panel.classList.add('show');
                    if (input) input.placeholder = '输入图片描述词，Enter 发送';
                } else if (mode === 'fav') {
                    favMode = true;
                    document.documentElement.setAttribute('data-mode', 'fav');
                    const btnChat = document.getElementById('modeBtnChat');
                    const btnGen = document.getElementById('modeBtnGen');
                    const btnFav = document.getElementById('modeBtnFav');
                    const favPage = document.getElementById('favPage');
                    const input = document.getElementById('userInput');
                    if (btnChat) btnChat.classList.remove('active');
                    if (btnGen) btnGen.classList.remove('active');
                    if (btnFav) btnFav.classList.add('active');
                    if (favPage) favPage.classList.add('show');
                    if (input) input.placeholder = '收藏页面';
                }
            } catch(e) {}
        })();
