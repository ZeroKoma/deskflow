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
  notes: JSON.parse(localStorage.getItem("deskflow_notes")) || [],
  tags: JSON.parse(localStorage.getItem("deskflow_tags")) || defaultTags,
  categories:
    JSON.parse(localStorage.getItem("deskflow_categories")) ||
    defaultCategories,
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
  saveNotes() {
    localStorage.setItem("deskflow_notes", JSON.stringify(state.notes));
  },

  saveTags() {
    localStorage.setItem("deskflow_tags", JSON.stringify(state.tags));
  },

  saveCategories() {
    localStorage.setItem(
      "deskflow_categories",
      JSON.stringify(state.categories),
    );
  },

  addNote(noteData) {
    state.notes.push(noteData);
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
    localStorage.setItem("deskflow_theme", theme);
  },

  updateCalendarState(year, month, day) {
    state.currentYear = year;
    state.currentMonth = month;
    state.currentDay = day;
  },

  resetApp() {
    state.notes = [];
    state.tags = JSON.parse(JSON.stringify(defaultTags));
    state.categories = JSON.parse(JSON.stringify(defaultCategories));
    this.saveNotes();
    this.saveTags();
    this.saveCategories();
  },

  deletePastNotes(todayStr) {
    state.notes = state.notes.filter((n) => !n.date || n.date >= todayStr);
    this.saveNotes();
  },
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
