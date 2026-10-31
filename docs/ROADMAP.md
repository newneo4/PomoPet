# Plan de trabajo

Agentes: **A1** núcleo Rust · **A2** overlay y mascota · **A3** packs y catálogo · **A4** panel y temas · **A5** release y CI · **A6** seguridad y QA. Fichas en `docs/agents/`.
Estado de cada tarea: se marca en el PR que la cierra (no se edita este archivo en paralelo; lo actualiza quien orquesta).

## Hitos
| Hito | Resultado | Fases |
|---|---|---|
| M0 | Repo andamiado y riesgos técnicos validados | 0 |
| M1 | Pomodoro usable a diario (gato provisional) | 1 |
| M2 | Cambiar mascota y tema desde archivo local | 2 |
| M3 | Beta pública instalable y actualizable | 3 |
| M4 | Galería con catálogo firmado | 4 |

## Olas de arranque (qué lanzar y cuándo)
- **Ola 0 (secuencial):** T0.1 (A5). Sin repo andamiado nadie puede empezar. También puedes hacerlo tú con `pnpm create tauri-app` y pedir a A5 que lo ajuste.
- **Ola 1 (paralelo, tras T0.1):** A1 → T0.5, T1.1, T1.2 · A2 → T0.2 · A3 → T0.3 y T2.1 (esquemas) · A5 → T0.4 · A6 → plan de pruebas y T2.2.
- **Ola 2:** T1.3 (A1) desbloquea T1.4, T1.6, T1.7, T1.8. A2 y A4 pueden avanzar con IPC simulado antes de T1.3.
- **Olas siguientes:** por fase, según dependencias.

## Fase 0 — Andamiaje y spikes (M0)
| ID | Tarea | Agente | Depende | Aceptación |
|---|---|---|---|---|
| T0.1 | Andamiaje: estructura de `AGENTS.md`, Tauri 2 + React + TS + Vite (una entrada `main.tsx` por ventana), workspace Rust, lint/format, CI en `windows-latest` (build, tests, lint), plantilla de PR | A5 | — | `pnpm tauri dev` abre una ventana `overlay` vacía; CI en verde en `main`; README con requisitos |
| T0.2 | Spike overlay: ventana transparente, sin bordes, siempre encima, `skipTaskbar`, arrastrable, sprite CSS de prueba, click-through | A2 | T0.1 | `docs/spikes/overlay.md` con matriz probada (maximizadas, borderless, pantalla completa exclusiva, multi-monitor, DPI 100/125/150/200 %, foco, ventanas elevadas) y config final recomendada |
| T0.3 | Spike `pack://` + CSP: servir un PNG de una carpeta de prueba con CSP estricto | A3 | T0.1 | `docs/spikes/pack-protocol.md` con URL real en Windows; rutas fuera de manifiesto → 404 (test) |
| T0.4 | Spike MSIX: empaquetar el `.exe` como MSIX, instalar local, probar autoarranque por manifiesto y build sin updater | A5 | T0.1 | `docs/spikes/msix.md` con pasos reproducibles y veredicto (viable / viable con pasos manuales / no viable) |
| T0.5 | Tipos TS generados desde Rust (`ts-rs` o `tauri-specta`) | A1 | T0.1 | ADR registrado; `pnpm gen:types` produce `src/lib/ipc/generated/`; CI falla si hay diferencias sin commitear |

## Fase 1 — MVP del temporizador (M1)
| ID | Tarea | Agente | Depende | Aceptación |
|---|---|---|---|---|
| T1.1 | `pomopet-core::timer` según ARCHITECTURE | A1 | T0.1 | Pruebas tabulares: transiciones, pausa/reanudación, restauración, reloj atrasado, expiración tardía (>60 s), ciclo largo; sin dependencia de Tauri |
| T1.2 | `pomopet-core::settings` v1: validación, recorte, migraciones, escritura atómica, archivo corrupto | A1 | T0.1 | Pruebas con valores fuera de rango y JSON corrupto |
| T1.3 | Pegamento Tauri: comandos y eventos de IPC_CONTRACT, capabilities por ventana | A1 | T1.1, T1.2, T0.5 | Todos los comandos con pruebas; `overlay` no puede llamar comandos de la columna ✘ |
| T1.4 | Overlay UI mínima: reloj `digital`, arrastrar, guardar posición validada, menú contextual, clic = iniciar/pausar | A2 | T0.2 (IPC simulado hasta T1.3) | Posición persiste; monitor desconectado → reposiciona; escala y opacidad funcionan |
| T1.5 | Tray (iniciar/pausar/saltar/panel/click-through/salir), instancia única, autoarranque opcional | A1 | T1.3 | Segundo lanzamiento enfoca el primero; autoarranque se activa/desactiva sin admin |
| T1.6 | Alerta al llegar a 0: notificación nativa y sonido opcionales | A1 | T1.3 | Respeta `notifyOnExpire` y `soundEnabled`; sin alerta si `lateMs > 60000` |
| T1.7 | Panel de ajustes (todos los campos de Settings v1) | A4 | T1.3 (IPC simulado antes) | Cambios se reflejan en el overlay sin reiniciar; valores inválidos no pasan |
| T1.8 | QA de precisión y recursos: 25 min, suspensión/reanudación, kill del proceso, CPU/RAM | A6 | T1.3 | Informe contra RNF-01…RNF-04; fallos abiertos como issues |
| T1.9 | i18n base (`es`, `en`) y ADR de librería (propia ligera vs `react-i18next`) | A4 | T0.1 | Sin strings sueltos (regla de lint); cambio de idioma en caliente |

