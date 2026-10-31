//! Timer state machine.
//!
//! The timer is the source of truth for session timing. It has no Tauri
//! dependency and takes an injected [`Clock`] so tests can control time.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Late expirations above this threshold must not trigger an alert.
pub const LATE_ALERT_THRESHOLD_MS: u64 = 60_000;

/// Wall-clock abstraction used by the timer.
pub trait Clock {
    /// Current time as epoch UTC milliseconds.
    fn now_ms(&self) -> u64;
}

/// Clock backed by the system wall clock.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| u64::try_from(duration.as_millis()).unwrap_or(u64::MAX))
            .unwrap_or(0)
    }
}

/// Deterministic clock for tests and simulations.
#[derive(Debug, Default)]
pub struct ManualClock {
    now_ms: AtomicU64,
}

impl ManualClock {
    /// Creates a manual clock at `now_ms`.
    pub fn new(now_ms: u64) -> Self {
        Self {
            now_ms: AtomicU64::new(now_ms),
        }
    }

    /// Sets the current time.
    pub fn set(&self, now_ms: u64) {
        self.now_ms.store(now_ms, Ordering::SeqCst);
    }

    /// Advances the current time by `delta_ms`.
    pub fn advance(&self, delta_ms: u64) {
        self.now_ms.fetch_add(delta_ms, Ordering::SeqCst);
    }
}

impl Clock for ManualClock {
    fn now_ms(&self) -> u64 {
        self.now_ms.load(Ordering::SeqCst)
    }
}

/// Pomodoro phase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Focus,
    ShortBreak,
    LongBreak,
}

/// Timer status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Ready,
    Running,
    Paused,
}

/// Timer configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerConfig {
    pub focus_ms: u64,
    pub short_break_ms: u64,
    pub long_break_ms: u64,
    pub cycles_until_long: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
}

impl Default for TimerConfig {
    fn default() -> Self {
        Self {
            focus_ms: 25 * 60 * 1_000,
            short_break_ms: 5 * 60 * 1_000,
            long_break_ms: 15 * 60 * 1_000,
            cycles_until_long: 4,
            auto_start_breaks: true,
            auto_start_focus: false,
        }
    }
}

impl TimerConfig {
    /// Duration of a phase in milliseconds.
    pub fn duration_ms(&self, phase: Phase) -> u64 {
        match phase {
            Phase::Focus => self.focus_ms,
            Phase::ShortBreak => self.short_break_ms,
            Phase::LongBreak => self.long_break_ms,
        }
    }

    fn cycles_until_long(&self) -> u32 {
        self.cycles_until_long.max(1)
    }
}

/// Persisted timer state.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerState {
    pub phase: Phase,
    pub status: Status,
    pub ends_at_ms: Option<u64>,
    pub remaining_ms: u64,
    pub total_ms: u64,
    pub cycles_done: u32,
    pub cycles_until_long: u32,
}

impl TimerState {
    /// Creates the initial state (`focus/ready`) for a timer configuration.
    pub fn initial(config: &TimerConfig) -> Self {
        let total_ms = config.focus_ms;
        Self {
            phase: Phase::Focus,
            status: Status::Ready,
            ends_at_ms: None,
            remaining_ms: total_ms,
            total_ms,
            cycles_done: 0,
            cycles_until_long: config.cycles_until_long(),
        }
    }
}

/// Snapshot sent to the UI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct TimerSnapshot {
    pub phase: Phase,
    pub status: Status,
    pub ends_at_ms: Option<u64>,
    pub remaining_ms: u64,
    pub total_ms: u64,
    pub cycles_done: u32,
    pub cycles_until_long: u32,
    pub now_ms: u64,
}

/// Emitted when a phase reaches zero.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub struct Expiration {
    pub phase_ended: Phase,
    pub next_phase: Phase,
    pub late_ms: u64,
}

