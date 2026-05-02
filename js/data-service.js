import { storage } from "./storage.js";
import { cryptoUtils } from "./crypto-utils.js";

/**
 * DATA SERVICE LAYER
 * This service centralizes data access. 
 * Facilitates the future transition to a Backend (REST API or GraphQL).
 */

// Change to 'true' and configure URL when backend is ready
const USE_BACKEND = false;
const API_BASE_URL = "https://api.deskflow.com/v1";

/**
 * Internal helpers for centralized encryption/decryption.
 * If no active key (locked app), it returns data as is.
 */
const processIncoming = async (items) => {
  if (!storage._encryptionKey || !Array.isArray(items)) return items;
  
  const results = await Promise.all(items.map(async item => {
    if (!item._encrypted) return item;
    try {
      return await cryptoUtils.decrypt(item, storage._encryptionKey);
    } catch (e) {
      console.error(`Error descifrando elemento ${item.id}:`, e);
      return null; // Ignore elements that cannot be decrypted
    }
  }));

  return results.filter(i => i !== null);
};

const processOutgoing = async (items) => {
  if (!storage._encryptionKey) return items;
  return Promise.all(items.map(async item => {
    const encrypted = await cryptoUtils.encrypt(item, storage._encryptionKey);
    return { id: item.id, _encrypted: true, ...encrypted };
  }));
};

export const dataService = {
  // NOTAS
  async getAllNotes() {
    const rawData = USE_BACKEND 
      ? await (await fetch(`${API_BASE_URL}/notes`)).json()
      : await storage.getAll("notes");
    
    return processIncoming(rawData);
  },

  async saveAllNotes(notes) {
    const processed = await processOutgoing(notes);
    if (USE_BACKEND) {
      // await fetch(`${API_BASE_URL}/notes/bulk`, { method: 'POST', body: JSON.stringify(processed) });
      return null; 
    }
    return storage.saveAll("notes", processed);
  },

  // TAGS Y CATEGORÍAS
  async getAllTags() {
    const raw = USE_BACKEND ? await (await fetch(`${API_BASE_URL}/tags`)).json() : await storage.getAll("tags");
    return processIncoming(raw);
  },

  async saveAllTags(tags) {
    const processed = await processOutgoing(tags);
    return USE_BACKEND ? null : storage.saveAll("tags", processed);
  },

  async getAllCategories() {
    const raw = USE_BACKEND ? await (await fetch(`${API_BASE_URL}/categories`)).json() : await storage.getAll("categories");
    return processIncoming(raw);
  },

  async saveAllCategories(cats) {
    const processed = await processOutgoing(cats);
    return USE_BACKEND ? null : storage.saveAll("categories", processed);
  },

  // PREFERENCIAS Y MANTENIMIENTO
  async getPreference(key, defaultValue) {
    return USE_BACKEND ? defaultValue : storage.getPreference(key, defaultValue);
  },
  async setPreference(key, value) {
    return USE_BACKEND ? null : storage.setPreference(key, value);
  },
  async clearAll() {
    if (USE_BACKEND) { 
      /* return fetch(`${API_BASE_URL}/account/reset`, { method: 'DELETE' }); */
      return; 
    }
    return storage.clearAll();
  },
  async getStorageStatus() {
    return storage.getStorageStatus ? await storage.getStorageStatus() : null;
  }
};