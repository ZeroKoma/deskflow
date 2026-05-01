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
  const weekGridHtml = renderCalendarGrid(focusDate);
  state.calendarSubView = originalSubView;

  // Filtrar notas sin fecha para el listado inferior
  const noDateTasksFull = state.notes
    .filter((n) => !n.date && matchesSearch(n, query, incTags, incCats))
    .sort(sortNotesLogic);
  const noDateTotal = noDateTasksFull.length;
  const noDateLimited = noDateTasksFull.slice(0, 5);

  viewContainer.innerHTML = `
    <div style="padding: 2rem;">
        <h1 style="margin-bottom: 0.5rem;">Panel de Control</h1>
        <p style="color: var(--text-muted); margin-bottom: 2rem;">Vista general</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
            ${renderDashboardColumn("Recordatorios de Hoy", todayTasks, "fa-calendar-day", "var(--primary)", todayStr)}
            ${renderDashboardColumn("Recordatorios de Mañana", tomorrowTasks, "fa-calendar-plus", "var(--medium)", tomorrowStr)}
        </div>

        <div class="card" style="background: var(--bg-sidebar); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 3rem; display: block; cursor: default;">
            <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem; margin-top: 0;">
                <i class="fas fa-calendar-week" style="color: var(--primary)"></i> Planificación Semanal
            </h3>
            <div class="calendar-grid week" style="margin: 0; background: var(--border);">
                ${weekGridHtml}
            </div>
        </div>

        <div class="card" style="background: var(--bg-sidebar); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); display: block; cursor: default;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="display: flex; align-items: center; gap: 10px; margin: 0;">
                    <i class="fas fa-sticky-note" style="color: var(--primary)"></i> Notas (${noDateTotal})
                </h3>
                <button class="btn-ghost" onclick="window.seeAllNoDateNotes()" style="font-size: 0.85rem; padding: 6px 12px; border: 1px solid var(--border);">
                    Ver todas <i class="fas fa-arrow-right" style="margin-left: 5px;"></i>
                </button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                ${
                  noDateLimited.length > 0
                    ? noDateLimited
                        .map(
                          (t) => `
                    <div class="dashboard-note-item" draggable="true" ondragstart="window.handleNoteDragStart(event, '${t.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${t.id}" style="padding: 12px; background: var(--bg-main); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.openNoteModal('${t.id}')" data-hint="Haz clic para editar o arrastra esta nota a un día del calendario">
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                            <span style="font-weight: 600;">${t.title}</span>
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                ${renderCategoryBadge(t.category)}
                                ${renderTagPills(t.tags)}
                            </div>
                        </div>
                        <span class="note-pill priority-${t.priority}">${t.time || "--:--"}</span>
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
  return `
    <div class="card drag-zone" data-drop-date="${targetDate}" ondragover="window.handleNoteDragOver(event)" ondragleave="window.handleNoteDragLeave(event)" ondrop="window.handleNoteDrop(event)"
         style="background: var(--bg-sidebar); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); display: block; cursor: default;">
        <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem;">
            <i class="fas ${icon}" style="color: ${color}"></i> ${title}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${
              tasks.length > 0
                ? tasks
                    .map((t) => {
                      const isPast = t.date && t.date < todayStr;
                      return `
                <div class="dashboard-note-item ${isPast ? "expired" : ""}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${t.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${t.id}" style="padding: 12px; background: var(--bg-main); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.openNoteModal('${t.id}')" data-hint="Haz clic para editar o arrastra este recordatorio a otro día">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                        <span style="font-weight: 500;">${t.title}</span>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            ${renderCategoryBadge(t.category)}
                            ${renderTagPills(t.tags)}
                        </div>
                    </div>
                    <span class="note-pill priority-${t.priority}">${t.time || "--:--"}</span>
                </div>`;
                    })
                    .join("")
                : '<p style="color: var(--text-muted); text-align: center;">Sin recordatorios.</p>'
            }
        </div>
    </div>`;
}

