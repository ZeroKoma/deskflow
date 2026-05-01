import { state, mutations, getters } from "./store.js";
import { dateUtils } from "./utils.js";
import {
  priorityLabels,
  getCategoryInfo,
  renderCategoryBadge,
  renderTagPills,
  showToast,
  showConfirmModal,
} from "./view-components.js";
import {
  openNoteModal,
  renderTagManager,
  renderCategoryManager,
} from "./view-modals.js";

// Re-exportar para app.js
export {
  showToast,
  showConfirmModal,
  openNoteModal,
  renderTagManager,
  renderCategoryManager,
};

const viewContainer = document.getElementById("view-container");

/**
 * Auxiliar para determinar si una nota coincide con los criterios de búsqueda actuales
 */
const matchesSearch = (note, query, includeTags, includeCats) => {
  if (!query) return true;
  const q = query.toLowerCase();

  // Si no hay filtros específicos activos, buscamos por nombre de nota (título)
  if (!includeTags && !includeCats) {
    return note.title.toLowerCase().includes(q);
  }

  // Si hay filtros activos, el nombre de la nota ya no se busca (según petición)
  let found = false;
  if (includeTags) {
    const tagNames = (note.tags || []).map(
      (id) => state.tags.find((t) => t.id === id)?.name.toLowerCase() || "",
    );
    if (tagNames.some((name) => name.includes(q))) found = true;
  }
  if (includeCats && !found) {
    const categoryName = getCategoryInfo(note.category).name.toLowerCase();
    if (categoryName.includes(q)) found = true;
  }
  return found;
};

/**
 * Lógica de ordenación solicitada:
 * 1. Prioridad primero, 2. Alarmas, 3. Por hora
 */
const sortNotesLogic = (a, b) => {
  const priorityMap = { high: 0, medium: 1, low: 2 };
  const pA = priorityMap[a.priority] ?? 1;
  const pB = priorityMap[b.priority] ?? 1;

  if (pA !== pB) return pA - pB;

  // Misma prioridad: Comparar por fecha (más antiguas primero)
  if (a.date && b.date && a.date !== b.date)
    return a.date.localeCompare(b.date);
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;

  if (a.alarm !== b.alarm) return a.alarm ? -1 : 1;

  if (a.time && b.time) {
    if (a.time !== b.time) return a.time.localeCompare(b.time);
  } else if (a.time) return -1;
  else if (b.time) return 1;

  return 0;
};

export function renderView() {
  // Asegurar que el scroll vuelva al inicio al cambiar de pantalla
  const mainContent = document.querySelector(".main-content");
  if (mainContent) mainContent.scrollTop = 0;
  window.scrollTo(0, 0);

  if (state.currentView === "calendar") renderCalendar();
  else if (state.currentView === "dashboard") renderDashboard();
  else renderAllNotes();
}

export function updateUIStats() {
  const stats = getters.getStats();
  document.getElementById("stat-high").innerText = stats.high;
  document.getElementById("stat-medium").innerText = stats.medium;
  document.getElementById("stat-low").innerText = stats.low;

  document.getElementById("count-all").innerText = stats.all;
  const expiredBadge = document.getElementById("count-expired");
  if (expiredBadge) expiredBadge.innerText = stats.expired;
  document.getElementById("count-calendar").innerText = stats.withDate;
  document.getElementById("count-tags").innerText = stats.tags;
  document.getElementById("count-categories").innerText = stats.categories;
}

