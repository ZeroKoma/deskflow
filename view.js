import { state, mutations, getters } from "./store.js";
import { dateUtils } from "./utils.js";

const viewContainer = document.getElementById("view-container");
const noteModal = document.getElementById("note-modal");
const noteForm = document.getElementById("note-form");

/**
 * Mapeo de traducciones para la interfaz
 */
const priorityLabels = { high: "Alta", medium: "Media", low: "Baja" };

const getCategoryInfo = (id) => {
  const cat = state.categories.find(c => c.id === id);
  if (cat) return cat;
  // Fallback para datos antiguos o borrados
  return { name: id || 'Otros', color: 'var(--text-muted)' };
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
  if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
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
  else if (state.currentView === "no-date-notes") renderNoDateNotes();
  else renderAllNotes();
}

export function updateUIStats() {
  const stats = getters.getStats();
  document.getElementById("stat-pending").innerText = stats.pending;
  document.getElementById("stat-urgent").innerText = stats.urgent;

  document.getElementById("count-all").innerText = stats.all;
  document.getElementById("count-no-date").innerText = stats.noDate;
  document.getElementById("count-calendar").innerText = stats.withDate;
  document.getElementById("count-tags").innerText = stats.tags;
  document.getElementById("count-categories").innerText = stats.categories;
}

export function openNoteModal(id = null, defaultDate = null) {
  const title = document.getElementById("modal-title");
  noteModal.style.display = "flex";
  const timeInput = document.getElementById("time");
  const alarmInput = document.getElementById("alarm");
  const deleteBtn = document.getElementById("delete-note-modal");

  // Poblar select de categorías dinámicamente
  const categorySelect = document.getElementById("category");
  categorySelect.innerHTML = state.categories.map(c => 
    `<option value="${c.id}">${c.name}</option>`).join('');

  if (id) {
    const note = getters.getNoteById(id);
    title.innerText = "Editar Nota";
    document.getElementById("note-id").value = note.id;
    document.getElementById("title").value = note.title;
    document.getElementById("date").value = note.date;
    document.getElementById("time").value = note.time;
    document.getElementById("priority").value = note.priority;
    document.getElementById("category").value = note.category;
    document.getElementById("description").value = note.description;
    document.getElementById("alarm").checked = note.alarm;

    // Renderizar selección de tags
    renderTagSelection(note.tags || []);

    alarmInput.disabled = !note.time;
    deleteBtn.style.display = "inline-flex";
    deleteBtn.onclick = () => window.deleteNote(id);
  } else {
    title.innerText = "Nueva Nota";
    noteForm.reset();
    document.getElementById("note-id").value = "";
    if (defaultDate) document.getElementById("date").value = defaultDate;
    renderTagSelection([]);
    alarmInput.disabled = true;
    deleteBtn.style.display = "none";
  }
}

function renderTagSelection(selectedIds) {
  const container = document.getElementById("tag-selection-container");
  container.innerHTML = state.tags
    .map(
      (tag) => `
    <div class="tag-chip ${selectedIds.includes(tag.id) ? "selected" : "inactive"}"
         style="background: ${tag.color}22; color: ${tag.color}; border-color: ${tag.color}">
      <input type="checkbox" name="note-tags" value="${tag.id}" ${selectedIds.includes(tag.id) ? "checked" : ""} style="display:none">
      ${tag.name}
    </div>
  `,
    )
    .join("");

  container.querySelectorAll(".tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const cb = chip.querySelector("input");
      cb.checked = !cb.checked;
      chip.classList.toggle("selected");
      chip.classList.toggle("inactive");
    });
  });
}

