//! Settings v1: validation, clamping, migrations and atomic persistence.
//!
//! Values are validated in Rust; the UI is never trusted. The file is
//! `settings.json` with a `schemaVersion`, and every save writes a temporary
//! file in the same directory, syncs it and renames it into place.

use crate::timer::TimerConfig;
use serde::{Deserialize, Deserializer, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

pub const DEFAULT_FOCUS_MIN: u32 = 25;
pub const DEFAULT_SHORT_BREAK_MIN: u32 = 5;
pub const DEFAULT_LONG_BREAK_MIN: u32 = 15;
pub const DEFAULT_CYCLES_UNTIL_LONG: u32 = 4;
pub const DEFAULT_ALERT_SECONDS: u32 = 8;
pub const DEFAULT_VOLUME: f32 = 0.6;
pub const DEFAULT_OVERLAY_SCALE: f32 = 1.0;
pub const DEFAULT_OVERLAY_OPACITY: f32 = 1.0;
pub const DEFAULT_PET_ID: &str = "gato-clasico";
pub const DEFAULT_THEME_ID: &str = "clasico";

pub const FOCUS_MIN_RANGE: (u32, u32) = (1, 180);
pub const SHORT_BREAK_MIN_RANGE: (u32, u32) = (1, 60);
pub const LONG_BREAK_MIN_RANGE: (u32, u32) = (1, 120);
pub const CYCLES_UNTIL_LONG_RANGE: (u32, u32) = (2, 12);
pub const ALERT_SECONDS_RANGE: (u32, u32) = (3, 60);
pub const VOLUME_RANGE: (f32, f32) = (0.0, 1.0);
pub const OVERLAY_SCALE_RANGE: (f32, f32) = (0.5, 2.0);
pub const OVERLAY_OPACITY_RANGE: (f32, f32) = (0.3, 1.0);

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Settings errors.
#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("settings I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("settings JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid settings path")]
    InvalidPath,
    #[error("invalid settings schemaVersion")]
    InvalidSchemaVersion,
    #[error("unsupported settings schema version {0}")]
    UnsupportedVersion(u64),
}

/// UI language preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Language {
    #[default]
    System,
    Es,
    En,
}

impl<'de> Deserialize<'de> for Language {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        Ok(match raw.as_str() {
            "es" => Self::Es,
            "en" => Self::En,
            _ => Self::System,
        })
    }
}

/// Reduced-motion preference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ReducedMotion {
    #[default]
    System,
    On,
    Off,
}

impl<'de> Deserialize<'de> for ReducedMotion {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        Ok(match raw.as_str() {
            "on" => Self::On,
            "off" => Self::Off,
            _ => Self::System,
        })
    }
}

/// Overlay geometry and appearance.
///
/// `None` coordinates mean the overlay has not been placed yet; the Tauri
/// layer resolves them to the default bottom-right position and validates
/// them against the available monitors (T1.3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OverlaySettings {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub monitor_id: Option<String>,
    pub scale: f32,
    pub opacity: f32,
}

impl Default for OverlaySettings {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            monitor_id: None,
            scale: DEFAULT_OVERLAY_SCALE,
            opacity: DEFAULT_OVERLAY_OPACITY,
        }
    }
}

impl OverlaySettings {
    fn normalize(&mut self) {
        self.scale = clamp_f32(self.scale, OVERLAY_SCALE_RANGE, DEFAULT_OVERLAY_SCALE);
        self.opacity = clamp_f32(self.opacity, OVERLAY_OPACITY_RANGE, DEFAULT_OVERLAY_OPACITY);
        self.monitor_id = sanitize_monitor_id(self.monitor_id.take());
    }
}

