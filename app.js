import { state, mutations, subscribe } from './js/store.js';
import { storage } from './js/storage.js';
import { renderView, updateUIStats, openNoteModal, showToast, renderTagManager, showConfirmModal, renderCategoryManager } from './js/view.js';
import { dateUtils, downloadFile } from './js/utils.js';
import { startAlarmService } from './js/app-alarms.js';
import * as settings from './js/app-settings.js';
import { t } from './translations/translations.js';

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Subscribe UI updates to the state before loading data
  subscribe(() => {
    translateStaticUI();
    renderView();
    updateUIStats();
  });

  // 1. Load basic preferences (language/theme) before showing anything
  await mutations.initStore();
  applyTheme();
  translateStaticUI();

  // 2. Manage security unlocking
  const salt = await storage.getPreference("crypto_salt");
  const unlockModal = document.getElementById("unlock-modal");
  
  // If there is no 'salt', it's the first time (setup)
  if (!salt) {
    document.getElementById("unlock-title").innerText = t('crypto_title_first');
    document.getElementById("unlock-desc").innerText = t('crypto_desc_first');
  }

  // Attempt automatic unlock if a session is already active
  if (salt && await mutations.tryResumeSession()) {
    unlockModal.style.display = "none";
    setupGlobalEvents();
    requestNotificationPermission();
    setFavicon();
    startAlarmService();
    return; // Skip the rest of the modal logic
  }

  // Password show/hide logic
  const togglePassBtn = document.getElementById("toggle-password-visibility");
  const passwordInput = document.getElementById("unlock-password");
  
  togglePassBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
  });

  // Automatically set focus on the password field
  passwordInput.focus();

  document.getElementById("unlock-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("unlock-password").value;
    const errorEl = document.getElementById("unlock-error");
    errorEl.style.display = "none";

    try {
      // This derives the key, verifies if it's correct, and reloads the actual data
      await mutations.unlockStorage(password);
      
      unlockModal.style.display = "none";
      
      // 3. Complete initialization after unlocking
      setupGlobalEvents();
      requestNotificationPermission();
      setFavicon();
      startAlarmService();
    } catch (err) {
      console.error("Error de desbloqueo:", err);
      errorEl.style.display = "block";
    }
  });
}

/**
 * Translates elements that are fixed in the HTML (Sidebar, fixed buttons, etc.)
 */
function translateStaticUI() {
  // Actualizar el atributo lang del documento para accesibilidad y SEO
  document.documentElement.lang = state.language;

  // Traducir textos
  document.querySelectorAll('[data-t]').forEach(el => {
    el.innerText = t(el.dataset.t);
  });

  // Traducir placeholders
  document.querySelectorAll('[data-t-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.tPlaceholder);
  });

  // Traducir atributos title
  document.querySelectorAll('[data-t-title]').forEach(el => {
    el.title = t(el.dataset.t_title || el.dataset.tTitle);
  });
}

