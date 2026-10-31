#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = pomopet_lib::run() {
        eprintln!("PomoPet failed to start: {error}");
        std::process::exit(1);
    }
}
