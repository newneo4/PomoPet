//! Type generation for the IPC contract.
//!
//! `pnpm gen:types` runs the ignored `write_generated_types` test to update
//! `src/lib/ipc/generated/`. The default `generated_types_are_up_to_date` test
//! fails when the committed files drift from the Rust types.

use std::fs;
use std::path::{Path, PathBuf};

use ts_rs::{Config, TS};

use crate::settings::{Settings, SettingsPatch};
use crate::timer::{Expiration, TimerSnapshot};

fn repo_generated_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../src/lib/ipc/generated")
}

fn export_all(out_dir: &Path) -> Result<(), ts_rs::ExportError> {
    let config = Config::new().with_out_dir(out_dir).with_large_int("number");

    TimerSnapshot::export_all(&config)?;
    Expiration::export_all(&config)?;
    Settings::export_all(&config)?;
    SettingsPatch::export_all(&config)?;

    Ok(())
}

fn read_types(dir: &Path) -> std::io::Result<Vec<(String, String)>> {
    let mut files = Vec::new();

    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("ts") {
            continue;
        }

        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        files.push((name, fs::read_to_string(path)?));
    }

    files.sort();
    Ok(files)
}

#[test]
#[ignore = "run with pnpm gen:types"]
fn write_generated_types() -> Result<(), Box<dyn std::error::Error>> {
    let out_dir = repo_generated_dir();
    let _ = fs::remove_dir_all(&out_dir);
    fs::create_dir_all(&out_dir)?;
    export_all(&out_dir)?;
    Ok(())
}

#[test]
fn generated_types_are_up_to_date() -> Result<(), Box<dyn std::error::Error>> {
    let temp_dir = std::env::temp_dir().join(format!("pomopet-typegen-{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir)?;

    export_all(&temp_dir)?;
    let generated = read_types(&temp_dir)?;
    let committed = read_types(&repo_generated_dir())?;
    let _ = fs::remove_dir_all(&temp_dir);

    let generated_names: Vec<_> = generated.iter().map(|(name, _)| name.as_str()).collect();
    let committed_names: Vec<_> = committed.iter().map(|(name, _)| name.as_str()).collect();
    assert_eq!(
        generated_names, committed_names,
        "generated file set is stale; run `pnpm gen:types` and commit src/lib/ipc/generated/"
    );

    for ((name, generated), (_, committed)) in generated.iter().zip(&committed) {
        assert_eq!(
            generated, committed,
            "{name} is stale; run `pnpm gen:types` and commit src/lib/ipc/generated/"
        );
    }

    Ok(())
}
