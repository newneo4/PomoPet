import type { Language } from "../ipc/generated/Language";
import type { PetManifest } from "../pet/types";
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
 * Priority:
 * 1. Pet's own manifest dialogues for the active language.
 * 2. Pet's own manifest dialogues in Spanish fallback.
 * 3. App dictionary for this petId.
 * 4. App neutral default dialogues.
 */
export function getPetDialogue(
  petId: string,
  category: "focusStart" | "breakStart" | "alert" | "poke",
  lang: SupportedLanguage = "es",
  manifest?: PetManifest | null,
): string {
  // 1. Pack's own dialogues in current language
  const packList = manifest?.dialogues?.[lang]?.[category];
  if (Array.isArray(packList) && packList.length > 0) {
    const idx = Math.floor(Math.random() * packList.length);
    if (packList[idx]) return packList[idx];
  }

  // 2. Pack's own dialogues in Spanish fallback
  if (lang !== "es") {
    const packEsList = manifest?.dialogues?.["es"]?.[category];
    if (Array.isArray(packEsList) && packEsList.length > 0) {
      const idx = Math.floor(Math.random() * packEsList.length);
      if (packEsList[idx]) return packEsList[idx];
    }
  }

  // 3. Built-in dictionary by petId
  const dict = (dictionaries[lang] ?? esDict) as Record<string, unknown>;
  const dialogues = (dict.dialogues || (esDict as Record<string, unknown>).dialogues) as
    Record<string, Record<string, string[]>> | undefined;
  const petDialogues = dialogues?.[petId];
  const list = petDialogues?.[category];
  if (Array.isArray(list) && list.length > 0) {
    const idx = Math.floor(Math.random() * list.length);
    if (list[idx]) return list[idx];
  }

  // 4. Universal neutral default fallback
  const defaultList = dialogues?.["default"]?.[category];
  if (Array.isArray(defaultList) && defaultList.length > 0) {
    const idx = Math.floor(Math.random() * defaultList.length);
    if (defaultList[idx]) return defaultList[idx];
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