/// Persisted settings v1.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub schema_version: u32,
    pub focus_min: u32,
    pub short_break_min: u32,
    pub long_break_min: u32,
    pub cycles_until_long: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
    pub alert_seconds: u32,
    pub sound_enabled: bool,
    pub volume: f32,
    pub notify_on_expire: bool,
    pub autostart_with_windows: bool,
    pub click_through: bool,
    pub overlay: OverlaySettings,
    pub active_pet_id: String,
    pub active_theme_id: String,
    pub language: Language,
    pub reduced_motion: ReducedMotion,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: SETTINGS_SCHEMA_VERSION,
            focus_min: DEFAULT_FOCUS_MIN,
            short_break_min: DEFAULT_SHORT_BREAK_MIN,
            long_break_min: DEFAULT_LONG_BREAK_MIN,
            cycles_until_long: DEFAULT_CYCLES_UNTIL_LONG,
            auto_start_breaks: true,
            auto_start_focus: false,
            alert_seconds: DEFAULT_ALERT_SECONDS,
            sound_enabled: true,
            volume: DEFAULT_VOLUME,
            notify_on_expire: true,
            autostart_with_windows: false,
            click_through: false,
            overlay: OverlaySettings::default(),
            active_pet_id: DEFAULT_PET_ID.to_string(),
            active_theme_id: DEFAULT_THEME_ID.to_string(),
            language: Language::System,
            reduced_motion: ReducedMotion::System,
        }
    }
}

impl Settings {
    /// Clamps every value into its v1 range and restores safe defaults.
    pub fn normalized(mut self) -> Self {
        self.schema_version = SETTINGS_SCHEMA_VERSION;
        self.focus_min = clamp_u32(self.focus_min, FOCUS_MIN_RANGE);
        self.short_break_min = clamp_u32(self.short_break_min, SHORT_BREAK_MIN_RANGE);
        self.long_break_min = clamp_u32(self.long_break_min, LONG_BREAK_MIN_RANGE);
        self.cycles_until_long = clamp_u32(self.cycles_until_long, CYCLES_UNTIL_LONG_RANGE);
        self.alert_seconds = clamp_u32(self.alert_seconds, ALERT_SECONDS_RANGE);
        self.volume = clamp_f32(self.volume, VOLUME_RANGE, DEFAULT_VOLUME);
        self.overlay.normalize();
        self.active_pet_id = sanitize_pack_id(&self.active_pet_id, DEFAULT_PET_ID);
        self.active_theme_id = sanitize_pack_id(&self.active_theme_id, DEFAULT_THEME_ID);
        self
    }

    /// Applies a partial patch and returns normalized settings.
    pub fn apply_patch(&self, patch: &SettingsPatch) -> Self {
        let mut next = self.clone();

        if let Some(value) = patch.focus_min {
            next.focus_min = value;
        }
        if let Some(value) = patch.short_break_min {
            next.short_break_min = value;
        }
        if let Some(value) = patch.long_break_min {
            next.long_break_min = value;
        }
        if let Some(value) = patch.cycles_until_long {
            next.cycles_until_long = value;
        }
        if let Some(value) = patch.auto_start_breaks {
            next.auto_start_breaks = value;
        }
        if let Some(value) = patch.auto_start_focus {
            next.auto_start_focus = value;
        }
        if let Some(value) = patch.alert_seconds {
            next.alert_seconds = value;
        }
        if let Some(value) = patch.sound_enabled {
            next.sound_enabled = value;
        }
        if let Some(value) = patch.volume {
            next.volume = value;
        }
        if let Some(value) = patch.notify_on_expire {
            next.notify_on_expire = value;
        }
        if let Some(value) = patch.autostart_with_windows {
            next.autostart_with_windows = value;
        }
        if let Some(value) = patch.click_through {
            next.click_through = value;
        }
        if let Some(overlay) = &patch.overlay {
            if let Some(value) = overlay.x {
                next.overlay.x = Some(value);
            }
            if let Some(value) = overlay.y {
                next.overlay.y = Some(value);
            }
            if let Some(value) = &overlay.monitor_id {
                next.overlay.monitor_id = Some(value.clone());
            }
            if let Some(value) = overlay.scale {
                next.overlay.scale = value;
            }
            if let Some(value) = overlay.opacity {
                next.overlay.opacity = value;
            }
        }
        if let Some(value) = &patch.active_pet_id {
            next.active_pet_id = value.clone();
        }
        if let Some(value) = &patch.active_theme_id {
            next.active_theme_id = value.clone();
        }
        if let Some(value) = patch.language {
            next.language = value;
        }
        if let Some(value) = patch.reduced_motion {
            next.reduced_motion = value;
        }

        next.normalized()
    }

