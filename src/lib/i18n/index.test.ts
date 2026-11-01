import { describe, it, expect } from "vitest";
import { resolveLanguage, translate } from "./index";
import esDict from "./es.json";
import enDict from "./en.json";

describe("i18n module", () => {
  it("resolves explicit languages correctly", () => {
    expect(resolveLanguage("es")).toBe("es");
    expect(resolveLanguage("en")).toBe("en");
  });

  it("resolves system language with fallback", () => {
    const lang = resolveLanguage("system");
    expect(["es", "en"]).toContain(lang);
  });

  it("translates dot notation keys in Spanish", () => {
    expect(translate("timer.focusMin", "es")).toBe("Duración de Foco (min)");
    expect(translate("app.title", "es")).toBe("Ajustes de PomoPet");
  });

  it("translates dot notation keys in English", () => {
    expect(translate("timer.focusMin", "en")).toBe("Focus Duration (min)");
    expect(translate("app.title", "en")).toBe("PomoPet Settings");
  });

  it("falls back gracefully when key is missing", () => {
    expect(translate("nonexistent.key", "en")).toBe("nonexistent.key");
  });

  it("has exact structural parity between es.json and en.json", () => {
    function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      let keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          keys = keys.concat(getKeys(v as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      }
      return keys.sort();
    }

    const esKeys = getKeys(esDict);
    const enKeys = getKeys(enDict);

    expect(esKeys).toEqual(enKeys);
  });
});
