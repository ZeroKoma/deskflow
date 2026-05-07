import { dataService } from "./data-service.js";
import { dateUtils } from "./utils.js";
import { storage } from "./storage.js";

const listeners = new Set();

/**
 * Subscribes a function to be executed every time the state changes.
 */
export const subscribe = (callback) => {
  listeners.add(callback);
};

let notifyPending = false;
/**
 * Notifies subscribers. Uses microtasks to group changes (debouncing).
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
    return { valid: false, error: "Title is required" };
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
  allNotesFilterCompleted: false, // NEW: Filter for completed notes
  allNotesFilterExpired: false,
};

export const state = new Proxy(_state, proxyHandler);

export const mutations = {
  async initStore() {
    // 1. Load data from the service (Local or API)
    const loadedNotes = await dataService.getAllNotes();
    const loadedTags = await dataService.getAllTags();
    const loadedCategories = await dataService.getAllCategories();

    // 2. Populate state (if IDB is empty, default values are maintained)
    if (loadedNotes.length) state.notes = loadedNotes.filter(validators.note).map(n => ({ ...n, completed: n.completed || false })); // NEW: Ensure completed property is set
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
    // Reload all state now that we have the key to decrypt
    await this.initStore();

    // Migration: Save again to ensure that data previously in plain text
    // is now persisted encrypted in IndexedDB.
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

    const note = { ...noteData, id: noteData.id || Date.now().toString(), completed: noteData.completed || false }; // NEW: Add completed property
    if (!validators.note(note)) return;

    syncAlarmTag(note);
    state.notes.push(note);
    this.saveNotes();
  },

  bulkAddNotes(notesArray) {
    if (!Array.isArray(notesArray)) return;
    notesArray.filter(validators.note).forEach(newNote => {
      newNote.completed = newNote.completed || false; // NEW: Ensure completed property is set for bulk adds
      const index = state.notes.findIndex(n => n.id === newNote.id);
      // If a note with the same ID exists, update it; otherwise, add it.
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
    const updated = { ...noteData, id }; // NEW: Ensure completed is a boolean, default to false if not provided (for older notes)
    updated.completed = typeof noteData.completed === 'boolean' ? noteData.completed : existing.completed || false;

    if (!validators.note(updated)) return;

    // If date or time changed, reset alarm tracking keys
    if (existing.date !== updated.date || existing.time !== updated.time) {
      updated.lastAlarmKey = null;
      updated.lastPreAlarmKey = null;
    }
    // NEW: If note is marked completed, disable alarm
    if (updated.completed) {
      updated.alarm = false;
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
    // Clear the tag from the notes that use it
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
    // Notes that used this category are moved to 'Others' or left without category
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
    // 1. Clear the state in memory immediately
    state.notes = [];
    state.tags = JSON.parse(JSON.stringify(defaultTags));
    state.categories = JSON.parse(JSON.stringify(defaultCategories));
    
    // 2. Clear storage (this now also clears the key in storage.js)
    await dataService.clearAll();
    
    // 3. Force reload to ensure a clean cryptographic environment
    window.location.reload();
  },

  deletePastNotes(todayStr) {
    state.notes = state.notes.filter((n) => !n.date || n.date >= todayStr);
    this.saveNotes();
  },

  deleteCompletedNotes() {
    state.notes = state.notes.filter((n) => !n.completed);
    this.saveNotes();
  },

  restoreState(backup) {
    if (!backup) return;
    state.notes = Array.isArray(backup.notes) ? backup.notes.filter(validators.note).map(n => ({ ...n, completed: n.completed || false })) : []; // NEW: Ensure completed property is set
    state.tags = Array.isArray(backup.tags) ? backup.tags.filter(validators.tag) : [...defaultTags];
    state.categories = Array.isArray(backup.categories) ? backup.categories.filter(validators.category) : [...defaultCategories];

    this.saveNotes();
    this.saveTags();
    this.saveCategories();
  },

  mergeState(data) {
    // 1. Merge Notes (bulkAddNotes manages upsert by ID)
    this.bulkAddNotes((data.notes || []).map(n => ({ ...n, completed: n.completed || false }))); // NEW: Ensure completed property is set

    // 2. Merge Tags
    (data.tags || []).filter(validators.tag).forEach(t => {
      if (!state.tags.find(existing => existing.id === t.id)) state.tags.push(t);
    });
    this.saveTags();

    // 3. Merge Categories
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
    const todayStr = dateUtils.getTodayStr();
    const activeNotes = state.notes.filter(
      (n) => (!n.date || n.date >= todayStr) && !n.completed,
    );
    return {
      high: activeNotes.filter((n) => n.priority === "high").length,
      medium: activeNotes.filter((n) => n.priority === "medium").length,
      low: activeNotes.filter((n) => n.priority === "low").length,
      all: activeNotes.length,
      all_total: state.notes.length, // Total notes including completed and expired
      expired: state.notes.filter((n) => n.date && n.date < todayStr && !n.completed).length, // NEW: Exclude completed from expired
      completed: state.notes.filter((n) => n.completed).length, // NEW: Count completed notes
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