    /// Builds the timer configuration from settings.
    pub fn timer_config(&self) -> TimerConfig {
        let settings = self.clone().normalized();
        TimerConfig {
            focus_ms: u64::from(settings.focus_min) * 60_000,
            short_break_ms: u64::from(settings.short_break_min) * 60_000,
            long_break_ms: u64::from(settings.long_break_min) * 60_000,
            cycles_until_long: settings.cycles_until_long,
            auto_start_breaks: settings.auto_start_breaks,
            auto_start_focus: settings.auto_start_focus,
        }
    }

    /// Loads settings, migrating v0 and recovering from corrupt files.
    ///
    /// A corrupt file is renamed to `settings.corrupt-<timestamp>.json` and
    /// defaults are returned. A missing file also returns defaults.
    pub fn load(path: impl AsRef<Path>) -> Result<LoadedSettings, SettingsError> {
        let path = path.as_ref();
        let bytes = match fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(LoadedSettings {
                    settings: Self::default(),
                    recovered_from_corrupt: false,
                    corrupt_path: None,
                });
            }
            Err(error) => return Err(error.into()),
        };

        match parse_settings(&bytes) {
            Ok(settings) => Ok(LoadedSettings {
                settings,
                recovered_from_corrupt: false,
                corrupt_path: None,
            }),
            Err(_) => {
                let corrupt_path = rename_corrupt(path)?;
                Ok(LoadedSettings {
                    settings: Self::default(),
                    recovered_from_corrupt: true,
                    corrupt_path: Some(corrupt_path),
                })
            }
        }
    }

    /// Saves a normalized copy atomically and keeps the previous file as `.bak`.
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), SettingsError> {
        let path = path.as_ref();
        let settings = self.clone().normalized();
        let json = serde_json::to_vec_pretty(&settings)?;

        if let Some(parent) = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        {
            fs::create_dir_all(parent)?;
        }

        let temp_path = temp_path_for(path)?;
        let write_result = (|| -> std::io::Result<()> {
            let mut file = fs::File::create(&temp_path)?;
            file.write_all(&json)?;
            file.sync_all()
        })();

        if let Err(error) = write_result {
            let _ = fs::remove_file(&temp_path);
            return Err(error.into());
        }

        let backup_path = backup_path(path)?;
        if path.exists() {
            if backup_path.exists()
                && let Err(error) = fs::remove_file(&backup_path)
            {
                let _ = fs::remove_file(&temp_path);
                return Err(error.into());
            }
            if let Err(error) = fs::rename(path, &backup_path) {
                let _ = fs::remove_file(&temp_path);
                return Err(error.into());
            }
        }

        if let Err(error) = fs::rename(&temp_path, path) {
            if backup_path.exists() {
                let _ = fs::rename(&backup_path, path);
            }
            let _ = fs::remove_file(&temp_path);
            return Err(error.into());
        }

        Ok(())
    }
}

/// Result of loading settings.
#[derive(Debug, Clone, PartialEq)]
pub struct LoadedSettings {
    pub settings: Settings,
    pub recovered_from_corrupt: bool,
    pub corrupt_path: Option<PathBuf>,
}

/// Partial settings update. Unknown fields are rejected.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct SettingsPatch {
    pub focus_min: Option<u32>,
    pub short_break_min: Option<u32>,
    pub long_break_min: Option<u32>,
    pub cycles_until_long: Option<u32>,
    pub auto_start_breaks: Option<bool>,
    pub auto_start_focus: Option<bool>,
    pub alert_seconds: Option<u32>,
    pub sound_enabled: Option<bool>,
    pub volume: Option<f32>,
    pub notify_on_expire: Option<bool>,
    pub autostart_with_windows: Option<bool>,
    pub click_through: Option<bool>,
    pub overlay: Option<OverlayPatch>,
    pub active_pet_id: Option<String>,
    pub active_theme_id: Option<String>,
    pub language: Option<Language>,
    pub reduced_motion: Option<ReducedMotion>,
}

