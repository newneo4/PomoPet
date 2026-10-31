//! PomoPet desktop shell.
//!
//! Window management, tray, plugins and IPC wiring live here (see
//! `docs/ARCHITECTURE.md` and `docs/IPC_CONTRACT.md`). Timer and settings
//! logic belong to `pomopet-core`.

/// Builds and runs the Tauri application.
pub fn run() -> tauri::Result<()> {
    tauri::Builder::default().run(tauri::generate_context!())
}
