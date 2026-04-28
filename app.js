import { state, mutations } from './store.js';
import { renderView, updateUIStats, openNoteModal, showToast, renderTagManager, showConfirmModal, renderCategoryManager } from './view.js';
import { dateUtils, downloadCSV } from './utils.js';

document.addEventListener("DOMContentLoaded", init);

function init() {
  applyTheme();
  setupGlobalEvents();
  requestNotificationPermission();
  setFavicon();
  startAlarmService();
  renderView();
  updateUIStats();
}

function setFavicon() {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/svg+xml';
  link.rel = 'icon';
  // SVG de un maletín profesional con el color azul corporativo de DeskFlow (#2563eb)
  link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="%232563eb" d="M128 64c0-35.3 28.7-64 64-64h128c35.3 0 64 28.7 64 64v64h64c35.3 0 64 28.7 64 64v288c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V192c0-35.3 28.7-64 64-64h64V64zm64 64h128V64H192v64z"/></svg>';
  document.head.appendChild(link);
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        showToast("Notificaciones activadas correctamente", "info");
      }
    });
  }
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.getElementById("theme-toggle").checked = state.theme === "dark";
}

function setupGlobalEvents() {
  // Navegación Sidebar
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const view = e.currentTarget.dataset.view;
      if (!view) return;
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.allNotesPriorityFilter = null;
      state.currentView = view;
      renderView();
    });
  });

  // Resumen Prioridades Clicks
  document.querySelectorAll(".sidebar-stats .stat-item").forEach(item => {
    item.addEventListener("click", () => {
      state.allNotesPriorityFilter = item.dataset.priority;
      state.currentView = "all-notes";
      // Actualizar visualmente la navegación del sidebar
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      const allNotesBtn = document.querySelector('[data-view="all-notes"]');
      if (allNotesBtn) allNotesBtn.classList.add("active");
      renderView();
    });
  });

  // Toggle Tema
  document.getElementById("theme-toggle").addEventListener("change", (e) => {
    const theme = e.target.checked ? "dark" : "light";
    mutations.setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  });

  // Modal y Formulario
  document.getElementById("add-note-btn").addEventListener("click", () => openNoteModal());
  document.getElementById("note-form").addEventListener("submit", handleFormSubmit);
  
  // Cerrar Modal
  document.getElementById("modal-x").addEventListener("click", () => document.getElementById("note-modal").style.display = "none");
  document.getElementById("close-modal").addEventListener("click", () => document.getElementById("note-modal").style.display = "none");

  // Tag Manager
  const tagModal = document.getElementById("tag-manager-modal");
  document.getElementById("manage-tags-btn").addEventListener("click", () => {
    document.getElementById("tag-form").reset();
    document.getElementById("tag-id").value = "";
    document.getElementById("tag-submit-btn").innerText = "Añadir";
    renderTagManager();
    tagModal.style.display = "flex";
  });
  document.getElementById("close-tag-manager").onclick = () => tagModal.style.display = "none";
  document.getElementById("close-tag-manager-btn").onclick = () => tagModal.style.display = "none";
  
  document.getElementById("tag-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("tag-id").value;
    const name = document.getElementById("tag-name").value;
    const color = document.getElementById("tag-color").value;

    if (id) {
      mutations.updateTag(id, { name, color });
      showToast("Tag actualizado");
    } else {
      mutations.addTag({ id: Date.now().toString(), name, color });
      showToast("Tag creado");
    }

    e.target.reset();
    document.getElementById("tag-id").value = "";
    document.getElementById("tag-submit-btn").innerText = "Añadir";
    renderTagManager();
    renderView();
    updateUIStats();
  });

  window.editTag = (id) => {
    const tag = state.tags.find(t => t.id === id);
    if (tag) {
      document.getElementById("tag-id").value = tag.id;
      document.getElementById("tag-name").value = tag.name;
      document.getElementById("tag-color").value = tag.color;
      document.getElementById("tag-submit-btn").innerText = "Guardar";
    }
  };

  window.deleteTag = (id) => {
    showConfirmModal("¿Eliminar este tag de todas las notas? Esta acción no se puede deshacer.", () => {
      mutations.deleteTag(id);
      renderTagManager();
      renderView();
      showToast("Tag eliminado de todas las notas", "info");
      updateUIStats();
    });
  };

  // Category Manager
  const catModal = document.getElementById("category-manager-modal");
  document.getElementById("manage-categories-btn").addEventListener("click", () => {
    document.getElementById("category-form").reset();
    document.getElementById("category-id").value = "";
    document.getElementById("category-submit-btn").innerText = "Añadir";
    renderCategoryManager();
    catModal.style.display = "flex";
  });
  document.getElementById("close-category-manager").onclick = () => catModal.style.display = "none";
  document.getElementById("close-category-manager-btn").onclick = () => catModal.style.display = "none";

  document.getElementById("category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("category-id").value;
    const name = document.getElementById("category-name").value;
    const color = document.getElementById("category-color").value;
    if (id) {
      mutations.updateCategory(id, { name, color });
      showToast("Categoría actualizada");
    } else {
      mutations.addCategory({ id: Date.now().toString(), name, color });
      showToast("Categoría creada");
    }
    e.target.reset();
    renderCategoryManager();
    renderView();
    updateUIStats();
  });

  window.editCategory = (id) => {
    const cat = state.categories.find(c => c.id === id);
    if (cat) {
      document.getElementById("category-id").value = cat.id;
      document.getElementById("category-name").value = cat.name;
      document.getElementById("category-color").value = cat.color;
      document.getElementById("category-submit-btn").innerText = "Guardar";
    }
  };

  window.deleteCategory = (id) => {
    showConfirmModal("¿Eliminar esta categoría? Las notas asociadas pasarán a 'Otros'.", () => {
      mutations.deleteCategory(id);
      renderCategoryManager();
      renderView();
      updateUIStats();
      showToast("Categoría eliminada", "info");
    });
  };

  // Configuración y Reset
  const settingsModal = document.getElementById("settings-modal");
  document.getElementById("manage-settings-btn").addEventListener("click", () => {
    settingsModal.style.display = "flex";
  });
  
  const closeSettings = () => settingsModal.style.display = "none";
  document.getElementById("close-settings-x").onclick = closeSettings;
  document.getElementById("close-settings-btn").onclick = closeSettings;

  document.getElementById("delete-past-notes-btn").addEventListener("click", () => {
    const todayStr = dateUtils.getTodayStr();
    const pastNotesCount = state.notes.filter(n => n.date && n.date < todayStr).length;

    if (pastNotesCount === 0) {
      showToast("No hay notas con fecha pasada para eliminar.", "info");
      return;
    }

    showConfirmModal(`¿Deseas eliminar permanentemente ${pastNotesCount} nota(s) con fecha anterior a hoy?`, () => {
      mutations.deletePastNotes(todayStr);
      showToast(`${pastNotesCount} notas antiguas eliminadas`, "info");
      renderView();
      updateUIStats();
      closeSettings();
    });
  });

  document.getElementById("reset-app-btn").addEventListener("click", () => {
    showConfirmModal("¿ESTÁS SEGURO? Esta acción borrará todas tus notas, categorías y etiquetas. No se puede deshacer.", () => {
      mutations.resetApp();
      showToast("Aplicación reseteada correctamente", "info");
      closeSettings();
      renderView();
      updateUIStats();
    });
  });

  // Control del switch de alarma basado en la hora
  const timeInput = document.getElementById("time");
  const alarmInput = document.getElementById("alarm");
  timeInput.addEventListener("input", () => {
    if (!timeInput.value) {
      alarmInput.checked = false;
      alarmInput.disabled = true;
    } else {
      if (alarmInput.disabled) alarmInput.checked = true;
      alarmInput.disabled = false;
    }
  });

  document.getElementById("clear-date").addEventListener("click", () => {
    document.getElementById("date").value = "";
  });

  document.getElementById("clear-time").addEventListener("click", () => {
    timeInput.value = "";
    timeInput.dispatchEvent(new Event('input'));
  });

  // Exportar e Importar
  document.getElementById("export-data").addEventListener("click", () => {
    const headers = "Titulo,Fecha,Hora,Prioridad,Categoria,Descripcion,Alarma,Tags";
    const content = headers + "\n" + 
      state.notes.map(n => {
        const tags = (n.tags || []).join(';');
        // Reemplazamos comas por punto y coma en textos para evitar romper el CSV simple
        const safeTitle = (n.title || "").replace(/,/g, ";").replace(/\n/g, " ");
        const safeDesc = (n.description || "").replace(/,/g, ";").replace(/\n/g, " ");
        return `${safeTitle},${n.date || ""},${n.time || ""},${n.priority},${n.category},${safeDesc},${n.alarm},${tags}`;
      }).join("\n");
    downloadCSV("deskflow_export.csv", content);
  });

  const importInput = document.getElementById("import-data-input");
  document.getElementById("import-data-btn").addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;

      const performImport = (shouldClear) => {
        try {
          if (shouldClear) mutations.clearNotes();

          const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
          if (lines.length < 2) {
            showToast("El archivo está vacío o no contiene datos válidos", "error");
            return;
          }

          const header = lines[0].toLowerCase();
          if (!header.includes("titulo") || !header.includes("prioridad") || !header.includes("categoria")) {
            showToast("Formato CSV no válido. Use un archivo exportado por DeskFlow.", "error");
            return;
          }

          let importedCount = 0;
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const v = line.split(",");
            if (v.length < 5) continue;

            mutations.addNote({
              id: Date.now().toString() + "_" + Math.random().toString(36).substr(2, 5),
              title: v[0] || "Nota Importada",
              date: v[1] || "",
              time: v[2] || "",
              priority: v[3] || "medium",
              category: v[4] || "Otros",
              description: v[5] || "",
              alarm: v[6] === "true",
              tags: v[7] ? v[7].split(";") : [],
              lastAlarmKey: null,
              lastPreAlarmKey: null
            });
            importedCount++;
          }

          if (importedCount > 0) {
            showToast(`Se han importado ${importedCount} notas correctamente`, "info");
            renderView();
            updateUIStats();
            closeSettings();
          }
        } catch (err) {
          showToast("Error al procesar el archivo CSV", "error");
        } finally {
          importInput.value = "";
        }
      };

      if (state.notes.length > 0) {
        showConfirmModal(
          "¿Deseas borrar todas las notas actuales antes de importar? (Pulsa 'Eliminar' para limpiar la lista o 'Cancelar' para añadir las nuevas a las existentes)",
          () => performImport(true),
          () => performImport(false)
        );
      } else {
        performImport(false);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("global-search").addEventListener("input", (e) => {
    // Lógica de filtrado delegada a view.js
    window.dispatchEvent(new CustomEvent('search-notes', { detail: e.target.value }));
  });

  // Refrescar al cambiar opciones de búsqueda
  document.getElementById("search-tags").addEventListener("change", () => renderView());
  document.getElementById("search-categories").addEventListener("change", () => renderView());
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('note-id').value;
  const timeValue = document.getElementById("time").value;
  const dateValue = document.getElementById("date").value;
  const existingNote = id ? state.notes.find(n => n.id === id) : null;

  const selectedTags = Array.from(document.querySelectorAll('input[name="note-tags"]:checked')).map(cb => cb.value);
  
  const noteData = {
    id: id || Date.now().toString(),
    title: document.getElementById("title").value,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    priority: document.getElementById("priority").value,
    category: document.getElementById("category").value,
    description: document.getElementById("description").value,
    alarm: document.getElementById("alarm").checked,
    tags: selectedTags,
    lastAlarmKey: (existingNote && existingNote.time === timeValue && existingNote.date === dateValue) ? existingNote.lastAlarmKey : null,
    lastPreAlarmKey: (existingNote && existingNote.time === timeValue && existingNote.date === dateValue) ? existingNote.lastPreAlarmKey : null
  };

  id ? mutations.updateNote(id, noteData) : mutations.addNote(noteData);
  showToast(id ? "Nota actualizada" : "Nota creada");
  
  document.getElementById("note-modal").style.display = "none";
  renderView();
  updateUIStats();
}

