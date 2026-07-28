// ============================================================
//  对话转语音 (TTS)
//  使用 Edge 默认专用语音 Microsoft Xiaoxiao Online 朗读助手消息
//  通过 MutationObserver 自动注入「朗读」按钮，与渲染逻辑解耦
// ============================================================
(function () {
    'use strict';

    var TARGET_VOICE_KEYWORD = 'Xiaoxiao';
    var UTTER_LANG = 'zh-CN';
    var BTN_CLASS = 'tts-btn';
    var BTN_ACTIVE_CLASS = 'tts-btn-active';

    var preferredVoice = null;
    var currentBtn = null;   // 当前正在朗读的消息按钮
    var isPaused = false;

    function isSupported() {
        return typeof window !== 'undefined'
            && 'speechSynthesis' in window
            && 'SpeechSynthesisUtterance' in window;
    }

    // ---------- 图标 ----------
    function svgIcon(paths) {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
    }
    function speakerIcon() {
        return svgIcon('<path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>');
    }
    function stopIcon() {
        return svgIcon('<rect x="6" y="6" width="12" height="12" rx="2"></rect>');
    }
    function playIcon() {
        return svgIcon('<polygon points="5 3 19 12 5 21 5 3"></polygon>');
    }

    // ---------- 语音选择 ----------
    function pickVoice() {
        if (!isSupported()) return;
        var voices = window.speechSynthesis.getVoices() || [];
        if (!voices.length) { preferredVoice = null; return; }
        preferredVoice =
            voices.filter(function (v) { return /Xiaoxiao/i.test(v.name); })[0] ||
            // Edge 在线中文自然语音兜底
            voices.filter(function (v) { return /Microsoft.*Online/i.test(v.name) && /zh|Chinese/i.test(v.lang); })[0] ||
            // 任意中文语音
            voices.filter(function (v) { return /^zh/i.test(v.lang); })[0] ||
            null;
    }

    if (isSupported()) {
        pickVoice();
        window.speechSynthesis.onvoiceschanged = pickVoice;
    }

    // ---------- 文本提取 ----------
    /**
     * 从助手消息块提取可朗读的纯文本
     * 优先使用 data-raw（Markdown 源），并清理语法符号；剔除代码/图表等
     */
    function extractSpeakableText(block) {
        var content = block.querySelector('.message-content');
        if (!content) return '';
        // 含图片（生图 HTML 消息）不朗读
        if (content.querySelector('img')) return '';
        var raw = content.getAttribute('data-raw') || '';
        var text = raw ? raw : content.textContent;
        text = text
            .replace(/!\[[^\]]*\]\([^)]*\)/g, '')        // 图片
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // 链接保留文字
            .replace(/```[\s\S]*?```/g, ' ')              // 代码块
            .replace(/`([^`]+)`/g, '$1')                  // 行内代码
            .replace(/^\s{0,3}#{1,6}\s+/gm, '')           // 标题
            .replace(/^\s{0,3}>\s?/gm, '')                // 引用
            .replace(/^\s{0,3}[-*+]\s+/gm, '')            // 无序列表
            .replace(/^\s{0,3}\d+\.\s+/gm, '')            // 有序列表
            .replace(/^\s{0,3}[-:|]\s*[-:|\s]+$/gm, '')   // 表格分隔行
            .replace(/\|/g, ' ')                          // 表格分隔符
            .replace(/\*\*|__/g, '')                      // 粗体
            .replace(/\*|_/g, '')                         // 斜体
            .replace(/~~([^~]+)~~/g, '$1')                // 删除线
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        return text;
    }

    // ---------- 按钮状态 ----------
    function resetButtonState(btn) {
        if (!btn) return;
        btn.classList.remove(BTN_ACTIVE_CLASS);
        btn.setAttribute('title', '朗读');
        btn.innerHTML = speakerIcon();
    }
    function setButtonPlaying(btn) {
        btn.classList.add(BTN_ACTIVE_CLASS);
        btn.setAttribute('title', '暂停朗读');
        btn.innerHTML = stopIcon();
    }
    function setButtonPaused(btn) {
        btn.classList.add(BTN_ACTIVE_CLASS);
        btn.setAttribute('title', '继续朗读');
        btn.innerHTML = playIcon();
    }

    // ---------- 朗读控制 ----------
    function stopSpeaking() {
        if (!isSupported()) return;
        try { window.speechSynthesis.cancel(); } catch (e) {}
        if (currentBtn) {
            resetButtonState(currentBtn);
            currentBtn = null;
        }
        isPaused = false;
    }

    function speakBlock(block, btn) {
        if (!isSupported()) {
            if (window.showToast) window.showToast('当前浏览器不支持语音合成');
            return;
        }
        // 点击正在朗读的消息 -> 暂停 / 继续
        if (currentBtn === btn) {
            if (isPaused) {
                window.speechSynthesis.resume();
                isPaused = false;
                setButtonPlaying(btn);
            } else {
                window.speechSynthesis.pause();
                isPaused = true;
                setButtonPaused(btn);
            }
            return;
        }
        // 切换到新消息 -> 先停止旧的
        stopSpeaking();

        var text = extractSpeakableText(block);
        if (!text) {
            if (window.showToast) window.showToast('没有可朗读的内容');
            return;
        }

        var utter = new SpeechSynthesisUtterance(text);
        utter.lang = UTTER_LANG;
        if (!preferredVoice) pickVoice();
        if (preferredVoice) utter.voice = preferredVoice;
        utter.rate = 1.5;
        utter.pitch = 1;
        utter.volume = 1;

        utter.onstart = function () {
            currentBtn = btn;
            isPaused = false;
            setButtonPlaying(btn);
        };
        utter.onend = function () {
            if (currentBtn === btn) {
                resetButtonState(btn);
                currentBtn = null;
            }
            isPaused = false;
        };
        utter.onerror = function (e) {
            if (currentBtn === btn) {
                resetButtonState(btn);
                currentBtn = null;
            }
            isPaused = false;
            // 被打断/取消不算错误，不提示
            if (e && e.error && /interrupt|cancel/i.test(e.error)) return;
            if (window.showToast) window.showToast('语音朗读失败：' + (e && e.error ? e.error : '未知错误'));
        };

        // 部分浏览器需要在交互后才能播放，确保队列刷新
        try { window.speechSynthesis.cancel(); } catch (e) {}
        window.speechSynthesis.speak(utter);
    }

    // 暴露全局函数，便于 onclick 调用
    window.speakMessage = function (btn) {
        var block = btn.closest('.message-block');
        if (!block) return;
        speakBlock(block, btn);
    };
    window.stopTTS = stopSpeaking;
    window.getTTSVoice = function () { return preferredVoice; };

    // ---------- 自动播放 ----------
    var AUTO_KEY = 'ttsAutoPlay';
    function autoPlayEnabled() {
        try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch (e) { return true; }
    }
    function setAutoPlayEnabled(on) {
        try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch (e) {}
    }
    window.toggleTTSAutoPlay = function () {
        var on = !autoPlayEnabled();
        setAutoPlayEnabled(on);
        if (!on) stopSpeaking();
        updateAutoPlayBtn();
        if (window.showToast) window.showToast(on ? '已开启自动朗读' : '已关闭自动朗读');
        return on;
    };

    var suppressAutoOnce = false;

    function autoplayLatest() {
        if (!isSupported() || !autoPlayEnabled()) return;
        if (suppressAutoOnce) { suppressAutoOnce = false; return; }
        var inner = document.getElementById('chatInner');
        if (!inner) return;
        var blocks = inner.querySelectorAll('.message-block.assistant-block');
        if (!blocks.length) return;
        var block = blocks[blocks.length - 1];
        var content = block.querySelector('.message-content');
        if (!content) return;
        if (content.querySelector('img')) return; // 生图消息不朗读
        var raw = (content.getAttribute('data-raw') || '').trim();
        if (!raw) return;
        // 跳过错误/中止提示
        if (/^(请求失败|已中止|该模型不支持图片输入|提示：)/.test(raw)) return;
        scanAll(); // 确保按钮已注入
        var btn = block.querySelector('.' + BTN_CLASS);
        if (btn) window.speakMessage(btn);
    }

    function hookResponding() {
        if (typeof window.setResponding !== 'function' || window.__ttsHooked) return;
        var orig = window.setResponding;
        window.__ttsHooked = true;
        window.setResponding = function (v) {
            orig(v);
            if (v === false) {
                // 延迟一帧，等待 renderChatArea / observer 注入按钮
                setTimeout(autoplayLatest, 60);
            }
        };
    }

    function hookStopButton() {
        var btn = document.getElementById('sendBtn');
        if (!btn || btn.__ttsStopHooked) return;
        btn.__ttsStopHooked = true;
        btn.addEventListener('click', function () {
            // 响应中点击发送按钮 = 用户主动停止，抑制本次自动朗读
            if (this.classList.contains('responding')) suppressAutoOnce = true;
        }, true);
    }

    function updateAutoPlayBtn() {
        var b = document.getElementById('ttsAutoBtn');
        if (!b) return;
        var on = autoPlayEnabled();
        b.classList.toggle('active', on);
        var span = b.querySelector('span');
        if (span) span.textContent = on ? '自动朗读' : '关闭朗读';
        b.setAttribute('title', on ? '自动朗读：开（点击关闭）' : '自动朗读：关（点击开启）');
    }

    function injectAutoPlayToggle() {
        if (document.getElementById('ttsAutoBtn')) return;
        var nav = document.querySelector('.nav-right-actions');
        if (!nav) return;
        var b = document.createElement('button');
        b.id = 'ttsAutoBtn';
        b.className = 'tts-auto-btn';
        b.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-surface);color:var(--text-muted);cursor:pointer;font-size:12px;transition:all .2s;flex-shrink:0;';
        b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span>自动朗读</span>';
        b.onclick = function () { window.toggleTTSAutoPlay(); };
        nav.insertBefore(b, nav.firstChild);
        updateAutoPlayBtn();
    }

    // ---------- 按钮注入 ----------
    function createTTSButton() {
        var btn = document.createElement('span');
        btn.className = BTN_CLASS;
        btn.setAttribute('title', '朗读');
        btn.setAttribute('role', 'button');
        btn.style.cssText = 'display:inline-flex;align-items:center;cursor:pointer;flex-shrink:0;';
        btn.innerHTML = speakerIcon();
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            window.speakMessage(this);
        });
        return btn;
    }

    function injectIntoActions(block) {
        if (block.getAttribute('data-tts-injected') === '1') return;
        var content = block.querySelector('.message-content');
        if (!content) return;
        // 仅对助手文本消息注入（含图片/生图消息不朗读）
        if (content.querySelector('img')) {
            block.setAttribute('data-tts-injected', '1');
            return;
        }
        var actions = block.querySelector('.message-actions');
        if (!actions) return;
        var btn = createTTSButton();
        // 放在最前
        actions.insertBefore(btn, actions.firstChild);
        block.setAttribute('data-tts-injected', '1');
    }

    function scanAll() {
        var inner = document.getElementById('chatInner');
        if (!inner) return;
        var blocks = inner.querySelectorAll('.message-block.assistant-block');
        for (var i = 0; i < blocks.length; i++) injectIntoActions(blocks[i]);
    }

    // 注入样式
    function injectStyle() {
        if (document.getElementById('tts-style')) return;
        var style = document.createElement('style');
        style.id = 'tts-style';
        style.textContent =
            '.tts-btn{transition:color .2s;outline:none;}' +
            '.tts-btn:hover{color:var(--text-main,#1f2329);}' +
            '.tts-btn-active{color:var(--accent,#19c37d)!important;}' +
            '.tts-btn-active svg{animation:ttsBlink 1s ease-in-out infinite;}' +
            '.tts-auto-btn:hover{color:var(--text-main,#1f2329);}' +
            '.tts-auto-btn.active{color:var(--accent,#19c37d);border-color:var(--accent,#19c37d);}' +
            '@keyframes ttsBlink{0%,100%{opacity:1}50%{opacity:.4}}';
        document.head.appendChild(style);
    }

    function init() {
        injectStyle();
        injectAutoPlayToggle();
        hookResponding();
        hookStopButton();
        if (!isSupported()) return;
        scanAll();
        var inner = document.getElementById('chatInner');
        if (inner && 'MutationObserver' in window) {
            var mo = new MutationObserver(function () { scanAll(); });
            // 仅监听直接子节点的增删（消息块级），避免流式输出时高频触发
            mo.observe(inner, { childList: true });
            window.__ttsObserver = mo;
        }
        window.addEventListener('beforeunload', stopSpeaking);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
