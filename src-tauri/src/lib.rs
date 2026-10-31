//! PomoPet desktop shell.
//!
//! Window management, tray, plugins and IPC wiring live here (see
//! `docs/ARCHITECTURE.md` and `docs/IPC_CONTRACT.md`). Timer and settings
//! logic belong to `pomopet-core`.

pub mod commands;
pub mod error;
pub mod state;

use std::path::PathBuf;
use std::time::Duration;

use pomopet_core::{LoadedSettings, Settings, Status, SystemClock, Tick, Timer};
use tauri::{Emitter, Manager};

use crate::state::{AppState, load_session};

/// Builds and runs the Tauri application.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let settings_path = app_data_dir.join("settings.json");
            let session_path = app_data_dir.join("session.json");

            let loaded = Settings::load(&settings_path).unwrap_or_else(|_| LoadedSettings {
                settings: Settings::default(),
                recovered_from_corrupt: false,
                corrupt_path: None,
            });
            let settings = loaded.settings;
            let timer_config = settings.timer_config();

            let (session_state, has_session) = load_session(&session_path, &timer_config);
            let (timer, initial_tick) = if has_session {
                Timer::restore(session_state, timer_config, SystemClock)
            } else {
                let t = Timer::new(timer_config, SystemClock);
                let tick = Tick {
                    snapshot: t.snapshot(),
                    expiration: None,
                };
                (t, tick)
            };

            let app_state = AppState::new(settings, timer, session_path, settings_path);
            app.manage(app_state);

            // Handle initial expiration if restore immediately evaluated an expired session
            if let Some(expiration) = initial_tick.expiration {
                let _ = app_handle.emit("timer://expired", &expiration);
            }

            // Spawn background tick task (~1 Hz) for running timers
            let handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_millis(1000)).await;
                    let state = handle_clone.state::<AppState>();
                    let mut tick_result = None;

                    if let Ok(mut timer) = state.timer.lock()
                        && timer.state().status == Status::Running
                    {
                        let tick = timer.tick();
                        tick_result = Some((tick, timer.state().clone()));
                    }

                    if let Some((tick, timer_state)) = tick_result {
                        let _ = state.persist_session(&timer_state);
                        let _ = handle_clone.emit("timer://snapshot", &tick.snapshot);
                        if let Some(expiration) = tick.expiration {
                            let _ = handle_clone.emit("timer://expired", &expiration);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::timer_get_state,
            commands::timer_start,
            commands::timer_pause,
            commands::timer_resume,
            commands::timer_skip,
            commands::timer_reset,
            commands::settings_get,
            commands::settings_update,
            commands::overlay_set_click_through,
            commands::overlay_reset_position,
            commands::overlay_open_panel,
            commands::app_quit,
        ])
        .run(tauri::generate_context!())
}
