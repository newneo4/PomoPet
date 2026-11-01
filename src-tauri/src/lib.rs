//! PomoPet desktop shell.
//!
//! Window management, tray, plugins and IPC wiring live here (see
//! `docs/ARCHITECTURE.md` and `docs/IPC_CONTRACT.md`). Timer and settings
//! logic belong to `pomopet-core`.

pub mod commands;
pub mod content;
pub mod error;
pub mod state;
pub mod tray;

use std::path::PathBuf;
use std::time::Duration;

use pomopet_core::{LoadedSettings, Phase, Settings, Status, SystemClock, Tick, Timer};
use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::state::{AppState, load_session};

/// Builds and runs the Tauri application.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.show();
                let _ = overlay.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .register_asynchronous_uri_scheme_protocol("pack", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let uri = request.uri().to_string();
            std::thread::spawn(move || {
                let response = content::handle_pack_request(&app, &uri);
                responder.respond(response);
            });
        })
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

            // Setup system tray
            let _ = tray::setup_tray(app_handle);

            // Handle initial expiration if restore immediately evaluated an expired session
            if let Some(expiration) = initial_tick.expiration {
                let _ = app_handle.emit("timer://expired", &expiration);
            }

            // Initial tray tooltip
            let snap = initial_tick.snapshot;
            tray::update_tray_tooltip(app_handle, snap.phase, snap.status, snap.remaining_ms);

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

                        // Update tray tooltip on each tick
                        tray::update_tray_tooltip(
                            &handle_clone,
                            tick.snapshot.phase,
                            tick.snapshot.status,
                            tick.snapshot.remaining_ms,
                        );

                        if let Some(expiration) = tick.expiration {
                            let _ = handle_clone.emit("timer://expired", &expiration);

                            // Native OS notification if not late and notify_on_expire is enabled
                            if expiration.late_ms <= 60_000 {
                                let notify = state
                                    .settings
                                    .lock()
                                    .map(|s| s.notify_on_expire)
                                    .unwrap_or(true);
                                if notify {
                                    let (title, body) = match expiration.next_phase {
                                        Phase::Focus => (
                                            "¡Descanso terminado!",
                                            "Hora de concentrarse de nuevo.",
                                        ),
                                        Phase::ShortBreak => (
                                            "¡Foco completado!",
                                            "Tómate un breve descanso de 5 minutos.",
                                        ),
                                        Phase::LongBreak => (
                                            "¡Ciclo completado!",
                                            "¡Gran trabajo! Disfruta tu descanso largo.",
                                        ),
                                    };
                                    let _ = handle_clone
                                        .notification()
                                        .builder()
                                        .title(title)
                                        .body(body)
                                        .show();
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event
                && window.label() == "panel"
            {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .on_menu_event(|app, event| {
            tray::handle_tray_menu_event(app, event.id().as_ref());
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
            commands::overlay_show_context_menu,
            commands::app_quit,
            content::content_list_installed,
            content::content_get_pet_manifest,
            content::content_get_sprite,
            content::content_activate,
        ])
        .run(tauri::generate_context!())
}
