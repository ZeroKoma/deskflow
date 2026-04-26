export const state = {
  notes: JSON.parse(localStorage.getItem("deskflow_notes")) || [],
  tags: JSON.parse(localStorage.getItem("deskflow_tags")) || [],
  currentView: "dashboard",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  currentDay: new Date().getDate(),
  calendarSubView: "month",
  theme: localStorage.getItem("deskflow_theme") || "dark",
  allNotesFilterWithDate: true,
  allNotesFilterNoDate: true
};

export const mutations = {
  saveNotes() {
    localStorage.setItem("deskflow_notes", JSON.stringify(state.notes));
  },
  
  saveTags() {
    localStorage.setItem("deskflow_tags", JSON.stringify(state.tags));
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
      pending: state.notes.length,
      urgent: state.notes.filter(n => n.priority === "high").length,
      all: state.notes.length,
      noDate: state.notes.filter(n => !n.date).length,
      withDate: state.notes.filter(n => !!n.date).length,
      tags: state.tags.length
    };
  },
  getNoteById(id) {
    return state.notes.find(n => n.id === id);
  }
};