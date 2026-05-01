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

export const state = {
  notes: [],
  tags: [...defaultTags],
  categories: [...defaultCategories],
  currentView: "dashboard",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  currentDay: new Date().getDate(),
  calendarSubView: "month",
  theme: localStorage.getItem("deskflow_theme") || "dark",
  allNotesFilterAll: true,
  allNotesFilterWithDate: false,
  allNotesFilterNoDate: false,
  allNotesPriorityFilter: null,
  allNotesFilterExpired: false,
};

export const mutations = {
  async initStore() {
    // 1. Asegurar migración
    await storage.performMigration();

    // 2. Cargar datos desde IndexedDB
    const loadedNotes = await storage.getAll("notes");
    const loadedTags = await storage.getAll("tags");
    const loadedCategories = await storage.getAll("categories");

    // 3. Poblar estado (si IDB está vacío tras migración, se quedan los defaults)
    if (loadedNotes.length) state.notes = loadedNotes;
    if (loadedTags.length) state.tags = loadedTags;
    if (loadedCategories.length) state.categories = loadedCategories;
    
    state.theme = storage.getPreference("deskflow_theme", "dark");
  },

  saveNotes() {
    storage.saveAll("notes", state.notes).catch(console.error);
  },

  saveTags() {
    storage.saveAll("tags", state.tags).catch(console.error);
  },

  saveCategories() {
    storage.saveAll("categories", state.categories).catch(console.error);
  },

  addNote(noteData) {
    state.notes.push(noteData);
    this.saveNotes();
  },

  bulkAddNotes(notesArray) {
    notesArray.forEach(newNote => {
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
    state.notes = state.notes.map((n) => (n.id === id ? noteData : n));
    this.saveNotes();
  },

  deleteNote(id) {
    state.notes = state.notes.filter((n) => n.id !== id);
    this.saveNotes();
  },

  addTag(tag) {
    state.tags.push(tag);
    this.saveTags();
  },

  updateTag(id, tagData) {
    state.tags = state.tags.map((t) =>
      t.id === id ? { ...t, ...tagData } : t,
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
    state.categories.push(category);
    this.saveCategories();
  },

  updateCategory(id, catData) {
    state.categories = state.categories.map((c) =>
      c.id === id ? { ...c, ...catData } : c,
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
    state.theme = theme;
    storage.setPreference("deskflow_theme", theme);
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
    // No borramos localStorage.clear() para no perder el flag de migración y tema
    // pero sí limpiamos las claves antiguas por si acaso
    localStorage.removeItem("deskflow_notes");
    localStorage.removeItem("deskflow_tags");
    localStorage.removeItem("deskflow_categories");

    this.saveNotes();
    this.saveTags();
    this.saveCategories();
  },

  deletePastNotes(todayStr) {
    state.notes = state.notes.filter((n) => !n.date || n.date >= todayStr);
    this.saveNotes();
  },

  restoreState(backup) {
    state.notes = backup.notes;
    state.tags = backup.tags;
    state.categories = backup.categories;
    this.saveNotes();
    this.saveTags();
    this.saveCategories();
  },

  mergeState(data) {
    // 1. Fusionar Notas (bulkAddNotes ya gestiona el "upsert" por ID)
    this.bulkAddNotes(data.notes || []);

    // 2. Fusionar Tags
    (data.tags || []).forEach(t => {
      if (!state.tags.find(existing => existing.id === t.id)) state.tags.push(t);
    });
    this.saveTags();

    // 3. Fusionar Categorías
    (data.categories || []).forEach(c => {
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
