import { dataService } from "./data-service.js";
import { dateUtils } from "./utils.js";
import { storage } from "./storage.js";

const listeners = new Set();

/**
 * Suscribe una función para que se ejecute cada vez que el estado cambie.
 */
export const subscribe = (callback) => {
  listeners.add(callback);
};

let notifyPending = false;
/**
 * Notifica a los suscriptores. Usa microtareas para agrupar cambios (debouncing).
 */
const notify = () => {
  if (notifyPending) return;
  notifyPending = true;
  queueMicrotask(() => {
    listeners.forEach(callback => callback());
    notifyPending = false;
  });
};

const proxyHandler = {
  get(target, key) {
    const value = target[key];
    if (value !== null && typeof value === 'object') {
      return new Proxy(value, proxyHandler);
    }
    return value;
  },
  set(target, key, value) {
    if (target[key] !== value) {
      target[key] = value;
      notify();
    }
    return true;
  },
  deleteProperty(target, key) {
    const result = delete target[key];
    if (result) notify();
    return result;
  }
};

const defaultCategories = [
  { id: "Categoría 1", name: "Categoría 1", color: "#2563eb" },
  { id: "Categoría 2", name: "Categoría 2", color: "#10b981" },
  { id: "Personal", name: "Personal", color: "#f59e0b" },
  { id: "Otros", name: "Otros", color: "#64748b" },
];

const defaultTags = [
  { id: "tag-alarm-default", name: "Alarma", color: "#ef4444" }
];

/**
 * Validation schemas to ensure IndexedDB integrity
 */
const validators = {
  note: (n) => 
    n && typeof n === 'object' &&
    typeof n.id === 'string' &&
    typeof n.title === 'string' && n.title.trim().length > 0 &&
    ['low', 'medium', 'high'].includes(n.priority) &&
    Array.isArray(n.tags),
  
  tag: (t) => 
    t && typeof t === 'object' &&
    typeof t.id === 'string' &&
    typeof t.name === 'string' && t.name.trim().length > 0,

  category: (c) => 
    c && typeof c === 'object' &&
    typeof c.id === 'string' &&
    typeof c.name === 'string' && c.name.trim().length > 0,

  theme: (t) => ["light", "dark"].includes(t),
  language: (l) => ["es", "en"].includes(l)
};

/**
 * Business rule validation for Notes/Reminders
 */
const validateNoteBusinessRules = (note) => {
  if (!note.title || note.title.trim().length === 0) {
    return { valid: false, error: "El título es obligatorio" };
  }

  if (note.date) {
    const todayStr = dateUtils.getTodayStr(); // Get today's date string
    if (note.date < todayStr) {
      return { valid: false, error: "Reminders cannot be scheduled for past dates" };
    }

    if (note.date === todayStr && note.time) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (note.time.slice(0, 5) < currentTime) {
        return { valid: false, error: "You cannot schedule a reminder for a time that has already passed today" };
      }
    }
  }
  return { valid: true };
};

const syncAlarmTag = (note) => {
  if (!note.tags) note.tags = [];
  const alarmTag = state.tags.find(t => t.name === "Alarma");
  if (!alarmTag) return;
  const tagIndex = note.tags.indexOf(alarmTag.id); // Find index of alarm tag
  if (note.alarm) { if (tagIndex === -1) note.tags.push(alarmTag.id); }
  else { if (tagIndex !== -1) note.tags.splice(tagIndex, 1); }
};

const _state = {
  notes: [],
  tags: [...defaultTags],
  categories: [...defaultCategories],
  currentView: "dashboard",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  currentDay: new Date().getDate(),
  calendarSubView: "month",
  theme: "dark", // Default value until initStore loads the actual one
  language: "es",
  allNotesFilterAll: true,
  allNotesFilterWithDate: false,
  allNotesFilterNoDate: false,
  allNotesFilterWithAlarm: false,
  allNotesPriorityFilter: null,
  allNotesFilterExpired: false,
};

export const state = new Proxy(_state, proxyHandler);

