import { describe, it, expect } from "vitest";
import { resolveLanguage, translate, getPetDialogue } from "./index";
import type { PetManifest } from "../pet/types";
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

  it("prioritizes dialogues from pet manifest in requested language", () => {
    const mockManifest: PetManifest = {
      schema: 1,
      type: "pet",
      id: "alien-pet",
      name: "Alien",
      version: "1.0.0",
      author: "Test",
      license: "MIT",
      frameSize: [128, 128],
      states: {
        idle: { sheet: "idle.png", frames: 1, mode: "loop" },
        focus: { sheet: "focus.png", frames: 1, mode: "loop" },
        break: { sheet: "break.png", frames: 1, mode: "loop" },
        alert: { sheet: "alert.png", frames: 1, mode: "once" },
      },
      dialogues: {
        en: {
          focusStart: ["Telepathic focus initiated 🛸"],
        },
      },
    };

    const dialogue = getPetDialogue("alien-pet", "focusStart", "en", mockManifest);
    expect(dialogue).toBe("Telepathic focus initiated 🛸");
  });

  it("falls back to manifest Spanish dialogues when English is missing in manifest", () => {
    const mockManifest: PetManifest = {
      schema: 1,
      type: "pet",
      id: "alien-pet",
      name: "Alien",
      version: "1.0.0",
      author: "Test",
      license: "MIT",
      frameSize: [128, 128],
      states: {
        idle: { sheet: "idle.png", frames: 1, mode: "loop" },
        focus: { sheet: "focus.png", frames: 1, mode: "loop" },
        break: { sheet: "break.png", frames: 1, mode: "loop" },
        alert: { sheet: "alert.png", frames: 1, mode: "once" },
      },
      dialogues: {
        es: {
          focusStart: ["Enfoque alienígena activado 🛸"],
        },
      },
    };

    const dialogue = getPetDialogue("alien-pet", "focusStart", "en", mockManifest);
    expect(dialogue).toBe("Enfoque alienígena activado 🛸");
  });

  it("falls back to neutral default dialogues for a pet without custom dialogues", () => {
    const mockManifest: PetManifest = {
      schema: 1,
      type: "pet",
      id: "perro-basico",
      name: "Perro Básico",
      version: "1.0.0",
      author: "Test",
      license: "MIT",
      frameSize: [128, 128],
      states: {
        idle: { sheet: "idle.png", frames: 1, mode: "loop" },
        focus: { sheet: "focus.png", frames: 1, mode: "loop" },
        break: { sheet: "break.png", frames: 1, mode: "loop" },
        alert: { sheet: "alert.png", frames: 1, mode: "once" },
      },
    };

    const dialogue = getPetDialogue("perro-basico", "focusStart", "es", mockManifest);
    expect(esDict.dialogues.default.focusStart).toContain(dialogue);
    // Crucial: ensure no cross-contamination from other pets
    expect(esDict.dialogues.mielcita.focusStart).not.toContain(dialogue);
    expect(esDict.dialogues["gato-clasico"].focusStart).not.toContain(dialogue);
  });
});