impl Expiration {
    /// Whether the UI should play the alert for this expiration.
    pub fn should_alert(&self) -> bool {
        self.late_ms <= LATE_ALERT_THRESHOLD_MS
    }
}

/// Result of evaluating the timer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tick {
    pub snapshot: TimerSnapshot,
    pub expiration: Option<Expiration>,
}

/// Timer state machine.
#[derive(Debug)]
pub struct Timer<C: Clock> {
    config: TimerConfig,
    state: TimerState,
    clock: C,
}

impl<C: Clock> Timer<C> {
    /// Creates a timer in the initial `focus/ready` state.
    pub fn new(config: TimerConfig, clock: C) -> Self {
        Self {
            state: TimerState::initial(&config),
            config,
            clock,
        }
    }

    /// Restores a persisted state and immediately evaluates late expirations.
    pub fn restore(state: TimerState, config: TimerConfig, clock: C) -> (Self, Tick) {
        let mut timer = Self {
            config,
            state,
            clock,
        };
        timer.normalize();
        let tick = timer.tick();
        (timer, tick)
    }

    /// Current configuration.
    pub fn config(&self) -> &TimerConfig {
        &self.config
    }

    /// Current persisted state.
    pub fn state(&self) -> &TimerState {
        &self.state
    }

    /// Injected clock (useful for deterministic tests).
    pub fn clock(&self) -> &C {
        &self.clock
    }

    /// Starts a ready timer.
    pub fn start(&mut self) -> TimerSnapshot {
        if self.state.status == Status::Ready {
            let now = self.clock.now_ms();
            let total_ms = self.config.duration_ms(self.state.phase);
            self.state.status = Status::Running;
            self.state.total_ms = total_ms;
            self.state.remaining_ms = total_ms;
            self.state.ends_at_ms = Some(now.saturating_add(total_ms));
        }
        self.snapshot()
    }

    /// Pauses a running timer, preserving the remaining time.
    pub fn pause(&mut self) -> TimerSnapshot {
        if self.state.status == Status::Running {
            let now = self.clock.now_ms();
            let remaining_ms = self.remaining_at(now);
            self.state.status = Status::Paused;
            self.state.remaining_ms = remaining_ms;
            self.state.ends_at_ms = None;
        }
        self.snapshot()
    }

    /// Resumes a paused timer.
    pub fn resume(&mut self) -> TimerSnapshot {
        if self.state.status == Status::Paused {
            let now = self.clock.now_ms();
            let remaining_ms = self.state.remaining_ms.min(self.state.total_ms);
            self.state.status = Status::Running;
            self.state.remaining_ms = remaining_ms;
            self.state.ends_at_ms = Some(now.saturating_add(remaining_ms));
        }
        self.snapshot()
    }

    /// Skips to the next phase without alerting.
    ///
    /// Skipping a focus session does not count as a completed cycle, so it
    /// always lands on a short break.
    pub fn skip(&mut self) -> TimerSnapshot {
        let next_phase = match self.state.phase {
            Phase::Focus => Phase::ShortBreak,
            Phase::ShortBreak | Phase::LongBreak => Phase::Focus,
        };
        self.enter_phase(next_phase, self.state.cycles_done);
        self.snapshot()
    }

    /// Returns to the initial `focus/ready` state and clears the cycle count.
    pub fn reset(&mut self) -> TimerSnapshot {
        self.state = TimerState::initial(&self.config);
        self.snapshot()
    }

    /// Updates the timer configuration, syncing cycle settings and adjusting ready timers.
    pub fn update_config(&mut self, config: TimerConfig) {
        self.config = config;
        self.state.cycles_until_long = self.config.cycles_until_long();
        if self.state.status == Status::Ready {
            let total_ms = self.config.duration_ms(self.state.phase);
            self.state.total_ms = total_ms;
            self.state.remaining_ms = total_ms;
        }
    }