// --- Renderizadores Específicos ---
function renderDashboard() {
  const query = document.getElementById("global-search")?.value || "";
  const incTags = document.getElementById("search-tags")?.checked;
  const incCats = document.getElementById("search-categories")?.checked;
  const todayStr = dateUtils.getTodayStr();
  const tomorrowStr = dateUtils.getTomorrowStr();
  const todayTasks = state.notes
    .filter(
      (n) => n.date === todayStr && matchesSearch(n, query, incTags, incCats),
    )
    .sort(sortNotesLogic);
  const tomorrowTasks = state.notes
    .filter(
      (n) =>
        n.date === tomorrowStr && matchesSearch(n, query, incTags, incCats),
    )
    .sort(sortNotesLogic);

  // Generar la vista semanal para el Dashboard (usando la fecha actual)
  const focusDate = new Date();
  const originalSubView = state.calendarSubView;
  state.calendarSubView = "week"; // Forzamos subvista semanal temporalmente
  const weekGridHtml = renderCalendarGrid(focusDate, 5); // Limitamos a 5 recordatorios por día en Dashboard
  state.calendarSubView = originalSubView;

  // Filtrar notas sin fecha para el listado inferior
  const noDateTasksFull = state.notes
    .filter((n) => !n.date && matchesSearch(n, query, incTags, incCats))
    .sort(sortNotesLogic);
  const noDateTotal = noDateTasksFull.length;
  const noDateLimited = noDateTasksFull.slice(0, 6);
  const noDateCountDisplay = noDateTotal > 6 ? `Mostrando 6 de ${noDateTotal}` : `Mostrando ${noDateTotal}`;

  viewContainer.innerHTML = `
    <div class="view-container-padding">
        <h1 class="view-title">Panel de Control</h1>
        <p class="view-subtitle">Vista general</p>
        
        <div class="dashboard-grid">
            ${renderDashboardColumn("Recordatorios de Hoy", todayTasks, "fa-calendar-day", "var(--primary)", todayStr)}
            ${renderDashboardColumn("Recordatorios de Mañana", tomorrowTasks, "fa-calendar-plus", "var(--medium)", tomorrowStr)}
        </div>

        <div class="card dashboard-column planning-card">
            <div class="flex-between column-title">
                <h3 class="m-0">
                    Planificación Semanal <span class="title-count">(Mostrando primeras 5 por día)</span>
                </h3>
                <button class="btn-ghost btn-sm-border" onclick="window.seeFullWeek()" title="Ver semana completa">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
            <div class="calendar-grid week reset-grid">
                ${weekGridHtml}
            </div>
        </div>

        <div class="card dashboard-column mb-0">
            <div class="flex-between column-title">
                <h3 class="m-0">
                    Notas <span class="title-count">(${noDateCountDisplay})</span>
                </h3>
                <button class="btn-ghost btn-sm-border" onclick="window.seeAllNoDateNotes()" title="Ver todas las notas">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
            <div class="notes-grid-300">
                ${
                  noDateLimited.length > 0
                    ? noDateLimited
                        .map(
                          (t) => `
                    <div class="dashboard-note-item priority-${t.priority}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${t.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${t.id}" onclick="window.openNoteModal('${t.id}')" data-hint="Haz clic para editar o arrastra esta nota a un día del calendario">
                        <div class="flex-1 notes-stack-mini">
                            <span style="font-weight: 600;">${t.title}</span>
                            <div class="badge-row">
                                ${renderCategoryBadge(t.category)}
                                ${renderTagPills(t.tags)}
                            </div>
                        </div>
                        <span class="note-time">${t.time || "--:--"}</span>
                    </div>`,
                        )
                        .join("")
                    : '<p style="color: var(--text-muted); text-align: center; width: 100%;">No tienes notas sin fecha.</p>'
                }
            </div>
        </div>
    </div>`;
}

function renderDashboardColumn(title, tasks, icon, color, targetDate) {
  const todayStr = dateUtils.getTodayStr();
  const totalCount = tasks.length;
  const displayedTasks = tasks.slice(0, 3);
  const countDisplay = totalCount > 3 ? `Mostrando 3 de ${totalCount}` : `Mostrando ${totalCount}`;

  return `
    <div class="card dashboard-column drag-zone" data-drop-date="${targetDate}" ondragover="window.handleNoteDragOver(event)" ondragleave="window.handleNoteDragLeave(event)" ondrop="window.handleNoteDrop(event)">
        <div class="flex-between column-title">
            <h3 class="m-0">
                ${title} <span class="title-count">(${countDisplay})</span>
            </h3>
            <button class="btn-ghost btn-sm-border" onclick="window.selectDayView('${targetDate}')" title="Ver día en calendario">
                <i class="fas fa-eye"></i>
            </button>
        </div>
        <div class="notes-stack">
            ${
              displayedTasks.length > 0
                ? displayedTasks
                    .map((t) => {
                      const isPast = t.date && t.date < todayStr;
                      return `
                <div class="dashboard-note-item priority-${t.priority} ${isPast ? "expired" : ""}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${t.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${t.id}" onclick="window.openNoteModal('${t.id}')" data-hint="Haz clic para editar o arrastra este recordatorio a otro día">
                    <div class="flex-1 notes-stack-mini">
                        <span style="font-weight: 500;">${t.title}</span>
                        <div class="badge-row">
                            ${renderCategoryBadge(t.category)}
                            ${renderTagPills(t.tags)}
                        </div>
                    </div>
                    <span class="note-time">${t.time || "--:--"}</span>
                </div>`;
                    })
                    .join("")
                : '<p style="color: var(--text-muted); text-align: center;">Sin recordatorios.</p>'
            }
        </div>
    </div>`;
}

