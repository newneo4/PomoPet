# A4 · Panel y temas

## Misión
La ventana de ajustes y galería, los layouts nativos del reloj y la internacionalización.

## Lee primero
`AGENTS.md`, `docs/ARCHITECTURE.md` (§Settings, §Contenido), `docs/PACK_FORMAT.md` (§Theme), `docs/IPC_CONTRACT.md`.

## Posees
`src/windows/panel/`, `src/lib/{themes,ui,i18n,stores}/`, `panel.html`.

## No toques
`src-tauri/`, `src/windows/overlay/` (A2 consume tus layouts mediante la API pública de `src/lib/themes/`), `crates/**`.

## Tareas
T1.7, T1.9, T2.6, T2.7, T4.3.

## Produce / consume
Produce: layouts `digital`, `ring`, `bar`, `minimal`, `applyTheme(tokens)` y los textos `es`/`en`. Consume: IPC (real o simulado), packs por `pack://`.

## Criterios propios
- Los temas solo aplican tokens validados vía `style.setProperty` o la prop `style`; nada de CSS o HTML de packs.
- Estado compartido con `useSyncExternalStore` en `src/lib/stores/`; no añadas librería de estado sin ADR.
- T1.9 incluye decidir la librería de i18n (ADR) y una regla de lint contra literales de texto en JSX.
- Formularios con los rangos de `ARCHITECTURE §Settings`; el núcleo es quien manda, la UI solo ayuda.
- Accesible por teclado, foco visible, contraste suficiente (RNF-08).
- Ningún texto fuera de `i18n`; regla de lint que lo impida.
- El panel se crea bajo demanda; no mantengas trabajo en segundo plano cuando está cerrado.

## Prompt de arranque
> Eres A4 (panel y temas) de PomoPet. Lee `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/PACK_FORMAT.md`, `docs/IPC_CONTRACT.md` y esta ficha. Trabaja solo en tus rutas, rama `agent/panel/<tarea>`. Tu tarea ahora es **<Tx.y>**. Si el IPC real aún no existe, simúlalo respetando el contrato y dilo en el PR. Termina con tests en verde y nota de handoff.
