# PomoPet

Temporizador Pomodoro para Windows 10/11 que vive como una ventana flotante siempre visible
(overlay) con una mascota animada. Mascotas y estilos de reloj son packs de datos intercambiables.

> Estado: **M0 — andamiaje (T0.1)**. El temporizador real se implementa a partir de T1.1.

## Requisitos

- Windows 10 22H2 o Windows 11.
- Rust estable con toolchain MSVC (`rustup default stable-x86_64-pc-windows-msvc`).
- Visual Studio Build Tools con la carga de trabajo **C++**.
- Node.js 20.19+ LTS (recomendado 24).
- pnpm 12 (`npm install -g pnpm`).
- WebView2 Runtime (incluido en Windows 11; en Windows 10 puede requerir instalación).

## Puesta en marcha

```powershell
pnpm install
pnpm tauri dev
```

Esto abre la ventana `overlay` vacía. El panel de ajustes (`panel.html`) se abrirá bajo demanda en
tareas posteriores.

## Comandos

| Comando | Descripción |
|---|---|
| `pnpm tauri dev` | Desarrollo con Tauri + Vite. |
| `pnpm tauri build` | Instaladores (NSIS/MSI). |
| `pnpm dev` | Solo el frontend en `http://localhost:1420`. |
| `pnpm build` | Typecheck + build de producción del frontend. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Vitest. |
| `pnpm format` | Prettier (escribe). |
| `pnpm format:check` | Prettier (solo verifica). |
| `cargo test --workspace` | Pruebas Rust. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint Rust. |
| `cargo fmt --all -- --check` | Formato Rust. |

## Estructura

```
.
├─ overlay.html, panel.html        # entradas multipágina de Vite
├─ src/
│  ├─ windows/{overlay,panel}/     # una entrada main.tsx por ventana
│  └─ lib/                         # ipc, pet, themes, stores, i18n, ui
├─ src-tauri/                      # shell: ventanas, tray, plugins, IPC, capabilities/
├─ crates/
│  ├─ pomopet-core/                # timer + settings (sin Tauri)
│  └─ pomopet-packs/               # packs, catálogo, firmas
├─ schemas/                        # JSON Schema (pet / theme / catalog)
├─ packs/{pets,themes}/            # contenido de fábrica
├─ tools/                          # CLI de packs
├─ fixtures/                       # packs de prueba (incluye hostiles)
└─ docs/                           # contexto, arquitectura, contratos, plan
```

Las carpetas `schemas/`, `packs/`, `tools/` y `fixtures/` se crean en sus tareas (T2.x).

## Documentación

- `docs/PROJECT_CONTEXT.md` — visión, alcance y requisitos.
- `docs/ARCHITECTURE.md` — arquitectura, timer, settings y packs.
- `docs/IPC_CONTRACT.md` — contrato núcleo ⇄ UI.
- `docs/PACK_FORMAT.md` — formato de packs y catálogo.
- `docs/SECURITY.md` — modelo de amenazas y reglas.
- `docs/ROADMAP.md` — plan de trabajo por hitos.
- `docs/agents/` — fichas de los agentes de trabajo.

## Notas de andamiaje

- `identifier` provisional: `com.pomopet.app` (se fija definitivamente antes de M3).
- La ruta de los packs de fábrica (`packs/` vs `resources/packs/`) se unificará en T0.1/T2.x.
- La webview no tiene red ni acceso a archivos; todo pasa por IPC tipado y validado en Rust.
