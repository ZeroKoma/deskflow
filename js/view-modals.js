import { state, mutations, getters } from "./store.js";
import { dateUtils } from "./utils.js";

export function openNoteModal(id = null, defaultDate = null) {
  const noteModal = document.getElementById("note-modal");
  const modalTitle = document.getElementById("modal-title");
  const dateInput = document.getElementById("date");
  const alarmInput = document.getElementById("alarm");
  const deleteBtn = document.getElementById("delete-note-modal");
  noteModal.style.display = "flex";
  dateInput.min = dateUtils.getTodayStr();

  document.getElementById("category").innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");

  if (id) {
    const note = getters.getNoteById(id);
    modalTitle.innerText = note.date ? "Editar Recordatorio" : "Editar Nota";
    document.getElementById("note-id").value = note.id;
    document.getElementById("title").value = note.title;
    dateInput.value = note.date;
    document.getElementById("time").value = note.time;
    document.getElementById("priority").value = note.priority;
    document.getElementById("category").value = note.category;
    document.getElementById("description").value = note.description;
    document.getElementById("alarm").checked = note.alarm;
    renderTagSelection(note.tags || []);
    alarmInput.disabled = !note.time;
    deleteBtn.style.display = "inline-flex";
    deleteBtn.onclick = () => window.deleteNote(id);
  } else {
    // Reset form for new note
    document.getElementById("note-form").reset();
    document.getElementById("note-id").value = "";

    // Set default date if provided
    if (defaultDate) {
      dateInput.value = defaultDate;
    }

    // Set initial title based on date presence
    modalTitle.innerText = dateInput.value
      ? "Nuevo Recordatorio"
      : "Nueva Nota";

    renderTagSelection([]);
    alarmInput.disabled = true;
    deleteBtn.style.display = "none";
  }

  // Add event listener for dynamic title update
  const updateModalTitleBasedOnDate = () => {
    const hasDate = !!dateInput.value;
    modalTitle.innerText = id
      ? hasDate
        ? "Editar Recordatorio"
        : "Editar Nota"
      : hasDate
        ? "Nuevo Recordatorio"
        : "Nueva Nota";
  };
  dateInput.removeEventListener("input", updateModalTitleBasedOnDate); // Prevent multiple listeners
  dateInput.addEventListener("input", updateModalTitleBasedOnDate);
}

export function renderTagSelection(selectedIds) {
  const container = document.getElementById("tag-selection-container");
  container.innerHTML = state.tags
    .map((tag) => {
      const isAlarmTag =
        tag.name === "Alarma" || tag.id === "tag-alarm-default";
      const isSelected = selectedIds.includes(tag.id);
      return `
        <div class="tag-chip ${isSelected ? "selected" : "inactive"} ${isAlarmTag ? "protected-tag" : ""}"
             ${isAlarmTag ? 'title="Este tag se activa con la alarma"' : ""}
             style="background: ${tag.color}22; color: ${tag.color}; border-color: ${tag.color}; display: ${isAlarmTag && !isSelected ? "none" : "inline-flex"}">
          <input type="checkbox" name="note-tags" value="${tag.id}" ${isSelected ? "checked" : ""} ${isAlarmTag ? "disabled" : ""} style="display:none">
          ${tag.name}
        </div>`;
    })
    .join("");

  container.querySelectorAll(".tag-chip").forEach((chip) => {
    if (!chip.classList.contains("protected-tag")) {
      chip.addEventListener("click", () => {
        const cb = chip.querySelector("input");
        cb.checked = !cb.checked;
        chip.classList.toggle("selected");
        chip.classList.toggle("inactive");
      });
    }
  });
}

export function renderTagManager() {
  const container = document.getElementById("tags-list-container");
  container.innerHTML = state.tags
    .map((tag) => {
      const isProtected =
        tag.name === "Alarma" || tag.id === "tag-alarm-default";
      return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 15px; height: 15px; border-radius: 50%; background: ${tag.color}"></div>
          <span>${tag.name}</span>
        </div>
        ${
          isProtected
            ? `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;"><i class="fas fa-lock"></i>&nbsp;&nbsp;Sistema</span>`
            : `<div style="display: flex; gap: 10px;">
            <button data-action="edit-tag" data-id="${tag.id}" class="btn-ghost" style="padding:4px"><i class="fas fa-pencil-alt"></i></button>
            <button data-action="delete-tag" data-id="${tag.id}" class="btn-ghost" style="color:var(--high); padding:4px"><i class="fas fa-times"></i></button>
          </div>`
        }
      </div>`;
    })
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
        <button data-action="edit-category" data-id="${cat.id}" class="btn-ghost" style="padding:4px"><i class="fas fa-pencil-alt"></i></button>
        <button data-action="delete-category" data-id="${cat.id}" class="btn-ghost" style="color:var(--high); padding:4px"><i class="fas fa-times"></i></button>
      </div>
    </div>`,
    )
    .join("");
}
