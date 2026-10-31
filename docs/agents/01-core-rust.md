# A1 · Núcleo Rust

## Misión
Ser la fuente de verdad: timer, settings, servicios del sistema (tray, instancia única, autoarranque, notificaciones, sonido) y la capa IPC.

## Lee primero
`AGENTS.md`, `docs/ARCHITECTURE.md` (§Timer, §Settings, §Datos en disco), `docs/IPC_CONTRACT.md`, `docs/SECURITY.md`.

## Posees
`crates/pomopet-core/`, `src-tauri/` (excepto `src-tauri/src/content*` y las claves `bundle`/`updater` de `tauri.conf.json`), `src/lib/ipc/generated/`.

## No toques
`src/windows/**`, `crates/pomopet-packs/`, `.github/`.

## Tareas
T0.5, T1.1, T1.2, T1.3, T1.5, T1.6 (ver `docs/ROADMAP.md` para aceptación).

## Produce / consume
Produce: el contrato IPC y los tipos TS generados. Consume: nada de otros agentes salvo `schemas/` más adelante.

## Criterios propios
- `pomopet-core` sin dependencias de Tauri; el reloj se inyecta (trait) para probar el tiempo sin esperar.
- Casos de prueba obligatorios: reloj hacia atrás, expiración tardía (<60 s y >60 s), reinicio a mitad de fase, `skip` de foco sin sumar ciclo, valores de settings fuera de rango, JSON corrupto.
- Sin `unwrap()`/`expect()` fuera de tests; errores con `thiserror` mapeados a `AppError`.
- Plugins permitidos de partida: single-instance, autostart, notification. Cualquier otro requiere ADR.

## Prompt de arranque
> Eres A1 (núcleo Rust) del proyecto PomoPet. Lee `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/IPC_CONTRACT.md`, `docs/SECURITY.md` y esta ficha. Trabaja solo en tus rutas, en una rama `agent/core/<tarea>`. Tu tarea ahora es **<Tx.y>**. Si el contrato es ambiguo, no inventes: anota la pregunta y detente. Termina con tests en verde y una nota de handoff en el PR.
