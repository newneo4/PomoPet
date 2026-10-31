import { describe, expect, it } from "vitest";
import type { TimerSnapshot } from "../ipc/generated/TimerSnapshot";
import { calculatePetState, calculateRemainingMs, formatTime } from "./petState";

const baseSnapshot: TimerSnapshot = {
  phase: "focus",
  status: "ready",
  endsAtMs: null,
  remainingMs: 1500000,
  totalMs: 1500000,
  cyclesDone: 0,
  cyclesUntilLong: 4,
  nowMs: 1000000,
};

describe("calculatePetState (ARCHITECTURE.md §Mascota table)", () => {
  it("focus + ready -> idle", () => {
    const s: TimerSnapshot = { ...baseSnapshot, phase: "focus", status: "ready" };
    expect(calculatePetState(s, false)).toBe("idle");
  });

  it("focus + running -> focus", () => {
    const s: TimerSnapshot = { ...baseSnapshot, phase: "focus", status: "running" };
    expect(calculatePetState(s, false)).toBe("focus");
  });

  it("any phase + paused -> paused", () => {
    expect(calculatePetState({ ...baseSnapshot, phase: "focus", status: "paused" }, false)).toBe(
      "paused",
    );
    expect(
      calculatePetState({ ...baseSnapshot, phase: "short_break", status: "paused" }, false),
    ).toBe("paused");
    expect(
      calculatePetState({ ...baseSnapshot, phase: "long_break", status: "paused" }, false),
    ).toBe("paused");
  });

  it("break + running -> break", () => {
    expect(
      calculatePetState({ ...baseSnapshot, phase: "short_break", status: "running" }, false),
    ).toBe("break");
    expect(
      calculatePetState({ ...baseSnapshot, phase: "long_break", status: "running" }, false),
    ).toBe("break");
  });

  it("break + ready -> idle", () => {
    expect(
      calculatePetState({ ...baseSnapshot, phase: "short_break", status: "ready" }, false),
    ).toBe("idle");
    expect(
      calculatePetState({ ...baseSnapshot, phase: "long_break", status: "ready" }, false),
    ).toBe("idle");
  });

  it("alertActive -> alert regardless of phase or status", () => {
    expect(calculatePetState({ ...baseSnapshot, phase: "focus", status: "running" }, true)).toBe(
      "alert",
    );
    expect(
      calculatePetState({ ...baseSnapshot, phase: "short_break", status: "ready" }, true),
    ).toBe("alert");
  });
});

describe("calculateRemainingMs (IPC_CONTRACT.md skew formula)", () => {
  it("uses remainingMs when not running", () => {
    const s: TimerSnapshot = { ...baseSnapshot, status: "ready", remainingMs: 50000 };
    expect(calculateRemainingMs(s, 0, 100000)).toBe(50000);
  });

  it("calculates remaining from endsAtMs with skew when running", () => {
    const s: TimerSnapshot = {
      ...baseSnapshot,
      status: "running",
      endsAtMs: 120000,
      totalMs: 100000,
    };
    const clientNow = 100000;
    const skew = 5000; // nowMs - clientNow
    // remaining = 120000 - (100000 + 5000) = 15000
    expect(calculateRemainingMs(s, skew, clientNow)).toBe(15000);
  });

  it("clamps remaining between 0 and totalMs", () => {
    const s: TimerSnapshot = {
      ...baseSnapshot,
      status: "running",
      endsAtMs: 100000,
      totalMs: 50000,
    };
    // Clock in past -> clamps to 0
    expect(calculateRemainingMs(s, 0, 150000)).toBe(0);
  });
});

describe("formatTime", () => {
  it("formats standard times", () => {
    expect(formatTime(25 * 60 * 1000)).toBe("25:00");
    expect(formatTime(5 * 60 * 1000)).toBe("05:00");
    expect(formatTime(65 * 1000)).toBe("01:05");
    expect(formatTime(9 * 1000)).toBe("00:09");
    expect(formatTime(0)).toBe("00:00");
  });
});