function renderCalendar() {
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

  if (state.calendarSubView === "week") {
    const start = new Date(focusDate);
    const day = focusDate.getDay();
    const diff = focusDate.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    title = `${start.getDate()} ${new Intl.DateTimeFormat("es-ES", { month: "short" }).format(start)} - ${end.getDate()} ${new Intl.DateTimeFormat("es-ES", { month: "short" }).format(end)}`;
  } else if (state.calendarSubView === "day")
    title = focusDate.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  viewContainer.innerHTML = `
    <div class="calendar-header" style="padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; background: var(--bg-sidebar); border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; gap: 20px;">
            <h2 style="margin:0; text-transform: capitalize;">${title}</h2>
            <div style="display: flex; gap: 8px;">
                ${
                  state.calendarSubView === "day" && focusDateStr === todayStr
                    ? ""
                    : `<button class="btn-primary" style="padding: 5px 15px;" onclick="window.goToday()">Hoy</button>`
                }
                ${
                  state.calendarSubView === "day"
                    ? `
                    <button class="btn-primary ${isPastDay ? "disabled-btn" : ""}" style="padding: 5px 15px; font-size: 0.8rem;"
                            ${isPastDay ? "disabled" : ""}
                            onclick="${isPastDay ? "" : `window.openNoteModal(null, '${dateUtils.formatYYYYMMDD(focusDate)}')`}">
                            Nuevo Recordatorio
                    </button>`
                    : ""
                }
            </div>
        </div>
        <div style="display: flex; gap: 15px; align-items: center;">
            <div class="subview-selector">
                <button class="subview-btn ${state.calendarSubView === "day" ? "active" : ""}" onclick="window.setSubView('day')">Día</button>
                <button class="subview-btn ${state.calendarSubView === "week" ? "active" : ""}" onclick="window.setSubView('week')">Semana</button>
                <button class="subview-btn ${state.calendarSubView === "month" ? "active" : ""}" onclick="window.setSubView('month')">Mes</button>
            </div>
            <div style="display:flex; gap: 5px;">
                <button class="btn-secondary" style="padding: 5px 12px;" onclick="window.navigateCalendar(-1)"><i class="fas fa-chevron-left"></i></button>
                <button class="btn-secondary" style="padding: 5px 12px;" onclick="window.navigateCalendar(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    </div>
    <div class="calendar-grid ${state.calendarSubView}">${renderCalendarGrid(focusDate)}</div>`;
}

function renderCalendarGrid(focusDate) {
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
      html += renderDayCell(label, dateStr, dateStr === todayStr);
    }
  } else {
    const dateStr = dateUtils.formatYYYYMMDD(focusDate);
    const label = `${new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(focusDate)} ${focusDate.getDate()}`;
    html += renderDayCell(label, dateStr, dateStr === todayStr, true);
  }
  return html;
}