    /// Evaluates the timer, advancing the phase if it expired.
    pub fn tick(&mut self) -> Tick {
        let now = self.clock.now_ms();
        let mut expiration = None;

        if self.state.status == Status::Running
            && let Some(ends_at_ms) = self.state.ends_at_ms
            && now >= ends_at_ms
        {
            let late_ms = now - ends_at_ms;
            let phase_ended = self.state.phase;
            let (next_phase, cycles_done) = match phase_ended {
                Phase::Focus => {
                    let cycles_done = self.state.cycles_done.saturating_add(1);
                    let next_phase = if cycles_done.is_multiple_of(self.config.cycles_until_long())
                    {
                        Phase::LongBreak
                    } else {
                        Phase::ShortBreak
                    };
                    (next_phase, cycles_done)
                }
                Phase::ShortBreak | Phase::LongBreak => (Phase::Focus, self.state.cycles_done),
            };

            self.enter_phase(next_phase, cycles_done);
            expiration = Some(Expiration {
                phase_ended,
                next_phase,
                late_ms,
            });
        }

        Tick {
            snapshot: self.snapshot(),
            expiration,
        }
    }

    /// Builds a snapshot from the current state.
    pub fn snapshot(&self) -> TimerSnapshot {
        let now_ms = self.clock.now_ms();
        TimerSnapshot {
            phase: self.state.phase,
            status: self.state.status,
            ends_at_ms: self.state.ends_at_ms,
            remaining_ms: self.remaining_at(now_ms),
            total_ms: self.state.total_ms,
            cycles_done: self.state.cycles_done,
            cycles_until_long: self.state.cycles_until_long,
            now_ms,
        }
    }

    fn remaining_at(&self, now_ms: u64) -> u64 {
        match self.state.status {
            Status::Running => match self.state.ends_at_ms {
                Some(ends_at_ms) if now_ms < ends_at_ms => {
                    (ends_at_ms - now_ms).min(self.state.total_ms)
                }
                Some(_) => 0,
                None => self.state.remaining_ms.min(self.state.total_ms),
            },
            Status::Ready | Status::Paused => self.state.remaining_ms.min(self.state.total_ms),
        }
    }

    fn enter_phase(&mut self, phase: Phase, cycles_done: u32) {
        let total_ms = self.config.duration_ms(phase);
        let auto_start = match phase {
            Phase::Focus => self.config.auto_start_focus,
            Phase::ShortBreak | Phase::LongBreak => self.config.auto_start_breaks,
        };

        self.state.phase = phase;
        self.state.cycles_done = cycles_done;
        self.state.cycles_until_long = self.config.cycles_until_long();
        self.state.total_ms = total_ms;
        self.state.remaining_ms = total_ms;

        if auto_start {
            let now = self.clock.now_ms();
            self.state.status = Status::Running;
            self.state.ends_at_ms = Some(now.saturating_add(total_ms));
        } else {
            self.state.status = Status::Ready;
            self.state.ends_at_ms = None;
        }
    }

