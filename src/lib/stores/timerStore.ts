import { ipcClient } from "../ipc/client";
import type { Expiration } from "../ipc/generated/Expiration";
import type { Settings } from "../ipc/generated/Settings";
import type { TimerSnapshot } from "../ipc/generated/TimerSnapshot";
import {
  calculatePetState,
  calculateRemainingMs,
  formatTime,
  type PetState,
} from "../pet/petState";
import { playChime } from "../sound";

export interface TimerStoreState {
  snapshot: TimerSnapshot;
  settings: Settings;
  skew: number;
  alertActive: boolean;
  remainingMs: number;
  formattedTime: string;
  petState: PetState;
}

const defaultSnapshot: TimerSnapshot = {
  phase: "focus",
  status: "ready",
  endsAtMs: null,
  remainingMs: 25 * 60 * 1000,
  totalMs: 25 * 60 * 1000,
  cyclesDone: 0,
  cyclesUntilLong: 4,
  nowMs: Date.now(),
};

const defaultSettings: Settings = {
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

function computeDerived(
  snapshot: TimerSnapshot,
  settings: Settings,
  skew: number,
  alertActive: boolean,
): TimerStoreState {
  const remainingMs = calculateRemainingMs(snapshot, skew, Date.now());
  const formattedTime = formatTime(remainingMs);
  const petState = calculatePetState(snapshot, alertActive);
  return {
    snapshot,
    settings,
    skew,
    alertActive,
    remainingMs,
    formattedTime,
    petState,
  };
}

class TimerStore {
  private state: TimerStoreState = computeDerived(defaultSnapshot, defaultSettings, 0, false);
  private listeners = new Set<() => void>();
  private tickInterval: number | null = null;
  private alertTimeout: number | null = null;
  private initialized = false;

  constructor() {
    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
  }

  public getSnapshot(): TimerStoreState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (!this.initialized) {
      this.initIpc();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private update(updater: (prev: TimerStoreState) => TimerStoreState) {
    this.state = updater(this.state);
    this.notify();
  }

  private initIpc() {
    this.initialized = true;

    void Promise.all([ipcClient.getTimerState(), ipcClient.getSettings()]).then(
      ([initialSnapshot, initialSettings]) => {
        const initialSkew = initialSnapshot.nowMs - Date.now();
        this.update(() =>
          computeDerived(initialSnapshot, initialSettings, initialSkew, this.state.alertActive),
        );
        this.syncInterval(initialSnapshot.status);
      },
    );

    void ipcClient.onTimerSnapshot((snapshot) => {
      const skew = snapshot.nowMs - Date.now();
      this.update(() =>
        computeDerived(snapshot, this.state.settings, skew, this.state.alertActive),
      );
      this.syncInterval(snapshot.status);
    });

    void ipcClient.onTimerExpired((expiration: Expiration) => {
      if (expiration.lateMs > 60000) return;

      if (this.alertTimeout) {
        window.clearTimeout(this.alertTimeout);
      }

      this.update((prev) => computeDerived(prev.snapshot, prev.settings, prev.skew, true));

      if (this.state.settings.soundEnabled) {
        playChime(this.state.settings.volume);
      }

      const durationMs = (this.state.settings.alertSeconds || 8) * 1000;
      this.alertTimeout = window.setTimeout(() => {
        this.dismissAlert();
      }, durationMs);
    });

    void ipcClient.onSettingsChanged((settings) => {
      this.update((prev) => computeDerived(prev.snapshot, settings, prev.skew, prev.alertActive));
    });
  }

  private syncInterval(status: string) {
    if (status === "running") {
      if (!this.tickInterval) {
        this.tickInterval = window.setInterval(() => {
          this.update((prev) =>
            computeDerived(prev.snapshot, prev.settings, prev.skew, prev.alertActive),
          );
        }, 1000);
      }
    } else if (this.tickInterval) {
      window.clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  public dismissAlert() {
    if (this.alertTimeout) {
      window.clearTimeout(this.alertTimeout);
      this.alertTimeout = null;
    }
    this.update((prev) => computeDerived(prev.snapshot, prev.settings, prev.skew, false));
  }

  public async toggleRunning(): Promise<void> {
    try {
      if (this.state.alertActive) {
        this.dismissAlert();
        return;
      }
      const status = this.state.snapshot.status;
      let snapshot: TimerSnapshot;
      if (status === "running") {
        snapshot = await ipcClient.pauseTimer();
      } else if (status === "paused") {
        snapshot = await ipcClient.resumeTimer();
      } else {
        snapshot = await ipcClient.startTimer();
      }
      const skew = snapshot.nowMs - Date.now();
      this.update(() =>
        computeDerived(snapshot, this.state.settings, skew, this.state.alertActive),
      );
      this.syncInterval(snapshot.status);
    } catch (err) {
      console.error("[PomoPet] Failed to toggle timer:", err);
    }
  }

  public async skip(): Promise<void> {
    try {
      this.dismissAlert();
      const snapshot = await ipcClient.skipTimer();
      const skew = snapshot.nowMs - Date.now();
      this.update(() =>
        computeDerived(snapshot, this.state.settings, skew, this.state.alertActive),
      );
      this.syncInterval(snapshot.status);
    } catch (err) {
      console.error("[PomoPet] Failed to skip timer:", err);
    }
  }

  public async openPanel(tab?: string): Promise<void> {
    await ipcClient.openPanel(tab);
  }

  public async setClickThrough(enabled: boolean): Promise<void> {
    await ipcClient.setClickThrough(enabled);
  }

  public async resetPosition(): Promise<void> {
    await ipcClient.resetOverlayPosition();
  }

  public async quit(): Promise<void> {
    await ipcClient.quitApp();
  }
}

export const timerStore = new TimerStore();
