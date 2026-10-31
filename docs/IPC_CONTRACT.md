# Contrato IPC (núcleo ⇄ UI)

Fuente de verdad: los tipos Rust. El frontend usa tipos **generados** (`src/lib/ipc/generated/`, `pnpm gen:types`). Este documento describe la intención; si el código y este documento difieren, es un bug: abre PR `contract-change`.

## Reglas
- Todo comando devuelve `Result<T, AppError>`.
- `AppError = { code, message_key, details? }`; `code ∈ invalid_argument | not_found | pack_invalid | pack_too_large | signature_invalid | network | io | internal`.
- El núcleo valida **todos** los argumentos; la UI no es de confianza.
- Permisos por ventana (capabilities de Tauri): `overlay` solo puede lo marcado en la columna *Overlay*; `panel` puede todo. El mecanismo exacto para restringir comandos propios por ventana se confirma en T1.3.

## Tipos principales
```
TimerSnapshot {
  phase: "focus" | "short_break" | "long_break"
  status: "ready" | "running" | "paused"
  endsAtMs: number | null        // epoch UTC; null si no está running
  remainingMs: number
  totalMs: number
  cyclesDone: number
  cyclesUntilLong: number
  nowMs: number                  // reloj del núcleo al emitir
}
Settings        // ver ARCHITECTURE.md §Settings
SettingsPatch   // subconjunto parcial de Settings; se valida y recorta
InstalledPack { kind: "pet"|"theme", id, name, version, author, license, bundled: bool, active: bool, previewUrl }
CatalogEntry  { kind, id, name, version, author, license, sizeBytes, previewUrl, installed: bool, updateAvailable: bool }
```

## Comandos (UI → núcleo)
| Comando | Retorna | Overlay |
|---|---|---|
| `timer_get_state()` | `TimerSnapshot` | ✔ |
| `timer_start()` / `timer_pause()` / `timer_resume()` / `timer_skip()` / `timer_reset()` | `TimerSnapshot` | start, pause, resume, skip |
| `settings_get()` | `Settings` | ✔ |
| `settings_update(patch)` | `Settings` | ✘ |
| `overlay_set_click_through(enabled)` | `()` | ✔ |
| `overlay_reset_position()` | `()` | ✔ |
| `overlay_open_panel(tab?)` | `()` | ✔ |
| `content_list_installed()` | `InstalledPack[]` | ✔ (solo lectura) |
| `content_activate(kind, id)` | `Settings` | ✘ |
| `content_install_from_file(path)` | `InstalledPack` | ✘ |
| `content_uninstall(kind, id)` | `()` | ✘ |
| `catalog_fetch()` | `CatalogEntry[]` | ✘ |
| `catalog_install(kind, id, version)` | `InstalledPack` | ✘ |
| `app_quit()` | `()` | ✔ |

`content_install_from_file` recibe una ruta elegida por el usuario mediante el diálogo del sistema o arrastrar y soltar; el núcleo la trata como entrada no confiable.

## Eventos (núcleo → UI)
| Evento | Payload | Cuándo |
|---|---|---|
| `timer://snapshot` | `TimerSnapshot` | cada transición y ~1 Hz mientras `running` |
| `timer://expired` | `{ phaseEnded, nextPhase, lateMs }` | al expirar; la UI omite la alerta si `lateMs > 60000` |
| `settings://changed` | `Settings` | tras cualquier cambio |
| `content://changed` | `InstalledPack[]` | instalar, quitar, activar, fallback |
| `content://progress` | `{ id, stage, percent }` | descarga/validación/instalación |
| `app://notice` | `{ level, message_key }` | avisos al usuario (p. ej. fallback de pack) |

## Cómo pinta el tiempo la UI
Al recibir cada snapshot, la UI calcula `skew = nowMs - Date.now()`. Mientras `status = running`: `remaining = endsAtMs - (Date.now() + skew)`; en otro caso usa `remainingMs`. El refresco visual es de 1 Hz o menos. Cada snapshot recalibra; la UI no mantiene un contador propio como fuente de verdad.
