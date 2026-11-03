//! Content protocol and commands (T2.4).
//!
//! Registers the `pack://` custom URI scheme and serves verified pack assets.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use pomopet_core::Settings;
use serde::{Deserialize, Serialize};
use tauri::http::{Response, StatusCode};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPack {
    pub kind: String,
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub license: String,
    pub bundled: bool,
    pub active: bool,
    pub preview_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetStateConfig {
    pub sheet: String,
    pub frames: u32,
    #[serde(default)]
    pub columns: Option<u32>,
    pub mode: String,
    #[serde(default)]
    pub fps: Option<u32>,
    #[serde(default)]
    pub loop_start: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PetDialogueCategory {
    #[serde(default)]
    pub focus_start: Vec<String>,
    #[serde(default)]
    pub break_start: Vec<String>,
    #[serde(default)]
    pub alert: Vec<String>,
    #[serde(default)]
    pub poke: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetClockProgress {
    pub r#type: String, // "horizontal-bar" | "vertical-bar"
    #[serde(default)]
    pub inset: Option<[u32; 4]>,
    #[serde(default)]
    pub color_focus: Option<String>,
    #[serde(default)]
    pub color_break: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetClockTokens {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub accent: Option<String>,
    #[serde(default)]
    pub accent_break: Option<String>,
    #[serde(default)]
    pub background: Option<String>,
    #[serde(default)]
    pub radius: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetClockConfig {
    pub mode: String, // "native" | "skinned"
    #[serde(default)]
    pub layout: Option<String>,
    #[serde(default)]
    pub tokens: Option<PetClockTokens>,
    #[serde(default)]
    pub size: Option<[u32; 2]>,
    #[serde(default)]
    pub frame_asset: Option<String>,
    #[serde(default)]
    pub progress: Option<PetClockProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetManifest {
    pub schema: u32,
    pub r#type: String,
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub license: String,
    #[serde(default)]
    pub description: Option<String>,
    pub frame_size: [u32; 2],
    #[serde(default = "default_render")]
    pub render: String,
    pub states: HashMap<String, PetStateConfig>,
    #[serde(default)]
    pub dialogues: Option<HashMap<String, PetDialogueCategory>>,
    #[serde(default)]
    pub particles: Option<Vec<String>>,
    #[serde(default)]
    pub clock: Option<PetClockConfig>,
}

fn default_render() -> String {
    "smooth".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackFileEntry {
    pub relative_path: String,
    pub data_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPetPackPayload {
    pub files: Vec<PackFileEntry>,
}

/// Helper to resolve a pack asset path on disk safely, preventing directory traversal.
pub fn resolve_pack_asset(app: &AppHandle, relative_path: &str) -> Option<PathBuf> {
    // Sanitize path against directory traversal
    let clean = relative_path
        .trim_start_matches('/')
        .trim_start_matches("localhost/")
        .trim_start_matches('/');

    if clean.contains("..") || clean.contains('\\') || clean.contains(':') {
        return None;
    }

    // Search locations in priority order:
    // 1. Compile-time workspace root (always resolves to workspace /packs in dev/test)
    if let Some(parent) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
        let p = parent.join("packs").join(clean);
        if p.is_file() {
            return Some(p);
        }
    }

    // 2. Relative to current dir (running from root or src-tauri)
    let p_local = PathBuf::from("packs").join(clean);
    if p_local.is_file() {
        return Some(p_local);
    }

    let p_parent = PathBuf::from("../packs").join(clean);
    if p_parent.is_file() {
        return Some(p_parent);
    }

    // 3. Bundled resources directory in release build
    if let Ok(resource_dir) = app.path().resource_dir() {
        let res_path = resource_dir.join("packs").join(clean);
        if res_path.is_file() {
            return Some(res_path);
        }
    }

    // 4. User app_data packs directory for installed packs
    if let Ok(app_data) = app.path().app_data_dir() {
        let user_path = app_data.join("packs").join(clean);
        if user_path.is_file() {
            return Some(user_path);
        }
    }

    None
}

/// Handler for `pack://` and `http://pack.localhost/` protocol requests.
pub fn handle_pack_request(app: &AppHandle, uri_str: &str) -> Response<Vec<u8>> {
    let Ok(uri) = uri_str.parse::<tauri::http::Uri>() else {
        return Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(Vec::new())
            .unwrap();
    };

    let host = uri.host().unwrap_or("");
    let path = uri.path();
    let relative_path = if host != "localhost" && host != "pack.localhost" && !host.is_empty() {
        format!("{}/{}", host, path.trim_start_matches('/'))
    } else {
        path.trim_start_matches('/').to_string()
    };

    let Some(file_path) = resolve_pack_asset(app, &relative_path) else {
        eprintln!("[PomoPet Pack Protocol] File not found: {}", relative_path);
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header("Access-Control-Allow-Origin", "*")
            .body(Vec::new())
            .unwrap();
    };

    let mime = match file_path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("json") => "application/json",
        Some("ogg") => "audio/ogg",
        Some("woff2") => "font/woff2",
        _ => {
            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header("Access-Control-Allow-Origin", "*")
                .body(Vec::new())
                .unwrap();
        }
    };

    match fs::read(&file_path) {
        Ok(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", mime)
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "public, max-age=3600")
            .body(bytes)
            .unwrap(),
        Err(_) => Response::builder()
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .header("Access-Control-Allow-Origin", "*")
            .body(Vec::new())
            .unwrap(),
    }
}

// ==================== CONTENT IPC COMMANDS ====================

fn scan_pets_dir(
    dir: &Path,
    bundled: bool,
    active_pet_id: &str,
    packs_map: &mut HashMap<String, InstalledPack>,
) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("pet.json");
        if !manifest_path.is_file() {
            continue;
        }

        let Ok(content) = fs::read_to_string(&manifest_path) else {
            continue;
        };

        let Ok(manifest) = serde_json::from_str::<PetManifest>(&content) else {
            continue;
        };

        let id = manifest.id.clone();
        if packs_map.contains_key(&id) && !bundled {
            // User packs can override bundled ones
        } else if packs_map.contains_key(&id) {
            continue;
        }

        let preview_url = if path.join("preview.webp").is_file() {
            format!("pack://localhost/pets/{}/preview.webp", id)
        } else {
            format!("pack://localhost/pets/{}/preview.png", id)
        };

        packs_map.insert(
            id.clone(),
            InstalledPack {
                kind: "pet".to_string(),
                id: id.clone(),
                name: manifest.name,
                version: manifest.version,
                author: manifest.author,
                license: manifest.license,
                bundled,
                active: id == active_pet_id,
                preview_url,
            },
        );
    }
}

#[tauri::command]
pub fn content_list_installed(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<InstalledPack>, AppError> {
    let active_pet_id = state
        .settings
        .lock()
        .map(|s| s.active_pet_id.clone())
        .unwrap_or_else(|_| "gato-clasico".to_string());

    let mut packs_map = HashMap::new();

    // 1. Scan bundled / workspace paths
    if let Some(parent) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
        let p = parent.join("packs").join("pets");
        scan_pets_dir(&p, true, &active_pet_id, &mut packs_map);
    }

    scan_pets_dir(
        &PathBuf::from("packs/pets"),
        true,
        &active_pet_id,
        &mut packs_map,
    );
    scan_pets_dir(
        &PathBuf::from("../packs/pets"),
        true,
        &active_pet_id,
        &mut packs_map,
    );

    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("packs").join("pets");
        scan_pets_dir(&p, true, &active_pet_id, &mut packs_map);
    }

    // 2. Scan user app_data directory
    if let Ok(app_data) = app.path().app_data_dir() {
        let user_pets = app_data.join("packs").join("pets");
        scan_pets_dir(&user_pets, false, &active_pet_id, &mut packs_map);
    }

    let mut packs: Vec<InstalledPack> = packs_map.into_values().collect();
    packs.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(packs)
}

#[tauri::command]
pub fn content_get_pet_manifest(app: AppHandle, pet_id: String) -> Result<PetManifest, AppError> {
    let manifest_path = format!("pets/{}/pet.json", pet_id);
    let Some(file_path) = resolve_pack_asset(&app, &manifest_path) else {
        return Err(AppError::not_found("errors.pack_not_found"));
    };

    let content = fs::read_to_string(&file_path)
        .map_err(|e| AppError::io("errors.read_failed", e.to_string()))?;

    let manifest = serde_json::from_str::<PetManifest>(&content)
        .map_err(|e| AppError::invalid_argument(format!("invalid manifest: {}", e)))?;

    Ok(manifest)
}

#[tauri::command]
pub fn content_get_sprite(
    app: AppHandle,
    pet_id: String,
    sheet: String,
) -> Result<String, AppError> {
    let relative = format!("pets/{}/{}", pet_id, sheet.trim_start_matches('/'));
    let Some(file_path) = resolve_pack_asset(&app, &relative) else {
        return Err(AppError::not_found("errors.asset_not_found"));
    };

    let bytes =
        fs::read(&file_path).map_err(|e| AppError::io("errors.read_failed", e.to_string()))?;

    let mime = if relative.ends_with(".webp") {
        "image/webp"
    } else {
        "image/png"
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
pub fn content_activate(
    app: AppHandle,
    state: State<'_, AppState>,
    kind: String,
    id: String,
) -> Result<Settings, AppError> {
    if kind != "pet" {
        return Err(AppError::invalid_argument("errors.unsupported_pack_kind"));
    }

    let manifest_path = format!("pets/{}/pet.json", id);
    let Some(file_path) = resolve_pack_asset(&app, &manifest_path) else {
        return Err(AppError::not_found("errors.pack_not_found"));
    };

    let manifest_opt: Option<PetManifest> = fs::read_to_string(&file_path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok());

    let mut patch = pomopet_core::SettingsPatch {
        active_pet_id: Some(id),
        ..Default::default()
    };

    // If the pet defines a custom clock, activate its clock automatically!
    // If it does not define a custom clock, active_theme_id is unchanged (retaining the app's current clock).
    if let Some(m) = manifest_opt
        && let Some(clk) = m.clock
    {
        if clk.mode == "skinned" {
            patch.active_theme_id = Some("pet-skinned".to_string());
        } else if clk.mode == "native"
            && let Some(layout) = clk.layout
        {
            patch.active_theme_id = Some(layout);
        }
    }

    let updated = state.update_settings(&patch)?;
    let _ = app.emit("settings://changed", &updated);
    let _ = app.emit("content://changed", ());
    Ok(updated)
}

#[tauri::command]
pub fn content_install_pack(
    app: AppHandle,
    payload: InstallPetPackPayload,
) -> Result<InstalledPack, AppError> {
    let manifest_entry = payload
        .files
        .iter()
        .find(|f| {
            f.relative_path == "pet.json"
                || f.relative_path.ends_with("/pet.json")
                || f.relative_path.ends_with("\\pet.json")
        })
        .ok_or_else(|| AppError::invalid_argument("errors.missing_manifest"))?;

    let manifest_bytes = base64::engine::general_purpose::STANDARD
        .decode(&manifest_entry.data_base64)
        .map_err(|e| AppError::invalid_argument(format!("invalid base64 in pet.json: {}", e)))?;

    let manifest: PetManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| AppError::invalid_argument(format!("invalid pet.json: {}", e)))?;

    if manifest.r#type != "pet" {
        return Err(AppError::invalid_argument("errors.invalid_pack_type"));
    }

    let id = manifest.id.trim().to_lowercase();
    if id.len() < 3
        || id.len() > 48
        || !id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(AppError::invalid_argument("errors.invalid_pack_id"));
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::internal("errors.app_data_unavailable", e.to_string()))?;

    let target_dir = app_data.join("packs").join("pets").join(&id);
    let tmp_dir = app_data.join("tmp").join(format!("pack-{}", &id));

    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(&tmp_dir);
    }
    fs::create_dir_all(&tmp_dir)
        .map_err(|e| AppError::io("errors.create_tmp_failed", e.to_string()))?;

    for file in &payload.files {
        let clean = file
            .relative_path
            .replace('\\', "/")
            .trim_start_matches('/')
            .to_string();

        if clean.contains("..") || clean.contains(':') {
            let _ = fs::remove_dir_all(&tmp_dir);
            return Err(AppError::invalid_argument("errors.unsafe_file_path"));
        }

        let ext = Path::new(&clean)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match ext {
            "json" | "png" | "webp" | "ogg" | "txt" | "md" | "" => {}
            _ => {
                let _ = fs::remove_dir_all(&tmp_dir);
                return Err(AppError::invalid_argument(
                    "errors.unsupported_file_extension",
                ));
            }
        }

        let file_bytes = base64::engine::general_purpose::STANDARD
            .decode(&file.data_base64)
            .map_err(|e| {
                AppError::invalid_argument(format!("invalid base64 in {}: {}", clean, e))
            })?;

        if file_bytes.len() > 2 * 1024 * 1024 {
            let _ = fs::remove_dir_all(&tmp_dir);
            return Err(AppError::invalid_argument("errors.file_too_large"));
        }

        let dest = tmp_dir.join(&clean);
        if let Some(parent) = dest.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&dest, &file_bytes)
            .map_err(|e| AppError::io("errors.write_failed", e.to_string()))?;
    }

    if target_dir.exists() {
        let _ = fs::remove_dir_all(&target_dir);
    }
    if let Some(parent) = target_dir.parent() {
        let _ = fs::create_dir_all(parent);
    }

    fs::rename(&tmp_dir, &target_dir)
        .map_err(|e| AppError::io("errors.install_failed", e.to_string()))?;

    let preview_url = if target_dir.join("preview.webp").is_file() {
        format!("pack://localhost/pets/{}/preview.webp", id)
    } else {
        format!("pack://localhost/pets/{}/preview.png", id)
    };

    let installed = InstalledPack {
        kind: "pet".to_string(),
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author: manifest.author,
        license: manifest.license,
        bundled: false,
        active: false,
        preview_url,
    };

    let _ = app.emit("content://changed", ());
    Ok(installed)
}
