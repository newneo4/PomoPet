# Arquitectura

## Vista general
```
PROCESO ÚNICO (Tauri 2)
│
├─ NÚCLEO (Rust) ─ fuente de verdad
│   ├─ pomopet-core:   timer (máquina de estados) + settings
│   ├─ pomopet-packs:  validar / instalar / activar packs, catálogo, firmas
│   └─ src-tauri:      ventanas, tray, plugins, IPC, protocolo pack://
│
│        ▲▼  comandos tipados + eventos (ver IPC_CONTRACT.md)
│
└─ UI (WebView2; sin red ni archivos)
    ├─ overlay: mascota + reloj, transparente, siempre encima
    └─ panel:   ajustes + galería (se crea al abrir, se destruye al cerrar)
```
Principio: el núcleo decide, la UI pinta. La UI puede reiniciarse sin perder estado.

## Ventanas
| Etiqueta | Config clave | Notas |
|---|---|---|
| `overlay` | `transparent`, sin decoraciones, `alwaysOnTop`, `skipTaskbar`, no redimensionable, sin sombra, sin robar foco al aparecer | Arrastrable. Tamaño dado por el tema activo × escala. Click-through por ventana completa (`set_ignore_cursor_events`), no por píxel. Al arrancar, validar que la posición guardada cae dentro de un monitor visible; si no, esquina inferior derecha del principal. |
| `panel` | Ventana normal | Se crea bajo demanda y se destruye al cerrar (ahorra RAM). |

Límite conocido (R1): el overlay no se muestra sobre aplicaciones en pantalla completa exclusiva.

## Timer (crate `pomopet-core`)
Sin dependencia de Tauri. Totalmente testeable.

**Modelo.** `phase ∈ {focus, short_break, long_break}` y `status ∈ {ready, running, paused}`. Estado inicial: `focus/ready`.

**Reglas**
- `start`: `ready → running`, `ends_at = now + duración(phase)`.
- `pause`: guarda `remaining_ms`, `ends_at = null`. `resume`: `ends_at = now + remaining_ms`.
- Expiración (cuando `now ≥ ends_at`): emite `timer://expired`. Si terminó un foco, `cycles_done += 1`; la siguiente fase es descanso largo cuando `cycles_done % cycles_until_long == 0`, si no descanso corto; tras un descanso, vuelve a foco. La nueva fase queda `running` si el ajuste de auto-inicio lo pide; si no, `ready`.
- `skip`: pasa a la siguiente fase sin alerta; saltar un foco no cuenta como ciclo completado.
- `reset`: `focus/ready` y `cycles_done = 0`.
- Reloj: `ends_at` es epoch UTC en ms. Si `remaining > total` (reloj del sistema atrasado), recortar a `total`.
- Tick: el núcleo emite snapshot ~1 Hz y programa la expiración exacta (espera hasta `min(1 s, ends_at - now)`); el error esperado es ≤ 1 s.
- Suspensión/reanudación (política única en v1: **tiempo real**): al despertar se reevalúa de inmediato. Si la expiración se pasó por más de 60 s, avanzar a la siguiente fase **sin alerta**; si fue menos, alerta normal.
- Persistencia: cada transición escribe `session.json`. Al arrancar, restaurar con las mismas reglas de retraso.

## Settings v1 (`settings.json`, con `schemaVersion` y migraciones)
| Campo | Defecto | Rango |
|---|---|---|
| `focusMin` | 25 | 1–180 |
| `shortBreakMin` | 5 | 1–60 |
| `longBreakMin` | 15 | 1–120 |
| `cyclesUntilLong` | 4 | 2–12 |
| `autoStartBreaks` / `autoStartFocus` | true / false | bool |
| `alertSeconds` | 8 | 3–60 |
| `soundEnabled` / `volume` | true / 0.6 | bool / 0–1 |
| `notifyOnExpire` | true | bool |
| `autostartWithWindows` | false | bool |
| `clickThrough` | false | bool |
| `overlay.{x,y,monitorId}` | esquina inferior derecha | validado contra monitores |
| `overlay.scale` / `overlay.opacity` | 1.0 / 1.0 | 0.5–2.0 / 0.3–1.0 |
| `activePetId` / `activeThemeId` | `gato-clasico` / `clasico` | id instalado |
| `language` | `system` | `system`, `es`, `en` |
| `reducedMotion` | `system` | `system`, `on`, `off` |

Todo valor se valida y se recorta en Rust. Un archivo corrupto se renombra a `settings.corrupt-<fecha>.json` y se arranca con defectos.

## Mascota: estado visual (frontend, `src/lib/pet/`)
Función pura: `petState = f(snapshot, alertActive)`.
| Timer | Estado de mascota |
|---|---|
| foco + `ready` | `idle` |
| foco + `running` | `focus` |
| cualquier fase + `paused` | `paused` (si el pack no lo define, `idle`) |
| descanso + `running` | `break` |
| descanso + `ready` | `idle` |
| evento `timer://expired` (no tardío) | `alert` durante `alertSeconds` o hasta clic; luego vuelve al estado del snapshot |

Con React, el componente de mascota **no** debe re-renderizar en cada tick: solo cuando cambia `petState` o el índice de fotograma (en `progress`, cuantizar el avance a fotograma antes de actualizar estado). La animación `loop/once` la ejecuta CSS, no React.

Render de hojas de sprites: CSS (`background-position` + `steps()`), sin canvas. Modos: `loop`, `once` y `progress` (el fotograma sale del avance `1 - remaining/total`). Con `prefers-reduced-motion`, los modos `loop`/`once` muestran un fotograma fijo; `progress` sigue (cambia lento, no es movimiento continuo).

## Contenido (packs)
- De fábrica (solo lectura): `resources/packs/{pets,themes}/<id>/`. Sus ids están reservados.
- Instalados: `<app_data>/packs/{pets,themes}/<id>/<version>/`. Se conservan las 2 últimas versiones.
- La webview carga assets por el protocolo propio `pack://` (registrado en el núcleo), que solo sirve archivos listados en el manifiesto de un pack ya validado. En Windows la URL real puede ser `http://pack.localhost/...`; confirmar en T0.3 y ajustar el CSP.
- Si el pack activo falta o falla, fallback automático a `gato-clasico` / `clasico` y aviso en el panel.
- Detalle del formato y la instalación: `PACK_FORMAT.md`.

## Datos en disco (`<app_data>` = `%APPDATA%\<identifier>`)
```
settings.json     session.json     logs/
packs/{pets,themes}/<id>/<version>/
cache/catalog.json (+ .sig)     tmp/   # instalaciones en curso
```
Escritura atómica: archivo temporal en el mismo directorio → `fsync` → rename; se conserva `.bak` del anterior. El `identifier` de Tauri definitivo se fija antes de M3 (afecta rutas, instalador y Store).

## Variantes de build
- `direct`: instalador NSIS por usuario + updater firmado de Tauri (GitHub Releases).
- `store`: paquete MSIX para Microsoft Store; sin updater (actualiza la Store); autoarranque declarado en el manifiesto. Se selecciona con la feature de Cargo `store`. Por validar en T0.4.

## Errores y resiliencia
- El núcleo nunca entra en pánico por entrada externa; errores tipados (`AppError`).
- La UI muestra errores como mensajes localizados; el detalle técnico va a `logs/` (rotación, sin datos personales).
- Instancia única: un segundo lanzamiento enfoca el overlay o abre el panel.
