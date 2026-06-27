        // ============================================================
        //  Mermaid 全屏放大查看器逻辑
        // ============================================================
        // 存储放大查看器的变换参数
        let viewerScale = 1.0;
        let viewerTranslateX = 0;
        let viewerTranslateY = 0;
        let isDraggingViewer = false;
        let dragStartX = 0;
        let dragStartY = 0;

        /**
         * 弹出 Mermaid 全屏放大查看器并装载 SVG 结构
         * @param {string} svgHtml - Mermaid 渲染出的 SVG 代码
         * @returns {void}
         */
        window.openMermaidViewer = function(svgHtml) {
            const canvas = document.getElementById('viewerCanvas');
            const body = document.getElementById('viewerBody');
            const modal = document.getElementById('mermaidViewerModal');
            if (!canvas) return;
            canvas.innerHTML = '';
            const graph = document.createElement('div');
            graph.className = 'mermaid viewer-mermaid';
            graph.innerHTML = svgHtml;
            canvas.appendChild(graph);

            // 1. 先显示弹窗，以便测量可用尺寸
            if (modal) modal.style.display = 'flex';

            const svg = canvas.querySelector('svg');
            if (svg && body) {
                // 解除 mermaid 内置的最大宽高限制
                svg.style.maxWidth = 'none';
                svg.style.maxHeight = 'none';
                svg.style.display = 'block';

                // 2. 取 viewBox 作为原始比例依据；缺失时回退到 width/height 属性
                let vbW = 0, vbH = 0;
                const vb = svg.getAttribute('viewBox');
                if (vb) {
                    const p = vb.split(/[\s,]+/).map(Number);
                    if (p.length === 4) { vbW = p[2]; vbH = p[3]; }
                }
                if (!vbW || !vbH) {
                    vbW = parseFloat(svg.getAttribute('width')) || 800;
                    vbH = parseFloat(svg.getAttribute('height')) || 600;
                }

                // 3. 移除硬编码尺寸，改用按视口等比缩放后的明确尺寸，避免在绝对定位画布中塌缩为空白
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                const bw = Math.max(body.clientWidth - 80, 100);
                const bh = Math.max(body.clientHeight - 80, 100);
                const fit = Math.min(bw / vbW, bh / vbH);
                svg.setAttribute('width', Math.max(vbW * fit, 1));
                svg.setAttribute('height', Math.max(vbH * fit, 1));
            }

            // 4. 重置画板坐标和比例
            resetMermaidViewer();
        };

        /**
         * 关闭 Mermaid 放大查看器并释放 DOM 节点
         * @returns {void}
         */
        window.closeMermaidViewer = function() {
            const modal = document.getElementById('mermaidViewerModal');
            if (modal) modal.style.display = 'none';
            
            const canvas = document.getElementById('viewerCanvas');
            if (canvas) canvas.innerHTML = '';
        };

        /**
         * 重置 Mermaid 查看器的缩放比例与平移中心
         * @returns {void}
         */
        window.resetMermaidViewer = function() {
            viewerScale = 1.0;
            viewerTranslateX = 0;
            viewerTranslateY = 0;
            updateViewerTransform();
        };

        /**
         * 对 Mermaid 图表进行指定因子的缩放
         * @param {number} factor - 缩放系数
         * @returns {void}
         */
        window.zoomMermaidViewer = function(factor) {
            viewerScale *= factor;
            
            // 1. 限制极限缩放值以保证图形不致消失或过载
            viewerScale = Math.max(0.1, Math.min(10, viewerScale));
            updateViewerTransform();
        };

        /**
         * 重新计算并应用画布的 CSS 变换矩阵
         * @returns {void}
         */
        function updateViewerTransform() {
            const canvas = document.getElementById('viewerCanvas');
            if (canvas) {
                canvas.style.transform = `translate(${viewerTranslateX}px, ${viewerTranslateY}px) scale(${viewerScale})`;
            }
        }

        /**
         * 响应滚轮手势对画板进行缩放
         * @param {WheelEvent} e - 滚轮事件对象
         * @returns {void}
         */
        window.handleMermaidViewerWheel = function(e) {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            zoomMermaidViewer(factor);
        };

        /**
         * 响应鼠标按下开始拖拽平移画布
         * @param {MouseEvent} e - 鼠标按键按下事件对象
         * @returns {void}
         */
        window.startDragMermaidViewer = function(e) {
            // 1. 只响应左键拖拽
            if (e.button !== 0) return;
            isDraggingViewer = true;
            
            // 2. 缓存平移基点
            dragStartX = e.clientX - viewerTranslateX;
            dragStartY = e.clientY - viewerTranslateY;

            const body = document.getElementById('viewerBody');
            if (body) body.style.cursor = 'grabbing';

            document.addEventListener('mousemove', dragMermaidViewer);
            document.addEventListener('mouseup', stopDragMermaidViewer);
        };

        /**
         * 鼠标移动事件，实时平移画布位置
         * @param {MouseEvent} e - 鼠标移动事件对象
         * @returns {void}
         */
        function dragMermaidViewer(e) {
            if (!isDraggingViewer) return;
            viewerTranslateX = e.clientX - dragStartX;
            viewerTranslateY = e.clientY - dragStartY;
            updateViewerTransform();
        }

        /**
         * 鼠标松开，停止拖拽事件监听
         * @returns {void}
         */
        function stopDragMermaidViewer() {
            isDraggingViewer = false;
            const body = document.getElementById('viewerBody');
            if (body) body.style.cursor = 'grab';
            document.removeEventListener('mousemove', dragMermaidViewer);
            document.removeEventListener('mouseup', stopDragMermaidViewer);
        }
