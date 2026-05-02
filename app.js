import { state, mutations, subscribe } from './js/store.js';
import { renderView, updateUIStats, openNoteModal, showToast, renderTagManager, showConfirmModal, renderCategoryManager } from './js/view.js';
import { dateUtils, downloadFile } from './js/utils.js';
import { startAlarmService } from './js/app-alarms.js';
import * as settings from './js/app-settings.js';
import { t } from './translations/translations.js';

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Suscribir la actualización de la UI al estado antes de cargar datos
  subscribe(() => {
    translateStaticUI();
    renderView();
    updateUIStats();
  });

  // FASE 6 — Esperar a que los datos se carguen desde IndexedDB
  await mutations.initStore();

  applyTheme(); // Ahora se aplica después de que initStore haya cargado el tema de IDB
  setupGlobalEvents();
  requestNotificationPermission();
  setFavicon();
  startAlarmService();
}

/**
 * Traduce elementos que están fijos en el HTML (Sidebar, botones fijos, etc)
 */
function translateStaticUI() {
  // Traducir textos
  document.querySelectorAll('[data-t]').forEach(el => {
    el.innerText = t(el.dataset.t);
  });

  // Traducir placeholders
  document.querySelectorAll('[data-t-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.tPlaceholder);
  });
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
  if (!("Notification" in window)) {
    console.warn("Este navegador no soporta notificaciones.");
    return;
  }

  console.log("Estado de permisos de notificación:", Notification.permission);

  if (Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      console.log("Nuevo estado de permiso:", permission);
      if (permission === "granted") showToast(t('toast_notif_on'), "info");
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

  // Función auxiliar para sincronizar los iconos de los botones de menú
  const updateToggleIcons = (isOpen) => {
    // Solo el botón de escritorio cambia de icono
    const desktopBtn = document.getElementById('sidebar-open-btn');
    if (desktopBtn) desktopBtn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
  };

  // Función para cerrar el sidebar solo en dispositivos móviles tras una acción
  const closeSidebarOnMobile = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
      updateToggleIcons(false);
    }
  };

  // Cerrar sidebar al hacer click en el overlay (zona oscura fuera del drawer)
  sidebarOverlay?.addEventListener('click', closeSidebarOnMobile);

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

    const searchToggle = document.getElementById('search-toggle-btn');
    const actions = document.querySelector('.top-bar .actions');

    mobileHeader.appendChild(menuBtn);
    mobileHeader.appendChild(mobileLogo);
    if (actions) mobileHeader.appendChild(actions);
    if (searchToggle) mobileHeader.appendChild(searchToggle);

    topBar.prepend(mobileHeader);

    // Listener para alternar el buscador en móvil
    searchToggle?.addEventListener('click', () => {
      const isActive = topBar.classList.toggle('search-active');
      const icon = searchToggle.querySelector('i');
      if (icon) {
        icon.className = isActive ? 'fas fa-times' : 'fas fa-search';
      }
    });

    menuBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });

    // Sincronización inicial: Si el sidebar empieza abierto, actualizar icono y activar overlay (solo en móvil)
    const startOpen = sidebar.classList.contains('open');
    if (startOpen) {
      if (window.innerWidth <= 768) {
        sidebarOverlay.classList.add('active');
      }
      updateToggleIcons(true);
    }
  }

  // Lógica de Menú para Escritorio
  const desktopMenuBtn = document.getElementById('sidebar-open-btn');
  if (desktopMenuBtn) {
    desktopMenuBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      // Solo activamos el overlay si estamos en móvil (ancho < 768px)
      if (window.innerWidth <= 768) {
        sidebarOverlay.classList.toggle('active');
      }
      updateToggleIcons(isOpen);
    });
  }

  // Cerrar sidebar al hacer click en el botón 'X' (solo se ve en responsive)
  document.getElementById('sidebar-close-btn').addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });

  // Navegación Sidebar
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const view = e.currentTarget.dataset.view;
      if (!view) return;
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.allNotesPriorityFilter = null;
      state.currentView = view;
      closeSidebarOnMobile();
    });
  });

  // Resumen Prioridades Clicks
  document.querySelectorAll(".sidebar-stats .stat-item").forEach(item => {
    item.addEventListener("click", () => {
      state.allNotesPriorityFilter = item.dataset.priority || null;
      state.allNotesFilterAll = !!item.dataset.priority;
      state.allNotesFilterWithDate = false;
      state.allNotesFilterNoDate = false;
      state.allNotesFilterWithAlarm = item.dataset.filter === 'withAlarm';
      state.allNotesFilterExpired = item.dataset.filter === 'expired';

      state.currentView = "all-notes";
      // Actualizar visualmente la navegación del sidebar
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      const allNotesBtn = document.querySelector('[data-view="all-notes"]');
      if (allNotesBtn) allNotesBtn.classList.add("active");
      closeSidebarOnMobile();
    });
  });

  // Toggle Tema
  document.getElementById("theme-toggle").addEventListener("change", (e) => {
    const theme = e.target.checked ? "dark" : "light";
    mutations.setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  });

  // Inyectar Selector de Idioma en el Sidebar (si no existe)
  if (sidebar && !document.getElementById('language-select-container')) {
    const langContainer = document.createElement('div');
    langContainer.id = 'language-select-container';
    langContainer.className = 'language-select-container';
    langContainer.innerHTML = `
      <select id="language-select" class="language-select">
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    `;
    sidebar.appendChild(langContainer);
    
    document.getElementById("language-select").value = state.language;
    document.getElementById("language-select").addEventListener("change", (e) => {
      mutations.setLanguage(e.target.value);
    });
  }

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
    document.getElementById("tag-submit-btn").innerText = t('btn_add');
    renderTagManager();
    tagModal.style.display = "flex";
    closeSidebarOnMobile();
  });
  document.getElementById("close-tag-manager").onclick = () => tagModal.style.display = "none";
  document.getElementById("close-tag-manager-btn").onclick = () => tagModal.style.display = "none";
  
  document.getElementById("tag-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("tag-id").value;
    const name = document.getElementById("tag-name").value;
    const color = document.getElementById("tag-color").value;

    if (name.trim().toLowerCase() === "alarma") {
      showToast(t('err_alarm_name'), "error");
      return;
    }

    if (id) {
      mutations.updateTag(id, { name, color });
      showToast(t('toast_tag_updated'));
    } else {
      mutations.addTag({ id: Date.now().toString(), name, color });
      showToast(t('toast_tag_created'));
    }

    e.target.reset();
    document.getElementById("tag-id").value = "";
    document.getElementById("tag-submit-btn").innerText = t('btn_add');
    renderTagManager();
  });

  // Centralización de acciones de UI para evitar el uso de 'window'
  const uiActions = {
    'edit-tag': (id) => {
      const tag = state.tags.find(t => t.id === id);
      if (tag && (tag.name === "Alarma" || tag.id === "tag-alarm-default")) {
        showToast(t('toast_err_system_tag'), "error");
        return;
      }
      if (tag) {
        document.getElementById("tag-id").value = tag.id;
        document.getElementById("tag-name").value = tag.name;
        document.getElementById("tag-color").value = tag.color;
        document.getElementById("tag-submit-btn").innerText = t('btn_save');
      }
    },
    'delete-tag': (id) => {
      const tag = state.tags.find(t => t.id === id);
      if (tag && (tag.name === "Alarma" || tag.id === "tag-alarm-default")) {
        showToast(t('toast_err_system_tag_del'), "error");
        return;
      }
      showConfirmModal(t('conf_del_tag'), () => {
        mutations.deleteTag(id);
        renderTagManager();
        showToast(t('toast_tag_updated'), "info");
      });
    },
    'edit-category': (id) => {
      const cat = state.categories.find(c => c.id === id);
      if (cat) {
        document.getElementById("category-id").value = cat.id;
        document.getElementById("category-name").value = cat.name;
        document.getElementById("category-color").value = cat.color;
        document.getElementById("category-submit-btn").innerText = t('btn_save');
      }
    },
    'delete-category': (id) => {
      showConfirmModal(t('conf_del_cat'), () => {
        mutations.deleteCategory(id);
        renderCategoryManager();
        showToast(t('toast_cat_updated'), "info");
      });
    },
    'view-day': (id, target) => {
      window.selectDayView(id);
      uiActions['close-toast'](null, target);
    },
    'snooze': (id, target) => {
      window.snoozeNote(id);
      uiActions['close-toast'](null, target);
    },
    'close-toast': (id, target) => {
      const toast = target.closest('.toast');
      if (toast) {
        toast.remove();
        if (document.querySelectorAll('.toast.high').length === 0) {
          document.body.classList.remove("alarm-active");
        }
      }
    }
  };

  // Delegación de eventos global
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (uiActions[action]) {
      uiActions[action](id, target);
    }
  });

  // Category Manager
  const catModal = document.getElementById("category-manager-modal");
  document.getElementById("manage-categories-btn").addEventListener("click", () => {
    document.getElementById("category-form").reset();
    document.getElementById("category-id").value = "";
    document.getElementById("category-submit-btn").innerText = t('btn_add');
    renderCategoryManager();
    catModal.style.display = "flex";
    closeSidebarOnMobile();
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
      showToast(t('toast_cat_updated'));
    } else {
      mutations.addCategory({ id: Date.now().toString(), name, color });
      showToast(t('toast_cat_created'));
    }
    e.target.reset();
    renderCategoryManager();
  });

  // Configuración y Reset
  const settingsModal = document.getElementById("settings-modal");
  document.getElementById("manage-settings-btn").addEventListener("click", () => {
    settings.updateStorageInfoUI();
    settingsModal.style.display = "flex";
    closeSidebarOnMobile();
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
      searchInput.placeholder = t('search_all');
    } else if (tagsActive) {
      searchInput.placeholder = t('search_tags');
    } else if (catsActive) {
      searchInput.placeholder = t('search_cats');
    } else {
      searchInput.placeholder = t('search_default');
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
  const existing = id ? state.notes.find(n => n.id === id) : null;

  const formData = {
    title: document.getElementById("title").value,
    date: document.getElementById("date").value,
    time: document.getElementById("time").value,
    priority: document.getElementById("priority").value,
    category: document.getElementById("category").value,
    description: document.getElementById("description").value,
    alarm: document.getElementById("alarm").checked,
    tags: Array.from(document.querySelectorAll('input[name="note-tags"]:checked')).map(cb => cb.value),
    // Preservamos las llaves de alarmas; el store decidirá si resetearlas si cambia la fecha/hora
    lastAlarmKey: existing ? existing.lastAlarmKey : null,
    lastPreAlarmKey: existing ? existing.lastPreAlarmKey : null
  };

  try {
    id ? mutations.updateNote(id, formData) : mutations.addNote(formData);
    showToast(id ? t('toast_saved') : (formData.date ? t('toast_rem_created') : t('toast_note_created')));
    document.getElementById("note-modal").style.display = "none";
  } catch (error) {
    showToast(error.message, "error");
  }
}