export function renderTagManager() {
  const container = document.getElementById("tags-list-container");
  container.innerHTML = state.tags
    .map(
      (tag) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 15px; height: 15px; border-radius: 50%; background: ${tag.color}"></div>
        <span>${tag.name}</span>
      </div>
      <div style="display: flex; gap: 10px;">
        <button onclick="window.editTag('${tag.id}')" style="color: var(--primary); background:none; border:none; cursor:pointer;"><i class="fas fa-pencil-alt"></i></button>
        <button onclick="window.deleteTag('${tag.id}')" style="color: var(--high); background:none; border:none; cursor:pointer;"><i class="fas fa-times"></i></button>
      </div>
    </div>
  `,
    )
    .join("");
}

export function renderCategoryManager() {
  const container = document.getElementById("categories-list-container");
  container.innerHTML = state.categories
    .map(
      (cat) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 15px; height: 15px; border-radius: 50%; background: ${cat.color}"></div>
        <span>${cat.name}</span>
      </div>
      <div style="display: flex; gap: 10px;">
        <button onclick="window.editCategory('${cat.id}')" style="color: var(--primary); background:none; border:none; cursor:pointer;"><i class="fas fa-pencil-alt"></i></button>
        <button onclick="window.deleteCategory('${cat.id}')" style="color: var(--high); background:none; border:none; cursor:pointer;"><i class="fas fa-times"></i></button>
      </div>
    </div>`,
    )
    .join("");
}

export function showToast(msg, type = "info", noteId = null) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  if (noteId) toast.id = `toast-${noteId}`;
  const icon = type === "high" ? "fa-exclamation-triangle" : "fa-info-circle";

  const snoozeBtn =
    type === "high" && noteId
      ? `<button class="btn-primary" onclick="window.snoozeNote('${noteId}')" style="margin-top: 15px; background: var(--high); color: white; width: 100%; border: 1px solid rgba(255,255,255,0.3);">
         <i class="fas fa-clock"></i> Posponer 5 min
       </button>`
      : "";

  toast.innerHTML = `
    <div style="display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
            <span><i class="fas ${icon}"></i> ${msg}</span>
            <i class="fas fa-times" style="cursor: pointer; opacity: 0.7;" onclick="window.closeToast(this)"></i>
        </div>
        ${snoozeBtn}
    </div>
  `;
  if (type === "high") {
    document.body.classList.add("alarm-active");
  }
  container.appendChild(toast);

  // Las alarmas (high) y los avisos previos (Aviso previo) son permanentes hasta cierre manual
  const isPermanent = type === "high" || msg.includes("Aviso previo");
  
  if (!isPermanent) setTimeout(() => toast.remove(), 4000);
}

