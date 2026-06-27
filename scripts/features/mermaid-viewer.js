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
         * 【Mermaid查看器/图表缩放】【视口解析】读取 SVG 的 viewBox 尺寸
         * @param {SVGElement} svg - Mermaid SVG 元素
         * @returns {Object} - SVG 宽高信息
         */
        function readViewerSvgSize(svg) {
            let width = 0;
            let height = 0;
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
                const parts = viewBox.split(/[\s,]+/).map(Number);
                if (parts.length === 4 && parts.every(value => Number.isFinite(value))) {
                    width = parts[2];
                    height = parts[3];
                }
            }
            if (!width || !height) {
                width = parseFloat(svg.getAttribute('width')) || 800;
                height = parseFloat(svg.getAttribute('height')) || 600;
            }
            return { width, height };
        }

        /**
         * 【Mermaid查看器/图表缩放】【样式清理】移除内联预览图遗留的响应式尺寸
         * @param {SVGElement} svg - Mermaid SVG 元素
         * @returns {void}
         */
        function clearViewerSvgInlineSize(svg) {
            svg.removeAttribute('width');
            svg.removeAttribute('height');
            svg.style.removeProperty('width');
            svg.style.removeProperty('height');
            svg.style.removeProperty('max-width');
            svg.style.removeProperty('max-height');
            svg.style.removeProperty('margin');
        }

        /**
         * 【Mermaid查看器/图表缩放】【尺寸应用】按原始尺寸优先显示，空间不足时才缩小适配
         * @param {SVGElement} svg - Mermaid SVG 元素
         * @param {HTMLElement} body - 查看器主体区域
         * @returns {void}
         */
        function fitViewerSvgToBody(svg, body) {
            const svgSize = readViewerSvgSize(svg);
            clearViewerSvgInlineSize(svg);
            const availableWidth = Math.max(body.clientWidth - 96, 100);
            const availableHeight = Math.max(body.clientHeight - 96, 100);
            const fit = Math.min(1, availableWidth / svgSize.width, availableHeight / svgSize.height);
            svg.setAttribute('width', Math.max(svgSize.width * fit, 1));
            svg.setAttribute('height', Math.max(svgSize.height * fit, 1));
            svg.style.display = 'block';
        }

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
                // 2. 查看器只在空间不足时缩小图表，不主动放大，避免甘特图文字和日期挤压
                fitViewerSvgToBody(svg, body);
            }

            // 3. 重置画板坐标和比例
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
