import { state, mutations } from './store.js';
import { dateUtils, downloadFile } from './utils.js';
import { showToast, renderView, updateUIStats, showConfirmModal } from './view.js';

export function exportData() {
  const backup = {
    notes: state.notes,
    tags: state.tags,
    categories: state.categories,
    theme: state.theme,
    exportDate: new Date().toISOString()
  };
  downloadFile("deskflow_backup.json", JSON.stringify(backup, null, 2), "application/json");
}

export function importData(file) {
  // La lógica principal ha sido movida a app.js para unificar la gestión del Undo y los modales.
  // Este archivo puede simplificarse o eliminarse en futuras refactorizaciones.
}

export function deletePastNotes() {
  const todayStr = dateUtils.getTodayStr();
  const pastNotesCount = state.notes.filter(n => n.date && n.date < todayStr).length;
  if (pastNotesCount === 0) {
    showToast("No hay notas pasadas", "info");
    return;
  }
  showConfirmModal(`¿Eliminar ${pastNotesCount} notas pasadas?`, () => {
    mutations.deletePastNotes(todayStr);
    showToast("Notas eliminadas", "info");
    renderView(); updateUIStats();
    document.getElementById("settings-modal").style.display = "none";
  });
}

export function resetApp() {
  showConfirmModal("¿BORRAR TODO? Esta acción es irreversible.", () => {
    mutations.resetApp();
    showToast("App reseteada", "info");
    renderView(); updateUIStats();
    document.getElementById("settings-modal").style.display = "none";
  });
}