    fn normalize(&mut self) {
        let total_ms = self.config.duration_ms(self.state.phase);
        self.state.total_ms = total_ms;
        self.state.cycles_until_long = self.config.cycles_until_long();

        match self.state.status {
            Status::Ready => {
                self.state.remaining_ms = total_ms;
                self.state.ends_at_ms = None;
            }
            Status::Paused => {
                self.state.remaining_ms = self.state.remaining_ms.min(total_ms);
                self.state.ends_at_ms = None;
            }
            Status::Running => {
                self.state.remaining_ms = self.state.remaining_ms.min(total_ms);
                if self.state.ends_at_ms.is_none() {
                    self.state.status = Status::Paused;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIN: u64 = 60_000;

    fn config() -> TimerConfig {
        TimerConfig {
            focus_ms: 25 * MIN,
            short_break_ms: 5 * MIN,
            long_break_ms: 15 * MIN,
            cycles_until_long: 4,
            auto_start_breaks: false,
            auto_start_focus: false,
        }
    }

    fn timer() -> Timer<ManualClock> {
        Timer::new(config(), ManualClock::new(0))
    }

    #[derive(Clone, Copy)]
    enum Action {
        Start,
        Pause,
        Resume,
        Skip,
        Reset,
        Tick,
    }

    struct Step {
        action: Action,
        advance_ms: u64,
        phase: Phase,
        status: Status,
        remaining_ms: u64,
        cycles_done: u32,
    }

    #[test]
    fn transition_table() {
        let steps = [
            Step {
                action: Action::Start,
                advance_ms: 0,
                phase: Phase::Focus,
                status: Status::Running,
                remaining_ms: 25 * MIN,
                cycles_done: 0,
            },
            Step {
                action: Action::Pause,
                advance_ms: 10 * MIN,
                phase: Phase::Focus,
                status: Status::Paused,
                remaining_ms: 15 * MIN,
                cycles_done: 0,
            },
            Step {
                action: Action::Resume,
                advance_ms: 5 * MIN,
                phase: Phase::Focus,
                status: Status::Running,
                remaining_ms: 15 * MIN,
                cycles_done: 0,
            },
            Step {
                action: Action::Tick,
                advance_ms: 15 * MIN,
                phase: Phase::ShortBreak,
                status: Status::Ready,
                remaining_ms: 5 * MIN,
                cycles_done: 1,
            },
            Step {
                action: Action::Skip,
                advance_ms: 0,
                phase: Phase::Focus,
                status: Status::Ready,
                remaining_ms: 25 * MIN,
                cycles_done: 1,
            },
            Step {
                action: Action::Reset,
                advance_ms: 0,
                phase: Phase::Focus,
                status: Status::Ready,
                remaining_ms: 25 * MIN,
                cycles_done: 0,
            },
        ];

        let mut timer = timer();
        for step in steps {
            timer.clock().advance(step.advance_ms);
            let snapshot = match step.action {
                Action::Start => timer.start(),
                Action::Pause => timer.pause(),
                Action::Resume => timer.resume(),
                Action::Skip => timer.skip(),
                Action::Reset => timer.reset(),
                Action::Tick => timer.tick().snapshot,
            };

            assert_eq!(snapshot.phase, step.phase);
            assert_eq!(snapshot.status, step.status);
            assert_eq!(snapshot.remaining_ms, step.remaining_ms);
            assert_eq!(snapshot.cycles_done, step.cycles_done);
        }
    }

    #[test]
    fn initial_state_is_focus_ready() {
        let timer = timer();
        let snapshot = timer.snapshot();

        assert_eq!(snapshot.phase, Phase::Focus);
        assert_eq!(snapshot.status, Status::Ready);
        assert_eq!(snapshot.remaining_ms, 25 * MIN);
        assert_eq!(snapshot.total_ms, 25 * MIN);
        assert_eq!(snapshot.cycles_done, 0);
        assert_eq!(snapshot.ends_at_ms, None);
        assert_eq!(snapshot.now_ms, 0);
    }

    #[test]
    fn start_sets_running_and_end_time() {
        let mut timer = timer();
        let snapshot = timer.start();

        assert_eq!(snapshot.status, Status::Running);
        assert_eq!(snapshot.ends_at_ms, Some(25 * MIN));
        assert_eq!(snapshot.remaining_ms, 25 * MIN);
    }

    #[test]
    fn pause_and_resume_preserve_remaining() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(10 * MIN);

        let paused = timer.pause();
        assert_eq!(paused.status, Status::Paused);
        assert_eq!(paused.remaining_ms, 15 * MIN);
        assert_eq!(paused.ends_at_ms, None);

        timer.clock().advance(5 * MIN);
        let resumed = timer.resume();
        assert_eq!(resumed.status, Status::Running);
        assert_eq!(resumed.remaining_ms, 15 * MIN);
        assert_eq!(resumed.ends_at_ms, Some(30 * MIN));
    }

    #[test]
    fn tick_before_expiry_does_not_expire() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(25 * MIN - 1_000);

        let tick = timer.tick();
        assert!(tick.expiration.is_none());
        assert_eq!(tick.snapshot.remaining_ms, 1_000);
        assert_eq!(tick.snapshot.status, Status::Running);
    }

    #[test]
    fn expiry_advances_to_short_break_and_counts_cycle() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(25 * MIN);

        let tick = timer.tick();
        let expiration = tick.expiration.expect("focus should expire");
        assert_eq!(expiration.phase_ended, Phase::Focus);
        assert_eq!(expiration.next_phase, Phase::ShortBreak);
        assert_eq!(expiration.late_ms, 0);
        assert!(expiration.should_alert());

        assert_eq!(tick.snapshot.phase, Phase::ShortBreak);
        assert_eq!(tick.snapshot.status, Status::Ready);
        assert_eq!(tick.snapshot.remaining_ms, 5 * MIN);
        assert_eq!(tick.snapshot.cycles_done, 1);
    }

    #[test]
    fn long_break_every_n_cycles() {
        let mut config = config();
        config.cycles_until_long = 2;
        let mut timer = Timer::new(config, ManualClock::new(0));

        timer.start();
        timer.clock().advance(25 * MIN);
        let first = timer.tick();
        assert_eq!(first.snapshot.phase, Phase::ShortBreak);
        assert_eq!(first.snapshot.cycles_done, 1);

        timer.start();
        timer.clock().advance(5 * MIN);
        let back_to_focus = timer.tick();
        assert_eq!(back_to_focus.snapshot.phase, Phase::Focus);
        assert_eq!(back_to_focus.snapshot.cycles_done, 1);

        timer.start();
        timer.clock().advance(25 * MIN);
        let second = timer.tick();
        assert_eq!(second.snapshot.phase, Phase::LongBreak);
        assert_eq!(second.snapshot.cycles_done, 2);
    }

    #[test]
    fn auto_start_breaks_and_focus() {
        let mut config = config();
        config.auto_start_breaks = true;
        config.auto_start_focus = true;
        let mut timer = Timer::new(config, ManualClock::new(0));

        timer.start();
        timer.clock().advance(25 * MIN);
        let break_tick = timer.tick();
        assert_eq!(break_tick.snapshot.phase, Phase::ShortBreak);
        assert_eq!(break_tick.snapshot.status, Status::Running);
        assert_eq!(break_tick.snapshot.ends_at_ms, Some(30 * MIN));

        timer.clock().advance(5 * MIN);
        let focus_tick = timer.tick();
        assert_eq!(focus_tick.snapshot.phase, Phase::Focus);
        assert_eq!(focus_tick.snapshot.status, Status::Running);
        assert_eq!(focus_tick.snapshot.ends_at_ms, Some(55 * MIN));
        assert_eq!(focus_tick.snapshot.cycles_done, 1);
    }

    #[test]
    fn skip_focus_does_not_count_cycle() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(10 * MIN);

        let skipped = timer.skip();
        assert_eq!(skipped.phase, Phase::ShortBreak);
        assert_eq!(skipped.status, Status::Ready);
        assert_eq!(skipped.cycles_done, 0);

        let skipped_break = timer.skip();
        assert_eq!(skipped_break.phase, Phase::Focus);
        assert_eq!(skipped_break.cycles_done, 0);
    }

