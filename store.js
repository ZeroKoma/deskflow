import { storage } from "./storage.js";

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
 * Esquemas de validación para garantizar la integridad de IndexedDB
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

  theme: (t) => ["light", "dark"].includes(t)
};

export const state = {
  notes: [],
  tags: [...defaultTags],
  categories: [...defaultCategories],
  currentView: "dashboard",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  currentDay: new Date().getDate(),
  calendarSubView: "month",
  theme: "dark", // Valor por defecto hasta que initStore cargue el real
  allNotesFilterAll: true,
  allNotesFilterWithDate: false,
  allNotesFilterNoDate: false,
  allNotesPriorityFilter: null,
  allNotesFilterExpired: false,
};

export const mutations = {
  async initStore() {
    // 1. Cargar datos desde IndexedDB
    const loadedNotes = await storage.getAll("notes");
    const loadedTags = await storage.getAll("tags");
    const loadedCategories = await storage.getAll("categories");

    // 2. Poblar estado (si IDB está vacío, se mantienen los valores por defecto)
    if (loadedNotes.length) state.notes = loadedNotes.filter(validators.note);
    if (loadedTags.length) state.tags = loadedTags.filter(validators.tag);
    if (loadedCategories.length) state.categories = loadedCategories.filter(validators.category);
    
    const theme = await storage.getPreference("deskflow_theme", "dark");
    state.theme = validators.theme(theme) ? theme : "dark";
  },

  saveNotes() {
    const valid = state.notes.filter(validators.note);
    storage.saveAll("notes", valid).catch(console.error);
  },

  saveTags() {
    const valid = state.tags.filter(validators.tag);
    storage.saveAll("tags", valid).catch(console.error);
  },

  saveCategories() {
    const valid = state.categories.filter(validators.category);
    storage.saveAll("categories", valid).catch(console.error);
  },

  addNote(noteData) {
    if (!validators.note(noteData)) return;
    state.notes.push(noteData);
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
    if (!validators.note(noteData)) return;
    state.notes = state.notes.map((n) => (n.id === id ? noteData : n));
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
    storage.setPreference("deskflow_theme", theme).catch(console.error);
  },

  updateCalendarState(year, month, day) {
    state.currentYear = year;
    state.currentMonth = month;
    state.currentDay = day;
  },

  async resetApp() {
    state.notes = [];
    state.tags = JSON.parse(JSON.stringify(defaultTags));
    state.categories = JSON.parse(JSON.stringify(defaultCategories));
    
    await storage.clearAll();

    this.saveNotes();
    this.saveTags();
    this.saveCategories();
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
