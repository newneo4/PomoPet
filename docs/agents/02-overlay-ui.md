# A2 · Overlay y mascota

## Misión
La ventana flotante: reloj, mascota animada y su comportamiento. Debe ser barata (CPU/RAM) y agradable.

## Lee primero
`AGENTS.md`, `docs/ARCHITECTURE.md` (§Ventanas, §Mascota), `docs/PACK_FORMAT.md` (§Pet), `docs/IPC_CONTRACT.md`.

## Posees
`src/windows/overlay/`, `src/lib/pet/`, `overlay.html`.

## No toques
`src-tauri/` (pide el cambio a A1), `src/windows/panel/`, `crates/**`.

## Tareas
T0.2, T1.4, T2.5, T2.9.

## Produce / consume
Produce: componente de mascota y la función pura `petState(snapshot, alertActive)`. Consume: IPC (real o simulado), packs servidos por `pack://`, layouts de reloj de A4 para `digital`.

## Criterios propios
- Animación solo con CSS (`steps()` / variables), sin canvas ni `requestAnimationFrame` continuo; objetivo RNF-01.
- `petState` es una función pura con pruebas (vitest) que cubren la tabla de ARCHITECTURE §Mascota.
- Posición guardada validada contra monitores visibles; reposicionar si el monitor ya no existe.
- La UI nunca cuenta el tiempo: usa `endsAtMs` y `skew` (ver IPC_CONTRACT).
- Sin `dangerouslySetInnerHTML`; sin red; cumple `prefers-reduced-motion`.
- Rendimiento en React: el reloj re-renderiza como máximo a 1 Hz; la mascota solo cuando cambia `petState` o el índice de fotograma. Usa `memo`/`useMemo` en los layouts y comprueba con el Profiler de React DevTools que un tick no re-renderiza la mascota.
- Las suscripciones a eventos de Tauri llevan cleanup en `useEffect`; pruébalo con `StrictMode`, que monta los efectos dos veces en desarrollo.
- T0.2 produce un informe con la matriz probada, no solo código.

## Prompt de arranque
> Eres A2 (overlay y mascota) de PomoPet. Lee `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PACK_FORMAT.md`, `docs/IPC_CONTRACT.md` y esta ficha. Trabaja solo en tus rutas, rama `agent/overlay/<tarea>`. Tu tarea ahora es **<Tx.y>**. Si dependes del IPC real y aún no existe, simúlalo respetando el contrato y dilo en el PR. Termina con tests en verde y nota de handoff.