export function showConfirmModal(message, onConfirm) {
  const confirmModal = document.getElementById("confirm-modal");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  msgEl.innerText = message;
  confirmModal.style.display = "flex";

  const cleanup = () => {
    confirmModal.style.display = "none";
    okBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  okBtn.onclick = () => {
    onConfirm();
    cleanup();
  };

  cancelBtn.onclick = cleanup;
}

// --- Renderizadores Específicos ---
function renderDashboard() {
  const todayStr = dateUtils.getTodayStr();
  const tomorrowStr = dateUtils.getTomorrowStr();
  const todayTasks = state.notes
    .filter((n) => n.date === todayStr)
    .sort(sortNotesLogic);
  const tomorrowTasks = state.notes
    .filter((n) => n.date === tomorrowStr)
    .sort(sortNotesLogic);
  const noDateTasks = state.notes
    .filter((n) => !n.date)
    .sort(sortNotesLogic);

  viewContainer.innerHTML = `
    <div style="padding: 2rem;">
        <h1 style="margin-bottom: 0.5rem;">Panel de Control</h1>
        <p style="color: var(--text-muted); margin-bottom: 2rem;">Vista general</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
            ${renderDashboardColumn("Notas de Hoy", todayTasks, "fa-calendar-day", "var(--primary)")}
            ${renderDashboardColumn("Mañana", tomorrowTasks, "fa-calendar-plus", "var(--medium)")}
        </div>
        <div style="margin-top: 2rem;">
            ${renderDashboardColumn("Notas sin fecha", noDateTasks, "fa-inbox", "var(--text-muted)")}
        </div>
    </div>`;
}

function renderDashboardColumn(title, tasks, icon, color) {
  return `
    <div class="card" style="background: var(--bg-sidebar); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border);">
        <h3 style="display: flex; align-items: center; gap: 10px; margin-bottom: 1.5rem;">
            <i class="fas ${icon}" style="color: ${color}"></i> ${title}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${
              tasks.length > 0
                ? tasks
                    .map(
                      (t) => `
                <div class="dashboard-note-item" data-note-id="${t.id}" style="padding: 12px; background: var(--bg-main); border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.openNoteModal('${t.id}')">
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                        <span style="font-weight: 500;">${t.title}</span>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            ${renderTagPills(t.tags)}
                            <span style="font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-folder" style="color: ${getCategoryInfo(t.category).color}; font-size: 0.6rem;"></i> 
                                ${getCategoryInfo(t.category).name}
                            </span>
                        </div>
                    </div>
                    <span class="note-pill priority-${t.priority}">${t.time || "--:--"}</span>
                </div>`,
                    )
                    .join("")
                : '<p style="color: var(--text-muted); text-align: center;">Sin notas.</p>'
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
                <button class="btn-primary" style="padding: 5px 15px;" onclick="window.goToday()">Hoy</button>
                ${state.calendarSubView === "day" ? `<button class="btn-primary" style="padding: 5px 15px; font-size: 0.8rem;" onclick="window.openNoteModal(null, '${dateUtils.formatYYYYMMDD(focusDate)}')"><i class="fas fa-plus"></i> Nueva Nota</button>` : ""}
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
  const dayNotes = state.notes
    .filter((n) => n.date === dateStr)
    .sort(sortNotesLogic);

  const notesHtml = dayNotes
    .map((n) => {
      if (isFull) {
        return `
        <div class="card" data-note-id="${n.id}" style="background: var(--bg-main); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 1.5rem; cursor: pointer; display: flex; justify-content: space-between; align-items: flex-start; box-shadow: var(--shadow); transition: transform 0.2s ease;" onclick="event.stopPropagation(); window.openNoteModal('${n.id}')">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <span class="note-pill priority-${n.priority}" style="margin:0">${(priorityLabels[n.priority] || n.priority).toUpperCase()}</span>
                    <h3 style="margin: 0;">${n.title}</h3>
                </div>
                <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                    ${renderTagPills(n.tags)}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">
                    ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                    <span><i class="fas fa-tag" style="color: ${getCategoryInfo(n.category).color}"></i> ${getCategoryInfo(n.category).name}</span>
                    ${n.alarm ? `<span style="color: var(--primary)"><i class="fas fa-bell"></i> Alarma</span>` : ""}
                </div>
                <p style="color: var(--text-main); line-height: 1.5; margin: 0; font-size: 0.95rem;">${n.description || "Sin descripción adicional."}</p>
            </div>
            <div style="display: flex; gap: 8px; margin-left: 20px;">
                <button class="btn-ghost" onclick="event.stopPropagation(); window.deleteNote('${n.id}')" style="color: var(--high); padding: 8px;"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
      }
      return `<div class="note-pill priority-${n.priority}" data-note-id="${n.id}" onclick="event.stopPropagation(); window.openNoteModal('${n.id}')">${n.title}</div>`;
    })
    .join("");

  const finalNotesHtml =
    isFull && dayNotes.length === 0
      ? `<div style="text-align: center; padding: 3rem; color: var(--text-muted); border: 2px dashed var(--border); border-radius: var(--radius);">
        <i class="fas fa-calendar-day" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
        No hay notas programadas para este día.
       </div>`
      : notesHtml;

  return `
    <div class="calendar-day ${isToday ? "current-day" : ""}" 
         ${!isFull ? `onclick="window.selectDayView('${dateStr}')" style="cursor:pointer;"` : `style="padding: 2rem; min-height: 400px;"`} >
        <div class="day-num">${label}</div>
        <div class="day-notes">
            ${finalNotesHtml}
        </div>
    </div>`;
}