function setFavicon() {
  const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/svg+xml';
  link.rel = 'icon';
  // Professional briefcase SVG with DeskFlow corporate blue (#2563eb)
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
  // Hamburger Menu Logic for Mobile
  const topBar = document.querySelector('.top-bar');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  // Helper function to sync menu icons
  const updateToggleIcons = (isOpen) => {
    // Only the desktop button changes icon
    const desktopBtn = document.getElementById('sidebar-open-btn');
    if (desktopBtn) desktopBtn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
  };

  // Function to close sidebar only on mobile after an action
  const closeSidebarOnMobile = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
      updateToggleIcons(false);
    }
  };

  // Close sidebar when clicking the overlay (dark area outside the drawer)
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
    mobileLogo.innerHTML = `<div><i class="fas fa-layer-group"></i> <span>${t('nav_logo')}</span></div>`;

    const searchToggle = document.getElementById('search-toggle-btn');
    const actions = document.querySelector('.top-bar .actions');

    mobileHeader.appendChild(menuBtn);
    mobileHeader.appendChild(mobileLogo);
    if (actions) mobileHeader.appendChild(actions);
    if (searchToggle) mobileHeader.appendChild(searchToggle);

    topBar.prepend(mobileHeader);

    // Listener to toggle the search bar on mobile
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

    // Initial sync: If sidebar starts open, update icon and activate overlay (mobile only)
    const startOpen = sidebar.classList.contains('open');
    if (startOpen) {
      if (window.innerWidth <= 768) {
        sidebarOverlay.classList.add('active');
      }
      updateToggleIcons(true);
    }
  }

  // Menu Logic for Desktop
  const desktopMenuBtn = document.getElementById('sidebar-open-btn');
  if (desktopMenuBtn) {
    desktopMenuBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      // Only activate overlay if on mobile (width < 768px)
      if (window.innerWidth <= 768) {
        sidebarOverlay.classList.toggle('active');
      }
      updateToggleIcons(isOpen);
    });
  }

  // Close sidebar clicking the 'X' button (responsive only)
  document.getElementById('sidebar-close-btn').addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });

  // Sidebar Navigation
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

  // Priority Summary Clicks
  document.querySelectorAll(".sidebar-stats .stat-item").forEach(item => {
    item.addEventListener("click", () => {
      state.allNotesPriorityFilter = item.dataset.priority || null;
      state.allNotesFilterAll = !!item.dataset.priority;
      state.allNotesFilterWithDate = false;
      state.allNotesFilterNoDate = false;
      state.allNotesFilterWithAlarm = item.dataset.filter === 'withAlarm';
      state.allNotesFilterExpired = item.dataset.filter === 'expired';
      state.allNotesFilterCompleted = item.dataset.filter === 'completed';

      state.currentView = "all-notes";
      // Visually update sidebar navigation
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      const allNotesBtn = document.querySelector('[data-view="all-notes"]');
      if (allNotesBtn) allNotesBtn.classList.add("active");
      closeSidebarOnMobile();
    });
  });

  // Theme Toggle
  document.getElementById("theme-toggle").addEventListener("change", (e) => {
    const theme = e.target.checked ? "dark" : "light";
    mutations.setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  });

  // Inject Language Selector in the Sidebar (if it missing)
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

  // Modal and Form
  document.getElementById("add-note-btn").addEventListener("click", () => openNoteModal());
  document.getElementById("note-form").addEventListener("submit", handleFormSubmit);
  
  // Close Modal
  document.getElementById("modal-x").addEventListener("click", () => document.getElementById("note-modal").style.display = "none");
  document.getElementById("close-modal").addEventListener("click", () => document.getElementById("note-modal").style.display = "none");

  // Handle dynamic form submissions (like the Tag form in Settings view)
  document.addEventListener("submit", (e) => {
    if (e.target.id === "tag-form") {
      e.preventDefault();
      const idInput = document.getElementById("tag-id");
      const nameInput = document.getElementById("tag-name");
      const colorInput = document.getElementById("tag-color");
      const submitBtn = document.getElementById("tag-submit-btn");

      const name = nameInput.value;
      const color = colorInput.value;
      const id = idInput.value;

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
      if (idInput) idInput.value = "";
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i>';
      renderTagManager();
    } else if (e.target.id === "category-form") {
      e.preventDefault();
      const idInput = document.getElementById("category-id");
      const nameInput = document.getElementById("category-name");
      const colorInput = document.getElementById("category-color");
      const submitBtn = document.getElementById("category-submit-btn");

      const name = nameInput.value;
      const color = colorInput.value;
      const id = idInput.value;

      if (id) {
        mutations.updateCategory(id, { name, color });
        showToast(t('toast_cat_updated'));
      } else {
        mutations.addCategory({ id: Date.now().toString(), name, color });
        showToast(t('toast_cat_created'));
      }

      e.target.reset();
      if (idInput) idInput.value = "";
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-plus"></i>';
      renderCategoryManager();
    }
  });

  // UI actions centralization to avoid 'window' pollution
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
        document.getElementById("tag-submit-btn").innerHTML = '<i class="fas fa-save"></i>';
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
        document.getElementById("category-submit-btn").innerHTML = '<i class="fas fa-save"></i>';
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
    'export-data': () => settings.exportData(),
    'import-data': () => document.getElementById("import-data-input").click(),
    'delete-past': () => settings.deletePastNotes(),
    'clear-completed': () => settings.clearCompletedNotes(),
    'reset-app': () => settings.resetApp(),
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

  // Global event delegation
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (uiActions[action]) {
      uiActions[action](id, target);
    }
  });

  // Alarm switch control based on time
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

  const completedInput = document.getElementById("completed");
  completedInput.addEventListener("change", (e) => {
    // Si se marca como finalizada, desactivamos la alarma y el tag visualmente en el modal
    if (e.target.checked) {
      alarmInput.checked = false;
      syncAlarmTagUI(false);
    }
  });

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
    // Trigger 'input' event to update the modal title
    document.getElementById("date").dispatchEvent(new Event('input'));
  });

  document.getElementById("clear-time").addEventListener("click", () => {
    timeInput.value = "";
    timeInput.dispatchEvent(new Event('input'));
  });

  const importInput = document.getElementById("import-data-input");
  importInput.addEventListener("change", (e) => {
    settings.importData(e.target.files[0], applyTheme);
    importInput.value = "";
  });

  document.getElementById("global-search").addEventListener("input", (e) => {
    // Filtering logic delegated to view.js
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

  // Refresh when changing search options
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
    lastPreAlarmKey: existing ? existing.lastPreAlarmKey : null,
    completed: document.getElementById("completed").checked, // NEW: Get completed state
  };

  try {
    id ? mutations.updateNote(id, formData) : mutations.addNote(formData);
    showToast(id ? t('toast_saved') : (formData.date ? t('toast_rem_created') : t('toast_note_created')));
    document.getElementById("note-modal").style.display = "none";
  } catch (error) {
    showToast(error.message, "error");
  }
}