export const mutations = {
  async initStore() {
    // 1. Cargar datos desde el servicio (Local o API)
    const loadedNotes = await dataService.getAllNotes();
    const loadedTags = await dataService.getAllTags();
    const loadedCategories = await dataService.getAllCategories();

    // 2. Poblar estado (si IDB está vacío, se mantienen los valores por defecto)
    if (loadedNotes.length) state.notes = loadedNotes.filter(validators.note);
    if (loadedTags.length) state.tags = loadedTags.filter(validators.tag);
    if (loadedCategories.length) state.categories = loadedCategories.filter(validators.category);
    
    const theme = await dataService.getPreference("deskflow_theme", "dark");
    state.theme = validators.theme(theme) ? theme : "dark";

    const browserLang = (navigator.language || navigator.userLanguage || "es").split("-")[0];
    const defaultFallback = validators.language(browserLang) ? browserLang : "es";
    const lang = await dataService.getPreference("deskflow_language", defaultFallback);
    state.language = validators.language(lang) ? lang : defaultFallback;
  },

  /**
   * Desbloquea el almacenamiento cifrado y recarga los datos.
   */
  async unlockStorage(password) {
    await storage.unlock(password);
    // Recargar todo el estado ahora que tenemos la clave para descifrar
    await this.initStore();

    // Migración: Guardar de nuevo para asegurar que los datos que estaban en plano
    // ahora se persistan cifrados en IndexedDB.
    this.saveNotes();
    this.saveTags();
    this.saveCategories();
    
    return true;
  },

  /**
   * Intenta restaurar la sesión de cifrado desde sessionStorage
   */
  async tryResumeSession() {
    const resumed = await storage.unlockWithSession();
    if (resumed) {
      await this.initStore();
      return true;
    }
    return false;
  },

  saveNotes() {
    // Convert Proxy to plain object before saving to IndexedDB
    const rawNotes = JSON.parse(JSON.stringify(state.notes));
    const valid = rawNotes.filter(validators.note);
    dataService.saveAllNotes(valid).catch(console.error);
  },

  saveTags() {
    // Convert Proxy to plain object before saving to IndexedDB
    const rawTags = JSON.parse(JSON.stringify(state.tags));
    const valid = rawTags.filter(validators.tag);
    dataService.saveAllTags(valid).catch(console.error);
  },

  saveCategories() {
    // Convert Proxy to plain object before saving to IndexedDB
    const rawCategories = JSON.parse(JSON.stringify(state.categories));
    const valid = rawCategories.filter(validators.category);
    dataService.saveAllCategories(valid).catch(console.error);
  },

  addNote(noteData) {
    const validation = validateNoteBusinessRules(noteData);
    if (!validation.valid) throw new Error(validation.error);

    const note = { ...noteData, id: noteData.id || Date.now().toString() };
    if (!validators.note(note)) return;

    syncAlarmTag(note);
    state.notes.push(note);
    this.saveNotes();
  },

  bulkAddNotes(notesArray) {
    if (!Array.isArray(notesArray)) return;
    notesArray.filter(validators.note).forEach(newNote => {
      const index = state.notes.findIndex(n => n.id === newNote.id);
      if (index !== -1) {
        state.notes[index] = newNote;
      } else {
        state.notes.push(newNote);
      }
    });
    this.saveNotes();
  },

  clearNotes() {
    state.notes = [];
    this.saveNotes();
  },

  updateNote(id, noteData) {
    const validation = validateNoteBusinessRules(noteData);
    if (!validation.valid) throw new Error(validation.error);

    const existingIndex = state.notes.findIndex(n => n.id === id);
    if (existingIndex === -1) return;

    const existing = state.notes[existingIndex];
    const updated = { ...noteData, id };
    if (!validators.note(updated)) return;

    // If date or time changed, reset alarm tracking keys
    if (existing.date !== updated.date || existing.time !== updated.time) {
      updated.lastAlarmKey = null;
      updated.lastPreAlarmKey = null;
    }

    syncAlarmTag(updated);
    state.notes[existingIndex] = updated;
    this.saveNotes();
  },

  deleteNote(id) {
    state.notes = state.notes.filter((n) => n.id !== id);
    this.saveNotes();
  },

  addTag(tag) {
    if (!validators.tag(tag)) return;
    state.tags.push(tag);
    this.saveTags();
  },

  updateTag(id, tagData) {
    const current = state.tags.find(t => t.id === id);
    if (!current) return;
    const updated = { ...current, ...tagData };
    if (!validators.tag(updated)) return;

    state.tags = state.tags.map((t) =>
      t.id === id ? updated : t,
    );
    this.saveTags();
  },

  deleteTag(id) {
    state.tags = state.tags.filter((t) => t.id !== id);
    // Limpiar el tag de las notas que lo usen
    state.notes = state.notes.map((n) => ({
      ...n,
      tags: n.tags ? n.tags.filter((tId) => tId !== id) : [],
    }));
    this.saveTags();
    this.saveNotes();
  },

  addCategory(category) {
    if (!validators.category(category)) return;
    state.categories.push(category);
    this.saveCategories();
  },

  updateCategory(id, catData) {
    const current = state.categories.find(c => c.id === id);
    if (!current) return;
    const updated = { ...current, ...catData };
    if (!validators.category(updated)) return;

    state.categories = state.categories.map((c) =>
      c.id === id ? updated : c,
    );
    this.saveCategories();
  },

  deleteCategory(id) {
    state.categories = state.categories.filter((c) => c.id !== id);
    // Las notas que usaban esta categoría pasan a 'Otros' o quedan sin categoría
    state.notes = state.notes.map((n) =>
      n.category === id ? { ...n, category: "Otros" } : n,
    );
    this.saveCategories();
    this.saveNotes();
  },

  setTheme(theme) {
    if (!validators.theme(theme)) return;
    state.theme = theme;
    dataService.setPreference("deskflow_theme", theme).catch(console.error);
  },

  setLanguage(lang) {
    state.language = lang;
    dataService.setPreference("deskflow_language", lang).catch(console.error);
  },

  updateCalendarState(year, month, day) {
    state.currentYear = year;
    state.currentMonth = month;
    state.currentDay = day;
  },

  async resetApp() {
    // 1. Limpiar el estado en memoria inmediatamente
    state.notes = [];
    state.tags = JSON.parse(JSON.stringify(defaultTags));
    state.categories = JSON.parse(JSON.stringify(defaultCategories));
    
    // 2. Limpiar el almacenamiento (esto ahora también limpia la clave en storage.js)
    await dataService.clearAll();
    
    // 3. Forzar recarga para asegurar un entorno criptográfico limpio
    window.location.reload();
  },

  deletePastNotes(todayStr) {
    state.notes = state.notes.filter((n) => !n.date || n.date >= todayStr);
    this.saveNotes();
  },

  restoreState(backup) {
    if (!backup) return;
    state.notes = Array.isArray(backup.notes) ? backup.notes.filter(validators.note) : [];
    state.tags = Array.isArray(backup.tags) ? backup.tags.filter(validators.tag) : [...defaultTags];
    state.categories = Array.isArray(backup.categories) ? backup.categories.filter(validators.category) : [...defaultCategories];

    this.saveNotes();
    this.saveTags();
    this.saveCategories();
  },

  mergeState(data) {
    // 1. Fusionar Notas (bulkAddNotes ya gestiona el "upsert" por ID)
    this.bulkAddNotes(data.notes || []);

    // 2. Fusionar Tags
    (data.tags || []).filter(validators.tag).forEach(t => {
      if (!state.tags.find(existing => existing.id === t.id)) state.tags.push(t);
    });
    this.saveTags();

    // 3. Fusionar Categorías
    (data.categories || []).filter(validators.category).forEach(c => {
      if (!state.categories.find(existing => existing.id === c.id)) state.categories.push(c);
    });
    this.saveCategories();
    this.saveNotes();
  }
};

export const getters = {
  getStats() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const activeNotes = state.notes.filter(
      (n) => !n.date || n.date >= todayStr,
    );
    return {
      high: activeNotes.filter((n) => n.priority === "high").length,
      medium: activeNotes.filter((n) => n.priority === "medium").length,
      low: activeNotes.filter((n) => n.priority === "low").length,
      all: activeNotes.length,
      all_total: state.notes.length,
      expired: state.notes.filter((n) => n.date && n.date < todayStr).length,
      withAlarm: activeNotes.filter((n) => n.alarm).length,
      withDate: state.notes.filter((n) => !!n.date).length,
      activeWithDate: activeNotes.filter((n) => !!n.date).length,
      activeNoDate: activeNotes.filter((n) => !n.date).length,
      tags: state.tags.length,
      categories: state.categories.length,
    };
  },
  getNoteById(id) {
    return state.notes.find((n) => n.id === id);
  },
};
