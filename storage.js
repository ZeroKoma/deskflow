/**
 * DeskFlow Persistence Engine
 * Native IndexedDB Wrapper & Quota Management
 */

const DB_NAME = "DeskFlowDB";
const DB_VERSION = 1;
const STORES = {
  NOTES: "notes",
  TAGS: "tags",
  CATEGORIES: "categories"
};

export const storage = {
  db: null,

  /**
   * Inicializa IndexedDB y maneja el versionado
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
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
   * FASE 4 — Migración segura
   */
  async performMigration() {
    const MIGRATION_KEY = "deskflow_migrated_v1";
    if (localStorage.getItem(MIGRATION_KEY)) return;

    console.log("Detectados datos legacy en LocalStorage. Iniciando migración...");
    
    try {
      const legacyNotes = JSON.parse(localStorage.getItem("deskflow_notes") || "[]");
      const legacyTags = JSON.parse(localStorage.getItem("deskflow_tags") || "[]");
      const legacyCats = JSON.parse(localStorage.getItem("deskflow_categories") || "[]");

      // Importar a IDB
      if (legacyNotes.length) await this.saveAll(STORES.NOTES, legacyNotes);
      if (legacyTags.length) await this.saveAll(STORES.TAGS, legacyTags);
      if (legacyCats.length) await this.saveAll(STORES.CATEGORIES, legacyCats);

      // Marcar como completado
      localStorage.setItem(MIGRATION_KEY, "true");
      
      // Limpieza (Opcional pero recomendado para liberar espacio en LS)
      localStorage.removeItem("deskflow_notes");
      localStorage.removeItem("deskflow_tags");
      localStorage.removeItem("deskflow_categories");
      
      console.log("Migración finalizada con éxito.");
    } catch (error) {
      console.error("Error en la migración:", error);
      // No marcamos como completado para que pueda reintentar
    }
  },

  /**
   * LocalStorage Helpers (Preferencias ligeras)
   */
  setPreference(key, value) {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  },

  getPreference(key, defaultValue = null) {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  }
};