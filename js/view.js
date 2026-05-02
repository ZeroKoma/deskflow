import { state, mutations, getters } from "./store.js";
import { dateUtils } from "./utils.js";
import { t } from "../translations/translations.js";
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

// Re-export for app.js
export {
  showToast,
  showConfirmModal,
  openNoteModal,
  renderTagManager,
  renderCategoryManager,
};

const viewContainer = document.getElementById("view-container");

/**
 * Helper to determine if a note matches current search criteria
 */
const matchesSearch = (note, query, includeTags, includeCats) => {
  if (!query) return true;
  const q = query.toLowerCase();

  // If no specific filters are active, we search by note name (title)
  if (!includeTags && !includeCats) {
    return note.title.toLowerCase().includes(q);
  }

  // If there are active filters, the note name is no longer searched (as requested)
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
 * Requested sorting logic:
 * 1. Priority first, 2. Alarms, 3. By time
 */
const sortNotesLogic = (a, b) => {
  const priorityMap = { high: 0, medium: 1, low: 2 };
  const pA = priorityMap[a.priority] ?? 1;
  const pB = priorityMap[b.priority] ?? 1;

  if (pA !== pB) return pA - pB;

  // Same priority: Compare by date (oldest first)
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
  // Ensure scroll returns to top when switching views
  const mainContent = document.querySelector(".main-content");
  if (mainContent) mainContent.scrollTop = 0;
  window.scrollTo(0, 0);

  if (state.currentView === "calendar") renderCalendar();
  else if (state.currentView === "dashboard") renderDashboard();
  else if (state.currentView === "settings") renderSettings();
  else renderAllNotes();
}

export function updateUIStats() {
  const stats = getters.getStats();
  
  const setIfOk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setIfOk("stat-high", stats.high);
  setIfOk("stat-medium", stats.medium);
  setIfOk("stat-low", stats.low);

  const statWithAlarm = document.getElementById("stat-with-alarm");
  if (statWithAlarm) statWithAlarm.innerText = stats.withAlarm;

  const todayStr = dateUtils.getTodayStr();
  const hasAlarmsToday = state.notes.some(n => n.date === todayStr && n.alarm);
  const alarmStatItem = document.querySelector('.stat-item[data-filter="withAlarm"]');
  if (alarmStatItem) {
    alarmStatItem.classList.toggle('alarm-alert-active', hasAlarmsToday);
    const alarmIcon = alarmStatItem.querySelector('i');
    if (alarmIcon) alarmIcon.classList.toggle('pulse-animation', hasAlarmsToday);
  }

  const statExpiredSidebar = document.getElementById("stat-expired-sidebar");
  if (statExpiredSidebar) statExpiredSidebar.innerText = stats.expired;

  setIfOk("count-all", stats.all);
  const expiredBadge = document.getElementById("count-expired");
  if (expiredBadge) expiredBadge.innerText = stats.expired;
  setIfOk("count-calendar", stats.withDate);
  setIfOk("count-tags", stats.tags);
  setIfOk("count-categories", stats.categories);
}

// --- Specific Renderers ---
function renderDashboard() {
  const query = document.getElementById("global-search")?.value || "";
  const incTags = document.getElementById("search-tags")?.checked;
  const incCats = document.getElementById("search-categories")?.checked;
  const todayStr = dateUtils.getTodayStr();
  const tomorrowStr = dateUtils.getTomorrowStr();
  const todayTasks = state.notes // Filter notes for today
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

  // Generate weekly view for Dashboard (using the current date)
  const focusDate = new Date(); // Current date for dashboard week view
  const originalSubView = state.calendarSubView;
  state.calendarSubView = "week"; // Force weekly subview temporarily
  const weekGridHtml = renderCalendarGrid(focusDate, 5); // Limit to 5 per day in Dashboard
  state.calendarSubView = originalSubView;

  // Filter undated notes for the bottom list
  const noDateTasksFull = state.notes
    .filter((n) => !n.date && matchesSearch(n, query, incTags, incCats))
    .sort(sortNotesLogic);
  const noDateTotal = noDateTasksFull.length; // Total undated notes
  const noDateLimited = noDateTasksFull.slice(0, 6);
  const noDateCountDisplay = noDateTotal > 6 ? `${t('dash_showing')} 6 ${t('dash_of')} ${noDateTotal}` : `${t('dash_showing')} ${noDateTotal}`;

  viewContainer.innerHTML = `
    <div class="view-container-padding">
        <h1 class="view-title">${t('dash_title')}</h1>
        <p class="view-subtitle">${t('dash_subtitle')}</p>
        
        <div class="dashboard-grid">
            ${renderDashboardColumn(t('dash_today'), todayTasks, "fa-calendar-day", "var(--primary)", todayStr)}
            ${renderDashboardColumn(t('dash_tomorrow'), tomorrowTasks, "fa-calendar-plus", "var(--medium)", tomorrowStr)}
        </div>

        <div class="card dashboard-column planning-card">
            <div class="flex-between column-title">
                <h3 class="m-0">
                    ${t('dash_weekly')} <span class="title-count">${t('dash_weekly_hint')}</span>
                </h3>
                <button class="btn-ghost btn-sm-border" onclick="window.seeFullWeek()" title="${t('dash_view_full_week')}">
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
                    ${t('dash_notes')} <span class="title-count">(${noDateCountDisplay})</span>
                </h3>
                <button class="btn-ghost btn-sm-border" onclick="window.seeAllNoDateNotes()" title="${t('dash_view_all_notes')}">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
            <div class="notes-grid-300">
                ${
                  noDateLimited.length > 0
                    ? noDateLimited
                        .map((note) => `
                    <div class="dashboard-note-item priority-${note.priority}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${note.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${note.id}" onclick="window.openNoteModal('${note.id}')" data-hint="${t('hint_drag_calendar')}">
                        <div class="flex-1 notes-stack-mini">
                            <span style="font-weight: 600;">${note.title}</span>
                            <div class="badge-row">
                                ${renderCategoryBadge(note.category)}
                                ${renderTagPills(note.tags)}
                            </div>
                        </div>
                        <span class="note-time">${note.time || "--:--"}</span>
                    </div>`
                        )
                        .join("")
                    : `<p style="color: var(--text-muted); text-align: center; width: 100%;">${t('dash_no_notes')}</p>`
                }
            </div>
        </div>
    </div>`;
}

function renderDashboardColumn(title, tasks, icon, color, targetDate) {
  const todayStr = dateUtils.getTodayStr();
  const totalCount = tasks.length;
  const displayedTasks = tasks.slice(0, 3);
  const countDisplay = totalCount > 3 ? `${t('dash_showing')} 3 ${t('dash_of')} ${totalCount}` : `${t('dash_showing')} ${totalCount}`;

  return `
    <div class="card dashboard-column drag-zone" data-drop-date="${targetDate}" ondragover="window.handleNoteDragOver(event)" ondragleave="window.handleNoteDragLeave(event)" ondrop="window.handleNoteDrop(event)">
        <div class="flex-between column-title">
            <h3 class="m-0">
                ${title} <span class="title-count">(${countDisplay})</span>
            </h3>
            <button class="btn-ghost btn-sm-border" onclick="window.selectDayView('${targetDate}')" title="${t('dash_view_day')}">
                <i class="fas fa-eye"></i>
            </button>
        </div>
        <div class="notes-stack">
            ${
              displayedTasks.length > 0
                ? displayedTasks.map((note) => {
                      const isPast = note.date && note.date < todayStr;
                      return `
                <div class="dashboard-note-item priority-${note.priority} ${isPast ? "expired" : ""}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${note.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${note.id}" onclick="window.openNoteModal('${note.id}')" data-hint="${t('hint_drag_move')}">
                    <div class="flex-1 notes-stack-mini">
                        <span style="font-weight: 500;">${note.title}</span>
                        <div class="badge-row">
                            ${renderCategoryBadge(note.category)}
                            ${renderTagPills(note.tags)}
                        </div>
                    </div>
                    <span class="note-time">${note.time || "--:--"}</span>
                </div>`;
                    })
                    .join("")
                : `<p style="color: var(--text-muted); text-align: center;">${t('dash_rem_none')}</p>`
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
  const locale = state.language === 'en' ? 'en-US' : 'es-ES'; // Locale for date formatting

  let title = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(focusDate);

  let dayTitle = focusDate.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const startOfWeek = new Date(focusDate);
  const day = focusDate.getDay();
  const diffToMonday = focusDate.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0); // Start of the week
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  let weekTitle = `${startOfWeek.getDate()} ${new Intl.DateTimeFormat(locale, { month: "short" }).format(startOfWeek)} - ${endOfWeek.getDate()} ${new Intl.DateTimeFormat(locale, { month: "short" }).format(endOfWeek)}`;

  let monthTitle = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(focusDate);

  // Calculate counts for each subview
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

  // Assign main title without the counter
  if (state.calendarSubView === "week") {
    title = weekTitle;
  } else if (state.calendarSubView === "day") {
    title = dayTitle;
  } else { // month
    title = monthTitle;
  }

  viewContainer.innerHTML = `
    <div class="view-container-padding">
        <h1 class="view-title mb-0">${t('cal_title')}</h1>
    </div>
    <div class="calendar-header">
        <div class="flex-center-gap-20">
            <h2 class="m-0 text-capitalize">${title}</h2>
            <div class="flex-gap-8">
                ${
                  state.calendarSubView === "day" && focusDateStr === todayStr
                    ? ""
                    : `<button class="btn-primary btn-sm" onclick="window.goToday()">${t('cal_today')}</button>`
                }
                ${
                  state.calendarSubView === "day"
                    ? `
                    <button class="btn-primary btn-sm ${isPastDay ? "disabled-btn" : ""}"
                            ${isPastDay ? "disabled" : ""}
                            onclick="${isPastDay ? "" : `window.openNoteModal(null, '${dateUtils.formatYYYYMMDD(focusDate)}')`}">
                            ${t('cal_new')}
                    </button>`
                    : ""
                }
            </div>
        </div>
        <div class="flex-center-gap-15">
            <div class="subview-selector">
                <button class="subview-btn ${state.calendarSubView === "day" ? "active" : ""}" onclick="window.setSubView('day')">${t('cal_day')} ${state.calendarSubView === "day" ? `<span class="title-count">(${dayCount})</span>` : ''}</button>
                <button class="subview-btn ${state.calendarSubView === "week" ? "active" : ""}" onclick="window.setSubView('week')">${t('cal_week')} ${state.calendarSubView === "week" ? `<span class="title-count">(${weekCount})</span>` : ''}</button>
                <button class="subview-btn ${state.calendarSubView === "month" ? "active" : ""}" onclick="window.setSubView('month')">${t('cal_month')} ${state.calendarSubView === "month" ? `<span class="title-count">(${monthCount})</span>` : ''}</button>
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
  const locale = state.language === 'en' ? 'en-US' : 'es-ES';
  const firstDayOfWeek = state.language === 'en' ? 0 : 1;

  if (state.calendarSubView === "month") {
    // Generate week day names dynamically according to language
    const weekDays = [];
    const baseDate = new Date(2021, 0, 3 + firstDayOfWeek); 
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      weekDays.push(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d));
    }

    weekDays.forEach(d => {
      html += `<div class="day-header text-capitalize" style="text-align:center; padding: 10px; background: var(--bg-main)">${d}</div>`;
    });

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

    // Dynamic offset based on the first day of the week
    const offset = (firstDay - firstDayOfWeek + 7) % 7;

    for (let i = 0; i < offset; i++)
      html += `<div class="calendar-day empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dObj = new Date(state.currentYear, state.currentMonth, day);
      const dateStr = dateUtils.formatYYYYMMDD(dObj);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
      html += renderDayCell(day, dateStr, dateStr === todayStr, false, null, isWeekend);
    }
  } else if (state.calendarSubView === "week") {
    const startOfWeek = new Date(focusDate);
    const day = focusDate.getDay();
    const diff = focusDate.getDate() - ((day - firstDayOfWeek + 7) % 7);
    startOfWeek.setDate(diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = dateUtils.formatYYYYMMDD(d);
      const label = `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d)} ${d.getDate()}`;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      html += renderDayCell(label, dateStr, dateStr === todayStr, false, limit, isWeekend);
    }
  } else {
    const dateStr = dateUtils.formatYYYYMMDD(focusDate);
    const label = `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(focusDate)} ${focusDate.getDate()}`;
    const isWeekend = focusDate.getDay() === 0 || focusDate.getDay() === 6;
    html += renderDayCell(label, dateStr, dateStr === todayStr, true, null, isWeekend);
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
        <div class="card note-card-full priority-${n.priority} ${expiredClass}" data-note-id="${n.id}" onclick="event.stopPropagation(); window.openNoteModal('${n.id}')" data-hint="${t('hint_edit')}">
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
                <p class="note-desc">${n.description || t('no_desc')}</p>
            </div>
            <div class="card-actions-col">
                        <button onclick="event.stopPropagation(); window.deleteNote('${n.id}')" class="btn-icon-trash-outline" data-note-id="${n.id}" data-hint="${t('btn_delete')}"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
      }

      // On mobile (responsive) and month view, we let the click bubble to the parent (calendar-day)
      // to navigate to day view, instead of opening the modal, as notes are represented as "dots".
      const clickHandler = state.calendarSubView === 'month' 
        ? `if(window.innerWidth > 768) { event.stopPropagation(); window.openNoteModal('${n.id}'); }`
        : `event.stopPropagation(); window.openNoteModal('${n.id}');`;

      return `<div class="note-pill priority-${n.priority} ${expiredClass}" draggable="true" ondragstart="window.handleNoteDragStart(event, '${n.id}')" ondragend="window.handleNoteDragEnd(event)" data-note-id="${n.id}" onclick="${clickHandler}" data-hint="${t('hint_drag_move')}">${n.title}</div>`;
    })
    .join("");

  const finalNotesHtml =
    isFull && dayNotes.length === 0
      ? `<div class="empty-state-placeholder">
        <i class="fas fa-calendar-day empty-state-icon"></i>
        ${t('cal_empty')}
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
    ? `onclick="window.selectDayView('${dateStr}')" style="cursor:pointer;" ${dayNotes.length > 0 ? `data-day-hint="${t('hint_view_day_notes')}"` : ''}` 
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
    if (state.allNotesFilterWithAlarm) return n.alarm && !isPast;

    return false;
  });

  const sortedData = [...filteredData].sort(sortNotesLogic);
  renderNoteList("All Notes", sortedData);
}

