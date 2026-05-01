import { state, mutations } from './store.js';
import { renderView, updateUIStats, openNoteModal, showToast, renderTagManager, showConfirmModal, renderCategoryManager } from './view.js';
import { dateUtils, downloadFile } from './utils.js';
import { startAlarmService } from './app-alarms.js';
import * as settings from './app-settings.js';

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // FASE 6 — Esperar a que los datos se carguen desde IndexedDB
  await mutations.initStore();

  applyTheme(); // Ahora se aplica después de que initStore haya cargado el tema de IDB
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

export function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.getElementById("theme-toggle").checked = state.theme === "dark";
}

function setupGlobalEvents() {
  // Lógica de Menú Hamburguesa para Móvil
  const topBar = document.querySelector('.top-bar');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (topBar && !document.getElementById('mobile-header-row')) {
    const mobileHeader = document.createElement('div');
    mobileHeader.id = 'mobile-header-row';
    mobileHeader.className = 'mobile-header-row';

    const menuBtn = document.createElement('button');
    menuBtn.id = 'mobile-menu-btn';
    menuBtn.className = 'hamburger-btn';
    menuBtn.innerHTML = '<i class="fas fa-bars"></i>';

    const mobileLogo = document.createElement('div');
    mobileLogo.className = 'logo mobile-logo';
    mobileLogo.innerHTML = '<div><i class="fas fa-layer-group"></i> <span>DeskFlow</span></div>';

    mobileHeader.appendChild(menuBtn);
    mobileHeader.appendChild(mobileLogo);
    topBar.prepend(mobileHeader);

    const searchToggle = document.getElementById('search-toggle-btn');
    searchToggle.addEventListener('click', () => {
      const isActive = topBar.classList.toggle('search-active');
      const icon = searchToggle.querySelector('i');
      if (icon) {
        icon.className = isActive ? 'fas fa-times' : 'fas fa-search';
      }
    });

    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });

    // Cerrar sidebar al hacer click en el overlay
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });

    // Cerrar sidebar al hacer click en el botón 'X'
    document.getElementById('sidebar-close-btn').addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }

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
      
      // Cerrar sidebar y overlay al hacer click en móvil
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  });

  // Resumen Prioridades Clicks
  document.querySelectorAll(".sidebar-stats .stat-item").forEach(item => {
    item.addEventListener("click", () => {
      state.allNotesPriorityFilter = item.dataset.priority;
      state.allNotesFilterAll = true;
      state.allNotesFilterWithDate = false;
      state.allNotesFilterNoDate = false;
      state.allNotesFilterExpired = false; // Asegurar que vemos notas activas al filtrar prioridad
      state.currentView = "all-notes";
      // Actualizar visualmente la navegación del sidebar
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      const allNotesBtn = document.querySelector('[data-view="all-notes"]');
      if (allNotesBtn) allNotesBtn.classList.add("active");
      renderView();

      // Cerrar sidebar y overlay en móvil
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
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

    // Cerrar sidebar y overlay en móvil
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });
  document.getElementById("close-tag-manager").onclick = () => tagModal.style.display = "none";
  document.getElementById("close-tag-manager-btn").onclick = () => tagModal.style.display = "none";
  
  document.getElementById("tag-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("tag-id").value;
    const name = document.getElementById("tag-name").value;
    const color = document.getElementById("tag-color").value;

    if (name.trim().toLowerCase() === "alarma") {
      showToast("El nombre 'Alarma' está reservado para el sistema", "error");
      return;
    }

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
    if (tag && (tag.name === "Alarma" || tag.id === "tag-alarm-default")) {
      showToast("Esta etiqueta de sistema no se puede modificar", "error");
      return;
    }

    if (tag) {
      document.getElementById("tag-id").value = tag.id;
      document.getElementById("tag-name").value = tag.name;
      document.getElementById("tag-color").value = tag.color;
      document.getElementById("tag-submit-btn").innerText = "Guardar";
    }
  };

  window.deleteTag = (id) => {
    const tag = state.tags.find(t => t.id === id);
    if (tag && (tag.name === "Alarma" || tag.id === "tag-alarm-default")) {
      showToast("Esta etiqueta de sistema no se puede eliminar", "error");
      return;
    }

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

    // Cerrar sidebar y overlay en móvil
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
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
    settings.updateStorageInfoUI();
    settingsModal.style.display = "flex";

    // Cerrar sidebar y overlay en móvil
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });
  
  const closeSettings = () => settingsModal.style.display = "none";
  document.getElementById("close-settings-x").onclick = closeSettings;
  document.getElementById("close-settings-btn").onclick = closeSettings;

  document.getElementById("delete-past-notes-btn").addEventListener("click", settings.deletePastNotes);
  document.getElementById("reset-app-btn").addEventListener("click", settings.resetApp);

  // Control del switch de alarma basado en la hora
  const timeInput = document.getElementById("time");
  const alarmInput = document.getElementById("alarm");

  const syncAlarmTagUI = (isActive) => {
    const alarmTag = state.tags.find(t => t.name === "Alarma");
    if (!alarmTag) return;
    const tagCheckbox = document.querySelector(`input[name="note-tags"][value="${alarmTag.id}"]`);
    if (tagCheckbox) {
      tagCheckbox.checked = isActive;
      const chip = tagCheckbox.closest(".tag-chip");
      if (chip) {
        chip.classList.toggle("selected", isActive);
        chip.classList.toggle("inactive", !isActive);
        chip.style.display = isActive ? 'inline-flex' : 'none';
      }
    }
  };

  alarmInput.addEventListener("change", (e) => syncAlarmTagUI(e.target.checked));

  timeInput.addEventListener("input", () => {
    if (!timeInput.value) {
      alarmInput.checked = false;
      alarmInput.disabled = true;
      syncAlarmTagUI(false);
    } else {
      if (alarmInput.disabled) {
        alarmInput.checked = true;
        syncAlarmTagUI(true);
      }
      alarmInput.disabled = false;
    }
  });

  document.getElementById("clear-date").addEventListener("click", () => {
    document.getElementById("date").value = "";
    // Disparar el evento 'input' para que el título del modal se actualice
    document.getElementById("date").dispatchEvent(new Event('input'));
  });

  document.getElementById("clear-time").addEventListener("click", () => {
    timeInput.value = "";
    timeInput.dispatchEvent(new Event('input'));
  });

  // Exportar e Importar
  document.getElementById("export-data").addEventListener("click", settings.exportData);

  const importInput = document.getElementById("import-data-input");
  document.getElementById("import-data-btn").addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", (e) => {
    settings.importData(e.target.files[0], applyTheme);
    importInput.value = "";
  });

  document.getElementById("global-search").addEventListener("input", (e) => {
    // Lógica de filtrado delegada a view.js
    window.dispatchEvent(new CustomEvent('search-notes', { detail: e.target.value }));
  });

  const updateSearchPlaceholder = () => {
    const searchInput = document.getElementById("global-search");
    const tagsActive = document.getElementById("search-tags").checked;
    const catsActive = document.getElementById("search-categories").checked;

    if (tagsActive && catsActive) {
      searchInput.placeholder = "Buscar notas por tag o categoría";
    } else if (tagsActive) {
      searchInput.placeholder = "Buscar notas por tag";
    } else if (catsActive) {
      searchInput.placeholder = "Buscar notas por categoría";
    } else {
      searchInput.placeholder = "Buscar notas por nombre...";
    }
  };

  // Refrescar al cambiar opciones de búsqueda
  document.getElementById("search-tags").addEventListener("change", () => {
    updateSearchPlaceholder();
    renderView();
  });
  document.getElementById("search-categories").addEventListener("change", () => {
    updateSearchPlaceholder();
    renderView();
  });
}

