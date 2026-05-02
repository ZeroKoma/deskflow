/**
 * DeskFlow Alarms Worker
 * Realiza la comprobación de recordatorios en un hilo separado para evitar jank en la UI.
 */
let notes = [];

self.onmessage = (e) => {
  if (e.data.type === 'SYNC_NOTES') {
    notes = e.data.notes;
  }
};

function checkAlarms() {
  const now = new Date();
  
  // Formato YYYY-MM-DD para comparación
  const todayStr = now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(now.getDate()).padStart(2, '0');
  
  // Formato HH:mm para comparación
  const currentTime = String(now.getHours()).padStart(2, '0') + ":" + 
                      String(now.getMinutes()).padStart(2, '0');

  // Calcular tiempo para pre-alarma (5 minutos antes)
  const preDate = new Date(now.getTime() + 5 * 60000);
  const preDayStr = preDate.getFullYear() + '-' + 
                    String(preDate.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(preDate.getDate()).padStart(2, '0');
  const preTimeStr = String(preDate.getHours()).padStart(2, '0') + ":" + 
                     String(preDate.getMinutes()).padStart(2, '0');

  notes.forEach(note => {
    if (!note.date || !note.time || !note.alarm) return;

    // 1. Comprobar Alarma Real
    if (note.date === todayStr && note.time === currentTime) {
      self.postMessage({ type: 'ALARM_NOW', noteId: note.id, key: `${note.id}-${note.date}-${note.time}` });
    }

    // 2. Comprobar Pre-Alarma
    if (note.date === preDayStr && note.time === preTimeStr) {
      self.postMessage({ type: 'ALARM_PRE', noteId: note.id, key: `pre-${note.id}-${note.date}-${note.time}` });
    }
  });
}

// Ejecutar la comprobación cada 10 segundos
setInterval(checkAlarms, 10000);