function renderCalendar() {
  const query = document.getElementById("global-search")?.value || "";
  const incTags = document.getElementById("search-tags")?.checked;
  const incCats = document.getElementById("search-categories")?.checked;

  const focusDate = new Date(
    state.currentYear,
    state.currentMonth,
    state.currentDay,
  );
  const todayStr = dateUtils.getTodayStr();
  const focusDateStr = dateUtils.formatYYYYMMDD(focusDate);
  const isPastDay = focusDateStr < todayStr;

  let title = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(focusDate);

  let dayTitle = focusDate.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const startOfWeek = new Date(focusDate);
  const day = focusDate.getDay();
  const diffToMonday = focusDate.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  let weekTitle = `${startOfWeek.getDate()} ${new Intl.DateTimeFormat("es-ES", { month: "short" }).format(startOfWeek)} - ${endOfWeek.getDate()} ${new Intl.DateTimeFormat("es-ES", { month: "short" }).format(endOfWeek)}`;

  let monthTitle = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(focusDate);

  // Calcular conteos para cada subvista
  const dayCount = state.notes.filter(n => n.date === focusDateStr && matchesSearch(n, query, incTags, incCats)).length;
  const weekCount = state.notes.filter(n => {
    if (!n.date) return false;
    const noteDate = new Date(n.date + 'T00:00:00');
    return noteDate >= startOfWeek && noteDate <= endOfWeek && matchesSearch(n, query, incTags, incCats);
  }).length;
  const monthCount = state.notes.filter(n => {
    if (!n.date) return false;
    const [y, m] = n.date.split("-").map(Number);
    return y === state.currentYear && (m - 1) === state.currentMonth && matchesSearch(n, query, incTags, incCats);
  }).length;

  // Asignar el título principal sin el contador
  if (state.calendarSubView === "week") {
    title = weekTitle;
  } else if (state.calendarSubView === "day") {
    title = dayTitle;
  } else { // month
    title = monthTitle;
  }

  viewContainer.innerHTML = `
    <div class="calendar-header">
        <div class="flex-center-gap-20">
            <h2 class="m-0 text-capitalize">${title}</h2>
            <div class="flex-gap-8">
                ${
                  state.calendarSubView === "day" && focusDateStr === todayStr
                    ? ""
                    : `<button class="btn-primary btn-sm" onclick="window.goToday()">Hoy</button>`
                }
                ${
                  state.calendarSubView === "day"
                    ? `
                    <button class="btn-primary btn-sm ${isPastDay ? "disabled-btn" : ""}"
                            ${isPastDay ? "disabled" : ""}
                            onclick="${isPastDay ? "" : `window.openNoteModal(null, '${dateUtils.formatYYYYMMDD(focusDate)}')`}">
                            Nuevo Recordatorio
                    </button>`
                    : ""
                }
            </div>
        </div>
        <div class="flex-center-gap-15">
            <div class="subview-selector">
                <button class="subview-btn ${state.calendarSubView === "day" ? "active" : ""}" onclick="window.setSubView('day')">Día ${state.calendarSubView === "day" ? `<span class="title-count">(${dayCount})</span>` : ''}</button>
                <button class="subview-btn ${state.calendarSubView === "week" ? "active" : ""}" onclick="window.setSubView('week')">Semana ${state.calendarSubView === "week" ? `<span class="title-count">(${weekCount})</span>` : ''}</button>
                <button class="subview-btn ${state.calendarSubView === "month" ? "active" : ""}" onclick="window.setSubView('month')">Mes ${state.calendarSubView === "month" ? `<span class="title-count">(${monthCount})</span>` : ''}</button>
            </div>
            <div class="flex-gap-5">
                <button class="btn-secondary btn-sm-nav" onclick="window.navigateCalendar(-1)"><i class="fas fa-chevron-left"></i></button>
                <button class="btn-secondary btn-sm-nav" onclick="window.navigateCalendar(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    </div>
    <div class="calendar-grid ${state.calendarSubView}">${renderCalendarGrid(focusDate)}</div>`;
}