function renderNoDateNotes() {
  const query = document.getElementById("global-search")?.value.toLowerCase() || "";
  const noDateNotes = state.notes
    .filter((n) => {
      if (!!n.date) return false;

      const inTitle = n.title.toLowerCase().includes(query);
      const tagNames = (n.tags || []).map(
        (id) => state.tags.find((t) => t.id === id)?.name.toLowerCase() || "",
      );
      const inTags = tagNames.some((name) => name.includes(query));
      const categoryName = getCategoryInfo(n.category).name.toLowerCase();
      const inCategory = categoryName.includes(query);

      return inTitle || inTags || inCategory;
    })
    .sort(sortNotesLogic);
  renderNoteList("Notas sin fecha", noDateNotes);
}

function renderTagPills(tagIds = []) {
  if (!tagIds) return "";
  return tagIds
    .map((id) => {
      const tag = state.tags.find((t) => t.id === id);
      if (!tag) return "";
      return `<span style="font-size: 0.65rem; padding: 1px 6px; border-radius: 10px; background: ${tag.color}22; color: ${tag.color}; border: 1px solid ${tag.color}">${tag.name}</span>`;
    })
    .join("");
}

function renderAllNotes(filtered = null) {
  const baseData = filtered || state.notes;
  const filteredData = baseData.filter((n) => {
    if (state.allNotesFilterWithDate && !!n.date) return true;
    if (state.allNotesFilterNoDate && !n.date) return true;
    return false;
  });

  const sortedData = [...filteredData].sort(sortNotesLogic);
  renderNoteList("Todas las Notas", sortedData);
}

