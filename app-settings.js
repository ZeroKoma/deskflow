import { state, mutations } from './store.js';
import { storage } from './storage.js';
import { dateUtils, downloadFile } from './utils.js';
import { showToast, renderView, updateUIStats, showConfirmModal } from './view.js';

const APP_VERSION = "1.0";

export function exportData() {
  const backup = {
    version: APP_VERSION,
    notes: state.notes,
    tags: state.tags,
    categories: state.categories,
    theme: state.theme,
    exportDate: new Date().toISOString()
  };
  downloadFile("deskflow_backup.json", JSON.stringify(backup, null, 2), "application/json");
}

export async function updateStorageInfoUI() {
  const status = await storage.getStorageStatus();
  const container = document.getElementById("storage-info");
  if (status && container) {
    const freePercent = (100 - parseFloat(status.percentUsed)).toFixed(2);
    container.innerHTML = `
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 12px; padding: 12px; background: var(--bg-main); border-radius: 8px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <span>Espacio libre:</span>
          <span style="font-weight: 700; color: var(--low);">${freePercent}%</span>
        </div>
        <div style="font-size: 0.7rem; opacity: 0.8; line-height: 1.3;">
          * Esta es una estimación aproximada del navegador basada en el disco disponible (${status.usageMB} MB usados).
        </div>
      </div>`;
  }
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

      const processImport = () => {
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

        // Comprobar si la aplicación está en su estado inicial (sin datos creados por el usuario)
        const isInitialState = state.notes.length === 0 && 
                               state.tags.length === 1 && 
                               state.categories.length === 4;

        if (isInitialState) {
          mutations.restoreState(data);
          if (data.theme) mutations.setTheme(data.theme);
          if (onThemeUpdate) onThemeUpdate();
          finalizeImport("Datos importados correctamente");
        } else {
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
        }
      };

      // Validación de versión
      if (!data.version || data.version !== APP_VERSION) {
        const warning = !data.version 
          ? "El archivo no tiene información de versión (es antiguo o externo)." 
          : `La versión del archivo (${data.version}) no coincide con la actual (${APP_VERSION}).`;
        
        showConfirmModal(
          `${warning} La importación podría causar problemas de compatibilidad. ¿Deseas continuar?`,
          processImport,
          null,
          { okText: "Continuar de todos modos", cancelText: "Cancelar", okClass: "btn-primary" }
        );
      } else {
        processImport();
      }
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