function renderCalendarGrid(focusDate, limit = null) {
  let html = "";
  const todayStr = dateUtils.getTodayStr();

  if (state.calendarSubView === "month") {
    // Añadir nombres de los días
    const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    days.forEach(
      (d) =>
        (html += `<div class="day-header" style="text-align:center; padding: 10px; background: var(--bg-main)">${d}</div>`),
    );

    const firstDay = new Date(
      state.currentYear,
      state.currentMonth,
      1,
    ).getDay();
    const daysInMonth = new Date(
      state.currentYear,
      state.currentMonth + 1,
      0,
    ).getDate();

    // Ajuste para que la semana empiece en Lunes (JS: 0=Dom, 1=Lun...)
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++)
      html += `<div class="calendar-day empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = dateUtils.formatYYYYMMDD(
        new Date(state.currentYear, state.currentMonth, day),
      );
      html += renderDayCell(day, dateStr, dateStr === todayStr);
    }
  } else if (state.calendarSubView === "week") {
    const startOfWeek = new Date(focusDate);
    const day = focusDate.getDay();
    const diff = focusDate.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = dateUtils.formatYYYYMMDD(d);
      const label = `${new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(d)} ${d.getDate()}`;
      html += renderDayCell(label, dateStr, dateStr === todayStr, false, limit);
    }
  } else {
    const dateStr = dateUtils.formatYYYYMMDD(focusDate);
    const label = `${new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(focusDate)} ${focusDate.getDate()}`;
    html += renderDayCell(label, dateStr, dateStr === todayStr, true);
  }
  return html;
}

function renderDayCell(label, dateStr, isToday = false, isFull = false, limit = null, isWeekend = false) {
  const query = document.getElementById("global-search")?.value || "";
  const incTags = document.getElementById("search-tags")?.checked;
  const incCats = document.getElementById("search-categories")?.checked;
  const todayStr = dateUtils.getTodayStr();
  const dayNotes = state.notes
    .filter(
      (n) => n.date === dateStr && matchesSearch(n, query, incTags, incCats),
    )
    .sort(sortNotesLogic);
    
  const displayedNotes = limit ? dayNotes.slice(0, limit) : dayNotes;

  const notesHtml = displayedNotes
    .map((n) => {
      const isPast = n.date && n.date < todayStr;
      const expiredClass = isPast ? "expired" : "";

      if (isFull) {
        return `
        <div class="card note-card-full priority-${n.priority} ${expiredClass}" data-note-id="${n.id}" onclick="event.stopPropagation(); window.openNoteModal('${n.id}')" data-hint="Haz clic para editar">
            <div class="flex-1 note-content-stack">
                <div class="card-header-row">
                    <h3 class="m-0">${n.title}</h3>
                </div>
                <div class="badge-row">
                    ${renderCategoryBadge(n.category)}
                    ${renderTagPills(n.tags)}
                </div>
                <div class="meta-row">
                    ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                </div>
                <p class="note-desc">${n.description || "Sin descripción adicional."}</p>
            </div>
            <div class="card-actions-col">
                        <button onclick="event.stopPropagation(); window.deleteNote('${n.id}')" class="btn-icon-trash-outline" data-note-id="${n.id}" data-hint="Eliminar nota"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
      }

      // En móvil (responsive) y vista mes, permitimos que el click llegue al padre (calendar-day)
      // para navegar a la vista día, en lugar de abrir el modal, ya que las notas son "puntos".
      const clickHandler = state.calendarSubView === 'month' 
        ? `if(window.innerWidth > 768) { event.stopPropagation(); window.openNoteModal('${n.id}'); }`
        : `event.stopPropagation(); window.openNoteModal('${n.id}');`;

      return `<div class="note-pill priority-${n.priority} ${expiredClass}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${n.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${n.id}" onclick="${clickHandler}" data-hint="Haz clic para editar o arrastra este recordatorio a otro día">${n.title}</div>`;
    })
    .join("");

  const finalNotesHtml =
    isFull && dayNotes.length === 0
      ? `<div class="empty-state-placeholder">
        <i class="fas fa-calendar-day empty-state-icon"></i>
        No hay recordatorios para este día.
       </div>`
      : notesHtml;

  const cellClasses = [
    "calendar-day",
    "drag-zone",
    isToday ? "current-day" : "",
    isWeekend ? "weekend" : "",
    isFull ? "day-cell-full" : ""
  ].filter(Boolean).join(" ");

  const cellAttrs = !isFull 
    ? `onclick="window.selectDayView('${dateStr}')" style="cursor:pointer;" ${dayNotes.length > 0 ? 'data-day-hint="Haz clic para ver las notas de este día"' : ''}` 
    : "";

  return `
    <div class="${cellClasses}" 
         data-drop-date="${dateStr}"
         ondragover="window.handleNoteDragOver(event)" 
         ondragleave="window.handleNoteDragLeave(event)" 
         ondrop="window.handleNoteDrop(event)"
         ${cellAttrs} >
        <div class="day-num">${label}</div>
        <div class="day-notes notes-stack">
            ${finalNotesHtml}
        </div>
    </div>`;
}

