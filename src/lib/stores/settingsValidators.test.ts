import { describe, it, expect } from "vitest";
import { clamp, validateNumberField } from "./settingsValidators";

describe("settingsValidators", () => {
  it("clamps numbers within defined range", () => {
    expect(clamp(10, 1, 20)).toBe(10);
    expect(clamp(-5, 1, 20)).toBe(1);
    expect(clamp(30, 1, 20)).toBe(20);
    expect(clamp(Number.NaN, 5, 10)).toBe(5);
  });

  it("validates focusMin according to pomopet-core limits", () => {
    expect(validateNumberField("focusMin", 25)).toEqual({ valid: true, clamped: 25 });
    expect(validateNumberField("focusMin", 0)).toEqual({
      valid: false,
      clamped: 1,
      error: "Debe estar entre 1 y 180",
    });
    expect(validateNumberField("focusMin", 300)).toEqual({
      valid: false,
      clamped: 180,
      error: "Debe estar entre 1 y 180",
    });
  });

  it("validates shortBreakMin and longBreakMin", () => {
    expect(validateNumberField("shortBreakMin", 5)).toEqual({ valid: true, clamped: 5 });
    expect(validateNumberField("shortBreakMin", 70)).toEqual({
      valid: false,
      clamped: 60,
      error: "Debe estar entre 1 y 60",
    });
    expect(validateNumberField("longBreakMin", 15)).toEqual({ valid: true, clamped: 15 });
    expect(validateNumberField("longBreakMin", 150)).toEqual({
      valid: false,
      clamped: 120,
      error: "Debe estar entre 1 y 120",
    });
  });

  it("validates scale and opacity limits", () => {
    expect(validateNumberField("scale", 1.5)).toEqual({ valid: true, clamped: 1.5 });
    expect(validateNumberField("scale", 0.2)).toEqual({
      valid: false,
      clamped: 0.5,
      error: "Debe estar entre 0.5 y 2",
    });
    expect(validateNumberField("opacity", 0.1)).toEqual({
      valid: false,
      clamped: 0.3,
      error: "Debe estar entre 0.3 y 1",
    });
  });

  it("validates alertSeconds and cyclesUntilLong", () => {
    expect(validateNumberField("alertSeconds", 8)).toEqual({ valid: true, clamped: 8 });
    expect(validateNumberField("alertSeconds", 1)).toEqual({
      valid: false,
      clamped: 3,
      error: "Debe estar entre 3 y 60",
    });
    expect(validateNumberField("cyclesUntilLong", 4)).toEqual({ valid: true, clamped: 4 });
    expect(validateNumberField("cyclesUntilLong", 20)).toEqual({
      valid: false,
      clamped: 12,
      error: "Debe estar entre 2 y 12",
    });
  });
});
