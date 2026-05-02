import { state, mutations, subscribe, getters } from './store.js';
import { showToast, renderView } from './view.js';

// Icono oficial de DeskFlow para las notificaciones (Data URL para máxima compatibilidad)
const APP_ICON = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="%232563eb" d="M128 64c0-35.3 28.7-64 64-64h128c35.3 0 64 28.7 64 64v64h64c35.3 0 64 28.7 64 64v288c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V192c0-35.3 28.7-64 64-64h64V64zm64 64h128V64H192v64z"/></svg>';

export function playAlarmSound() {
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

let alarmWorker;

export function startAlarmService() {
  if (!window.Worker) return;

  alarmWorker = new Worker('./js/alarms-worker.js');

  alarmWorker.onmessage = (e) => {
    const { type, noteId, key } = e.data;
    const note = getters.getNoteById(noteId);
    if (!note) return;

    if (type === 'ALARM_NOW' && note.lastAlarmKey !== key) {
      // Actualizar inmediatamente para evitar duplicados
      mutations.updateNote(note.id, { ...note, lastAlarmKey: key, alarm: false });
      
      playAlarmSound();
      triggerBrowserNotification("DeskFlow: Recordatorio", note.title);
      showToast(`¡ALERTA!: ${note.title}`, "high", note.id);
      renderView();

    } else if (type === 'ALARM_PRE' && note.lastPreAlarmKey !== key) {
      mutations.updateNote(note.id, { ...note, lastPreAlarmKey: key });
      triggerBrowserNotification("DeskFlow: Aviso (5 min)", `Próximamente: ${note.title}`);
      showToast(`Aviso previo (5 min): ${note.title}`, "info");
    }
  };

  // Mantener al Worker sincronizado con el estado
  subscribe(() => {
    const cleanNotes = JSON.parse(JSON.stringify(state.notes));
    alarmWorker.postMessage({ type: 'SYNC_NOTES', notes: cleanNotes });
  });

  // Sincronización inicial
  const initialNotes = JSON.parse(JSON.stringify(state.notes));
  alarmWorker.postMessage({ type: 'SYNC_NOTES', notes: initialNotes });
}

function triggerBrowserNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body: body,
        icon: APP_ICON,
        requireInteraction: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { console.error("Fallo al lanzar notificación:", e); }
  }
}