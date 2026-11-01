export const SETTINGS_LIMITS = {
  focusMin: { min: 1, max: 180, default: 25 },
  shortBreakMin: { min: 1, max: 60, default: 5 },
  longBreakMin: { min: 1, max: 120, default: 15 },
  cyclesUntilLong: { min: 2, max: 12, default: 4 },
  alertSeconds: { min: 3, max: 60, default: 8 },
  volume: { min: 0.0, max: 1.0, default: 0.6 },
  scale: { min: 0.5, max: 2.0, default: 1.0 },
  opacity: { min: 0.3, max: 1.0, default: 1.0 },
} as const;

export function clamp(val: number, min: number, max: number): number {
  if (Number.isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

export function validateNumberField(
  field: keyof typeof SETTINGS_LIMITS,
  value: number,
): { valid: boolean; clamped: number; error?: string } {
  const limits = SETTINGS_LIMITS[field];
  if (Number.isNaN(value)) {
    return { valid: false, clamped: limits.default, error: "Valor numérico inválido" };
  }
  if (value < limits.min || value > limits.max) {
    return {
      valid: false,
      clamped: clamp(value, limits.min, limits.max),
      error: `Debe estar entre ${limits.min} y ${limits.max}`,
    };
  }
  return { valid: true, clamped: value };
}
