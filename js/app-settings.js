import { state, mutations } from './store.js';
import { dataService } from './data-service.js';
import { dateUtils, downloadFile } from './utils.js';
import { showToast, showConfirmModal } from './view.js';
import { t } from '../translations/translations.js';

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
  const status = await dataService.getStorageStatus();
  const container = document.getElementById("storage-info");
  if (status && container) {
    const freePercent = (100 - parseFloat(status.percentUsed)).toFixed(2);
    container.innerHTML = `
      <div class="storage-info-container">
        <div class="flex-between m-b-5">
          <span>${t('storage_free')}:</span>
          <span style="font-weight: 700; color: var(--low);">${freePercent}%</span>
        </div>
        <div class="storage-footer-note">
          ${t('storage_estimate')} (${status.usageMB} MB ${t('storage_used')}).
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
        showToast(t('toast_import_err_format'), "error");
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
          showToast(msg, "info", null, {
            label: t('undo'),
            callback: () => {
              mutations.restoreState(stateBackup);
              if (stateBackup.theme) mutations.setTheme(stateBackup.theme);
              if (onThemeUpdate) onThemeUpdate();
              showToast(t('toast_undo_success'));
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
          finalizeImport(t('toast_import_success'));
        } else {
          showConfirmModal(
            t('conf_import_mode'),
            () => { 
              mutations.restoreState(data); 
              if (data.theme) mutations.setTheme(data.theme);
              if (onThemeUpdate) onThemeUpdate();
              finalizeImport(t('toast_import_replaced'));
            },
            () => { 
              mutations.mergeState(data); 
              finalizeImport(t('toast_import_merged'));
            },
            { okText: t('btn_replace_all'), cancelText: t('btn_merge_data'), okClass: "btn-danger" }
          );
        }
      };

      // Validación de versión
      if (!data.version || data.version !== APP_VERSION) {
        let warning = !data.version 
          ? t('import_warn_no_version') 
          : t('import_warn_mismatch').replace('{version}', data.version).replace('{current}', APP_VERSION);
        
        showConfirmModal(
          `${warning} ${t('import_warn_continue')}`,
          processImport,
          null,
          { okText: t('btn_continue'), cancelText: t('btn_cancel'), okClass: "btn-primary" }
        );
      } else {
        processImport();
      }
    } catch (err) {
      showToast(t('toast_import_json_err'), "error");
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
    showToast(t('toast_no_past'), "info");
    return;
  }
  showConfirmModal(t('conf_delete_past'), () => {
    mutations.deletePastNotes(todayStr);
    showToast(t('toast_past_deleted'), "info");
    closeSettingsModal();
  });
}

export function resetApp() {
  showConfirmModal(t('conf_reset_app'), () => {
    mutations.resetApp();
    showToast(t('toast_reset_success'), "info");
    closeSettingsModal();
  });
}