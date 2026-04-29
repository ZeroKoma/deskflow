import { state, mutations } from './store.js';
import { dateUtils } from './utils.js';
import { showToast, renderView } from './view.js';

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

export function startAlarmService() {
  setInterval(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDate = dateUtils.getTodayStr();

    state.notes.forEach((note) => {
      const isScheduledToday = !note.date || note.date === currentDate;

      if (note.alarm && isScheduledToday && note.time) {
        const [hrs, mins] = note.time.split(':').map(Number);
        const noteTime = new Date();
        noteTime.setHours(hrs, mins, 0, 0);

        const diff = now - noteTime;

        // --- Lógica de Pre-Alarma (5 minutos antes) ---
        const preAlarmDiff = now - (noteTime.getTime() - 5 * 60000);
        if (preAlarmDiff >= 0 && preAlarmDiff < 60000 && note.lastPreAlarmKey !== currentDate) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("DeskFlow: Aviso (5 min)", {
              body: `Próximamente: ${note.title}`,
              icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/layer-group.svg",
              requireInteraction: true
            });
          }
          showToast(`Aviso previo (5 min): ${note.title}`, "info");
          note.lastPreAlarmKey = currentDate;
          mutations.saveNotes();
        }

        // Alarma Real (ventana de 2 min)
        if (diff >= 0 && diff < 120000 && note.lastAlarmKey !== currentDate) { 
          playAlarmSound();

          if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification("DeskFlow: Recordatorio", {
              body: note.title,
              icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/layer-group.svg",
              requireInteraction: true
            });
            notification.onclick = () => { window.focus(); notification.close(); };
          }

          showToast(`¡ALERTA!: ${note.title}`, "high", note.id);
          
          if (note.date) note.alarm = false;
          
          note.lastAlarmKey = currentDate;
          mutations.saveNotes();
          renderView();
        }
      }
    });
  }, 10000);
}