# AGENTS.md — PomoPet

> Entrada para cualquier agente de código. Es corta a propósito: el detalle vive en `docs/`.
> Si algo aquí contradice un documento de `docs/`, dilo en tu PR; no elijas en silencio.

## Qué es
PomoPet (nombre de trabajo) es un temporizador Pomodoro para Windows 10/11 que vive como una ventana flotante siempre visible (overlay) con una mascota animada. La mascota por defecto es un gato que duerme mientras corre el contador y despierta al llegar a 0. Mascotas y estilos de reloj son **packs de datos** intercambiables, instalables desde archivo o desde un catálogo firmado.

Contexto completo: `docs/PROJECT_CONTEXT.md`.

## Stack (decidido; ver `docs/DECISIONS.md`)
- Shell: Tauri 2 (Rust) + WebView2 del sistema.
- Frontend: React + TypeScript + Vite, multipágina (`overlay.html`, `panel.html`; entradas `src/windows/<ventana>/main.tsx`), gestor `pnpm`, pruebas con Vitest.
- Rust: workspace con `src-tauri/` (shell), `crates/pomopet-core/` (timer + settings), `crates/pomopet-packs/` (packs, catálogo, firmas).
- Sin backend, sin cuentas, sin telemetría.

## Mapa del repositorio
```
pomopet/
├─ AGENTS.md / CLAUDE.md
├─ Cargo.toml                  # workspace Rust
├─ package.json, vite.config.ts, overlay.html, panel.html
├─ src/                        # frontend
│  ├─ windows/{overlay,panel}/
│  └─ lib/{ipc,pet,themes,stores,i18n,ui}/
├─ src-tauri/                  # shell: ventanas, tray, plugins, IPC, capabilities/
├─ crates/
│  ├─ pomopet-core/            # máquina de estados del timer + settings (sin Tauri)
│  └─ pomopet-packs/           # validador, instalador, catálogo, firmas
├─ schemas/                    # pet / theme / catalog (JSON Schema)
├─ packs/{pets,themes}/        # contenido de fábrica
├─ tools/                      # CLI: pack-validate, catalog-build, catalog-sign
├─ fixtures/                   # packs de prueba (incluye maliciosos)
├─ docs/                       # contexto, arquitectura, contratos, plan, agentes
└─ .github/                    # CI y plantilla de PR
```

## Comandos (se crean en T0.1)
```
pnpm install
pnpm tauri dev                                   # desarrollo
pnpm tauri build                                 # instaladores
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all -- --check
pnpm lint && pnpm typecheck && pnpm test         # eslint, tsc --noEmit, vitest
```
Requisitos locales: Rust estable (toolchain MSVC), Node 20+ LTS, pnpm, Visual Studio Build Tools (carga C++), WebView2 Runtime.

## Reglas no negociables
1. El tiempo lo cuenta el núcleo Rust con un `ends_at` absoluto. La UI nunca cuenta; solo pinta.
2. Los packs son datos, nunca código: sin JS, sin SVG, sin ejecutables, sin CSS libre.
3. La webview no tiene red ni acceso a archivos. Todo pasa por comandos IPC tipados y validados en Rust.
4. Los contratos (`docs/IPC_CONTRACT.md`, `docs/PACK_FORMAT.md`, `schemas/`) solo cambian en un PR con etiqueta `contract-change` que actualice docs y esquemas a la vez.
5. No añadas dependencias sin una entrada en `docs/DECISIONS.md` (motivo, licencia, mantenimiento).
6. Prohibido sin justificación revisada por el rol de seguridad: `unsafe`, `dangerouslySetInnerHTML`, `eval`, permisos nuevos en `src-tauri/capabilities/`.
7. Instalación por usuario, sin privilegios de administrador.
8. Cualquier archivo en datos de usuario se escribe de forma atómica (temporal + rename).

## Convenciones
- Documentación en español. Código, identificadores, comentarios y commits en inglés (Conventional Commits).
- Rust: `rustfmt`, `clippy -D warnings`, errores con `thiserror`, sin `unwrap()`/`expect()` fuera de tests.
- TypeScript: `strict`, sin `any`. Los tipos IPC se generan desde Rust; no se escriben a mano.
- React: componentes funcionales y hooks. Toda suscripción a eventos de Tauri se hace en `useEffect` con su cleanup (debe funcionar bajo `StrictMode`). Estado compartido en `src/lib/stores/` con `useSyncExternalStore`; librerías de estado o de i18n solo con ADR.
- Textos de UI solo en `src/lib/i18n/{es,en}.json`.
- Respeta `prefers-reduced-motion` en toda animación.

## Cómo trabajar
1. Lee `docs/agents/README.md` y tu ficha `docs/agents/NN-*.md`.
2. Toma una tarea de `docs/ROADMAP.md` (ID `Tx.y`) con dependencias cerradas.
3. Rama `agent/<rol>/<id-tarea>`; un PR pequeño por tarea.
4. Si un contrato es ambiguo o falta algo: no inventes. Anótalo en el PR y detente.

## Definition of Done (toda tarea)
- Criterios de aceptación de la tarea cumplidos.
- Rust y frontend en verde (tests, clippy, fmt, lint, typecheck).
- Docs y esquemas afectados actualizados en el mismo PR.
- Checklist de seguridad de la plantilla de PR completada.
- Nota de handoff en la descripción del PR.

## Fuera de alcance
Cuentas, pagos, backend, telemetría, macOS/Linux, mascotas con código o scripts, temas con CSS libre.
