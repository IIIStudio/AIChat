        // ============================================================
        //  文件上传与粘贴 (多图)
        // ============================================================
        // pendingFiles 存储待发送的图片数组，每项为 { base64, name }
        let pendingFiles = [];

        // 处理文件选择：支持多文件，逐个读取为 base64 加入 pendingFiles
        function handleFileSelected(input) {
            if (!input.files || input.files.length === 0) return;
            const files = Array.from(input.files);
            for (const file of files) {
                if (!file.type.startsWith('image/')) { showToast('仅支持图片文件'); continue; }
                const reader = new FileReader();
                reader.onload = (e) => {
                    pendingFiles.push({ base64: e.target.result, name: file.name });
                    renderImagePreview();
                };
                reader.readAsDataURL(file);
            }
            input.value = '';
        }

        // 粘贴事件：从剪贴板提取图片文件加入 pendingFiles
        function handlePaste(e) {
            const items = e.clipboardData?.items;
            if (!items) return;
            let hasImage = false;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    hasImage = true;
                    const file = item.getAsFile();
                    if (!file) continue;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        pendingFiles.push({ base64: ev.target.result, name: `粘贴图片_${Date.now()}.png` });
                        renderImagePreview();
                    };
                    reader.readAsDataURL(file);
                }
            }
            if (hasImage) e.preventDefault();
        }

        // 渲染图片预览网格：每张图缩略图 + hover 删除按钮
        function renderImagePreview() {
            const area = document.getElementById('imagePreviewArea');
            const grid = document.getElementById('imagePreviewGrid');
            if (pendingFiles.length === 0) {
                area.style.display = 'none';
                grid.innerHTML = '';
                return;
            }
            area.style.display = 'flex';
            grid.innerHTML = '';
            pendingFiles.forEach((file, idx) => {
                const item = document.createElement('div');
                item.className = 'image-preview-item';
                const img = document.createElement('img');
                img.src = file.base64;
                img.title = file.name;
                const removeBtn = document.createElement('span');
                removeBtn.className = 'img-remove-btn';
                removeBtn.innerHTML = '&times;';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    pendingFiles.splice(idx, 1);
                    renderImagePreview();
                };
                item.appendChild(img);
                item.appendChild(removeBtn);
                grid.appendChild(item);
            });
        }

        // 清除所有图片预览
        function clearImagePreview() {
            pendingFiles = [];
            renderImagePreview();
        }
