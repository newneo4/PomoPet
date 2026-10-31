import { describe, expect, it } from "vitest";
import { timerStore } from "./timerStore";

describe("timerStore", () => {
  it("initializes with default snapshot and settings", () => {
    const state = timerStore.getSnapshot();
    expect(state.snapshot.phase).toBe("focus");
    expect(state.snapshot.status).toBe("ready");
    expect(state.formattedTime).toBe("25:00");
    expect(state.alertActive).toBe(false);
    expect(state.petState).toBe("idle");
  });

  it("subscribes and notifies listeners", () => {
    let called = false;
    const unsubscribe = timerStore.subscribe(() => {
      called = true;
    });

    timerStore.dismissAlert();
    expect(called).toBe(true);
    unsubscribe();
  });
});
