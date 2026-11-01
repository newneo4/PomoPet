/**
 * Web Audio API synthesizer for the Pomodoro alarm chime (T1.6).
 * Self-contained, zero-asset, with smooth exponential decay.
 */

export function playChime(volume = 0.8): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const clampedVolume = Math.max(0, Math.min(1, volume));

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack and exponential decay for bell sound
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(clampedVolume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // First note: C5 (523.25 Hz)
    playTone(523.25, now, 1.2);
    playTone(1046.5, now, 0.8);

    // Second note: G5 (783.99 Hz)
    playTone(783.99, now + 0.22, 1.4);
    playTone(1567.98, now + 0.22, 0.9);

    // Clean up audio context
    window.setTimeout(() => {
      void ctx.close();
    }, 2000);
  } catch (err) {
    console.warn("[PomoPet] Audio playback skipped:", err);
  }
}
