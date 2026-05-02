/**
 * DeskFlow Persistence Engine
 * Native IndexedDB Wrapper & Quota Management
 */

const DB_NAME = "DeskFlowDB";
const DB_VERSION = 2;
const STORES = {
  NOTES: "notes",
  TAGS: "tags",
  CATEGORIES: "categories",
  PREFERENCES: "preferences"
};

export const storage = {
  db: null,
  _initPromise: null,

  /**
   * Inicializa IndexedDB y maneja el versionado
   */
  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Crear almacenes si no existen
        if (!db.objectStoreNames.contains(STORES.NOTES)) {
          db.createObjectStore(STORES.NOTES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.TAGS)) {
          db.createObjectStore(STORES.TAGS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
          db.createObjectStore(STORES.PREFERENCES);
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB Error:", event.target.error);
        reject(new Error("No se pudo inicializar el almacenamiento estructurado."));
      };
    });
    return this._initPromise;
  },

  /**
   * Operaciones genéricas de acceso
   */
  async getAll(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveAll(storeName, items) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      
      // En IndexedDB, para sincronizar una colección completa de forma segura
      store.clear(); 
      items.forEach(item => {
        try {
          store.put(item);
        } catch (e) {
          if (e.name === 'QuotaExceededError') {
            reject(new Error("Espacio de almacenamiento insuficiente."));
          } else {
            throw e;
          }
        }
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async saveItem(storeName, item) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      store.put(item);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async deleteItem(storeName, id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      store.delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async clearAll() {
    const db = await this.init();
    const transaction = db.transaction(Object.values(STORES), "readwrite");
    Object.values(STORES).forEach(s => transaction.objectStore(s).clear());
    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  },

  /**
   * FASE 5 — Control de Cuota
   */
  async getStorageStatus() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        usageMB: (usage / (1024 * 1024)).toFixed(2),
        quotaMB: (quota / (1024 * 1024)).toFixed(2),
        percentUsed: ((usage / quota) * 100).toFixed(2),
        isPersisted: await navigator.storage.persisted()
      };
    }
    return null;
  },

  /**
   * IndexedDB Preference Helpers
   */
  async setPreference(key, value) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PREFERENCES, "readwrite");
      transaction.objectStore(STORES.PREFERENCES).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getPreference(key, defaultValue = null) {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORES.PREFERENCES, "readonly");
      const request = transaction.objectStore(STORES.PREFERENCES).get(key);
      request.onsuccess = () => resolve(request.result !== undefined ? request.result : defaultValue);
      request.onerror = () => resolve(defaultValue);
    });
  }
};