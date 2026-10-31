//! Core domain for PomoPet: timer state machine and settings.
//!
//! Implemented in T1.1 (`timer`) and T1.2 (`settings`). This crate must not
//! depend on Tauri so it stays fully testable.

pub mod settings;
pub mod timer;

pub use settings::{
    Language, LoadedSettings, OverlayPatch, OverlaySettings, ReducedMotion,
    SETTINGS_SCHEMA_VERSION, Settings, SettingsError, SettingsPatch,
};
pub use timer::{
    Clock, Expiration, LATE_ALERT_THRESHOLD_MS, ManualClock, Phase, Status, SystemClock, Tick,
    Timer, TimerConfig, TimerSnapshot, TimerState,
};

/// Crate identifier, kept stable for diagnostics.
pub const CRATE_NAME: &str = "pomopet-core";

#[cfg(test)]
mod tests {
    use super::CRATE_NAME;

    #[test]
    fn crate_name_is_stable() {
        assert_eq!(CRATE_NAME, "pomopet-core");
    }
}
