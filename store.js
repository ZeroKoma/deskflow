const defaultCategories = [
  { id: 'Trabajo', name: 'Trabajo', color: '#2563eb' },
  { id: 'Reunión', name: 'Reunión', color: '#10b981' },
  { id: 'Personal', name: 'Personal', color: '#f59e0b' },
  { id: 'Otros', name: 'Otros', color: '#64748b' }
];

export const state = {
  notes: JSON.parse(localStorage.getItem("deskflow_notes")) || [],
  tags: JSON.parse(localStorage.getItem("deskflow_tags")) || [],
  categories: JSON.parse(localStorage.getItem("deskflow_categories")) || defaultCategories,
  currentView: "dashboard",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  currentDay: new Date().getDate(),
  calendarSubView: "month",
  theme: localStorage.getItem("deskflow_theme") || "dark",
  allNotesFilterWithDate: true,
  allNotesFilterNoDate: true,
  allNotesPriorityFilter: null
};

export const mutations = {
  saveNotes() {
    localStorage.setItem("deskflow_notes", JSON.stringify(state.notes));
  },
  
  saveTags() {
    localStorage.setItem("deskflow_tags", JSON.stringify(state.tags));
  },

  saveCategories() {
    localStorage.setItem("deskflow_categories", JSON.stringify(state.categories));
  },

  addNote(noteData) {
    state.notes.push(noteData);
    this.saveNotes();
  },

  updateNote(id, noteData) {
    state.notes = state.notes.map(n => n.id === id ? noteData : n);
    this.saveNotes();
  },

  deleteNote(id) {
    state.notes = state.notes.filter(n => n.id !== id);
    this.saveNotes();
  },

  addTag(tag) {
    state.tags.push(tag);
    this.saveTags();
  },

  updateTag(id, tagData) {
    state.tags = state.tags.map(t => t.id === id ? { ...t, ...tagData } : t);
    this.saveTags();
  },

  deleteTag(id) {
    state.tags = state.tags.filter(t => t.id !== id);
    // Limpiar el tag de las notas que lo usen
    state.notes = state.notes.map(n => ({
      ...n,
      tags: n.tags ? n.tags.filter(tId => tId !== id) : []
    }));
    this.saveTags();
    this.saveNotes();
  },

  addCategory(category) {
    state.categories.push(category);
    this.saveCategories();
  },

  updateCategory(id, catData) {
    state.categories = state.categories.map(c => c.id === id ? { ...c, ...catData } : c);
    this.saveCategories();
  },

  deleteCategory(id) {
    state.categories = state.categories.filter(c => c.id !== id);
    // Las notas que usaban esta categoría pasan a 'Otros' o quedan sin categoría
    state.notes = state.notes.map(n => n.category === id ? { ...n, category: 'Otros' } : n);
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
  }
};

export const getters = {
  getStats() {
    return {
      high: state.notes.filter(n => n.priority === "high").length,
      medium: state.notes.filter(n => n.priority === "medium").length,
      low: state.notes.filter(n => n.priority === "low").length,
      all: state.notes.length,
      noDate: state.notes.filter(n => !n.date).length,
      withDate: state.notes.filter(n => !!n.date).length,
      tags: state.tags.length,
      categories: state.categories.length
    };
  },
  getNoteById(id) {
    return state.notes.find(n => n.id === id);
  }
};