/// Partial overlay update. Unknown fields are rejected.
#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct OverlayPatch {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub monitor_id: Option<String>,
    pub scale: Option<f32>,
    pub opacity: Option<f32>,
}

fn parse_settings(bytes: &[u8]) -> Result<Settings, SettingsError> {
    let mut value: serde_json::Value = serde_json::from_slice(bytes)?;
    let version = match value.get("schemaVersion") {
        None => 0,
        Some(serde_json::Value::Number(number)) => {
            number.as_u64().ok_or(SettingsError::InvalidSchemaVersion)?
        }
        Some(_) => return Err(SettingsError::InvalidSchemaVersion),
    };

    match version {
        0 => {
            let object = value
                .as_object_mut()
                .ok_or(SettingsError::InvalidSchemaVersion)?;
            object.insert(
                "schemaVersion".to_string(),
                serde_json::Value::from(SETTINGS_SCHEMA_VERSION),
            );
        }
        SETTINGS_SCHEMA_VERSION_U64 => {}
        other => return Err(SettingsError::UnsupportedVersion(other)),
    }

    let settings: Settings = serde_json::from_value(value)?;
    Ok(settings.normalized())
}

const SETTINGS_SCHEMA_VERSION_U64: u64 = SETTINGS_SCHEMA_VERSION as u64;

fn temp_path_for(path: &Path) -> Result<PathBuf, SettingsError> {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(SettingsError::InvalidPath)?;
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let pid = std::process::id();
    Ok(parent.join(format!(".{name}.tmp-{pid}-{counter}")))
}

fn backup_path(path: &Path) -> Result<PathBuf, SettingsError> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(SettingsError::InvalidPath)?;
    Ok(path.with_file_name(format!("{name}.bak")))
}

fn rename_corrupt(path: &Path) -> Result<PathBuf, SettingsError> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(SettingsError::InvalidPath)?;
    let stem = Path::new(name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("settings");
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let timestamp = format_utc_timestamp(SystemTime::now());
    let mut candidate = parent.join(format!("{stem}.corrupt-{timestamp}.json"));
    let mut counter = 1;

    while candidate.exists() {
        candidate = parent.join(format!("{stem}.corrupt-{timestamp}-{counter}.json"));
        counter += 1;
    }

    fs::rename(path, &candidate)?;
    Ok(candidate)
}

fn format_utc_timestamp(time: SystemTime) -> String {
    let seconds = time
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let days = i64::try_from(seconds / 86_400).unwrap_or(i64::MAX);
    let seconds_of_day = seconds % 86_400;
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}{month:02}{day:02}-{hour:02}{minute:02}{second:02}")
}

fn civil_from_days(days_since_epoch: i64) -> (i64, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year + 1 } else { year };
    (year, month as u32, day as u32)
}

fn clamp_u32(value: u32, range: (u32, u32)) -> u32 {
    value.clamp(range.0, range.1)
}

fn clamp_f32(value: f32, range: (f32, f32), fallback: f32) -> f32 {
    if value.is_finite() {
        value.clamp(range.0, range.1)
    } else {
        fallback
    }
}

fn sanitize_pack_id(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if is_valid_pack_id(trimmed) {
        trimmed.to_string()
    } else {
        fallback.to_string()
    }
}

fn is_valid_pack_id(value: &str) -> bool {
    if !(3..=48).contains(&value.len()) {
        return false;
    }

    let mut previous_was_hyphen = true;
    for character in value.chars() {
        match character {
            'a'..='z' | '0'..='9' => previous_was_hyphen = false,
            '-' if !previous_was_hyphen => previous_was_hyphen = true,
            _ => return false,
        }
    }

    !previous_was_hyphen
}

