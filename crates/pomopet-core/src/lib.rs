//! Core domain for PomoPet: timer state machine and settings.
//!
//! Implemented in T1.1 (`timer`) and T1.2 (`settings`). This crate must not
//! depend on Tauri so it stays fully testable.

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
