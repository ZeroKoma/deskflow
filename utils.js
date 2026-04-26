export const dateUtils = {
  formatYYYYMMDD(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  },
  
  getTodayStr() {
    return this.formatYYYYMMDD(new Date());
  },

  getTomorrowStr() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.formatYYYYMMDD(tomorrow);
  },

  formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }
};

export function downloadCSV(filename, content) {
  const encodedUri = encodeURI("data:text/csv;charset=utf-8," + content);
  const link = Object.assign(document.createElement("a"), { href: encodedUri, download: filename });
  document.body.appendChild(link); link.click(); link.remove();
}