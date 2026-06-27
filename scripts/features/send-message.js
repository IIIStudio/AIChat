        // ============================================================
        //  发送消息
        // ============================================================
        function sendMessage() {
            if (favMode) return; // 收藏模式不发送消息
            const text = userInput.value.trim();

            // 生图模式
            if (imageGenMode) {
                if (!text) return;
                sendImageGeneration(text);
                return;
            }

            const hasImage = pendingFiles.length > 0;
            if (!text && !hasImage) return;

            // 【网络搜索/TinyFish】【重置面板】在发送新消息前重置并隐藏右侧侧边栏展示状态
            clearSearchProcess();
            toggleSearchSidebar(false);

            const provider = getActiveProvider();
            if (!provider || !provider.apiUrl || !provider.apiKey || !activeModel) {
                showToast('请配置 API 参数！');
                openSettings();
                return;
            }

            const currentSession = sessions.find(s => s.id === getCurrentId());
            currentSession.type = 'chat'; // 确保类型正确
            if (currentSession.messages.length === 0) {
                currentSession.title = text.length > 12 ? text.substring(0, 12) + '...' : text || '图片消息';
                renderSidebar();
            }

            let content, displayText, imageForDisplay = null;
            if (hasImage) {
                // 1.构建 OpenAI 多图格式：文本 + 多个 image_url
                const imageContents = pendingFiles.map(f => ({ type: 'image_url', image_url: { url: f.base64 } }));
                content = text ? [{ type: 'text', text: text }, ...imageContents] : imageContents;
                displayText = text || '图片';
                // 2.展示用第一张图缩略图（多图在 appendMessageDOM 中循环渲染）
                imageForDisplay = pendingFiles.map(f => f.base64);
            } else {
                content = text;
                displayText = text;
            }

            enableChatAutoScroll();
            appendMessageDOM('user', displayText, null, imageForDisplay, null, currentSession.messages.length);
            currentSession.messages.push({ role: "user", content: content });
            saveSessionsToStorage();
            
            clearImagePreview();
            userInput.value = '';
            userInput.style.height = '24px';
            
            fetchAIResponse();
        }

        // ============================================================
        //  图片生成
        // ============================================================
        async function sendImageGeneration(prompt, skipUserMsg = false) {
            saveGenSettings(); // 每次生图前保存设置
            const provider = getActiveProvider();
            if (!provider || !provider.apiUrl || !provider.apiKey || !activeModel) {
                showToast('请配置 API 参数！');
                openSettings();
                return;
            }

            const currentSession = sessions.find(s => s.id === getCurrentId());
            enableChatAutoScroll();
            currentSession.type = 'gen'; // 确保类型正确
            if (!skipUserMsg && currentSession.messages.length === 0) {
                currentSession.title = prompt.length > 12 ? prompt.substring(0, 12) + '...' : prompt || '生图';
                renderSidebar();
            }

            if (!skipUserMsg) {
                // 显示用户消息
                appendMessageDOM('user', prompt, null, null, null, currentSession.messages.length);
                currentSession.messages.push({ role: "user", content: prompt });
                saveSessionsToStorage();
            }

            userInput.value = '';
            userInput.style.height = '24px';

            const msgIdx = currentSession.messages.length;
            const aiMsgEl = appendMessageDOM('assistant', '正在生成图片...', null, null, null, msgIdx);

            try {
                currentAbortController = new AbortController();
                setResponding(true);
                let baseUrl = (provider.apiUrl || '').trim().replace(/\/+$/, '');
                if (baseUrl.endsWith('/chat/completions')) {
                    baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
                }
                const genUrl = baseUrl + '/images/generations';

                const seedVal = parseInt(document.getElementById('genSeed').value) || 0;
                const body = {
                    model: activeModel,
                    prompt: prompt,
                    num_images_per_prompt: 1,
                    negative_prompt: document.getElementById('genNegativePrompt').value.trim() || undefined,
                    num_inference_steps: parseInt(document.getElementById('genSteps').value) || 9,
                    guidance_scale: parseFloat(document.getElementById('genGuidanceScale').value) || 1,
                    image_scale: parseFloat(document.getElementById('genImageScale').value) || 1,
                    size: getGenSize(),
                };
                if (seedVal !== 0) body.seed = seedVal; // 0=随机，不传

                // 控制模式
                const controlMode = document.getElementById('genControlMode').value;
                if (controlMode) {
                    body.control_mode = controlMode;
                    body.control_context_scale = parseFloat(document.getElementById('genControlScale').value) || 0.75;
                    if (genControlImage) {
                        body.control_image = genControlImage.base64;
                    }
                }

                const response = await fetch(genUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
                    body: JSON.stringify(body),
                    signal: currentAbortController?.signal
                });

                if (!response.ok) {
                    const errText = await response.text();
                    let errMsg = `HTTP ${response.status}`;
                    try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch(e) {}
                    throw new Error(errMsg);
                }

                const data = await response.json();

                // 处理生成结果
                const genImages = [];       // 持久化：{b64, type}
                let resultHtml = '';        // 持久化用的 HTML（占位符）
                if (data.data && data.data.length > 0) {
                    for (let i = 0; i < data.data.length; i++) {
                        const imgData = data.data[i];
                        if (imgData.url) {
                            const url = imgData.url;
                            resultHtml += `<div style="position:relative;display:inline-block;margin:4px;">
                                <img src="${escapeHtml(url)}" onclick="previewGenImage('${escapeHtml(url)}')" 
                                    style="max-width:280px;max-height:280px;border-radius:12px;cursor:pointer;border:1px solid var(--border-color);"
                                    onerror="this.style.display='none';">
                            </div>`;
                        } else if (imgData.b64_json) {
                            const idx = genImages.length;
                            genImages.push({ b64: imgData.b64_json, type: imgData.type || 'image/png' });
                            resultHtml += `<div style="position:relative;display:inline-block;margin:4px;">
                                <img src="" data-gen-idx="${idx}" data-gen-src="" onclick="previewGenImage(this.src)" 
                                    style="max-width:280px;max-height:280px;border-radius:12px;cursor:pointer;border:1px solid var(--border-color);">
                            </div>`;
                        }
                    }
                    if (resultHtml) {
                        resultHtml = '<div class="generated-images">' + resultHtml + '</div>';
                    } else {
                        resultHtml = '已生成但无法显示图片';
                    }
                } else {
                    resultHtml = '未能生成图片，请检查参数后重试';
                }

                // 持久化（使用占位符版本，images 数组单独存储）
                const genParams = {
                    size: getGenSize(),
                    steps: parseInt(document.getElementById('genSteps').value) || 9,
                    guidance: parseFloat(document.getElementById('genGuidanceScale').value) || 1,
                    imgScale: parseFloat(document.getElementById('genImageScale').value) || 1,
                    seed: seedVal,
                    negative: document.getElementById('genNegativePrompt').value.trim() || '',
                    control: document.getElementById('genControlMode').value || '',
                    controlScale: document.getElementById('genControlScale').value || ''
                };
                const msgData = {
                    role: "assistant",
                    content: resultHtml,
                    model: activeModel,
                    genPrompt: prompt,
                    genParams: genParams,
                    isHtml: true
                };
                if (genImages.length > 0) msgData.images = genImages;
                currentSession.messages.push(msgData);
                if (pendingVersions !== null) {
                    currentSession.messages[currentSession.messages.length - 1].versions = pendingVersions;
                    pendingVersions = null;
                }
                saveSessionsToStorage();
                renderChatArea(); // 用 renderChatArea 重建，正确显示版本导航 ◂ ▸

                // 清理控制图片
                clearGenControlImage();

            } catch (error) {
                if (error.name === 'AbortError') return;
                const errFull = `生图失败: ${error.message || '未知错误'}`;
                aiMsgEl.textContent = errFull;
                currentSession.messages.push({ role: "assistant", content: errFull });
                saveSessionsToStorage();
                renderChatArea();
            } finally {
                currentAbortController = null;
                setResponding(false);
                if (shouldAutoScroll) {
                    requestChatAutoScroll();
                }
            }
        }

        function previewGenImage(src) {
            document.getElementById('imgLightboxImg').src = src;
            document.getElementById('imgLightbox').classList.add('show');
        }

        function closeImgLightbox() {
            document.getElementById('imgLightbox').classList.remove('show');
            document.getElementById('imgLightboxImg').src = '';
        }

        function downloadGenImageFromSrc(src) {
            const a = document.createElement('a');
            a.href = src;
            a.download = 'generated-image.png';
            a.click();
        }

        function downloadGenImage(b64Data, index) {
            const a = document.createElement('a');
            a.href = 'data:image/png;base64,' + b64Data;
            a.download = `generated-image-${index}.png`;
            a.click();
        }

        // 下载消息块中的所有生成图片
        function downloadGenBlockImages(btnEl) {
            const block = btnEl.closest('.message-block');
            const imgs = block.querySelectorAll('.generated-images img, .message-content img');
            if (imgs.length === 0) { showToast('没有可下载的图片'); return; }
            imgs.forEach((img, i) => {
                setTimeout(() => {
                    const src = img.getAttribute('data-gen-src') || img.src;
                    if (src) downloadGenImageFromSrc(src);
                }, i * 200);
            });
            showToast(`正在下载 ${imgs.length} 张图片`);
        }

        // 收藏消息块中的生成图片
        function favGenBlockImages(btnEl) {
            const block = btnEl.closest('.message-block');
            const contentEl = block.querySelector('.message-content');
            const msgIdx = parseInt(contentEl.getAttribute('data-index'));
            if (isNaN(msgIdx)) return;
            const session = sessions.find(s => s.id === getCurrentId());
            if (!session) return;
            const msg = session.messages[msgIdx];
            if (!msg) return;
            const prompt = msg.genPrompt || '';
            const genModel = msg.model || activeModel;
            const imgs = block.querySelectorAll('.generated-images img, .message-content img');
            let count = 0;
            imgs.forEach(img => {
                let src = img.getAttribute('data-gen-src') || img.src;
                if (!src || src === 'null' || src === 'undefined') return;
                // 对于占位符，从 session 消息的 images 数组中还原
                const dataIdx = parseInt(img.getAttribute('data-gen-idx'));
                if (!isNaN(dataIdx) && msg.images && msg.images[dataIdx]) {
                    const gi = msg.images[dataIdx];
                    src = 'data:' + (gi.type || 'image/png') + ';base64,' + gi.b64;
                }
                addFavorite(src, prompt, 'gen', genModel);
                count++;
            });
            if (count > 0) {
                btnEl.style.fill = '#e74c3c';
                btnEl.removeAttribute('stroke');
                btnEl.style.stroke = 'none';
                btnEl.style.color = '#e74c3c';
            }
        }

        // 检查生成消息是否已收藏（通过 prompt 匹配）
        function isGenMsgFavorited(msg) {
            if (!msg || !msg.genPrompt) return false;
            const prompt = msg.genPrompt;
            // 如果有 images 数组（base64），逐一比对
            if (msg.images && msg.images.length > 0) {
                return msg.images.some(gi => {
                    const src = 'data:' + (gi.type || 'image/png') + ';base64,' + gi.b64;
                    return favorites.some(f => f.imageSrc === src && f.prompt === prompt);
                });
            }
            // URL 类型：从 HTML 中提取图片 URL 后比对
            const html = typeof msg.content === 'string' ? msg.content : '';
            const urlMatches = html.match(/src="([^"]+)"/g);
            if (urlMatches) {
                return urlMatches.some(m => {
                    const src = m.replace(/^src="/, '').replace(/"$/, '');
                    return favorites.some(f => f.imageSrc === src && f.prompt === prompt);
                });
            }
            // 兜底：仅按 prompt 匹配
            return favorites.some(f => f.prompt === prompt);
        }