function renderAllNotes(filtered = null) {
  const query = document.getElementById("global-search")?.value || "";
  const incTags = document.getElementById("search-tags")?.checked;
  const incCats = document.getElementById("search-categories")?.checked;
  const todayStr = dateUtils.getTodayStr();

  const filteredData = state.notes.filter((n) => {
    if (!matchesSearch(n, query, incTags, incCats)) return false;
    if (
      state.allNotesPriorityFilter &&
      n.priority !== state.allNotesPriorityFilter
    )
      return false;

    const isPast = n.date && n.date < todayStr;

    if (state.allNotesFilterAll) return true;
    if (state.allNotesFilterExpired) return isPast;
    if (state.allNotesFilterWithDate) return !!n.date && !isPast;
    if (state.allNotesFilterNoDate) return !n.date;

    return false;
  });

  const sortedData = [...filteredData].sort(sortNotesLogic);
  renderNoteList("Todas las Notas", sortedData);
}

function renderNoteList(title, data) {
  const stats = getters.getStats();
  const todayStr = dateUtils.getTodayStr();
  viewContainer.innerHTML = `
    <div class="view-container-padding">
        <div class="view-header-row">
            <h2>Notas y Recordatorios</h2>
            <div class="flex-center-gap-15">
                ${
                  state.currentView === "all-notes"
                    ? `
                ${
                  state.allNotesPriorityFilter
                    ? `
                <div class="priority-filter-tag">
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">Prioridad: ${priorityLabels[state.allNotesPriorityFilter]}</span>
                    <i class="fas fa-times" style="cursor: pointer; font-size: 0.8rem; color: var(--text-muted);" title="Quitar filtro" onclick="window.clearPriorityFilter()"></i>
                </div>
                `
                    : ""
                }
                <div class="filters-bar">
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterAll ? "checked" : ""} onchange="window.toggleAllNotesFilter('all', this.checked)"> 
                        <span>Todo (${stats.all_total})</span>
                    </label>
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterWithDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('withDate', this.checked)"> 
                        <span>Recordatorios (${stats.activeWithDate})</span>
                    </label>
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterNoDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('noDate', this.checked)"> 
                        <span>Notas (${stats.activeNoDate})</span>
                    </label>
                    <div class="flex-grow"></div>
                    <label class="filter-checkbox-group color-high">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterExpired ? "checked" : ""} onchange="window.toggleAllNotesFilter('expired', this.checked)"> 
                        <span>Caducadas (${stats.expired})</span>
                    </label>
                </div>`
                    : ""
                }
            </div>
        </div>
        <div class="notes-stack-grid">
            ${
              data.length === 0
                ? `<div class="empty-state-placeholder list-variant">
                    <i class="fas fa-clipboard-list empty-state-icon-lg"></i>
                    <p style="color: var(--text-muted);">No se encontraron resultados</p>
                 </div>`
                : data
                    .map((n) => {
                      const isPast = n.date && n.date < todayStr;
                      const expiredClass = isPast ? "expired" : "";
                      return `
                <div class="card note-card-full priority-${n.priority} bg-sidebar ${expiredClass}" data-note-id="${n.id}" onclick="window.openNoteModal('${n.id}')" data-hint="Haz clic para editar">
                    <div class="flex-1 note-content-stack">
                        <div class="card-header-row">
                            <h3 class="m-0">${n.title}</h3>
                        </div>
                        <div class="badge-row">
                            ${renderCategoryBadge(n.category)}
                            ${renderTagPills(n.tags)}
                        </div>
                        <div class="meta-row">
                            <span><i class="far fa-calendar-alt"></i> ${n.date ? dateUtils.formatDisplayDate(n.date) : n.time ? "Sin fecha (Recurrente)" : "Sin fecha"}</span>
                            ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                        </div>
                        <p class="note-desc">${n.description || "Sin descripción adicional."}</p>
                    </div>
                    <div class="card-actions-col">
                        <button onclick="event.stopPropagation(); window.deleteNote('${n.id}')" class="btn-icon-trash-fill" data-note-id="${n.id}" data-hint="Eliminar nota"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
                    })
                    .join("")
            }
        </div>
    </div>`;
}

// --- Exponer funciones a Window para compatibilidad con HTML strings ---
window.openNoteModal = openNoteModal;
window.closeToast = (el) => {
  const toast = el.closest(".toast");
  toast.remove();
  // Solo quitamos el efecto si no quedan más alarmas críticas en pantalla
  if (!document.querySelector(".toast.high")) {
    document.body.classList.remove("alarm-active");
  }
};
window.clearPriorityFilter = () => {
  state.allNotesPriorityFilter = null;
  state.allNotesFilterAll = true;
  state.allNotesFilterWithDate = false;
  state.allNotesFilterNoDate = false;
  state.allNotesFilterExpired = false;
  renderView();
};
window.toggleAllNotesFilter = (type, val) => {
  state.allNotesFilterAll = type === "all";
  state.allNotesFilterWithDate = type === "withDate";
  state.allNotesFilterNoDate = type === "noDate";
  state.allNotesFilterExpired = type === "expired";
  renderView();
};
window.seeAllNoDateNotes = () => {
  state.currentView = "all-notes";
  state.allNotesFilterAll = false;
  state.allNotesFilterNoDate = true;
  state.allNotesFilterWithDate = false;
  state.allNotesFilterExpired = false;
  state.allNotesPriorityFilter = null;
  // Actualizar visualmente la navegación del sidebar
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));
  const allNotesBtn = document.querySelector('[data-view="all-notes"]');
  if (allNotesBtn) allNotesBtn.classList.add("active");
  renderView();
};
window.seeFullWeek = () => {
  state.currentView = "calendar";
  state.calendarSubView = "week";
  // Actualizar visualmente la navegación del sidebar
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));
  const calendarBtn = document.querySelector('[data-view="calendar"]');
  if (calendarBtn) calendarBtn.classList.add("active");
  renderView();
};
window.goToday = () => {
  const now = new Date();
  mutations.updateCalendarState(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  state.calendarSubView = "day";
  renderView();
};
window.setSubView = (v) => {
  const now = new Date();
  mutations.updateCalendarState(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  state.calendarSubView = v;
  renderView();
};
window.selectDayView = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  mutations.updateCalendarState(y, m - 1, day);
  state.calendarSubView = "day";
  state.currentView = "calendar";

  // Actualizar visualmente la navegación del sidebar para reflejar que estamos en Calendario
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));
  const calendarBtn = document.querySelector('[data-view="calendar"]');
  if (calendarBtn) calendarBtn.classList.add("active");

  renderView();
};
window.deleteNote = (id) => {
  showConfirmModal(
    "¿Estás seguro de que deseas eliminar esta nota permanentemente?",
    () => {
      mutations.deleteNote(id);
      updateUIStats();
      renderView();
      showToast("Nota eliminada correctamente", "info");
      document.getElementById("note-modal").style.display = "none";
    },
  );
};
window.navigateCalendar = (diff) => {
  const date = new Date(
    state.currentYear,
    state.currentMonth,
    state.currentDay,
  );
  if (state.calendarSubView === "month") {
    date.setMonth(date.getMonth() + diff);
    date.setDate(1);
  } else if (state.calendarSubView === "week") {
    date.setDate(date.getDate() + diff * 7);
  } else {
    date.setDate(date.getDate() + diff);
  }
  mutations.updateCalendarState(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  renderView();
};

window.snoozeNote = (id) => {
  const note = getters.getNoteById(id);
  if (note) {
    const date = new Date();
    if (note.date) {
      const [year, month, day] = note.date.split("-").map(Number);
      date.setFullYear(year, month - 1, day);
    }

    const [hours, minutes] = note.time.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);

    // Añadir 5 minutos
    date.setMinutes(date.getMinutes() + 5);

    if (note.date) {
      note.date = dateUtils.formatYYYYMMDD(date);
    }
    note.time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    note.alarm = true; // Reactivar la alarma para la nueva hora
    note.lastAlarmKey = null; // Resetear rastreo para que pueda sonar de nuevo
    note.lastPreAlarmKey = null;

    mutations.saveNotes();
    const toast = document.getElementById(`toast-${id}`);
    if (toast) {
      toast.remove();
      if (!document.querySelector(".toast.high")) {
        document.body.classList.remove("alarm-active");
      }
    }
    renderView();
    showToast("Alarma pospuesta 5 minutos", "info");
  }
};

// --- Listener para búsqueda ---
window.addEventListener("search-notes", () => {
  renderView();
});

window.handleNoteDragStart = (e, id) => {
  const note = getters.getNoteById(id);
  e.dataTransfer.setData("text/plain", id);
  e.dataTransfer.effectAllowed = "move";

  // Crear un icono fantasma dinámico para el puntero
  const dragIcon = document.createElement('div');
  const isReminder = !!(note && note.date);
  const iconClass = isReminder ? 'fa-calendar-check' : 'fa-sticky-note';
  
  dragIcon.innerHTML = `<i class="fas ${iconClass}" style="color: white; background: #2563eb; padding: 8px; border-radius: 6px; font-size: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></i>`;
  dragIcon.style.position = 'absolute';
  dragIcon.style.top = '-1000px';
  document.body.appendChild(dragIcon);
  
  e.dataTransfer.setDragImage(dragIcon, 20, 20);
  setTimeout(() => document.body.removeChild(dragIcon), 0);
};

