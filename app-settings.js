import { state, mutations } from './store.js';
import { dateUtils, downloadCSV } from './utils.js';
import { showToast, renderView, updateUIStats, showConfirmModal } from './view.js';

export function exportData() {
  const headers = "Titulo,Fecha,Hora,Prioridad,Categoria,Descripcion,Alarma,Tags";
  const content = headers + "\n" + 
    state.notes.map(n => {
      const tags = (n.tags || []).join(';');
      const safeTitle = (n.title || "").replace(/,/g, ";").replace(/\n/g, " ");
      const safeDesc = (n.description || "").replace(/,/g, ";").replace(/\n/g, " ");
      return `${safeTitle},${n.date || ""},${n.time || ""},${n.priority},${n.category},${safeDesc},${n.alarm},${tags}`;
    }).join("\n");
  downloadCSV("deskflow_export.csv", content);
}

export function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    
    const performImport = (shouldClear) => {
      try {
        if (shouldClear) mutations.clearNotes();
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
        if (lines.length < 2) {
          showToast("Archivo no válido", "error");
          return;
        }

        let importedCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const v = lines[i].split(",");
          if (v.length < 5) continue;
          mutations.addNote({
            id: Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5),
            title: v[0], date: v[1], time: v[2], priority: v[3], category: v[4],
            description: v[5], alarm: v[6] === "true", tags: v[7] ? v[7].split(";") : [],
            lastAlarmKey: null, lastPreAlarmKey: null
          });
          importedCount++;
        }
        showToast(`Importadas ${importedCount} notas`, "info");
        renderView(); updateUIStats();
        document.getElementById("settings-modal").style.display = "none";
      } catch (err) {
        showToast("Error en importación", "error");
      }
    };

    if (state.notes.length > 0) {
      showConfirmModal("¿Limpiar notas actuales antes de importar?", 
        () => performImport(true), () => performImport(false));
    } else {
      performImport(false);
    }
  };
  reader.readAsText(file);
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