## Fase 2 — Mascotas y estilos (M2)
| ID | Tarea | Agente | Depende | Aceptación |
|---|---|---|---|---|
| T2.1 | JSON Schemas (`pet`, `theme`, `catalog`) y validador en `pomopet-packs` | A3 | T0.3 | Todas las reglas de PACK_FORMAT con prueba; `tools/pack-validate` CLI |
| T2.2 | Fixtures hostiles: zip-slip, zip bomb, SVG, ruta `..`, nombres reservados, poliglotas, hojas gigantes, manifiestos inválidos | A6 | PACK_FORMAT | Cada fixture documenta qué debe rechazar; se ejecutan en CI |
| T2.3 | Instalador atómico, registro de instalados, versiones, fallback a por defecto | A3 | T2.1 | Un pack a medias nunca queda activo; matar el proceso durante instalación no corrompe nada |
| T2.4 | Comandos de contenido + protocolo `pack://` | A3 | T2.3, T1.3 | Comandos de IPC_CONTRACT §content; solo se sirven archivos del manifiesto |
| T2.5 | Renderer de mascota: estados, `loop/once/progress`, alerta, `paused`→`idle`, `render` | A2 | T1.4, T2.4 | Gato duerme en foco y despierta en `alert`; planta crece con el avance |
| T2.6 | Layouts nativos `digital`, `ring`, `bar`, `minimal` + tokens + fuente | A4 | T1.4, T2.4 | Cambiar de tema es instantáneo; tokens inválidos imposibles |
| T2.7 | Galería local: lista, vista previa, activar, importar `.zip` (arrastrar), quitar | A4 | T2.4 | Accesible por teclado; errores localizados |
| T2.8 | Contenido de fábrica: `gato-clasico`, `planta-bonsai`, temas `clasico`, `anillo` | Humano/artista + A3 | T2.1 | Pasan el validador; arte con licencia compatible |
| T2.9 | `prefers-reduced-motion` y ajuste `reducedMotion` | A2 | T2.5 | `loop/once` estáticos con la preferencia activa |

## Fase 3 — Distribución (M3)
| ID | Tarea | Agente | Depende | Aceptación |
|---|---|---|---|---|
| T3.1 | Variante `direct`: NSIS por usuario sin admin | A5 | T1.5 | Instala/desinstala limpio; datos de usuario respetados |
| T3.2 | Updater firmado y canal de releases | A5 | T3.1 | Actualiza de vN a vN+1 en una VM; firma inválida se rechaza |
| T3.3 | Variante `store` (MSIX) según T0.4 | A5 | T0.4, T3.1 | Paquete válido para Partner Center; sin updater propio |
| T3.4 | Revisión de endurecimiento: CSP, capabilities, `cargo audit/deny`, contacto de seguridad | A6 | T2.7 | Informe sin hallazgos críticos abiertos |
| T3.5 | Matriz manual: Win10 22H2, Win11, DPI, multi-monitor, suspensión | A6 | T3.1 | Informe con evidencias |
| T3.6 | Decisión e implementación de firma de código del canal directo | Humano + A5 | T3.1 | Decisión en DECISIONS.md; CI firma los artefactos si aplica |

## Fase 4 — Catálogo (M4)
| ID | Tarea | Agente | Depende | Aceptación |
|---|---|---|---|---|
| T4.1 | Cliente de catálogo: descarga, firma, `sha256`, caché offline | A3 | T2.4 | Firma inválida, hash distinto y exceso de tamaño se rechazan (tests) |
| T4.2 | Repo/CI del catálogo: validar PRs, generar `index.json`, firmar, publicar en hosting estático | A5 + A3 | T2.1 | Un PR con pack inválido falla; uno válido publica índice firmado |
| T4.3 | Galería online en el panel | A4 | T4.1 | Instalar, actualizar y ver estado sin conexión |
| T4.4 | Rotación de claves y guía `CONTRIBUTING_PACKS.md` | A3 | T4.1 | Prueba con dos `kid`; guía clara para creadores |
| T4.5 | Revisión de seguridad del catálogo | A6 | T4.2 | Informe sin hallazgos críticos |

## Backlog posterior a v1
Política «pausar al suspender», estadísticas locales, sonidos por fase, atajo global configurable, más layouts de reloj, renderizadores Lottie/Rive (`schema` 2), pruebas E2E con `tauri-driver`.
