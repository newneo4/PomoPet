import type { TimerSnapshot } from "../ipc/generated/TimerSnapshot";

export type PetState = "idle" | "focus" | "break" | "alert" | "paused";

/**
 * Pure function mapping timer snapshot and alert flag to the visual pet state.
 *
 * Rules defined in `docs/ARCHITECTURE.md` §Mascota:
 * - alertActive: true -> "alert"
 * - any phase + paused -> "paused"
 * - focus + running -> "focus"
 * - (short_break | long_break) + running -> "break"
 * - focus + ready -> "idle"
 * - (short_break | long_break) + ready -> "idle"
 */
export function calculatePetState(snapshot: TimerSnapshot, alertActive: boolean = false): PetState {
  if (alertActive) {
    return "alert";
  }

  if (snapshot.status === "paused") {
    return "paused";
  }

  if (snapshot.status === "running") {
    if (snapshot.phase === "focus") {
      return "focus";
    }
    return "break";
  }

  // Ready in any phase
  return "idle";
}

/**
 * Calculates remaining milliseconds using the skew formula from `docs/IPC_CONTRACT.md`.
 * Skew: `skew = nowMs - Date.now()`
 * Running: `remaining = endsAtMs - (Date.now() + skew)`
 * Other statuses: `remainingMs`
 */
export function calculateRemainingMs(
  snapshot: TimerSnapshot,
  skew: number,
  clientNow: number = Date.now(),
): number {
  if (snapshot.status === "running" && snapshot.endsAtMs !== null) {
    const remaining = snapshot.endsAtMs - (clientNow + skew);
    return Math.max(0, Math.min(snapshot.totalMs, remaining));
  }
  return Math.max(0, Math.min(snapshot.totalMs, snapshot.remainingMs));
}

/**
 * Formats milliseconds into standard digital MM:SS clock string.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
