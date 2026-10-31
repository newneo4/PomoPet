//! Pack validation, installation, catalog and signatures for PomoPet.
//!
//! Implemented from T2.1 onward. Packs are data, never code: no JS, SVG,
//! executables or free-form CSS.

/// Crate identifier, kept stable for diagnostics.
pub const CRATE_NAME: &str = "pomopet-packs";

#[cfg(test)]
mod tests {
    use super::CRATE_NAME;

    #[test]
    fn crate_name_is_stable() {
        assert_eq!(CRATE_NAME, "pomopet-packs");
    }
}