function playAlarmSound() {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, context.currentTime);
    gain.gain.setValueAtTime(0.1, context.currentTime);
    osc.start();
    osc.stop(context.currentTime + 1);
  } catch (e) {
    console.error("Audio no soportado o bloqueado por el navegador");
  }
}

function startAlarmService() {
  setInterval(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDate = dateUtils.getTodayStr();
    const currentMinuteKey = currentDate + "_" + currentTime;

    state.notes.forEach((note) => {
      // Si no hay fecha, es una nota recurrente diaria
      const isScheduledToday = !note.date || note.date === currentDate;

      if (note.alarm && isScheduledToday && note.time) {
        const [hrs, mins] = note.time.split(':').map(Number);
        const noteTime = new Date();
        noteTime.setHours(hrs, mins, 0, 0);

        const diff = now - noteTime;

        // --- Lógica de Pre-Alarma (5 minutos antes) ---
        const preAlarmDiff = now - (noteTime.getTime() - 5 * 60000);
        if (preAlarmDiff >= 0 && preAlarmDiff < 60000 && note.lastPreAlarmKey !== currentDate) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("DeskFlow: Aviso (5 min)", {
              body: `Próximamente: ${note.title}`,
              icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/layer-group.svg",
              requireInteraction: true
            });
          }
          showToast(`Aviso previo (5 min): ${note.title}`, "info");
          note.lastPreAlarmKey = currentDate;
          mutations.saveNotes();
        }

        // Comprobamos si ya es la hora o si ya pasó (ventana de 2 min) y si no ha sonado HOY
        if (diff >= 0 && diff < 120000 && note.lastAlarmKey !== currentDate) { 
        playAlarmSound();

        // Notificación Nativa del Sistema Operativo
        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification("DeskFlow: Recordatorio", {
            body: note.title,
            icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/layer-group.svg",
            requireInteraction: true
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }

        showToast(`¡ALERTA!: ${note.title}`, "high", note.id);
        
        // Si tiene fecha específica, desactivamos alarma permanentemente.
        // Si no tiene fecha, es recurrente: solo marcamos que ya sonó hoy en este minuto.
        if (note.date) {
          note.alarm = false;
        }
        
        note.lastAlarmKey = currentDate;
        mutations.saveNotes();
        renderView();
        }
      }
    });
  }, 10000); // Revisar cada 10 segundos es más seguro para tabs en segundo plano
}