    #[test]
    fn reset_returns_to_initial_state() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(25 * MIN);
        timer.tick();
        let snapshot = timer.reset();

        assert_eq!(snapshot.phase, Phase::Focus);
        assert_eq!(snapshot.status, Status::Ready);
        assert_eq!(snapshot.remaining_ms, 25 * MIN);
        assert_eq!(snapshot.cycles_done, 0);
        assert_eq!(snapshot.ends_at_ms, None);
    }

    #[test]
    fn clock_moving_back_clamps_remaining_to_total() {
        let clock = ManualClock::new(1_000);
        let mut timer = Timer::new(config(), clock);
        timer.start();
        timer.clock().set(0);

        let snapshot = timer.snapshot();
        assert_eq!(snapshot.remaining_ms, 25 * MIN);
        assert_eq!(snapshot.ends_at_ms, Some(25 * MIN + 1_000));
    }

    #[test]
    fn late_expiration_over_threshold_does_not_alert() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(25 * MIN + 61_000);

        let tick = timer.tick();
        let expiration = tick.expiration.expect("focus should expire");
        assert_eq!(expiration.late_ms, 61_000);
        assert!(!expiration.should_alert());
        assert_eq!(tick.snapshot.phase, Phase::ShortBreak);
        assert_eq!(tick.snapshot.cycles_done, 1);
    }

    #[test]
    fn late_expiration_under_threshold_alerts() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(25 * MIN + 30_000);

        let tick = timer.tick();
        let expiration = tick.expiration.expect("focus should expire");
        assert_eq!(expiration.late_ms, 30_000);
        assert!(expiration.should_alert());
    }

    #[test]
    fn restore_running_state_keeps_remaining() {
        let mut original = timer();
        original.start();
        original.clock().advance(10 * MIN);

        let state_json = serde_json::to_string(original.state()).expect("serialize state");
        let state: TimerState = serde_json::from_str(&state_json).expect("deserialize state");

        let (restored, tick) = Timer::restore(state, config(), ManualClock::new(10 * MIN));
        assert!(tick.expiration.is_none());
        assert_eq!(tick.snapshot.remaining_ms, 15 * MIN);
        assert_eq!(restored.snapshot().status, Status::Running);
    }

    #[test]
    fn restore_running_late_state_advances_without_alert() {
        let mut original = timer();
        original.start();
        let state = original.state().clone();

        let (restored, tick) = Timer::restore(state, config(), ManualClock::new(25 * MIN + 61_000));
        let expiration = tick.expiration.expect("late focus should expire");
        assert_eq!(expiration.late_ms, 61_000);
        assert!(!expiration.should_alert());
        assert_eq!(tick.snapshot.phase, Phase::ShortBreak);
        assert_eq!(tick.snapshot.cycles_done, 1);
        assert_eq!(restored.snapshot().status, Status::Ready);
    }

    #[test]
    fn restore_paused_state_does_not_expire() {
        let mut original = timer();
        original.start();
        original.clock().advance(10 * MIN);
        original.pause();
        let state = original.state().clone();

        let (restored, tick) = Timer::restore(state, config(), ManualClock::new(999 * MIN));
        assert!(tick.expiration.is_none());
        assert_eq!(tick.snapshot.status, Status::Paused);
        assert_eq!(tick.snapshot.remaining_ms, 15 * MIN);
        assert_eq!(restored.snapshot().remaining_ms, 15 * MIN);
    }

    #[test]
    fn restore_ready_state_resets_remaining() {
        let mut state = TimerState::initial(&config());
        state.remaining_ms = 1;
        state.ends_at_ms = Some(123);

        let (restored, tick) = Timer::restore(state, config(), ManualClock::new(0));
        assert!(tick.expiration.is_none());
        assert_eq!(tick.snapshot.status, Status::Ready);
        assert_eq!(tick.snapshot.remaining_ms, 25 * MIN);
        assert_eq!(restored.snapshot().ends_at_ms, None);
    }

    #[test]
    fn start_does_not_restart_running_or_paused_timers() {
        let mut timer = timer();
        timer.start();
        timer.clock().advance(5 * MIN);

        let running = timer.start();
        assert_eq!(running.ends_at_ms, Some(25 * MIN));

        timer.pause();
        let paused = timer.start();
        assert_eq!(paused.status, Status::Paused);
    }

    #[test]
    fn resume_is_noop_when_not_paused() {
        let mut timer = timer();
        let snapshot = timer.resume();

        assert_eq!(snapshot.status, Status::Ready);
        assert_eq!(snapshot.remaining_ms, 25 * MIN);
    }
}