window.handleNoteDragEnd = (e) => {
  document.querySelectorAll(".drag-zone").forEach((zone) => {
    zone.classList.remove("zone-valid", "zone-invalid", "drag-over");
  });
};

window.handleNoteDragOver = (e) => {
  e.preventDefault();
  const zone = e.currentTarget;
  const todayStr = dateUtils.getTodayStr();
  const targetDate = zone.dataset.dropDate;
  const isValid = !targetDate || targetDate >= todayStr;

  zone.classList.add("drag-over");
  zone.classList.add(isValid ? "zone-valid" : "zone-invalid");
  e.dataTransfer.dropEffect = isValid ? "move" : "none";
};

window.handleNoteDragLeave = (e) => {
  e.currentTarget.classList.remove("drag-over", "zone-valid", "zone-invalid");
};

window.handleNoteDrop = (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over", "zone-valid", "zone-invalid");
  const id = e.dataTransfer.getData("text/plain");
  const targetDate = e.currentTarget.dataset.dropDate; // "" para notas, "YYYY-MM-DD" para calendario
  const todayStr = dateUtils.getTodayStr();
  
  const note = getters.getNoteById(id);
  if (!note || note.date === targetDate) return;

  // Validación: No permitir mover recordatorios a fechas pasadas
  if (targetDate && targetDate < todayStr) {
    showToast("No puedes programar recordatorios en fechas pasadas", "error");
    return;
  }

  // Validación de hora al soltar en el día de hoy (solo si tiene hora definida)
  if (targetDate && targetDate === todayStr && note.time) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (note.time.slice(0, 5) < currentTime) {
          showToast("No puedes mover un recordatorio con hora pasada al día de hoy", "error");
          return;
      }
  }

  const wasNote = !note.date;
  const isNowNote = !targetDate;

  const updatedNote = { ...note, date: targetDate };
  
  // Si vuelve a ser una nota simple, limpiamos metadatos de recordatorio
  if (isNowNote) {
    updatedNote.time = "";
    updatedNote.alarm = false;
  }

  mutations.updateNote(id, updatedNote);
  renderView();
  updateUIStats();

  // Feedback dinámico según la conversión
  let msg = `Movido al ${dateUtils.formatDisplayDate(targetDate)}`;
  if (wasNote && !isNowNote) msg = `Convertido en Recordatorio para el ${dateUtils.formatDisplayDate(targetDate)}`;
  else if (!wasNote && isNowNote) msg = "Convertido en Nota (Sin fecha)";
  
  showToast(msg, "info");
};
