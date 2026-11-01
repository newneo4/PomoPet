import type { Language } from "../ipc/generated/Language";
import esDict from "./es.json";
import enDict from "./en.json";

export type SupportedLanguage = "es" | "en";

export type Dictionary = typeof esDict;

const dictionaries: Record<SupportedLanguage, Record<string, unknown>> = {
  es: esDict,
  en: enDict,
};

/**
 * Resolves the active language based on user preference and system locale.
 */
export function resolveLanguage(preference: Language = "system"): SupportedLanguage {
  if (preference === "es" || preference === "en") {
    return preference;
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("en")) return "en";
  }

  return "es";
}

/**
 * Retrieves a translated string by dot-notation key (e.g. "timer.focusMin").
 * Falls back to Spanish and then to the key itself if not found.
 */
export function translate(key: string, lang: SupportedLanguage = "es"): string {
  const dict = dictionaries[lang] ?? esDict;
  const val = getNestedValue(dict, key);
  if (typeof val === "string") {
    return val;
  }

  // Fallback to Spanish if lang was English
  if (lang !== "es") {
    const fallbackVal = getNestedValue(esDict, key);
    if (typeof fallbackVal === "string") {
      return fallbackVal;
    }
  }

  return key;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Retrieves a random themed dialogue line for a pet and event category.
 */
export function getPetDialogue(
  petId: string,
  category: "focusStart" | "breakStart" | "alert" | "poke",
  lang: SupportedLanguage = "es",
): string {
  const dict = (dictionaries[lang] ?? esDict) as Record<string, unknown>;
  const dialogues = (dict.dialogues || (esDict as Record<string, unknown>).dialogues) as
    Record<string, Record<string, string[]>> | undefined;
  const petDialogues = dialogues?.[petId] || dialogues?.["mielcita"] || dialogues?.["gato-clasico"];
  const list = petDialogues?.[category];

  if (Array.isArray(list) && list.length > 0) {
    const idx = Math.floor(Math.random() * list.length);
    return list[idx] || "❤️";
  }

  return "❤️";
}

/**
 * Lightweight React hook for translations.
 */
export function useI18n(preference: Language = "system") {
  const activeLang = resolveLanguage(preference);
  const t = (key: string): string => translate(key, activeLang);
  return { t, currentLang: activeLang };
}
