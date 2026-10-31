import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Expiration } from "./generated/Expiration";
import type { Settings } from "./generated/Settings";
import type { SettingsPatch } from "./generated/SettingsPatch";
import type { TimerSnapshot } from "./generated/TimerSnapshot";

export interface IpcClient {
  getTimerState(): Promise<TimerSnapshot>;
  startTimer(): Promise<TimerSnapshot>;
  pauseTimer(): Promise<TimerSnapshot>;
  resumeTimer(): Promise<TimerSnapshot>;
  skipTimer(): Promise<TimerSnapshot>;
  resetTimer(): Promise<TimerSnapshot>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsPatch): Promise<Settings>;
  setClickThrough(enabled: boolean): Promise<void>;
  resetOverlayPosition(): Promise<void>;
  openPanel(tab?: string): Promise<void>;
  quitApp(): Promise<void>;
  onTimerSnapshot(cb: (snapshot: TimerSnapshot) => void): Promise<UnlistenFn>;
  onTimerExpired(cb: (expiration: Expiration) => void): Promise<UnlistenFn>;
  onSettingsChanged(cb: (settings: Settings) => void): Promise<UnlistenFn>;
}

const isTauriAvailable = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const ipcClient: IpcClient = {
  getTimerState: async () => {
    if (!isTauriAvailable()) {
      return mockSnapshot;
    }
    return invoke<TimerSnapshot>("timer_get_state");
  },
  startTimer: async () => {
    if (!isTauriAvailable()) {
      return { ...mockSnapshot, status: "running" };
    }
    return invoke<TimerSnapshot>("timer_start");
  },
  pauseTimer: async () => {
    if (!isTauriAvailable()) {
      return { ...mockSnapshot, status: "paused" };
    }
    return invoke<TimerSnapshot>("timer_pause");
  },
  resumeTimer: async () => {
    if (!isTauriAvailable()) {
      return { ...mockSnapshot, status: "running" };
    }
    return invoke<TimerSnapshot>("timer_resume");
  },
  skipTimer: async () => {
    if (!isTauriAvailable()) {
      return mockSnapshot;
    }
    return invoke<TimerSnapshot>("timer_skip");
  },
  resetTimer: async () => {
    if (!isTauriAvailable()) {
      return mockSnapshot;
    }
    return invoke<TimerSnapshot>("timer_reset");
  },
  getSettings: async () => {
    if (!isTauriAvailable()) {
      return mockSettings;
    }
    return invoke<Settings>("settings_get");
  },
  updateSettings: async (patch: SettingsPatch) => {
    if (!isTauriAvailable()) {
      return mockSettings;
    }
    return invoke<Settings>("settings_update", { patch });
  },
  setClickThrough: async (enabled: boolean) => {
    if (!isTauriAvailable()) return;
    return invoke<void>("overlay_set_click_through", { enabled });
  },
  resetOverlayPosition: async () => {
    if (!isTauriAvailable()) return;
    return invoke<void>("overlay_reset_position");
  },
  openPanel: async (tab?: string) => {
    if (!isTauriAvailable()) return;
    return invoke<void>("overlay_open_panel", { tab });
  },
  quitApp: async () => {
    if (!isTauriAvailable()) return;
    return invoke<void>("app_quit");
  },
  onTimerSnapshot: async (cb: (snapshot: TimerSnapshot) => void) => {
    if (!isTauriAvailable()) {
      return () => {};
    }
    return listen<TimerSnapshot>("timer://snapshot", (event) => cb(event.payload));
  },
  onTimerExpired: async (cb: (expiration: Expiration) => void) => {
    if (!isTauriAvailable()) {
      return () => {};
    }
    return listen<Expiration>("timer://expired", (event) => cb(event.payload));
  },
  onSettingsChanged: async (cb: (settings: Settings) => void) => {
    if (!isTauriAvailable()) {
      return () => {};
    }
    return listen<Settings>("settings://changed", (event) => cb(event.payload));
  },
};

const mockSnapshot: TimerSnapshot = {
  phase: "focus",
  status: "ready",
  endsAtMs: null,
  remainingMs: 25 * 60 * 1000,
  totalMs: 25 * 60 * 1000,
  cyclesDone: 0,
  cyclesUntilLong: 4,
  nowMs: Date.now(),
};

const mockSettings: Settings = {
  schemaVersion: 1,
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  cyclesUntilLong: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  alertSeconds: 8,
  soundEnabled: true,
  volume: 0.6,
  notifyOnExpire: true,
  autostartWithWindows: false,
  clickThrough: false,
  overlay: {
    x: null,
    y: null,
    monitorId: null,
    scale: 1.0,
    opacity: 1.0,
  },
  activePetId: "gato-clasico",
  activeThemeId: "clasico",
  language: "system",
  reducedMotion: "system",
};
