//! Content protocol and commands (T2.4).
//!
//! Registers the `pack://` custom URI scheme and serves verified pack assets.

use std::fs;
use std::path::PathBuf;

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
    pub states: std::collections::HashMap<String, PetStateConfig>,
}

fn default_render() -> String {
    "smooth".to_string()
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

    // 1. Check workspace/dev `packs/` directory
    let dev_path = PathBuf::from("packs").join(clean);
    if dev_path.is_file() {
        return Some(dev_path);
    }

    // 2. Check bundled resources directory
    if let Ok(resource_dir) = app.path().resource_dir() {
        let res_path = resource_dir.join("packs").join(clean);
        if res_path.is_file() {
            return Some(res_path);
        }
    }

    // 3. Check user app_data packs directory
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

    let path_str = uri.path();
    let Some(file_path) = resolve_pack_asset(app, path_str) else {
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

    let mut packs = Vec::new();

    // Check built-in pets
    for pet_id in &["gato-clasico", "nano-panda"] {
        let manifest_path = format!("pets/{}/pet.json", pet_id);
        if let Some(file_path) = resolve_pack_asset(&app, &manifest_path)
            && let Ok(content) = fs::read_to_string(&file_path)
            && let Ok(manifest) = serde_json::from_str::<PetManifest>(&content)
        {
            packs.push(InstalledPack {
                kind: "pet".to_string(),
                id: manifest.id.clone(),
                name: manifest.name,
                version: manifest.version,
                author: manifest.author,
                license: manifest.license,
                bundled: true,
                active: manifest.id == active_pet_id,
                preview_url: format!("http://pack.localhost/pets/{}/preview.png", manifest.id),
            });
        }
    }

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
    if resolve_pack_asset(&app, &manifest_path).is_none() {
        return Err(AppError::not_found("errors.pack_not_found"));
    }

    let patch = pomopet_core::SettingsPatch {
        active_pet_id: Some(id),
        ..Default::default()
    };

    let updated = state.update_settings(&patch)?;
    let _ = app.emit("settings://changed", &updated);
    let _ = app.emit("content://changed", ());
    Ok(updated)
}
