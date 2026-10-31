import { useSyncExternalStore } from "react";
import { timerStore, type TimerStoreState } from "./timerStore";

export function useTimer(): TimerStoreState & {
  toggleRunning: () => Promise<void>;
  skip: () => Promise<void>;
  openPanel: (tab?: string) => Promise<void>;
  setClickThrough: (enabled: boolean) => Promise<void>;
  resetPosition: () => Promise<void>;
  quit: () => Promise<void>;
  dismissAlert: () => void;
} {
  const state = useSyncExternalStore(timerStore.subscribe, timerStore.getSnapshot);

  return {
    ...state,
    toggleRunning: () => timerStore.toggleRunning(),
    skip: () => timerStore.skip(),
    openPanel: (tab?: string) => timerStore.openPanel(tab),
    setClickThrough: (enabled: boolean) => timerStore.setClickThrough(enabled),
    resetPosition: () => timerStore.resetPosition(),
    quit: () => timerStore.quit(),
    dismissAlert: () => timerStore.dismissAlert(),
  };
}
