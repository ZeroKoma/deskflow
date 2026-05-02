import { state, getters } from "./store.js";
import { dateUtils } from "./utils.js";

export const priorityLabels = { high: "Alta", medium: "Media", low: "Baja" };

export const getCategoryInfo = (id) => {
  const cat = state.categories.find((c) => c.id === id);
  if (cat) return cat;
  return { name: id || "Otros", color: "var(--text-muted)" };
};

export function renderCategoryBadge(categoryId) {
  const cat = getCategoryInfo(categoryId);
  return `<span class="category-badge" style="background-color: ${cat.color}">
    <i class="fas fa-folder" style="font-size: 0.65rem;"></i> ${cat.name}
  </span>`;
}

export function renderTagPills(tagIds = []) {
  if (!tagIds || tagIds.length === 0) return "";
  return tagIds
    .map((id) => {
      const tag = state.tags.find((t) => t.id === id);
      if (!tag) return "";
      return `<span class="tag-pill" style="background: ${tag.color}15; color: ${tag.color}; border-color: ${tag.color}44;"><span style="font-size: 1.3em; margin-right: 2px; font-weight: 800; line-height: 1;">#</span>${tag.name}</span>`;
    })
    .join("");
}

export function showToast(msg, type = "info", noteId = null, action = null) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  if (noteId) toast.id = `toast-${noteId}`;
  const icon = type === "high" ? "fa-exclamation-triangle" : "fa-info-circle";

  let actionButtons = "";
  if (type === "high" && noteId) {
    const note = getters.getNoteById(noteId);
    const dateBtn = note && note.date
        ? `<button class="btn-primary" data-action="view-day" data-id="${note.date}" style="background: var(--primary); color: white; flex: 1; border: 1px solid rgba(255,255,255,0.3);">
           <i class="fas fa-calendar-day"></i> Ver día
         </button>` : "";

    actionButtons = `<div style="display: flex; gap: var(--space-m); margin-top: var(--space-l);">
        ${dateBtn}
        <button class="btn-primary" data-action="snooze" data-id="${noteId}" style="background: var(--high); color: white; flex: 1; border: 1px solid rgba(255,255,255,0.3);">
          <i class="fas fa-clock"></i> Posponer
        </button>
      </div>`;
  }

  if (!actionButtons && action && action.label) {
    actionButtons = `<div style="display: flex; gap: 10px; margin-top: 10px;">
        <button id="toast-action-btn" class="btn-secondary" style="font-size: 0.8rem; padding: 4px 10px; width: 100%; border: 1px solid var(--border);"><i class="fas fa-undo"></i> ${action.label}</button>
    </div>`;
  }

  toast.innerHTML = `
    <div style="display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
            <span><i class="fas ${icon}"></i> ${msg}</span>
            <i class="fas fa-times" style="cursor: pointer; opacity: 0.7;" data-action="close-toast"></i>
        </div>
        ${actionButtons}
    </div>`;
  
  if (type === "high") document.body.classList.add("alarm-active");
  container.appendChild(toast);

  if (action && action.callback) {
    const btn = toast.querySelector("#toast-action-btn");
    if (btn) btn.onclick = () => { action.callback(); toast.remove(); };
  }

  // Si la notificación es una alarma crítica, un aviso previo o contiene una acción (como Deshacer),
  // NO se eliminará automáticamente. Solo el usuario puede cerrarla o ejecutar la acción.
  if (!(type === "high" || msg.includes("Aviso previo") || action)) {
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
  }
}

export function showConfirmModal(message, onConfirm, onCancel = null, options = {}) {
  const { okText = "Eliminar", okClass = "btn-danger", cancelText = "Cancelar" } = options;
  const confirmModal = document.getElementById("confirm-modal");
  const msgEl = document.getElementById("confirm-message");
  const okBtn = document.getElementById("confirm-ok");
  const cancelBtn = document.getElementById("confirm-cancel");

  msgEl.innerText = message;
  okBtn.innerText = okText;
  okBtn.className = okClass;
  cancelBtn.innerText = cancelText;

  confirmModal.style.display = "flex";

  const cleanup = () => {
    confirmModal.style.display = "none";
    okBtn.onclick = null;
    cancelBtn.onclick = null;
  };
  okBtn.onclick = () => { onConfirm(); cleanup(); };
  cancelBtn.onclick = () => { if (onCancel) onCancel(); cleanup(); };
}

// --- Sistema de Tooltips ---
const tooltip = document.getElementById("note-tooltip");
let isDraggingActive = false;

document.addEventListener("mouseover", (e) => {
  const target = e.target.closest("[data-note-id]");
  const dayTarget = e.target.closest("[data-day-hint]");
  const isFullView = state.currentView === "all-notes" || (state.currentView === "calendar" && state.calendarSubView === "day");
  if (target && !e.target.closest(".modal") && !isDraggingActive) {
    const note = getters.getNoteById(target.dataset.noteId);
    const hint = target.dataset.hint;
    if (note) {
      tooltip.style.display = "block";
      tooltip.style.borderLeftColor = `var(--${note.priority})`;

      if (isFullView && hint) {
        // En vista detallada, solo mostramos el consejo de acción para no ser redundantes
        tooltip.innerHTML = `<div style="font-size: 0.8rem; font-weight: 600; color: var(--primary);"><i class="fas fa-info-circle"></i> ${hint}</div>`;
      } else if (!isFullView) {
        // En vistas compactas (dashboard, mes), mostramos toda la info + el consejo
        tooltip.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 5px;">${note.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">
            <i class="far fa-calendar-alt"></i> ${note.date ? dateUtils.formatDisplayDate(note.date) : "--"}
            ${note.time ? `<i class="far fa-clock" style="margin-left:8px"></i> ${note.time}` : ""}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            ${renderCategoryBadge(note.category)}
            ${renderTagPills(note.tags)}
          </div>
          <div style="color: var(--text-main); font-size: 0.8rem; white-space: pre-wrap; margin-bottom: 8px;">${note.description || "<i>Sin descripción</i>"}</div>
          ${hint ? `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border); font-size: 0.75rem; color: var(--primary); font-weight: 600;"><i class="fas fa-mouse-pointer"></i> ${hint}</div>` : ""}
        `;
      } else {
        tooltip.style.display = "none";
      }
    }
  } else if (dayTarget && !e.target.closest(".modal") && !isDraggingActive) {
    // Tooltip para el día del calendario (solo si no estamos sobre una nota)
    tooltip.style.display = "block";
    tooltip.style.borderLeftColor = "var(--primary)";
    tooltip.innerHTML = `<div style="font-size: 0.8rem; font-weight: 600; color: var(--primary);"><i class="fas fa-search-plus"></i> ${dayTarget.dataset.dayHint}</div>`;
  }
});
document.addEventListener("mousemove", (e) => {
  if (tooltip.style.display === "block") {
    const offset = 15;
    let x = e.clientX + offset, y = e.clientY + offset;
    if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - offset;
    if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - offset;
    tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
  }
});
document.addEventListener("mouseout", (e) => { if (e.target.closest("[data-note-id]") || e.target.closest("[data-day-hint]")) tooltip.style.display = "none"; });

// Limpieza de tooltips durante operaciones de arrastre
document.addEventListener("dragstart", () => {
  isDraggingActive = true;
  if (tooltip) tooltip.style.display = "none";
});
document.addEventListener("dragend", () => { isDraggingActive = false; });
document.addEventListener("drop", () => { isDraggingActive = false; });