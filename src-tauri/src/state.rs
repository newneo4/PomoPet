//! Shared application state and session persistence.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use pomopet_core::{Settings, SettingsPatch, SystemClock, Timer, TimerConfig, TimerState};

use crate::error::AppError;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub timer: Arc<Mutex<Timer<SystemClock>>>,
    pub settings: Arc<Mutex<Settings>>,
    pub session_path: PathBuf,
    pub settings_path: PathBuf,
}

impl AppState {
    /// Creates a new application state.
    pub fn new(
        settings: Settings,
        timer: Timer<SystemClock>,
        session_path: PathBuf,
        settings_path: PathBuf,
    ) -> Self {
        Self {
            timer: Arc::new(Mutex::new(timer)),
            settings: Arc::new(Mutex::new(settings)),
            session_path,
            settings_path,
        }
    }

    /// Persists session state atomically.
    pub fn persist_session(&self, state: &TimerState) -> Result<(), AppError> {
        save_session_atomic(&self.session_path, state)
            .map_err(|e| AppError::io("errors.session_save_failed", e.to_string()))
    }

    /// Applies settings patch, normalizes, updates timer config, and saves atomically.
    pub fn update_settings(&self, patch: &SettingsPatch) -> Result<Settings, AppError> {
        let mut settings_lock = self
            .settings
            .lock()
            .map_err(|_| AppError::internal("errors.lock_poisoned", "settings lock poisoned"))?;

        let updated = settings_lock.apply_patch(patch).normalized();
        updated
            .save(&self.settings_path)
            .map_err(|e| AppError::io("errors.settings_save_failed", e.to_string()))?;

        *settings_lock = updated.clone();

        let timer_config = updated.timer_config();
        let mut timer_lock = self
            .timer
            .lock()
            .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
        timer_lock.update_config(timer_config);

        Ok(updated)
    }
}

/// Atomically writes session.json by writing to a temporary file in the same directory and renaming.
pub fn save_session_atomic(path: &Path, state: &TimerState) -> std::io::Result<()> {
    let json = serde_json::to_vec_pretty(state)?;
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        fs::create_dir_all(parent)?;
    }
    let temp_path = path.with_extension(format!("tmp-{}", std::process::id()));
    fs::write(&temp_path, &json)?;
    fs::rename(&temp_path, path)?;
    Ok(())
}

/// Restores a session from file, or returns default initial state.
pub fn load_session(path: &Path, config: &TimerConfig) -> (TimerState, bool) {
    if let Ok(bytes) = fs::read(path)
        && let Ok(state) = serde_json::from_slice::<TimerState>(&bytes)
    {
        return (state, true);
    }
    (TimerState::initial(config), false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use pomopet_core::{Phase, Status};

    fn test_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("pomopet_test_{}_{}", name, std::process::id()));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn session_persistence_roundtrip() {
        let dir = test_dir("session_roundtrip");
        let session_path = dir.join("session.json");
        let settings_path = dir.join("settings.json");

        let settings = Settings::default();
        let timer = Timer::new(settings.timer_config(), SystemClock);
        let app_state = AppState::new(settings, timer, session_path.clone(), settings_path);

        let initial_state = app_state.timer.lock().unwrap().state().clone();
        app_state.persist_session(&initial_state).unwrap();

        let (loaded_state, has_session) = load_session(
            &session_path,
            &app_state.settings.lock().unwrap().timer_config(),
        );
        assert!(has_session);
        assert_eq!(loaded_state.phase, Phase::Focus);
        assert_eq!(loaded_state.status, Status::Ready);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn update_settings_updates_both_settings_and_timer_config() {
        let dir = test_dir("update_settings");
        let session_path = dir.join("session.json");
        let settings_path = dir.join("settings.json");

        let settings = Settings::default();
        let timer = Timer::new(settings.timer_config(), SystemClock);
        let app_state = AppState::new(settings, timer, session_path, settings_path);

        let patch = SettingsPatch {
            focus_min: Some(50),
            ..Default::default()
        };

        let updated = app_state.update_settings(&patch).unwrap();
        assert_eq!(updated.focus_min, 50);

        let timer_lock = app_state.timer.lock().unwrap();
        assert_eq!(timer_lock.config().focus_ms, 50 * 60_000);
        assert_eq!(timer_lock.state().total_ms, 50 * 60_000);
        assert_eq!(timer_lock.state().remaining_ms, 50 * 60_000);

        let _ = fs::remove_dir_all(&dir);
    }
}
