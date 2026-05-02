/**
 * DeskFlow Persistence Engine
 * Native IndexedDB Wrapper & Quota Management
 */

import { cryptoUtils } from "./crypto-utils.js";

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
  _encryptionKey: null,

  /**
   * Tries to recover the key from the current session (sessionStorage).
   * This allows page refreshing without asking for the password.
   */
  async unlockWithSession() {
    const sessionKey = sessionStorage.getItem('deskflow_session_key');
    if (!sessionKey) return false;
    try {
      const rawKey = new Uint8Array(JSON.parse(sessionKey));
      this._encryptionKey = await cryptoUtils.importVaultKey(rawKey);
      return true;
    } catch (e) {
      sessionStorage.removeItem('deskflow_session_key');
      return false;
    }
  },

  /**
   * Desbloquea la bóveda usando la contraseña del usuario o la contraseña maestra de recuperación.
   */
  async unlock(password) {
    const cleanPwd = password.trim();
    let salt = await this.getPreference("crypto_salt");
    let vaultCheck = await this.getPreference("vault_key_user");
    
    // Hash de "BorealitosRules" para identificación.
    const MASTER_HASH = "89f075d9e5f72436d4f66453911d5119932170881919865f9038676d91062f6b";
    const inputHash = await cryptoUtils.hash(cleanPwd);
    const isMaster = inputHash === MASTER_HASH;

    // Si no hay salt O no hay llaves de bóveda, es que estamos en una instalación nueva o migrando
    if (!salt || !vaultCheck) {
      // CONFIGURACIÓN INICIAL: Creamos la Vault Key y la protegemos con ambas contraseñas
      salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      await this.setPreference("crypto_salt", salt);

      const vaultKeyRaw = await cryptoUtils.generateVaultKey();
      const saltArr = new Uint8Array(salt);

      // Derivamos las claves de cifrado. La maestra está ofuscada para no ser legible a simple vista.
      const userKey = await cryptoUtils.deriveKey(cleanPwd, saltArr);
      const masterKey = await cryptoUtils.deriveKey(atob("Qm9yZWFsaXRvc1J1bGVz"), saltArr);

      // Guardamos la Vault Key real (que es aleatoria) cifrada por duplicado.
      const encUser = await cryptoUtils.encrypt(Array.from(vaultKeyRaw), userKey);
      const encMaster = await cryptoUtils.encrypt(Array.from(vaultKeyRaw), masterKey);

      await this.setPreference("vault_key_user", encUser);
      await this.setPreference("vault_key_master", encMaster);

      this._encryptionKey = await cryptoUtils.importVaultKey(vaultKeyRaw);
      // Save in session to allow refreshes
      sessionStorage.setItem('deskflow_session_key', JSON.stringify(Array.from(vaultKeyRaw)));
    } else {
      // UNLOCK: Attempt to recover the Vault Key using the current input
      const saltArr = new Uint8Array(salt);
      const inputKey = await cryptoUtils.deriveKey(cleanPwd, saltArr);
      
      // Try primary key then fallback
      const keysToTry = isMaster 
        ? ["vault_key_master", "vault_key_user"] 
        : ["vault_key_user", "vault_key_master"];

      for (const storageKey of keysToTry) {
        const encryptedVault = await this.getPreference(storageKey);
        if (!encryptedVault) continue;

        try {
          const decryptedVaultRaw = await cryptoUtils.decrypt(encryptedVault, inputKey);
          const vaultKeyBytes = new Uint8Array(decryptedVaultRaw);
          this._encryptionKey = await cryptoUtils.importVaultKey(vaultKeyBytes);
          // Save in session to allow refreshes
          sessionStorage.setItem('deskflow_session_key', JSON.stringify(Array.from(vaultKeyBytes)));
          return; // Éxito
        } catch (e) {
          // If it fails, try the next key in the list
          continue;
        }
      }

      // If no key worked
      this._encryptionKey = null;
      throw new Error("INVALID_PASSWORD");
    }
  },

  /**
   * Initializes IndexedDB and handles versioning
   */
  async init() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create stores if they don't exist
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
        // Handle unexpected closure or manual deletion from the inspector
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
        };
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
   * Generic access operations
   */
  async getAll(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = async () => {
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveAll(storeName, items) {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      
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
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(Object.values(STORES), "readwrite");
      // IMPORTANT: Clear memory and session before confirming
      this._encryptionKey = null;
      sessionStorage.removeItem('deskflow_session_key');
      
      Object.values(STORES).forEach(s => transaction.objectStore(s).clear());
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
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