function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('note-id').value;
  const timeValue = document.getElementById("time").value;
  const dateValue = document.getElementById("date").value;
  const existingNote = id ? state.notes.find(n => n.id === id) : null;
  const todayStr = dateUtils.getTodayStr();

  // Si no hay fecha seleccionada, no aplicamos validaciones de tiempo.
  // Esto permite que las "notas" (sin fecha) se guarden con cualquier hora.
  if (dateValue === "") {
    // No hay fecha, se omite la validación de tiempo.
  }
  // Si hay fecha, aplicamos las validaciones de recordatorio.
  else {
    // 1. No permitir fechas pasadas
    if (dateValue < todayStr) {
      showToast("No se pueden programar recordatorios en fechas pasadas", "error");
      return;
    }

    // 2. Si la fecha es hoy, la hora no puede ser anterior a la actual
    if (dateValue === todayStr && timeValue && timeValue.slice(0, 5) < `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`) {
      showToast("No puedes programar un recordatorio para una hora que ya pasó hoy", "error");
      return;
    }
  }

  const selectedTags = Array.from(document.querySelectorAll('input[name="note-tags"]:checked')).map(cb => cb.value);
  const isAlarmActive = document.getElementById("alarm").checked;

  const alarmTag = state.tags.find(t => t.name === "Alarma");

  // Sincronizar automáticamente el tag "Alarma" según el estado del checkbox
  if (alarmTag) {
    const tagIndex = selectedTags.indexOf(alarmTag.id);
    if (isAlarmActive) {
      if (tagIndex === -1) selectedTags.push(alarmTag.id);
    } else {
      if (tagIndex !== -1) selectedTags.splice(tagIndex, 1);
    }
  }

  const noteData = {
    id: id || Date.now().toString(),
    title: document.getElementById("title").value,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    priority: document.getElementById("priority").value,
    category: document.getElementById("category").value,
    description: document.getElementById("description").value,
    alarm: isAlarmActive,
    tags: selectedTags,
    lastAlarmKey: (existingNote && existingNote.time === timeValue && existingNote.date === dateValue) ? existingNote.lastAlarmKey : null,
    lastPreAlarmKey: (existingNote && existingNote.time === timeValue && existingNote.date === dateValue) ? existingNote.lastPreAlarmKey : null
  };

  id ? mutations.updateNote(id, noteData) : mutations.addNote(noteData);
  
  const typeLabel = noteData.date ? "Recordatorio" : "Nota";
  showToast(id ? `${typeLabel} actualizado` : `${typeLabel} creado`);
  
  document.getElementById("note-modal").style.display = "none";
  renderView();
  updateUIStats();
}