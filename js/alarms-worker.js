/**
 * DeskFlow Alarms Worker
 * Performs reminders checks in a separate thread to avoid UI jank.
 */
let notes = [];

self.onmessage = (e) => {
  if (e.data.type === 'SYNC_NOTES') {
    notes = e.data.notes;
  }
};

function checkAlarms() {
  const now = new Date();
  
  // YYYY-MM-DD format for comparison
  const todayStr = now.getFullYear() + '-' + 
                   String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(now.getDate()).padStart(2, '0');
  
  // HH:mm format for comparison
  const currentTime = String(now.getHours()).padStart(2, '0') + ":" + 
                      String(now.getMinutes()).padStart(2, '0');

  // Calculate time for pre-alarm (5 minutes before)
  const preDate = new Date(now.getTime() + 5 * 60000);
  const preDayStr = preDate.getFullYear() + '-' + 
                    String(preDate.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(preDate.getDate()).padStart(2, '0');
  const preTimeStr = String(preDate.getHours()).padStart(2, '0') + ":" + 
                     String(preDate.getMinutes()).padStart(2, '0');

  notes.forEach(note => {
    if (!note.date || !note.time || !note.alarm) return;

    // 1. Check Real Alarm
    if (note.date === todayStr && note.time === currentTime) {
      self.postMessage({ type: 'ALARM_NOW', noteId: note.id, key: `${note.id}-${note.date}-${note.time}` });
    }

    // 2. Check Pre-Alarm
    if (note.date === preDayStr && note.time === preTimeStr) {
      self.postMessage({ type: 'ALARM_PRE', noteId: note.id, key: `pre-${note.id}-${note.date}-${note.time}` });
    }
  });
}

// Run the check every 10 seconds
setInterval(checkAlarms, 10000);