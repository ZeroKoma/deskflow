import { storage } from "./storage.js";

/**
 * DATA SERVICE LAYER
 * Este servicio centraliza el acceso a los datos. 
 * Facilita la transición futura a un Backend (REST API o GraphQL).
 */

// Cambiar a 'true' y configurar URL cuando el backend esté listo
const USE_BACKEND = false;
const API_BASE_URL = "https://api.deskflow.com/v1";

export const dataService = {
  // NOTAS
  async getAllNotes() {
    if (USE_BACKEND) {
      const res = await fetch(`${API_BASE_URL}/notes`);
      return res.json();
    }
    return storage.getAll("notes");
  },

  async saveAllNotes(notes) {
    if (USE_BACKEND) {
      // Ejemplo: En un backend real podrías hacer un Sync o un bulk update
      // const res = await fetch(`${API_BASE_URL}/notes/bulk`, { method: 'POST', body: JSON.stringify(notes) });
      // return res.json();
      return null; // Evita caer al storage local si el backend está activo
    }
    return storage.saveAll("notes", notes);
  },

  // TAGS Y CATEGORÍAS (Estructura similar)
  async getAllTags() {
    return USE_BACKEND ? (await fetch(`${API_BASE_URL}/tags`)).json() : storage.getAll("tags");
  },
  async saveAllTags(tags) {
    return USE_BACKEND ? null : storage.saveAll("tags", tags);
  },

  async getAllCategories() {
    return USE_BACKEND ? (await fetch(`${API_BASE_URL}/categories`)).json() : storage.getAll("categories");
  },
  async saveAllCategories(cats) {
    return USE_BACKEND ? null : storage.saveAll("categories", cats);
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