        // ============================================================
        //  Toast 提示
        // ============================================================
        let toastTimeout;
        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.classList.add('show');
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 2500);
        }