fn sanitize_monitor_id(value: Option<String>) -> Option<String> {
    let id = value?;
    let trimmed = id.trim();
    if trimmed.is_empty() || trimmed.len() > 256 || trimmed.chars().any(char::is_control) {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOSTILE_SETTINGS: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../fixtures/settings/hostile.json"
    ));
    const CORRUPT_SETTINGS: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../fixtures/settings/corrupt.json"
    ));

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(name: &str) -> Self {
            let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
            let pid = std::process::id();
            let path =
                std::env::temp_dir().join(format!("pomopet-core-settings-{pid}-{counter}-{name}"));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir_all(&path).expect("create test directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn normalized_with(change: impl FnOnce(&mut Settings)) -> Settings {
        let mut settings = Settings::default();
        change(&mut settings);
        settings.normalized()
    }

    #[test]
    fn defaults_match_architecture() {
        let settings = Settings::default();

        assert_eq!(settings.schema_version, SETTINGS_SCHEMA_VERSION);
        assert_eq!(settings.focus_min, 25);
        assert_eq!(settings.short_break_min, 5);
        assert_eq!(settings.long_break_min, 15);
        assert_eq!(settings.cycles_until_long, 4);
        assert!(settings.auto_start_breaks);
        assert!(!settings.auto_start_focus);
        assert_eq!(settings.alert_seconds, 8);
        assert!(settings.sound_enabled);
        assert_eq!(settings.volume, 0.6);
        assert!(settings.notify_on_expire);
        assert!(!settings.autostart_with_windows);
        assert!(!settings.click_through);
        assert_eq!(settings.overlay.x, None);
        assert_eq!(settings.overlay.y, None);
        assert_eq!(settings.overlay.monitor_id, None);
        assert_eq!(settings.overlay.scale, 1.0);
        assert_eq!(settings.overlay.opacity, 1.0);
        assert_eq!(settings.active_pet_id, "gato-clasico");
        assert_eq!(settings.active_theme_id, "clasico");
        assert_eq!(settings.language, Language::System);
        assert_eq!(settings.reduced_motion, ReducedMotion::System);
    }

    #[test]
    fn normalization_clamps_low_values() {
        let settings = normalized_with(|settings| {
            settings.focus_min = 0;
            settings.short_break_min = 0;
            settings.long_break_min = 0;
            settings.cycles_until_long = 1;
            settings.alert_seconds = 0;
            settings.volume = -1.0;
            settings.overlay.scale = 0.1;
            settings.overlay.opacity = 0.1;
        });

        assert_eq!(settings.focus_min, 1);
        assert_eq!(settings.short_break_min, 1);
        assert_eq!(settings.long_break_min, 1);
        assert_eq!(settings.cycles_until_long, 2);
        assert_eq!(settings.alert_seconds, 3);
        assert_eq!(settings.volume, 0.0);
        assert_eq!(settings.overlay.scale, 0.5);
        assert_eq!(settings.overlay.opacity, 0.3);
    }

    #[test]
    fn normalization_clamps_high_values() {
        let settings = normalized_with(|settings| {
            settings.focus_min = 999;
            settings.short_break_min = 999;
            settings.long_break_min = 999;
            settings.cycles_until_long = 999;
            settings.alert_seconds = 999;
            settings.volume = 2.0;
            settings.overlay.scale = 9.0;
            settings.overlay.opacity = 9.0;
        });

        assert_eq!(settings.focus_min, 180);
        assert_eq!(settings.short_break_min, 60);
        assert_eq!(settings.long_break_min, 120);
        assert_eq!(settings.cycles_until_long, 12);
        assert_eq!(settings.alert_seconds, 60);
        assert_eq!(settings.volume, 1.0);
        assert_eq!(settings.overlay.scale, 2.0);
        assert_eq!(settings.overlay.opacity, 1.0);
    }

    #[test]
    fn normalization_rejects_non_finite_floats() {
        let settings = normalized_with(|settings| {
            settings.volume = f32::NAN;
            settings.overlay.scale = f32::INFINITY;
            settings.overlay.opacity = f32::NEG_INFINITY;
        });

        assert_eq!(settings.volume, DEFAULT_VOLUME);
        assert_eq!(settings.overlay.scale, DEFAULT_OVERLAY_SCALE);
        assert_eq!(settings.overlay.opacity, DEFAULT_OVERLAY_OPACITY);
    }

    #[test]
    fn normalization_sanitizes_pack_ids() {
        let settings = normalized_with(|settings| {
            settings.active_pet_id = "../evil".to_string();
            settings.active_theme_id = "Tema!".to_string();
        });
        assert_eq!(settings.active_pet_id, DEFAULT_PET_ID);
        assert_eq!(settings.active_theme_id, DEFAULT_THEME_ID);

        let settings = normalized_with(|settings| {
            settings.active_pet_id = String::new();
            settings.active_theme_id = "a".repeat(49);
        });
        assert_eq!(settings.active_pet_id, DEFAULT_PET_ID);
        assert_eq!(settings.active_theme_id, DEFAULT_THEME_ID);

        let settings = normalized_with(|settings| {
            settings.active_pet_id = "  gato-clasico  ".to_string();
            settings.active_theme_id = "tema-1".to_string();
        });
        assert_eq!(settings.active_pet_id, "gato-clasico");
        assert_eq!(settings.active_theme_id, "tema-1");
    }

    #[test]
    fn pack_id_validation_matches_schema() {
        let long = "a".repeat(49);

        assert!(is_valid_pack_id("gato-clasico"));
        assert!(is_valid_pack_id("abc"));
        assert!(is_valid_pack_id("a1-b2"));
        assert!(!is_valid_pack_id("ab"));
        assert!(!is_valid_pack_id("Gato"));
        assert!(!is_valid_pack_id("-abc"));
        assert!(!is_valid_pack_id("abc-"));
        assert!(!is_valid_pack_id("abc--def"));
        assert!(!is_valid_pack_id("../evil"));
        assert!(!is_valid_pack_id(&long));
    }

    #[test]
    fn normalization_sanitizes_monitor_id() {
        let settings = normalized_with(|settings| {
            settings.overlay.monitor_id = Some("   ".to_string());
        });
        assert_eq!(settings.overlay.monitor_id, None);

        let settings = normalized_with(|settings| {
            settings.overlay.monitor_id = Some("monitor-1".to_string());
        });
        assert_eq!(settings.overlay.monitor_id.as_deref(), Some("monitor-1"));

        let settings = normalized_with(|settings| {
            settings.overlay.monitor_id = Some("x".repeat(257));
        });
        assert_eq!(settings.overlay.monitor_id, None);
    }

    #[test]
    fn enums_fall_back_to_system_on_unknown_values() {
        let language: Language = serde_json::from_str("\"fr\"").expect("language");
        assert_eq!(language, Language::System);

        let language: Language = serde_json::from_str("\"en\"").expect("language");
        assert_eq!(language, Language::En);

        let motion: ReducedMotion = serde_json::from_str("\"sometimes\"").expect("motion");
        assert_eq!(motion, ReducedMotion::System);

        let motion: ReducedMotion = serde_json::from_str("\"off\"").expect("motion");
        assert_eq!(motion, ReducedMotion::Off);
    }

    #[test]
    fn settings_serialize_with_camel_case_and_schema_version() {
        let json = serde_json::to_value(Settings::default()).expect("serialize settings");

        assert_eq!(json["schemaVersion"], 1);
        assert_eq!(json["focusMin"], 25);
        assert_eq!(json["activePetId"], "gato-clasico");
        assert_eq!(json["overlay"]["monitorId"], serde_json::Value::Null);
        assert_eq!(json["language"], "system");
        assert_eq!(json["reducedMotion"], "system");
    }

    #[test]
    fn patch_applies_and_clamps() {
        let base = Settings::default();
        let patch: SettingsPatch = serde_json::from_str(
            r#"{
                "focusMin": 0,
                "volume": 2,
                "overlay": { "scale": 0.1, "monitorId": "   " },
                "language": "en",
                "activePetId": "../../evil"
            }"#,
        )
        .expect("parse patch");

        let next = base.apply_patch(&patch);

        assert_eq!(next.focus_min, 1);
        assert_eq!(next.volume, 1.0);
        assert_eq!(next.overlay.scale, 0.5);
        assert_eq!(next.overlay.monitor_id, None);
        assert_eq!(next.language, Language::En);
        assert_eq!(next.active_pet_id, DEFAULT_PET_ID);
        assert_eq!(next.short_break_min, base.short_break_min);
    }

    #[test]
    fn patch_rejects_unknown_fields() {
        let result = serde_json::from_str::<SettingsPatch>(r#"{"focusMin":30,"unknown":true}"#);
        assert!(result.is_err());

        let result =
            serde_json::from_str::<SettingsPatch>(r#"{"overlay":{"scale":1.5,"unknown":true}}"#);
        assert!(result.is_err());
    }

    #[test]
    fn patch_only_changes_present_fields() {
        let base = Settings::default();
        let patch: SettingsPatch =
            serde_json::from_str(r#"{"focusMin":50,"overlay":{"scale":1.5}}"#)
                .expect("parse patch");

        let next = base.apply_patch(&patch);

        assert_eq!(next.focus_min, 50);
        assert_eq!(next.overlay.scale, 1.5);
        assert_eq!(next.short_break_min, base.short_break_min);
        assert_eq!(next.overlay.opacity, base.overlay.opacity);
    }

    #[test]
    fn load_missing_file_returns_defaults() {
        let dir = TempDir::new("missing");
        let path = dir.path().join("settings.json");

        let loaded = Settings::load(&path).expect("load settings");

        assert_eq!(loaded.settings, Settings::default());
        assert!(!loaded.recovered_from_corrupt);
        assert_eq!(loaded.corrupt_path, None);
        assert!(!path.exists());
    }

    #[test]
    fn load_corrupt_json_renames_file_and_uses_defaults() {
        let dir = TempDir::new("corrupt");
        let path = dir.path().join("settings.json");
        fs::write(&path, CORRUPT_SETTINGS).expect("write corrupt settings");

        let loaded = Settings::load(&path).expect("load corrupt settings");

        assert!(loaded.recovered_from_corrupt);
        assert_eq!(loaded.settings, Settings::default());
        assert!(!path.exists());

        let corrupt_path = loaded.corrupt_path.expect("corrupt path");
        assert!(corrupt_path.exists());
        let name = corrupt_path
            .file_name()
            .and_then(|name| name.to_str())
            .expect("corrupt file name");
        assert!(name.starts_with("settings.corrupt-"));
        assert!(name.ends_with(".json"));
        assert_eq!(
            fs::read_to_string(&corrupt_path).expect("read corrupt file"),
            CORRUPT_SETTINGS
        );
    }

    #[test]
    fn load_hostile_values_are_clamped() {
        let dir = TempDir::new("hostile");
        let path = dir.path().join("settings.json");
        fs::write(&path, HOSTILE_SETTINGS).expect("write hostile settings");

        let loaded = Settings::load(&path).expect("load hostile settings");
        assert!(!loaded.recovered_from_corrupt);
        assert_eq!(loaded.corrupt_path, None);

        let settings = loaded.settings;
        assert_eq!(settings.focus_min, 1);
        assert_eq!(settings.short_break_min, 60);
        assert_eq!(settings.long_break_min, 1);
        assert_eq!(settings.cycles_until_long, 2);
        assert_eq!(settings.alert_seconds, 60);
        assert_eq!(settings.volume, 1.0);
        assert_eq!(settings.overlay.x, Some(i32::MAX));
        assert_eq!(settings.overlay.y, Some(i32::MIN));
        assert_eq!(settings.overlay.monitor_id, None);
        assert_eq!(settings.overlay.scale, 0.5);
        assert_eq!(settings.overlay.opacity, 1.0);
        assert_eq!(settings.active_pet_id, DEFAULT_PET_ID);
        assert_eq!(settings.active_theme_id, DEFAULT_THEME_ID);
        assert_eq!(settings.language, Language::System);
        assert_eq!(settings.reduced_motion, ReducedMotion::System);
    }

    #[test]
    fn load_missing_schema_version_migrates_to_v1() {
        let dir = TempDir::new("migrate");
        let path = dir.path().join("settings.json");
        fs::write(&path, r#"{ "focusMin": 50 }"#).expect("write v0 settings");

        let loaded = Settings::load(&path).expect("load v0 settings");

        assert!(!loaded.recovered_from_corrupt);
        assert_eq!(loaded.settings.schema_version, SETTINGS_SCHEMA_VERSION);
        assert_eq!(loaded.settings.focus_min, 50);
        assert_eq!(loaded.settings.short_break_min, DEFAULT_SHORT_BREAK_MIN);
    }

    #[test]
    fn load_newer_schema_version_is_preserved_as_corrupt() {
        let dir = TempDir::new("newer");
        let path = dir.path().join("settings.json");
        fs::write(&path, r#"{ "schemaVersion": 2, "focusMin": 50 }"#).expect("write v2 settings");

        let loaded = Settings::load(&path).expect("load v2 settings");

        assert!(loaded.recovered_from_corrupt);
        assert_eq!(loaded.settings, Settings::default());
        assert!(!path.exists());
        let corrupt_path = loaded.corrupt_path.expect("corrupt path");
        let preserved = fs::read_to_string(&corrupt_path).expect("read corrupt file");
        assert!(preserved.contains("\"schemaVersion\": 2"));
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = TempDir::new("round-trip");
        let path = dir.path().join("settings.json");
        let settings = normalized_with(|settings| {
            settings.focus_min = 50;
            settings.overlay.monitor_id = Some("monitor-1".to_string());
            settings.language = Language::En;
        });

        settings.save(&path).expect("save settings");
        let loaded = Settings::load(&path).expect("load settings");

        assert!(!loaded.recovered_from_corrupt);
        assert_eq!(loaded.corrupt_path, None);
        assert_eq!(loaded.settings, settings);
    }

    #[test]
    fn save_keeps_previous_file_as_backup() {
        let dir = TempDir::new("backup");
        let path = dir.path().join("settings.json");
        let mut settings = Settings {
            focus_min: 30,
            ..Settings::default()
        };
        settings.save(&path).expect("first save");

        let backup_path = path.with_file_name("settings.json.bak");
        assert!(!backup_path.exists());

        settings.focus_min = 40;
        settings.save(&path).expect("second save");

        assert!(backup_path.exists());
        let backup: Settings =
            serde_json::from_slice(&fs::read(&backup_path).expect("read backup"))
                .expect("parse backup");
        assert_eq!(backup.focus_min, 30);

        let current: Settings =
            serde_json::from_slice(&fs::read(&path).expect("read current")).expect("parse current");
        assert_eq!(current.focus_min, 40);

        let temp_files = fs::read_dir(dir.path())
            .expect("read test directory")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp-"))
            .count();
        assert_eq!(temp_files, 0);
    }

    #[test]
    fn save_creates_parent_directories() {
        let dir = TempDir::new("nested");
        let path = dir.path().join("nested").join("settings.json");

        Settings::default().save(&path).expect("save settings");

        assert!(path.exists());
    }

    #[test]
    fn timer_config_uses_settings() {
        let settings = normalized_with(|settings| {
            settings.focus_min = 50;
            settings.short_break_min = 10;
            settings.long_break_min = 30;
            settings.cycles_until_long = 3;
            settings.auto_start_breaks = false;
            settings.auto_start_focus = true;
        });

        let config = settings.timer_config();

        assert_eq!(config.focus_ms, 50 * 60_000);
        assert_eq!(config.short_break_ms, 10 * 60_000);
        assert_eq!(config.long_break_ms, 30 * 60_000);
        assert_eq!(config.cycles_until_long, 3);
        assert!(!config.auto_start_breaks);
        assert!(config.auto_start_focus);
    }

    #[test]
    fn timer_config_normalizes_untrusted_settings() {
        let settings = Settings {
            focus_min: 0,
            cycles_until_long: 1,
            ..Settings::default()
        };

        let config = settings.timer_config();

        assert_eq!(config.focus_ms, 60_000);
        assert_eq!(config.cycles_until_long, 2);
    }

    #[test]
    fn timestamp_is_utc_and_sortable() {
        assert_eq!(format_utc_timestamp(UNIX_EPOCH), "19700101-000000");
        assert_eq!(
            format_utc_timestamp(UNIX_EPOCH + std::time::Duration::from_secs(86_400)),
            "19700102-000000"
        );
        assert_eq!(
            format_utc_timestamp(UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000)),
            "20231114-221320"
        );
    }
}
