        // ============================================================
        //  IndexedDB 存储（替代 localStorage，支持更大容量）
        // ============================================================
        const DB_NAME = 'AIChatDB';
        const DB_VERSION = 1;
        const STORE_NAME = 'data';
        let db = null;

        function openDB() {
            return new Promise((resolve, reject) => {
                if (db) return resolve(db);
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const d = e.target.result;
                    if (!d.objectStoreNames.contains(STORE_NAME)) {
                        d.createObjectStore(STORE_NAME);
                    }
                };
                req.onsuccess = (e) => { db = e.target.result; resolve(db); };
                req.onerror = (e) => reject(e.target.error);
            });
        }

        async function dbGet(key) {
            const d = await openDB();
            return new Promise((resolve, reject) => {
                const tx = d.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }

        async function dbSet(key, value) {
            const d = await openDB();
            return new Promise((resolve, reject) => {
                const tx = d.transaction(STORE_NAME, 'readwrite');
                const req = tx.objectStore(STORE_NAME).put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }

        async function dbDelete(key) {
            const d = await openDB();
            return new Promise((resolve, reject) => {
                const tx = d.transaction(STORE_NAME, 'readwrite');
                const req = tx.objectStore(STORE_NAME).delete(key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