function renderNoteList(title, data) {
  viewContainer.innerHTML = `
    <div style="padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2>${title}</h2>
            <div style="display: flex; align-items: center; gap: 15px;">
                ${state.currentView === 'all-notes' ? `
                <div style="display: flex; align-items: center; gap: 15px; background: var(--bg-main); padding: 8px 15px; border-radius: 20px; border: 1px solid var(--border);">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer;">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterWithDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('withDate', this.checked)"> 
                        <span>Con fecha</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer;">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterNoDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('noDate', this.checked)"> 
                        <span>Sin fecha</span>
                    </label>
                </div>` : ''}
                <span style="color: var(--text-muted); font-weight: 500; min-width: 100px; text-align: right;">${data.length} registros</span>
            </div>
        </div>
        <div style="display: grid; gap: 1.5rem;">
            ${
              data.length === 0
                ? `<div style="text-align: center; padding: 4rem; background: var(--bg-sidebar); border-radius: var(--radius); border: 2px dashed var(--border);">
                    <i class="fas fa-clipboard-list" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem; display: block;"></i>
                    <p style="color: var(--text-muted);">No se encontraron notas</p>
                 </div>`
                : data
                    .map(
                      (n) => `
                <div class="card" data-note-id="${n.id}" style="background: var(--bg-sidebar); padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; box-shadow: var(--shadow); cursor: pointer; transition: transform 0.2s ease;" onclick="window.openNoteModal('${n.id}')">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <span class="note-pill priority-${n.priority}">${(priorityLabels[n.priority] || n.priority).toUpperCase()}</span>
                            <h3 style="margin: 0;">${n.title}</h3>
                        </div>
                        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                            ${renderTagPills(n.tags)}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">
                        <span><i class="far fa-calendar-alt"></i> ${n.date ? dateUtils.formatDisplayDate(n.date) : (n.time ? "Sin fecha (Recurrente)" : "Sin fecha")}</span>
                            ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                            <span><i class="fas fa-tag" style="color: ${getCategoryInfo(n.category).color}"></i> ${getCategoryInfo(n.category).name}</span>
                            ${n.alarm ? `<span style="color: var(--primary)"><i class="fas fa-bell"></i> Alarma</span>` : ""}
                        </div>
                        <p style="color: var(--text-main); line-height: 1.5; margin: 0; font-size: 0.95rem;">${n.description || "Sin descripción adicional."}</p>
                    </div>
                    <div style="display: flex; gap: 8px; margin-left: 20px;">
                        <button class="btn-secondary" onclick="event.stopPropagation(); window.deleteNote('${n.id}')" style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; background: var(--bg-main); color: var(--high);"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`,
                    )
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
window.toggleAllNotesFilter = (type, val) => {
  if (type === 'withDate') {
    if (!val && !state.allNotesFilterNoDate) return renderView(); // Impedir desactivar ambos
    state.allNotesFilterWithDate = val;
  } else {
    if (!val && !state.allNotesFilterWithDate) return renderView(); // Impedir desactivar ambos
    state.allNotesFilterNoDate = val;
  }
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

// --- Sistema de Tooltips ---
const tooltip = document.getElementById("note-tooltip");

document.addEventListener("mouseover", (e) => {
  const target = e.target.closest("[data-note-id]");
  
  // No mostrar tooltip en vistas que ya muestran toda la información (Todas las notas, Notas sin fecha y Vista de día)
  const isFullView = state.currentView === "all-notes" || state.currentView === "no-date-notes" || (state.currentView === "calendar" && state.calendarSubView === "day");

  if (target && !e.target.closest(".modal") && !isFullView) {
    const id = target.dataset.noteId;
    const note = getters.getNoteById(id);
    if (note) {
      tooltip.style.display = "block";
      tooltip.style.borderLeftColor = `var(--${note.priority})`;
      tooltip.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 5px;">${note.title}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">
          <i class="far fa-calendar-alt"></i> ${dateUtils.formatDisplayDate(note.date)} 
          ${note.time ? `<i class="far fa-clock" style="margin-left:8px"></i> ${note.time}` : ""}
          <span style="margin-left:8px"><i class="fas fa-folder" style="color: ${getCategoryInfo(note.category).color}"></i> ${getCategoryInfo(note.category).name}</span>
        </div>
        <div style="margin-bottom: 8px;">${renderTagPills(note.tags)}</div>
        <div style="color: var(--text-main); font-size: 0.8rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
          ${note.description || "<i>Sin descripción</i>"}
        </div>
      `;
    }
  }
});

document.addEventListener("mousemove", (e) => {
  if (tooltip.style.display === "block") {
    const offset = 15;
    let x = e.clientX + offset;
    let y = e.clientY + offset;

    // Mantener dentro de la pantalla
    if (x + tooltip.offsetWidth > window.innerWidth) {
      x = e.clientX - tooltip.offsetWidth - offset;
    }
    if (y + tooltip.offsetHeight > window.innerHeight) {
      y = e.clientY - tooltip.offsetHeight - offset;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
});

document.addEventListener("mouseout", (e) => {
  if (e.target.closest("[data-note-id]")) {
    tooltip.style.display = "none";
  }
});

window.snoozeNote = (id) => {
  const note = getters.getNoteById(id);
  if (note) {
    const [year, month, day] = note.date.split("-").map(Number);
    const [hours, minutes] = note.time.split(":").map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);

    // Añadir 5 minutos
    date.setMinutes(date.getMinutes() + 5);

    note.date = dateUtils.formatYYYYMMDD(date);
    note.time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    note.alarm = true; // Reactivar la alarma para la nueva hora
    delete note.preAlarmFired; // Permitir aviso previo para la nueva hora

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
  if (state.currentView !== "all-notes" && state.currentView !== "no-date-notes") {
    state.currentView = "all-notes";
    document
      .querySelectorAll(".nav-item")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.view === "all-notes"),
      );
  }
  renderView();
});
