import { state } from './store.js';

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
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const locale = state.language === 'en' ? 'en-US' : 'es-ES';
    const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    // Formateamos la fecha corta según el estándar del idioma seleccionado
    const shortDate = date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });

    return `${capitalizedDay} ${shortDate}`;
  }
};

export function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}