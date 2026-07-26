        // ============================================================
        //  收藏管理
        // ============================================================
        let favorites = [];
        let favRenderedOnce = false; // 仅在首次初始化时渲染一次
        let favLazyState = null; // 懒加载状态

        async function loadFavorites() {
            try {
                const saved = await dbGet('favorites');
                if (saved && Array.isArray(saved)) favorites = saved;
            } catch(e) {}
        }

        async function saveFavorites() {
            try { await dbSet('favorites', favorites); } catch(e) {}
        }

        function addFavorite(src, prompt, type, model) {
            // 去重
            if (favorites.some(f => f.imageSrc === src && f.prompt === prompt)) {
                showToast('已收藏过此图片');
                return;
            }
            favorites.push({
                id: Date.now(),
                prompt: prompt,
                imageSrc: src,
                imageType: type || 'url',
                tags: [],
                model: model || '',
                addedAt: Date.now()
            });
            saveFavorites();
            // 原地追加卡片到瀑布流（避免全量重建）
            appendFavCard(favorites[favorites.length - 1]);
            showToast('已收藏');
        }

        function removeFavorite(id) {
            const numId = Number(id);
            favorites = favorites.filter(f => f.id !== numId);
            saveFavorites();
            // 原地移除卡片，不重建
            const card = document.querySelector('.fav-card[data-fav-id="' + numId + '"]');
            if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 200); }
            renderFavTagBar();
            showToast('已取消收藏');
        }

        // 标签管理
        let favFilterTag = null;
        let favTagInputCardId = null;

        function updateCardTags(card, fav) {
            const tagsDiv = card.querySelector('.fav-card-tags');
            if (!tagsDiv) return;
            const addBtn = tagsDiv.querySelector('.fav-tag-add-btn');
            tagsDiv.querySelectorAll('.fav-card-tag-badge').forEach(b => b.remove());
            if (fav.tags && fav.tags.length > 0) {
                fav.tags.forEach(tag => {
                    const b = document.createElement('span');
                    b.className = 'fav-card-tag-badge';
                    b.innerHTML = escapeHtml(tag) + '<span class="fav-tag-x" onclick="event.stopPropagation();removeTagFromFavorite(' + fav.id + ',\'' + escapeHtml(tag).replace(/'/g, "\\'") + '\')">×</span>';
                    tagsDiv.insertBefore(b, addBtn);
                });
            }
        }

        function addTagToFavorite(favId, tag) {
            tag = tag.trim().replace(/\s+/g, '');
            if (!tag) return;
            const fav = favorites.find(f => f.id === favId);
            if (!fav) return;
            if (!fav.tags) fav.tags = [];
            if (fav.tags.includes(tag)) { showToast('标签已存在'); return; }
            fav.tags.push(tag);
            saveFavorites();
            renderFavTagBar();
            const card = document.querySelector('.fav-card[data-fav-id="' + favId + '"]');
            if (card) updateCardTags(card, fav);
        }

        function removeTagFromFavorite(favId, tag) {
            const fav = favorites.find(f => f.id === favId);
            if (!fav) return;
            if (!fav.tags) return;
            fav.tags = fav.tags.filter(t => t !== tag);
            saveFavorites();
            renderFavTagBar();
            const card = document.querySelector('.fav-card[data-fav-id="' + favId + '"]');
            if (card) updateCardTags(card, fav);
        }

        function showFavTagInput(cardEl) {
            closeFavTagInput();
            const favId = Number(cardEl.getAttribute('data-fav-id'));
            favTagInputCardId = favId;
            const fav = favorites.find(f => f.id === favId);
            const currentTags = (fav && fav.tags) ? fav.tags : [];

            // 收集所有已有标签（去重）
            const allTags = {};
            favorites.forEach(f => {
                if (f.tags) f.tags.forEach(t => { allTags[t] = (allTags[t] || 0) + 1; });
            });
            // 排除当前卡片已有的标签
            const suggested = Object.entries(allTags)
                .filter(([t]) => !currentTags.includes(t))
                .sort((a, b) => b[1] - a[1])
                .map(([t]) => t);

            const popup = document.createElement('div');
            popup.className = 'fav-tag-input-popup';
            popup.id = 'favTagInputPopup';
            popup.onclick = (e) => e.stopPropagation();

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '输入或选择标签';
            input.maxLength = 20;

            const suggestList = document.createElement('div');
            suggestList.className = 'fav-tag-suggest-list';

            function renderSuggestions(filter) {
                suggestList.innerHTML = '';
                const list = filter ? suggested.filter(t => t.toLowerCase().includes(filter.toLowerCase())) : suggested;
                if (list.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'fav-tag-suggest-empty';
                    empty.textContent = filter ? '按下 Enter 创建新标签' : '暂无已有标签';
                    suggestList.appendChild(empty);
                } else {
                    list.forEach(tag => {
                        const item = document.createElement('div');
                        item.className = 'fav-tag-suggest-item';
                        item.textContent = tag;
                        item.onclick = () => {
                            addTagToFavorite(favId, tag);
                            closeFavTagInput();
                        };
                        suggestList.appendChild(item);
                    });
                }
            }

            input.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = input.value.trim().replace(/\s+/g, '');
                    if (val) {
                        if (currentTags.includes(val)) { showToast('标签已存在'); closeFavTagInput(); return; }
                        addTagToFavorite(favId, val);
                    }
                    closeFavTagInput();
                }
                if (e.key === 'Escape') { closeFavTagInput(); }
                e.stopPropagation();
            };
            input.oninput = () => renderSuggestions(input.value.trim());

            popup.appendChild(input);
            popup.appendChild(suggestList);
            document.body.appendChild(popup);

            // 使用 fixed 定位，根据卡片位置计算弹窗坐标
            function repositionPopup() {
                const rect = cardEl.getBoundingClientRect();
                const popupWidth = popup.offsetWidth || 180;
                const popupHeight = popup.offsetHeight || 40;
                // 弹窗默认显示在卡片底部下方
                let top = rect.bottom + 6;
                let left = rect.left + 8;
                // 如果底部空间不够，弹窗从卡片底部向上展开（标签上方，而非图片上方）
                if (top + popupHeight > window.innerHeight - 8) {
                    top = rect.bottom - popupHeight - 6;
                }
                // 不超出左右边界
                if (left + popupWidth > window.innerWidth - 8) left = window.innerWidth - popupWidth - 8;
                if (left < 8) left = 8;
                // 如果上方也不够，贴窗口顶部
                if (top < 4) top = 4;
                popup.style.top = top + 'px';
                popup.style.left = left + 'px';
            }
            repositionPopup();

            // 渲染建议后重新定位
            const origRender = renderSuggestions;
            renderSuggestions = function(filter) {
                origRender(filter);
                setTimeout(repositionPopup, 10);
            };

            renderSuggestions('');
            setTimeout(() => { input.focus(); }, 50);
        }

        function closeFavTagInput() {
            const p = document.getElementById('favTagInputPopup');
            if (p) p.remove();
            favTagInputCardId = null;
        }

        // 点击外部关闭标签输入
        document.addEventListener('click', function(e) {
            if (favTagInputCardId !== null && !e.target.closest('#favTagInputPopup') && !e.target.closest('.fav-tag-add-btn')) {
                closeFavTagInput();
            }
        });

        // 窗口大小变化时重新渲染（列数变化影响横向阅读顺序）
        (function() {
            let lastColumnCount = getFavColumnCount();
            let resizeTimer;
            window.addEventListener('resize', function() {
                const newCount = getFavColumnCount();
                if (newCount !== lastColumnCount) {
                    lastColumnCount = newCount;
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(function() {
                        if (document.documentElement.getAttribute('data-mode') === 'fav') {
                            renderFavorites();
                        }
                    }, 250);
                }
            });
        })();

        function filterByTag(tag) {
            if (favFilterTag === tag) {
                favFilterTag = null;
            } else {
                favFilterTag = tag;
            }
            // 不重建 DOM，只切换卡片可见性，避免图片重新加载
            applyFavFilter();
            renderFavTagBar();
        }

        // 根据当前筛选标签切换卡片可见性
        function applyFavFilter() {
            const cards = document.querySelectorAll('.fav-card');
            cards.forEach(card => {
                const favId = Number(card.getAttribute('data-fav-id'));
                const fav = favorites.find(f => f.id === favId);
                if (!favFilterTag || (fav && fav.tags && fav.tags.includes(favFilterTag))) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function getFilteredFavorites() {
            if (!favFilterTag) return favorites.slice();
            return favorites.filter(f => f.tags && f.tags.includes(favFilterTag));
        }

        function renderFavTagBar() {
            const bar = document.getElementById('favTagBar');
            if (!bar) return;
            bar.innerHTML = '';
            if (favorites.length === 0) return;

            const tagCounts = {};
            favorites.forEach(f => {
                if (f.tags) f.tags.forEach(t => {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            });
            const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
            if (sorted.length === 0) return;

            sorted.forEach(([tag, count]) => {
                const chip = document.createElement('span');
                chip.className = 'fav-tag-chip' + (favFilterTag === tag ? ' active' : '');
                chip.textContent = tag + '（' + count + '）';
                chip.onclick = () => filterByTag(tag);
                bar.appendChild(chip);
            });

            if (favFilterTag) {
                const clear = document.createElement('span');
                clear.className = 'fav-tag-chip';
                clear.textContent = '✕ 全部';
                clear.onclick = () => filterByTag(favFilterTag);
                bar.appendChild(clear);
            }
        }

        function downloadFavImage(imageSrc) {
            const a = document.createElement('a');
            a.href = imageSrc;
            a.download = 'favorite-image.png';
            a.click();
        }

        function copyFavPrompt(prompt) {
            navigator.clipboard.writeText(prompt).then(() => {
                showToast('提示词已复制');
            }).catch(() => {
                showToast('复制失败');
            });
        }

        // 创建单张收藏卡片
        function createFavCard(fav, index) {
            const card = document.createElement('div');
            card.className = 'fav-card';
            card.style.animationDelay = (index * 0.05) + 's';
            card.setAttribute('data-fav-id', fav.id);
            card.setAttribute('data-fav-prompt', fav.prompt);
            card.setAttribute('data-fav-src', fav.imageSrc);

            const overlay = document.createElement('div');
            overlay.className = 'fav-card-overlay';

            const downloadBtn = document.createElement('button');
            downloadBtn.title = '下载图片';
            downloadBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
            downloadBtn.onclick = function(e) { e.stopPropagation(); downloadFavImage(card.getAttribute('data-fav-src')); };

            const copyBtn = document.createElement('button');
            copyBtn.title = '复制提示词';
            copyBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            copyBtn.onclick = function(e) { e.stopPropagation(); copyFavPrompt(card.getAttribute('data-fav-prompt')); };

            const unfavBtn = document.createElement('button');
            unfavBtn.title = '取消收藏';
            unfavBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="fill:none;pointer-events:none;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
            unfavBtn.onclick = function(e) { e.stopPropagation(); removeFavorite(card.getAttribute('data-fav-id')); };

            const genBtn = document.createElement('button');
            genBtn.title = '发送提示词到生图';
            genBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>';
            genBtn.onclick = function(e) { e.stopPropagation(); setMode('gen'); userInput.value = fav.prompt; userInput.style.height = 'auto'; userInput.style.height = userInput.scrollHeight + 'px'; userInput.focus(); showToast('已填入提示词'); };

            overlay.appendChild(downloadBtn);
            overlay.appendChild(copyBtn);
            overlay.appendChild(genBtn);
            overlay.appendChild(unfavBtn);

            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'fav-card-tags';
            const tagAddBtn = document.createElement('div');
            tagAddBtn.className = 'fav-tag-add-btn';
            tagAddBtn.textContent = '+';
            tagAddBtn.title = '添加标签';
            tagAddBtn.onclick = function(e) { e.stopPropagation(); showFavTagInput(card); };
            tagsDiv.appendChild(tagAddBtn);
            if (fav.tags && fav.tags.length > 0) {
                fav.tags.forEach(tag => {
                    const b = document.createElement('span');
                    b.className = 'fav-card-tag-badge';
                    b.innerHTML = escapeHtml(tag) + '<span class="fav-tag-x" onclick="event.stopPropagation();removeTagFromFavorite(' + fav.id + ',\'' + escapeHtml(tag).replace(/'/g, "\\'") + '\')">×</span>';
                    tagsDiv.appendChild(b);
                });
            }

            const img = document.createElement('img');
            img.src = fav.imageSrc;
            img.loading = 'lazy';
            img.alt = '';
            img.onclick = function() { previewGenImage(fav.imageSrc); };
            img.onerror = function() { this.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="#ddd" width="200" height="150"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-size="12">图片失效</text></svg>'); };

            card.appendChild(overlay);

            if (fav.model) {
                const modelBadge = document.createElement('div');
                modelBadge.className = 'fav-card-model-badge';
                const logo = getLogoForModel(fav.model);
                const logoHtml = logo ? '<img src="' + logo + '" alt="" onerror="this.style.display=\'none\'">' : '<span class="model-logo-fallback">AI</span>';
                modelBadge.innerHTML = logoHtml + escapeHtml(fav.model);
                card.appendChild(modelBadge);
            }

            card.appendChild(tagsDiv);
            card.appendChild(img);
            return card;
        }

        // 追加新收藏卡片（全量重建以保证横向阅读顺序）
        function appendFavCard(fav) {
            const waterfall = document.getElementById('favWaterfall');
            if (!waterfall) return;
            // 如果有筛选且新卡片不匹配，不追加
            if (favFilterTag && (!fav.tags || !fav.tags.includes(favFilterTag))) return;
            // 全量重建以保证 CSS 列布局中的横向阅读顺序
            renderFavorites();
        }

        // 获取当前瀑布流的列数
        function getFavColumnCount() {
            const w = window.innerWidth;
            if (w > 1100) return 5;
            if (w > 860) return 4;
            if (w > 600) return 3;
            return 2;
        }

        function renderFavorites() {
            const waterfall = document.getElementById('favWaterfall');
            if (!waterfall) return;
            closeFavTagInput();
            renderFavTagBar();
            favLazyState = null;

            if (favorites.length === 0) {
                waterfall.innerHTML = '<div class="fav-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><h3>暂无收藏</h3><p>在生图模式下点击图片旁的收藏按钮即可收藏</p></div>';
                return;
            }
            waterfall.innerHTML = '';
            const allFavs = getFilteredFavorites();
            if (allFavs.length === 0) {
                waterfall.innerHTML = '<div class="fav-empty"><h3>该标签下无收藏</h3></div>';
                return;
            }

            // 使用 flexbox 分列布局，创建列容器并按顺序分配卡片
            const N = getFavColumnCount();
            const columns = [];
            for (let c = 0; c < N; c++) {
                const col = document.createElement('div');
                col.className = 'fav-column';
                waterfall.appendChild(col);
                columns.push(col);
            }

            // 懒加载状态
            favLazyState = {
                allFavs,
                columns,
                renderedCount: 0,
                pageSize: 20,
                N
            };

            // 渲染首批
            renderNextFavBatch();
        }

        // 渲染下一批收藏卡片
        function renderNextFavBatch() {
            if (!favLazyState) return;
            const { allFavs, columns, renderedCount, pageSize, N } = favLazyState;
            if (renderedCount >= allFavs.length) return;
            const batch = allFavs.slice(renderedCount, renderedCount + pageSize);
            batch.forEach((fav, idx) => {
                const globalIdx = renderedCount + idx;
                const card = createFavCard(fav, globalIdx);
                columns[globalIdx % N].appendChild(card);
            });
            favLazyState.renderedCount += batch.length;
        }

        // 收藏页滚动懒加载（下滑时加载更多）
        (function() {
            const favPage = document.getElementById('favPage');
            if (!favPage) return;
            let scrollTimer;
            favPage.addEventListener('scroll', function() {
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(function() {
                    if (!favLazyState) return;
                    if (favLazyState.renderedCount >= favLazyState.allFavs.length) return;
                    if (favPage.scrollTop + favPage.clientHeight >= favPage.scrollHeight - 300) {
                        renderNextFavBatch();
                    }
                }, 80);
            });
        })();
