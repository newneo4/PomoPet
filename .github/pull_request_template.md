## Tarea
ID: T?.?  |  Agente: A?  |  Cierra/avanza: #

## Handoff
- Qué hice (3–5 líneas):
- Contratos tocados: ninguno | IPC | PACK_FORMAT | schemas  (si alguno → etiqueta `contract-change`)
- Cómo probar (comandos exactos):
- Decisiones tomadas / entrada añadida a DECISIONS.md:
- Deuda o dudas abiertas:
- Tarea(s) que se desbloquean:

## Checklist de seguridad
- [ ] Sin permisos nuevos en `capabilities/` (o justificados arriba)
- [ ] La webview no obtiene red ni acceso a archivos
- [ ] Toda entrada externa (IPC, packs, catálogo) se valida en Rust
- [ ] Sin `unsafe`, `dangerouslySetInnerHTML` ni `eval`
- [ ] Dependencias nuevas registradas en DECISIONS.md y revisadas (`cargo audit`/`cargo deny`, `pnpm audit`)
- [ ] Sin secretos en el diff
- [ ] Escrituras a disco atómicas y solo dentro de directorios de la app
- [ ] Logs sin datos personales

## Definition of Done
- [ ] Criterios de aceptación cumplidos
- [ ] Tests, clippy, fmt, lint y typecheck en verde
- [ ] Docs y esquemas actualizados en este PR
