const DB_NAME = 'ct4_inventory_db';
const DB_VERSION = 1;
const STORE_INVENTORY = 'inventory';
const STORE_RECORDS = 'records';

const DB = {
    db: null,
    open() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_INVENTORY)) {
                    db.createObjectStore(STORE_INVENTORY, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(STORE_RECORDS)) {
                    db.createObjectStore(STORE_RECORDS, { keyPath: 'id', autoIncrement: true });
                }
            };
            req.onsuccess = e => {
                this.db = e.target.result;
                resolve(this.db);
            };
            req.onerror = e => reject(e);
        });
    },
    async getAll(storeName) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = e => reject(e);
        });
    },
    async put(storeName, value) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = e => reject(e);
        });
    },
    async delete(storeName, key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e);
        });
    },
    async clear(storeName) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e);
        });
    }
};
