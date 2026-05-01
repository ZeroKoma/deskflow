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

export function importData(file, onThemeUpdate) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    try {
      const data = JSON.parse(text);
      if (!data.notes || !data.tags || !data.categories) {
        showToast("El archivo no tiene el formato correcto de DeskFlow", "error");
        return;
      }

      // Backup para "Deshacer"
      const stateBackup = {
        notes: JSON.parse(JSON.stringify(state.notes)),
        tags: JSON.parse(JSON.stringify(state.tags)),
        categories: JSON.parse(JSON.stringify(state.categories)),
        theme: state.theme
      };

      const closeSettings = () => {
        const modal = document.getElementById("settings-modal");
        if (modal) modal.style.display = "none";
      };

      const finalizeImport = (msg) => {
        renderView();
        updateUIStats();
        showToast(msg, "info", null, {
          label: "Deshacer",
          callback: () => {
            mutations.restoreState(stateBackup);
            if (stateBackup.theme) mutations.setTheme(stateBackup.theme);
            if (onThemeUpdate) onThemeUpdate();
            renderView();
            updateUIStats();
            showToast("Cambios revertidos correctamente");
          }
        });
        closeSettings();
      };

      showConfirmModal(
        "¿Cómo deseas importar los datos?",
        () => { 
          mutations.restoreState(data); 
          if (data.theme) mutations.setTheme(data.theme);
          if (onThemeUpdate) onThemeUpdate();
          finalizeImport("Copia de seguridad restaurada (Reemplazo total)");
        },
        () => { 
          mutations.mergeState(data); 
          finalizeImport("Datos fusionados correctamente");
        },
        { okText: "Reemplazar Todo", cancelText: "Fusionar Datos", okClass: "btn-danger" }
      );
    } catch (err) {
      showToast("Error al procesar el archivo JSON", "error");
    }
  };
  reader.readAsText(file);
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    modal.style.display = "none";
    return true;
  }
  return false;
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
    renderView(); 
    updateUIStats();
    closeSettingsModal();
  });
}

export function resetApp() {
  showConfirmModal("¿BORRAR TODO? Esta acción es irreversible.", () => {
    mutations.resetApp();
    showToast("Aplicación reseteada correctamente", "info");
    renderView(); 
    updateUIStats();
    closeSettingsModal();
  });
}