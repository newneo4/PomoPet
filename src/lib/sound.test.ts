import { describe, it, expect, vi, beforeEach } from "vitest";
import { playChime } from "./sound";

interface MockOscillator {
  type: string;
  frequency: {
    setValueAtTime: (val: number, time: number) => void;
  };
  connect: () => void;
  start: (time: number) => void;
  stop: (time: number) => void;
}

interface MockGain {
  gain: {
    setValueAtTime: (val: number, time: number) => void;
    exponentialRampToValueAtTime: (val: number, time: number) => void;
  };
  connect: () => void;
}

describe("playChime", () => {
  let createdOscillators: MockOscillator[] = [];
  let createdGains: MockGain[] = [];

  beforeEach(() => {
    createdOscillators = [];
    createdGains = [];

    class MockGainNode implements MockGain {
      gain = {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      };
      connect = vi.fn();
    }

    class MockOscillatorNode implements MockOscillator {
      type = "sine";
      frequency = {
        setValueAtTime: vi.fn(),
      };
      connect = vi.fn();
      start = vi.fn();
      stop = vi.fn();
    }

    class MockAudioContext {
      currentTime = 0;
      destination = {};
      createOscillator(): MockOscillator {
        const osc = new MockOscillatorNode();
        createdOscillators.push(osc);
        return osc;
      }
      createGain(): MockGain {
        const gain = new MockGainNode();
        createdGains.push(gain);
        return gain;
      }
      close(): Promise<void> {
        return Promise.resolve();
      }
    }

    const mockWin = {
      AudioContext: MockAudioContext,
      setTimeout: (fn: () => void) => fn(),
    };

    (globalThis as unknown as { window: unknown }).window = mockWin;
  });

  it("creates tones with correct frequencies for chime", () => {
    playChime(0.8);

    expect(createdOscillators.length).toBe(4);
    expect(createdGains.length).toBe(4);
    // Note 1: C5 (523.25) & harmonic (1046.5)
    expect(createdOscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 0);
    expect(createdOscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(1046.5, 0);
    // Note 2: G5 (783.99) & harmonic (1567.98)
    expect(createdOscillators[2]?.frequency.setValueAtTime).toHaveBeenCalledWith(783.99, 0.22);
    expect(createdOscillators[3]?.frequency.setValueAtTime).toHaveBeenCalledWith(1567.98, 0.22);
  });

  it("handles missing AudioContext gracefully without throwing", () => {
    (globalThis as unknown as { window: unknown }).window = {};
    expect(() => playChime(0.5)).not.toThrow();
  });
});
