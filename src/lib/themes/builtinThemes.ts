import type { ThemeManifest } from "./types";

export const BUILTIN_THEMES: Record<string, ThemeManifest> = {
  clasico: {
    schema: 1,
    id: "clasico",
    name: "Clásico (Digital)",
    description: "Pastilla digital elegante con vista clara de fase y controles",
    layout: "digital",
    tokens: {
      text: "#ffffff",
      accent: "#f59e0b",
      accentBreak: "#10b981",
      background: "rgba(15, 23, 42, 0.88)",
      radius: 20,
    },
  },
  anillo: {
    schema: 1,
    id: "anillo",
    name: "Anillo (Circular)",
    description: "Anillo circular con progreso concéntrico y tiempo central",
    layout: "ring",
    tokens: {
      text: "#ffffff",
      accent: "#6366f1",
      accentBreak: "#06b6d4",
      background: "rgba(15, 23, 42, 0.90)",
      radius: 56,
    },
  },
  barra: {
    schema: 1,
    id: "barra",
    name: "Barra Compacta",
    description: "Barra horizontal estilizada con indicador de progreso continuo",
    layout: "bar",
    tokens: {
      text: "#ffffff",
      accent: "#ec4899",
      accentBreak: "#8b5cf6",
      background: "rgba(15, 23, 42, 0.92)",
      radius: 12,
    },
  },
  minimalista: {
    schema: 1,
    id: "minimalista",
    name: "Minimalista",
    description: "Tipografía discreta con punto de estado y controles en hover",
    layout: "minimal",
    tokens: {
      text: "#f8fafc",
      accent: "#10b981",
      accentBreak: "#38bdf8",
      background: "rgba(15, 23, 42, 0.55)",
      radius: 10,
    },
  },
};

export const DEFAULT_THEME_ID = "clasico";

/**
 * Returns the theme manifest for the requested id, falling back to 'clasico'.
 */
export function getTheme(id?: string | null): ThemeManifest {
  if (id && id in BUILTIN_THEMES) {
    return BUILTIN_THEMES[id]!;
  }
  return BUILTIN_THEMES[DEFAULT_THEME_ID]!;
}
