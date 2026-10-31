# Cómo trabajan los agentes

## Roles
| ID | Rol | Posee (rutas) | Ficha |
|---|---|---|---|
| A1 | Núcleo Rust | `crates/pomopet-core/`, `src-tauri/` (salvo `src-tauri/src/content*` y las claves `bundle`/`updater` de `tauri.conf.json`), `src/lib/ipc/generated/` | `01-core-rust.md` |
| A2 | Overlay y mascota | `src/windows/overlay/`, `src/lib/pet/`, `overlay.html` | `02-overlay-ui.md` |
| A3 | Packs y catálogo | `crates/pomopet-packs/`, `schemas/`, `src-tauri/src/content*`, `tools/`, `packs/` | `03-packs.md` |
| A4 | Panel y temas | `src/windows/panel/`, `src/lib/{themes,ui,i18n,stores}/`, `panel.html` | `04-panel-ui.md` |
| A5 | Release y CI | `.github/`, `scripts/`, claves `bundle`/`updater` de `tauri.conf.json` | `05-release-ci.md` |
| A6 | Seguridad y QA | `fixtures/` (hostiles), `tests/`, `docs/SECURITY.md`; revisa PRs sensibles | `06-security-qa.md` |

Orquestación (tú, o un agente líder): prioriza, resuelve conflictos entre agentes, aprueba cambios de contrato y actualiza `ROADMAP.md`.

## Reglas de convivencia
1. **Cada agente toca solo sus rutas.** Si necesitas algo en otra ruta, pídelo en el PR (o abre issue) en vez de editarlo.
2. **Los contratos son compartidos y protegidos**: `docs/IPC_CONTRACT.md`, `docs/PACK_FORMAT.md`, `schemas/`. Cambian en un PR etiquetado `contract-change`, con docs y esquemas en el mismo PR, y la aprobación de quien orquesta.
3. **Un worktree por agente** para trabajar en paralelo sin pisarse:
   `git worktree add ../pomopet-a1 -b agent/core/T1.1`
4. **Ramas y PR:** `agent/<rol>/<id-tarea>`, un PR por tarea, pequeño, con Conventional Commits.
5. **Desarrollo contra contrato:** si tu dependencia aún no existe (p. ej. IPC real), usa una simulación que respete `IPC_CONTRACT.md` y avísalo en el PR.
6. **Sin ambigüedad no se inventa:** si un contrato no cubre tu caso, detente, documenta la pregunta en el PR y espera.
7. **Seguridad primero:** todo PR que toque capabilities, CSP, packs, catálogo, updater o dependencias lo revisa A6 antes de integrarse.
8. **`tauri.conf.json` es compartido:** A1 toca ventanas/seguridad/plugins; A5 solo `bundle` y `updater`. Cambios pequeños y en commits separados para evitar conflictos.

## Cómo lanzar un agente
1. Dale acceso al repo y el contenido de su ficha (`docs/agents/NN-*.md`) como prompt inicial; cada ficha trae un «Prompt de arranque» listo.
2. Indica la tarea concreta (`Tx.y`). Una tarea por sesión.
3. Pídele que, al terminar, deje la nota de handoff en el PR.

## Nota de handoff (en cada PR)
```
Tarea / agente:
Qué hice (3–5 líneas):
Contratos tocados: ninguno | IPC | PACK_FORMAT | schemas
Cómo probar (comandos exactos):
Decisiones / entradas en DECISIONS.md:
Deuda o dudas abiertas:
Tareas que se desbloquean:
```

## Escalado
- Conflicto de rutas o contrato → quien orquesta decide y deja la decisión en `DECISIONS.md`.
- Hallazgo de seguridad crítico → A6 bloquea el PR y abre issue privado.
- Tarea estancada (>2 intentos sin avance) → el agente se detiene y reporta qué probó y qué necesita.