function renderDayCell(label, dateStr, isToday = false, isFull = false) {
  const query = document.getElementById("global-search")?.value || "";
  const incTags = document.getElementById("search-tags")?.checked;
  const incCats = document.getElementById("search-categories")?.checked;
  const todayStr = dateUtils.getTodayStr();
  const dayNotes = state.notes
    .filter(
      (n) => n.date === dateStr && matchesSearch(n, query, incTags, incCats),
    )
    .sort(sortNotesLogic);

  const notesHtml = dayNotes
    .map((n) => {
      const isPast = n.date && n.date < todayStr;
      const expiredClass = isPast ? "expired" : "";

      if (isFull) {
        return `
        <div class="card ${expiredClass}" data-note-id="${n.id}" style="background: var(--bg-main); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 1.5rem; cursor: pointer; display: flex; justify-content: space-between; align-items: flex-start; box-shadow: var(--shadow); transition: transform 0.2s ease;" onclick="event.stopPropagation(); window.openNoteModal('${n.id}')" data-hint="Haz clic para editar">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <span class="note-pill priority-${n.priority}" style="margin:0">${(priorityLabels[n.priority] || n.priority).toUpperCase()}</span>
                    <h3 style="margin: 0;">${n.title}</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                    ${renderCategoryBadge(n.category)}
                    ${renderTagPills(n.tags)}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">
                    ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                </div>
                <p style="color: var(--text-main); line-height: 1.5; margin: 0; font-size: 0.95rem; white-space: pre-wrap;">${n.description || "Sin descripción adicional."}</p>
            </div>
            <div style="display: flex; gap: 8px; margin-left: 20px;">
                        <button onclick="event.stopPropagation(); window.deleteNote('${n.id}')" style="background: none; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; color: var(--high); padding: 8px 12px; transition: all 0.2s;"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
      }
      return `<div class="note-pill priority-${n.priority} ${expiredClass}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${n.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${n.id}" onclick="event.stopPropagation(); window.openNoteModal('${n.id}')" data-hint="Haz clic para editar o arrastra este recordatorio a otro día">${n.title}</div>`;
    })
    .join("");

  const finalNotesHtml =
    isFull && dayNotes.length === 0
      ? `<div style="text-align: center; padding: 3rem; color: var(--text-muted); border: 2px dashed var(--border); border-radius: var(--radius);">
        <i class="fas fa-calendar-day" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
        No hay recordatorios para este día.
       </div>`
      : notesHtml;

  return `
    <div class="calendar-day drag-zone ${isToday ? "current-day" : ""}" 
         data-drop-date="${dateStr}"
         ondragover="window.handleNoteDragOver(event)" 
         ondragleave="window.handleNoteDragLeave(event)" 
         ondrop="window.handleNoteDrop(event)"
         ${!isFull ? `onclick="window.selectDayView('${dateStr}')" style="cursor:pointer;" ${dayNotes.length > 0 ? 'data-day-hint="Haz clic para ver las notas de este día"' : ''}` : `style="padding: 2rem; min-height: 400px;"`} >
        <div class="day-num">${label}</div>
        <div class="day-notes">
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
    <div style="padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>Notas y Recordatorios</h2>
            <div style="display: flex; align-items: center; gap: 15px;">
                ${
                  state.currentView === "all-notes"
                    ? `
                ${
                  state.allNotesPriorityFilter
                    ? `
                <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-main); padding: 8px 15px; border-radius: 20px; border: 1px solid var(--primary);">
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">Prioridad: ${priorityLabels[state.allNotesPriorityFilter]}</span>
                    <i class="fas fa-times" style="cursor: pointer; font-size: 0.8rem; color: var(--text-muted);" title="Quitar filtro" onclick="window.clearPriorityFilter()"></i>
                </div>
                `
                    : ""
                }
                <div style="display: flex; align-items: center; gap: 15px; background: var(--bg-main); padding: 8px 15px; border-radius: 20px; border: 1px solid var(--border); flex: 1; min-width: 600px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer;">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterAll ? "checked" : ""} onchange="window.toggleAllNotesFilter('all', this.checked)"> 
                        <span>Todo (${stats.all_total})</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer;">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterWithDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('withDate', this.checked)"> 
                        <span>Recordatorios (${stats.activeWithDate})</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer;">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterNoDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('noDate', this.checked)"> 
                        <span>Notas (${stats.activeNoDate})</span>
                    </label>
                    <div style="flex-grow: 1;"></div>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--high); cursor: pointer;">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterExpired ? "checked" : ""} onchange="window.toggleAllNotesFilter('expired', this.checked)"> 
                        <span>Caducadas (${stats.expired})</span>
                    </label>
                </div>`
                    : ""
                }
            </div>
        </div>
        <div style="display: grid; gap: 1.5rem;">
            ${
              data.length === 0
                ? `<div style="text-align: center; padding: 4rem; background: var(--bg-sidebar); border-radius: var(--radius); border: 2px dashed var(--border);">
                    <i class="fas fa-clipboard-list" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem; display: block;"></i>
                    <p style="color: var(--text-muted);">No se encontraron resultados</p>
                 </div>`
                : data
                    .map((n) => {
                      const isPast = n.date && n.date < todayStr;
                      const expiredClass = isPast ? "expired" : "";
                      return `
                <div class="card ${expiredClass}" data-note-id="${n.id}" style="background: var(--bg-sidebar); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; box-shadow: var(--shadow); cursor: pointer; transition: transform 0.2s ease;" onclick="window.openNoteModal('${n.id}')" data-hint="Haz clic para editar">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <span class="note-pill priority-${n.priority}">${(priorityLabels[n.priority] || n.priority).toUpperCase()}</span>
                            <h3 style="margin: 0;">${n.title}</h3>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                            ${renderCategoryBadge(n.category)}
                            ${renderTagPills(n.tags)}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">
                            <span><i class="far fa-calendar-alt"></i> ${n.date ? dateUtils.formatDisplayDate(n.date) : n.time ? "Sin fecha (Recurrente)" : "Sin fecha"}</span>
                            ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                        </div>
                        <p style="color: var(--text-main); line-height: 1.5; margin: 0; font-size: 0.95rem; white-space: pre-wrap;">${n.description || "Sin descripción adicional."}</p>
                    </div>
                    <div style="display: flex; gap: 8px; margin-left: 20px;">
                        <button onclick="event.stopPropagation(); window.deleteNote('${n.id}')" style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; color: var(--high); padding: 8px 12px; transition: all 0.2s;"><i class="fas fa-trash"></i></button>
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
