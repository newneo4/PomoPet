# Decisiones (ADR ligeros)

Formato: contexto breve → decisión → revisar si. Un agente no reabre una decisión sin un ADR nuevo.

## ADR-001 · Tauri 2 como shell
Instalador pequeño, WebView2 del sistema, modelo de permisos por capacidad, NSIS/MSI y updater firmado integrados. Alternativas: Electron (más pesado), WPF (válido, pero packs web más trabajosos). **Revisar si**: el spike del overlay (T0.2) muestra problemas graves de transparencia o rendimiento.

## ADR-002 · Frontend: React + TypeScript + Vite + pnpm
Decidido por el autor del proyecto (preferencia y dominio del stack). Multipágina: `overlay.html` y `panel.html`, cada una con su entrada `main.tsx`. Estado compartido ligero con `useSyncExternalStore` en `src/lib/stores/`; cualquier librería de estado (p. ej. Zustand) o de i18n requiere ADR. Riesgo propio de React: re-renderizados innecesarios en el overlay; ver criterios de rendimiento en la ficha A2. **Revisar si**: el overlay no cumple RNF-01 por el coste del runtime.

## ADR-003 · El tiempo vive en el núcleo
`ends_at` absoluto (epoch UTC ms), persistido en cada transición; la UI solo pinta. Evita el throttling de webviews y sobrevive a suspensión y reinicios. **Revisar si**: aparece necesidad real de política «pausar al suspender» (backlog).

## ADR-004 · Packs de datos, nunca código
Mascotas por hojas de sprites + manifiesto; temas por tokens sobre layouts nativos. Elimina casi toda la superficie de ataque del mercado. **Revisar si**: se decide permitir layouts de terceros (requeriría iframe aislado sin red).

## ADR-005 · Sprites en WebP/PNG; sin SVG ni GIF en v1
Fáciles de producir y validar; sin scripts embebidos. `schema` permite añadir renderizadores (Lottie, Rive) en una versión futura.

## ADR-006 · Catálogo estático firmado, sin backend
`index.json` + firma Ed25519 en hosting estático; contribuciones por PR con CI de validación. **Revisar si**: se piden cuentas, pagos o subidas desde la app.

## ADR-007 · Distribución
Primario: Microsoft Store con MSIX (firma y hosting de Microsoft; registro individual gratuito). Secundario: NSIS por usuario + updater firmado vía GitHub Releases. Notas verificadas en oct-2026: Azure Artifact Signing ofrece cuentas a individuos solo en EE. UU. y Canadá; los certificados EV ya no eliminan SmartScreen al instante. Confirmar disponibilidad de la Store en el país del autor. **Revisar si**: cambian los requisitos de Microsoft o falla el spike T0.4.

## ADR-008 · Instalación por usuario, sin administrador, sin telemetría
Reduce superficie de ataque y fricción. La app nunca pide elevación.

## ADR-009 · Idiomas
Docs en español; código, identificadores, comentarios y commits en inglés. UI con textos externalizados (`es` por defecto, `en` secundario).

## ADR-010 · Dependencias base de Rust y tooling de calidad
`serde`/`serde_json` (MIT/Apache-2.0, serde-rs) para serializar estado, settings e IPC; `thiserror` (MIT/Apache-2.0, dtolnay) para errores tipados. En frontend, ESLint + typescript-eslint, Prettier y Vitest son tooling de desarrollo (MIT) y no se empaquetan en producción. **Revisar si**: se propone sustituir la serialización, el manejo de errores o el framework de pruebas.

## Pendientes de decidir (con responsable)
| Tema | Opciones | Quién | Cuándo |
|---|---|---|---|
| Generación de tipos TS desde Rust | `ts-rs` vs `tauri-specta` | A1 | T0.5 |
| Mecanismo de permisos por ventana para comandos propios | app manifest de `tauri-build` + capabilities | A1 | T1.3 |
| Firma de código para canal directo | solo Store / certificado OV | Humano + A5 | T3.6 |
| `identifier` definitivo de la app | texto | Humano | antes de M3 |
| Librería de i18n | propia y ligera vs `react-i18next` | A4 | T1.9 |
