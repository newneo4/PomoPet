//! System tray implementation (T1.5).

use tauri::{
    AppHandle, Emitter, Manager,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
};

use pomopet_core::{Phase, Status};

use crate::commands;
use crate::state::AppState;

pub const TRAY_ID: &str = "pomopet-tray";

pub fn build_tray_menu<R: tauri::Runtime>(
    app: &AppHandle<R>,
    is_click_through: bool,
) -> Result<Menu<R>, tauri::Error> {
    let toggle_i = MenuItem::with_id(app, "toggle", "Iniciar / Pausar", true, None::<&str>)?;
    let skip_i = MenuItem::with_id(app, "skip", "Saltar fase", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let panel_i = MenuItem::with_id(app, "panel", "Ajustes...", true, None::<&str>)?;
    let click_through_i = CheckMenuItem::with_id(
        app,
        "click_through",
        "Click-through (atravesar clics)",
        true,
        is_click_through,
        None::<&str>,
    )?;
    let reset_pos_i =
        MenuItem::with_id(app, "reset_pos", "Restablecer posición", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Salir de PomoPet", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &toggle_i,
            &skip_i,
            &sep1,
            &panel_i,
            &click_through_i,
            &reset_pos_i,
            &sep2,
            &quit_i,
        ],
    )
}

pub fn setup_tray(app: &AppHandle) -> Result<TrayIcon, tauri::Error> {
    let is_click_through = app
        .state::<AppState>()
        .settings
        .lock()
        .map(|s| s.click_through)
        .unwrap_or(false);

    let menu = build_tray_menu(app, is_click_through)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("PomoPet")
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    // Left click rescue: if click-through is enabled, clicking the tray icon
                    // immediately restores mouse interaction so the user is never trapped!
                    let state = app.state::<AppState>();
                    let is_click_through = state
                        .settings
                        .lock()
                        .map(|s| s.click_through)
                        .unwrap_or(false);
                    if is_click_through {
                        if let Some(overlay) = app.get_webview_window("overlay") {
                            let _ = overlay.set_ignore_cursor_events(false);
                        }
                        let patch = pomopet_core::SettingsPatch {
                            click_through: Some(false),
                            ..Default::default()
                        };
                        if let Ok(updated) = state.update_settings(&patch) {
                            let _ = app.emit("settings://changed", &updated);
                        }
                        if let Ok(new_menu) = build_tray_menu(app, false) {
                            let _ = tray.set_menu(Some(new_menu));
                        }
                    }

                    if let Some(overlay) = app.get_webview_window("overlay") {
                        let _ = overlay.show();
                        let _ = overlay.set_focus();
                    }
                }
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    // Double click opens the settings panel directly
                    let _ = commands::overlay_open_panel(app.clone(), None);
                }
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)
}

pub fn update_tray_tooltip(app: &AppHandle, phase: Phase, status: Status, remaining_ms: u64) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let remaining_seconds = remaining_ms / 1000;
        let mins = remaining_seconds / 60;
        let secs = remaining_seconds % 60;
        let phase_str = match phase {
            Phase::Focus => "Foco",
            Phase::ShortBreak => "Descanso",
            Phase::LongBreak => "Descanso Largo",
        };
        let status_str = match status {
            Status::Running => "",
            Status::Paused => " (Pausado)",
            Status::Ready => " (Listo)",
        };
        let tip = format!(
            "PomoPet: {} {:02}:{:02}{}",
            phase_str, mins, secs, status_str
        );
        let _ = tray.set_tooltip(Some(tip));
    }
}

pub fn show_overlay_context_menu(
    app: &AppHandle,
    window: &tauri::WebviewWindow,
) -> Result<(), tauri::Error> {
    use tauri::menu::ContextMenu;
    let is_click_through = app
        .state::<AppState>()
        .settings
        .lock()
        .map(|s| s.click_through)
        .unwrap_or(false);

    let toggle_i = MenuItem::with_id(app, "toggle", "Iniciar / Pausar", true, None::<&str>)?;
    let skip_i = MenuItem::with_id(app, "skip", "Saltar fase", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let panel_i = MenuItem::with_id(app, "panel", "Ajustes...", true, None::<&str>)?;
    let click_through_i = CheckMenuItem::with_id(
        app,
        "click_through",
        "Click-through (atravesar clics)",
        true,
        is_click_through,
        None::<&str>,
    )?;
    let reset_pos_i =
        MenuItem::with_id(app, "reset_pos", "Restablecer posición", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Salir de PomoPet", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &toggle_i,
            &skip_i,
            &sep1,
            &panel_i,
            &click_through_i,
            &reset_pos_i,
            &sep2,
            &quit_i,
        ],
    )?;

    menu.popup(window.as_ref().window().clone())?;
    Ok(())
}

pub fn handle_tray_menu_event(app: &AppHandle, id: &str) {
    match id {
        "toggle" => {
            let state = app.state::<AppState>();
            if let Ok(mut timer) = state.timer.lock() {
                let snapshot = match timer.state().status {
                    Status::Running => timer.pause(),
                    Status::Paused => timer.resume(),
                    Status::Ready => timer.start(),
                };
                let _ = state.persist_session(timer.state());
                let _ = app.emit("timer://snapshot", &snapshot);
            }
        }
        "skip" => {
            let state = app.state::<AppState>();
            if let Ok(mut timer) = state.timer.lock() {
                let snapshot = timer.skip();
                let _ = state.persist_session(timer.state());
                let _ = app.emit("timer://snapshot", &snapshot);
            }
        }
        "panel" => {
            let _ = commands::overlay_open_panel(app.clone(), None);
        }
        "click_through" => {
            let state = app.state::<AppState>();
            let current = state
                .settings
                .lock()
                .map(|s| s.click_through)
                .unwrap_or(false);
            let next = !current;
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.set_ignore_cursor_events(next);
            }
            let patch = pomopet_core::SettingsPatch {
                click_through: Some(next),
                ..Default::default()
            };
            if let Ok(updated) = state.update_settings(&patch) {
                let _ = app.emit("settings://changed", &updated);
            }
            if let Some(tray) = app.tray_by_id(TRAY_ID)
                && let Ok(new_menu) = build_tray_menu(app, next)
            {
                let _ = tray.set_menu(Some(new_menu));
            }
        }
        "reset_pos" => {
            let state = app.state::<AppState>();
            let _ = commands::overlay_reset_position(app.clone(), state);
        }
        "quit" => {
            let _ = commands::app_quit(app.clone());
        }
        _ => {}
    }
}