function renderNoteList(title, data) {
  const stats = getters.getStats();
  const todayStr = dateUtils.getTodayStr();
  viewContainer.innerHTML = `
    <div class="view-container-padding">
        <h1 class="view-title">${t('all_title')}</h1>
        <div class="view-header-row" style="margin-top: var(--space-l);">
            <div class="flex-center-gap-15">
                ${
                  state.currentView === "all-notes"
                    ? `
                ${
                  state.allNotesPriorityFilter
                    ? `
                <div class="priority-filter-tag">
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--primary);">${t('filter_priority')}: ${priorityLabels[state.allNotesPriorityFilter]}</span>
                    <i class="fas fa-times" style="cursor: pointer; font-size: 0.8rem; color: var(--text-muted);" title="Quitar filtro" onclick="window.clearPriorityFilter()"></i>
                </div>
                `
                    : ""
                }
                <div class="filters-bar">
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterAll ? "checked" : ""} onchange="window.toggleAllNotesFilter('all', this.checked)"> 
                        <span>${t('filter_all')} (${stats.all_total})</span>
                    </label>
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterWithDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('withDate', this.checked)"> 
                        <span>${t('filter_reminders')} (${stats.activeWithDate})</span>
                    </label>
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterNoDate ? "checked" : ""} onchange="window.toggleAllNotesFilter('noDate', this.checked)"> 
                        <span>${t('filter_notes')} (${stats.activeNoDate})</span>
                    </label>
                    <label class="filter-checkbox-group">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterWithAlarm ? "checked" : ""} onchange="window.toggleAllNotesFilter('withAlarm', this.checked)"> 
                        <span>${t('filter_alarms')} (${stats.withAlarm})</span>
                    </label>
                    <div class="flex-grow"></div>
                    <label class="filter-checkbox-group color-high">
                        <input type="checkbox" class="round-checkbox" 
                               ${state.allNotesFilterExpired ? "checked" : ""} onchange="window.toggleAllNotesFilter('expired', this.checked)"> 
                        <span>${t('filter_expired')} (${stats.expired})</span>
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
                    <p style="color: var(--text-muted);">${t('no_results')}</p>
                 </div>`
                : data
                    .map((n) => {
                      const isPast = n.date && n.date < todayStr;
                      const expiredClass = isPast ? "expired" : "";
                      return `
                <div class="card note-card-full priority-${n.priority} bg-sidebar ${expiredClass}" data-note-id="${n.id}" onclick="window.openNoteModal('${n.id}')" data-hint="${t('hint_edit')}">
                    <div class="flex-1 note-content-stack">
                        <div class="card-header-row">
                            <h3 class="m-0">${n.title}</h3>
                        </div>
                        <div class="badge-row">
                            ${renderCategoryBadge(n.category)}
                            ${renderTagPills(n.tags)}
                        </div>
                        <div class="meta-row">
                            <span><i class="far fa-calendar-alt"></i> ${n.date ? dateUtils.formatDisplayDate(n.date) : n.time ? t('no_date_recurrent') : t('no_date')}</span>
                            ${n.time ? `<span><i class="far fa-clock"></i> ${n.time}</span>` : ""}
                        </div>
                        <p class="note-desc">${n.description || t('no_desc')}</p>
                    </div>
                    <div class="card-actions-col">
                        <button onclick="event.stopPropagation(); window.deleteNote('${n.id}')" class="btn-icon-trash-fill" data-note-id="${n.id}" data-hint="${t('btn_delete')}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
                    })
                    .join("")
            }
        </div>
    </div>`;
}

function renderSettings() {
  viewContainer.innerHTML = `
    <div class="view-container-padding">
        <h1 class="view-title">${t('nav_settings')}</h1>
        <p class="view-subtitle">${t('dash_subtitle')}</p>

        <div class="settings-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-xl); margin-top: var(--space-xl);">
            
            <!-- Tag Management Section -->
            <section class="card settings-section">
                <div class="column-title">
                    <h3 class="m-0"><i class="fas fa-tags"></i> ${t('tag_mgr_title')}</h3>
                </div>
                <div class="settings-content">
                    <form id="tag-form" style="display: flex; gap: var(--space-m); margin-bottom: var(--space-xl); align-items: center;">
                        <input type="hidden" id="tag-id" />
                        <input
                          type="text"
                          id="tag-name"
                          data-t-placeholder="tag_mgr_placeholder"
                          placeholder="${t('tag_mgr_placeholder')}"
                          required
                          style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-main); color: var(--text-main);"
                        />
                        <input type="color" id="tag-color" value="#2563eb" style="width: 50px; height: 38px; padding: 2px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer;" />
                        <button type="submit" class="btn-primary" id="tag-submit-btn" style="padding: 8px 16px;">
                          <i class="fas fa-plus"></i>
                        </button>
                    </form>
                    <div id="tags-list-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-main);">
                        <!-- Dynamic tags list -->
                    </div>
                </div>
            </section>

            <!-- Category Management Section -->
            <section class="card settings-section">
                <div class="column-title">
                    <h3 class="m-0"><i class="fas fa-folder"></i> ${t('cat_mgr_title')}</h3>
                </div>
                <div class="settings-content">
                    <form id="category-form" style="display: flex; gap: var(--space-m); margin-bottom: var(--space-xl); align-items: center;">
                        <input type="hidden" id="category-id" />
                        <input
                          type="text"
                          id="category-name"
                          data-t-placeholder="cat_mgr_placeholder"
                          placeholder="${t('cat_mgr_placeholder')}"
                          required
                          style="flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-main); color: var(--text-main);"
                        />
                        <input type="color" id="category-color" value="#2563eb" style="width: 50px; height: 38px; padding: 2px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer;" />
                        <button type="submit" class="btn-primary" id="category-submit-btn" style="padding: 8px 16px;">
                          <i class="fas fa-plus"></i>
                        </button>
                    </form>
                    <div id="categories-list-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-main);">
                        <!-- Dynamic categories list -->
                    </div>
                </div>
            </section>

            <!-- Configuration Section -->
            <section class="card settings-section">
                <div class="column-title">
                    <h3 class="m-0"><i class="fas fa-tools"></i> ${t('settings_data')}</h3>
                </div>
                <div class="settings-content" style="display: flex; flex-direction: column; gap: var(--space-l);">
                    <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-m);">
                        <button data-action="export-data" class="btn-secondary" style="width: 100%">
                            <i class="fas fa-download"></i> <span>${t('nav_export')}</span>
                        </button>
                        <button data-action="import-data" class="btn-secondary" style="width: 100%">
                            <i class="fas fa-upload"></i> <span>${t('nav_import')}</span>
                        </button>
                    </div>
                    
                    <div style="padding-top: var(--space-l); border-top: 1px solid var(--border);">
                        <h4 style="margin-bottom: var(--space-m); color: var(--text-muted)">${t('settings_maint')}</h4>
                        <button data-action="delete-past" class="btn-secondary" style="width: 100%; border-color: var(--medium); color: var(--medium);">
                            <i class="fas fa-broom"></i> <span>${t('nav_delete_past')}</span>
                        </button>
                    </div>

                    <div style="padding-top: var(--space-l); border-top: 1px solid var(--border);">
                        <h4 style="margin-bottom: var(--space-m); color: var(--high)">${t('settings_danger')}</h4>
                        <button data-action="reset-app" class="btn-danger" style="width: 100%">
                            <i class="fas fa-trash-alt"></i> <span>${t('nav_reset')}</span>
                        </button>
                    </div>
                    
                    <div id="storage-info" style="margin-top: auto;"></div>
                </div>
            </section>
        </div>
    </div>`;

  renderTagManager();
  renderCategoryManager();
  // Load storage info
  import('./app-settings.js').then(module => {
    module.updateStorageInfoUI();
  });
}

// --- Expose functions to Window for HTML string compatibility ---
window.openNoteModal = openNoteModal;
window.closeToast = (el) => {
  const toast = el.closest(".toast");
  toast.remove();
  // Only remove effect if no more critical alarms are visible
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
  state.allNotesFilterWithAlarm = false;
};
window.toggleAllNotesFilter = (type, val) => {
  state.allNotesFilterAll = type === "all";
  state.allNotesFilterWithDate = type === "withDate";
  state.allNotesFilterNoDate = type === "noDate";
  state.allNotesFilterExpired = type === "expired";
  state.allNotesFilterWithAlarm = type === "withAlarm";
};
window.seeAllNoDateNotes = () => {
  state.currentView = "all-notes";
  state.allNotesFilterAll = false;
  state.allNotesFilterNoDate = true;
  state.allNotesFilterWithDate = false;
  state.allNotesFilterExpired = false;
  state.allNotesFilterWithAlarm = false;
  state.allNotesPriorityFilter = null;
  // Visually update sidebar navigation
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));
  const allNotesBtn = document.querySelector('[data-view="all-notes"]');
  if (allNotesBtn) allNotesBtn.classList.add("active");
};
window.seeFullWeek = () => {
  state.currentView = "calendar";
  state.calendarSubView = "week";
  // Visually update sidebar navigation
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));
  const calendarBtn = document.querySelector('[data-view="calendar"]');
  if (calendarBtn) calendarBtn.classList.add("active");
};
window.goToday = () => {
  const now = new Date();
  mutations.updateCalendarState(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  state.calendarSubView = "day";
};
window.setSubView = (v) => {
  const now = new Date();
  mutations.updateCalendarState(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  state.calendarSubView = v;
};
window.selectDayView = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  mutations.updateCalendarState(y, m - 1, day);
  state.calendarSubView = "day";
  state.currentView = "calendar";

  // Visually update sidebar navigation to reflect Calendar view
  document
    .querySelectorAll(".nav-item")
    .forEach((b) => b.classList.remove("active"));
  const calendarBtn = document.querySelector('[data-view="calendar"]');
  if (calendarBtn) calendarBtn.classList.add("active");
};
window.deleteNote = (id) => {
  showConfirmModal(
    t('conf_del_note'),
    () => {
      mutations.deleteNote(id);
      showToast(t('toast_deleted'), "info");
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
};

window.snoozeNote = (id) => {
  const note = getters.getNoteById(id);
  if (note) {
    const now = new Date();
    let targetDate = new Date();

    if (note.date) {
      const [year, month, day] = note.date.split("-").map(Number);
      targetDate.setFullYear(year, month - 1, day);
    }

    const [hours, minutes] = note.time.split(":").map(Number);
    targetDate.setHours(hours, minutes, 0, 0);

    // If the note time has already passed (normal when snoozing),
    // we add 5 minutes from "now" to ensure it rings soon.
    const baseDate = targetDate < now ? now : targetDate;
    const newTime = new Date(baseDate.getTime() + 5 * 60000);

    mutations.updateNote(id, {
      ...note,
      date: dateUtils.formatYYYYMMDD(newTime),
      time: `${String(newTime.getHours()).padStart(2, "0")}:${String(newTime.getMinutes()).padStart(2, "0")}`,
      alarm: true,
      lastAlarmKey: null,
      lastPreAlarmKey: null
    });

    showToast(t('toast_snoozed'), "info");
  }
};

// --- Search Listener ---
window.addEventListener("search-notes", () => {
  renderView();
});

window.handleNoteDragStart = (e, id) => {
  const note = getters.getNoteById(id);
  e.dataTransfer.setData("text/plain", id);
  e.dataTransfer.effectAllowed = "move";

  // Add visual class to original element to make it look like a ghost
  const target = e.target.closest('[draggable="true"]');
  if (target) target.classList.add('is-dragging');

  // Create a ghost element that includes the title for better feedback on mobile
  const dragIcon = document.createElement('div');
  dragIcon.id = 'drag-ghost';
  
  const isReminder = !!(note && note.date);
  const iconClass = isReminder ? 'fa-calendar-check' : 'fa-sticky-note';
  const noteTitle = note ? note.title : t('hint_moving');

  dragIcon.innerHTML = `
    <div style="background: var(--primary); color: white; padding: 10px 16px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 10px; border: 2px solid rgba(255,255,255,0.2);">
        <i class="fas ${iconClass}" style="font-size: 1.2rem;"></i>
        <span style="font-weight: 600; font-size: 0.9rem; white-space: nowrap;">${noteTitle.substring(0, 25)}${noteTitle.length > 25 ? '...' : ''}</span>
    </div>`;
  dragIcon.style.position = 'fixed';
  dragIcon.style.top = '-1000px';
  dragIcon.style.zIndex = '9999';
  document.body.appendChild(dragIcon);

  // On mobile, offsetting the icon helps so it's not hidden under the finger
  e.dataTransfer.setDragImage(dragIcon, 20, 20);
};

window.handleNoteDragEnd = (e) => {
  // Remove visual class from original element
  document.querySelectorAll(".is-dragging").forEach(el => el.classList.remove("is-dragging"));

  document.querySelectorAll(".drag-zone").forEach((zone) => {
    zone.classList.remove("zone-valid", "zone-invalid", "drag-over");
  });

  // Remove ghost icon from DOM
  const ghost = document.getElementById('drag-ghost');
  if (ghost) ghost.remove();
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
  const targetDate = e.currentTarget.dataset.dropDate; // "" for notes, "YYYY-MM-DD" for calendar
  const todayStr = dateUtils.getTodayStr();
  
  const note = getters.getNoteById(id);
  if (!note || note.date === targetDate) return;

  // Validation: Don't allow moving reminders to past dates
  if (targetDate && targetDate < todayStr) {
    showToast(t('toast_err_past_date'), "error");
    return;
  }

  // Time validation when dropping onto today (only if time is defined)
  if (targetDate && targetDate === todayStr && note.time) {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (note.time.slice(0, 5) < currentTime) {
          showToast(t('toast_move_err_past_today'), "error");
          return;
      }
  }

  const wasNote = !note.date;
  const isNowNote = !targetDate;

  const updatedNote = { ...note, date: targetDate };
  
  // If it's a simple note again, we clear reminder metadata
  if (isNowNote) {
    updatedNote.time = "";
    updatedNote.alarm = false;
  }

  mutations.updateNote(id, updatedNote);

  // Dynamic feedback according to conversion
  let msg = `${t('toast_moved')} ${dateUtils.formatDisplayDate(targetDate)}`;
  if (wasNote && !isNowNote) msg = `${t('toast_converted_rem')} ${dateUtils.formatDisplayDate(targetDate)}`;
  else if (!wasNote && isNowNote) msg = t('toast_converted_note');
  
  showToast(msg, "info");
};
