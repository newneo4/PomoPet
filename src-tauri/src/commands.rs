//! IPC commands implementation.

use tauri::{AppHandle, Emitter, Manager, State, Window};

use pomopet_core::{Settings, SettingsPatch, TimerSnapshot};

use crate::error::AppError;
use crate::state::AppState;

/// Helper to ensure a command is only callable from authorized windows.
/// According to IPC_CONTRACT.md, the `overlay` window is forbidden from calling certain commands.
pub fn ensure_not_overlay(window: &Window) -> Result<(), AppError> {
    if window.label() == "overlay" {
        return Err(AppError::invalid_argument("errors.unauthorized_window"));
    }
    Ok(())
}

// ==================== TIMER COMMANDS ====================

#[tauri::command]
pub fn timer_get_state(state: State<'_, AppState>) -> Result<TimerSnapshot, AppError> {
    let timer = state
        .timer
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
    Ok(timer.snapshot())
}

#[tauri::command]
pub fn timer_start(app: AppHandle, state: State<'_, AppState>) -> Result<TimerSnapshot, AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
    let snapshot = timer.start();
    let _ = state.persist_session(timer.state());
    let _ = app.emit("timer://snapshot", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn timer_pause(app: AppHandle, state: State<'_, AppState>) -> Result<TimerSnapshot, AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
    let snapshot = timer.pause();
    let _ = state.persist_session(timer.state());
    let _ = app.emit("timer://snapshot", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn timer_resume(app: AppHandle, state: State<'_, AppState>) -> Result<TimerSnapshot, AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
    let snapshot = timer.resume();
    let _ = state.persist_session(timer.state());
    let _ = app.emit("timer://snapshot", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn timer_skip(app: AppHandle, state: State<'_, AppState>) -> Result<TimerSnapshot, AppError> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
    let snapshot = timer.skip();
    let _ = state.persist_session(timer.state());
    let _ = app.emit("timer://snapshot", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn timer_reset(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TimerSnapshot, AppError> {
    ensure_not_overlay(&window)?;
    let mut timer = state
        .timer
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "timer lock poisoned"))?;
    let snapshot = timer.reset();
    let _ = state.persist_session(timer.state());
    let _ = app.emit("timer://snapshot", &snapshot);
    Ok(snapshot)
}

// ==================== SETTINGS COMMANDS ====================

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> Result<Settings, AppError> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::internal("errors.lock_poisoned", "settings lock poisoned"))?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn settings_update(
    window: Window,
    app: AppHandle,
    state: State<'_, AppState>,
    patch: SettingsPatch,
) -> Result<Settings, AppError> {
    ensure_not_overlay(&window)?;
    let updated = state.update_settings(&patch)?;
    let _ = app.emit("settings://changed", &updated);

    if let Some(autostart) = patch.autostart_with_windows {
        use tauri_plugin_autostart::ManagerExt;
        if autostart {
            let _ = app.autolaunch().enable();
        } else {
            let _ = app.autolaunch().disable();
        }
    }

    if let Some(click_through) = patch.click_through {
        if let Some(overlay) = app.get_webview_window("overlay") {
            let _ = overlay.set_ignore_cursor_events(click_through);
        }
        if let Some(tray) = app.tray_by_id(crate::tray::TRAY_ID)
            && let Ok(new_menu) = crate::tray::build_tray_menu(&app, click_through)
        {
            let _ = tray.set_menu(Some(new_menu));
        }
    }

    Ok(updated)
}

// ==================== OVERLAY & APP COMMANDS ====================

#[tauri::command]
pub fn overlay_set_click_through(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), AppError> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        overlay
            .set_ignore_cursor_events(enabled)
            .map_err(|e| AppError::internal("errors.click_through_failed", e.to_string()))?;
    }

    let patch = SettingsPatch {
        click_through: Some(enabled),
        ..Default::default()
    };
    let updated = state.update_settings(&patch)?;
    let _ = app.emit("settings://changed", &updated);

    if let Some(tray) = app.tray_by_id(crate::tray::TRAY_ID)
        && let Ok(new_menu) = crate::tray::build_tray_menu(&app, enabled)
    {
        let _ = tray.set_menu(Some(new_menu));
    }

    Ok(())
}

#[tauri::command]
pub fn overlay_reset_position(app: AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    if let Some(overlay) = app.get_webview_window("overlay")
        && let Ok(Some(monitor)) = overlay.primary_monitor()
    {
        let screen_size = monitor.size();
        let window_size = overlay
            .outer_size()
            .unwrap_or(tauri::PhysicalSize::new(260, 220));
        let x = screen_size.width as i32 - window_size.width as i32 - 20;
        let y = screen_size.height as i32 - window_size.height as i32 - 60;
        let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            x, y,
        )));

        let patch = SettingsPatch {
            overlay: Some(pomopet_core::OverlayPatch {
                x: Some(x),
                y: Some(y),
                monitor_id: None,
                scale: None,
                opacity: None,
            }),
            ..Default::default()
        };
        let _ = state.update_settings(&patch);
    }
    Ok(())
}

#[tauri::command]
pub fn overlay_show_context_menu(app: AppHandle) -> Result<(), AppError> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = crate::tray::show_overlay_context_menu(&app, &overlay);
    }
    Ok(())
}

#[tauri::command]
pub fn overlay_open_panel(app: AppHandle, tab: Option<String>) -> Result<(), AppError> {
    if let Some(panel) = app.get_webview_window("panel") {
        let _ = panel.unminimize();
        let _ = panel.show();
        let _ = panel.set_always_on_top(true);
        let _ = panel.set_always_on_top(false);
        let _ = panel.set_focus();
    } else {
        #[cfg(dev)]
        let url = tauri::WebviewUrl::External("http://localhost:1420/panel.html".parse().unwrap());
        #[cfg(not(dev))]
        let url = tauri::WebviewUrl::App("panel.html".into());

        let _ = tauri::WebviewWindowBuilder::new(&app, "panel", url)
            .title("PomoPet - Ajustes")
            .inner_size(640.0, 620.0)
            .resizable(true)
            .build()
            .map_err(|e| AppError::internal("errors.panel_open_failed", e.to_string()))?;
    }
    if let Some(tab_name) = tab {
        let _ = app.emit("panel://switch-tab", tab_name);
    }
    Ok(())
}

#[tauri::command]
pub fn app_quit(app: AppHandle) -> Result<(), AppError> {
    app.exit(0);
    Ok(())
}
