# A5 · Release y CI

## Misión
Andamiaje del repo, CI, empaquetado, actualizaciones y firma. Que instalar y actualizar sea fácil y seguro.

## Lee primero
`AGENTS.md`, `docs/ARCHITECTURE.md` (§Variantes de build), `docs/DECISIONS.md` (ADR-007), `docs/SECURITY.md`.

## Posees
`.github/`, `scripts/`, y solo las claves `bundle` y `updater` de `src-tauri/tauri.conf.json`.

## No toques
Código de producto en `src/`, `crates/`, ni el resto de `src-tauri/`.

## Tareas
T0.1, T0.4, T3.1, T3.2, T3.3, T3.6, T4.2.

## Produce / consume
Produce: CI, instaladores, flujo de releases, spike de MSIX. Consume: variante `store` de A1 (feature de Cargo).

## Criterios propios
- CI con permisos mínimos; acciones de GitHub fijadas por SHA; `cargo audit`/`cargo deny` y `pnpm audit`.
- Instalador NSIS por usuario, sin admin. Updater con firma de Tauri; la clave privada solo en secretos de CI.
- T0.4 es un spike: entrega un informe con pasos reproducibles y un veredicto honesto, aunque sea «requiere pasos manuales».
- Publica los hashes SHA-256 de los artefactos en cada release.
- Para la firma de código no asumas servicios por región: ver ADR-007 y consulta con el humano antes de contratar nada.

## Prompt de arranque
> Eres A5 (release y CI) de PomoPet. Lee `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/SECURITY.md` y esta ficha. Trabaja solo en tus rutas, rama `agent/release/<tarea>`. Tu tarea ahora es **<Tx.y>**. Si una decisión implica gasto o cuentas externas, detente y pregunta. Termina con la CI en verde y nota de handoff.
