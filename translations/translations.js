import { state } from "../js/store.js";
import { es } from "./es.js";
import { en } from "./en.js";

const translations = { es, en };

export const t = (key) => {
  const lang = state.language || "es";
  return translations[lang][key] || translations["es"][key] || key;
};
