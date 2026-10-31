# Contexto del proyecto

## Visión
Un Pomodoro que no estorba y da gusto tener a la vista: una mascota pequeña, siempre visible sobre cualquier programa, cuyo comportamiento *es* el temporizador. Con el gato por defecto, duerme mientras corre el foco y despierta al llegar a 0.

## Escenarios clave
1. Trabajo con el IDE maximizado; el gato flota en una esquina, dormido. Sé cuánto falta sin abrir nada.
2. El contador llega a 0: el gato despierta, suena un maullido suave y aparece una notificación.
3. Quiero otra mascota o un reloj distinto: abro la galería, instalo, aplico, sin reiniciar.
4. Cierro la tapa de la laptop a mitad de sesión: al abrirla, el contador es coherente.
5. Sin internet: todo funciona salvo explorar el catálogo.

## Alcance v1
Temporizador con fases, overlay con mascota, ajustes, packs de mascota y de tema (instalación local y catálogo firmado), tray, autoarranque, actualizaciones.

## No-objetivos
Cuentas, pagos, subida de contenido por usuarios dentro de la app, sincronización en la nube, estadísticas en la nube, telemetría, macOS/Linux, mascotas con lógica propia (código), temas con CSS arbitrario.

## Requisitos funcionales
| ID | Requisito |
|---|---|
| RF-01 | Fases foco / descanso corto / descanso largo; ciclo configurable. |
| RF-02 | Overlay siempre visible, arrastrable, fuera de la barra de tareas, con escala y opacidad ajustables. |
| RF-03 | Modo click-through activable desde tray o atajo. |
| RF-04 | Mascota sincronizada con el estado; alerta al llegar a 0 (animación + sonido opcional + notificación opcional). |
| RF-05 | Ajustes: duraciones, ciclos, auto-inicio de fases, sonido, escala, opacidad, autoarranque, idioma. |
| RF-06 | Instalar packs desde `.zip` (arrastrar) y desde catálogo firmado; activar y quitar. |
| RF-07 | Menú de tray con acciones rápidas. |
| RF-08 | Persistencia y recuperación tras cierre o fallo. |
| RF-09 | Una sola instancia. |
| RF-10 | Actualización según canal (updater firmado o Store). |

## Requisitos no funcionales (objetivos a validar en M1)
| ID | Objetivo |
|---|---|
| RNF-01 | CPU en reposo con animación < 1 %; RAM total (incluye procesos de WebView2) < 150 MB. |
| RNF-02 | Overlay visible en < 2 s desde el arranque. |
| RNF-03 | Error del contador ≤ 1 s tras 25 min y tras suspensión/reanudación. |
| RNF-04 | Tras un cierre inesperado, el estado se restaura en el siguiente arranque. |
| RNF-05 | Windows 10 22H2 y Windows 11; DPI 100–200 %; multi-monitor. |
| RNF-06 | Instalador < 15 MB; instalación sin administrador. |
| RNF-07 | 100 % funcional offline (el catálogo es opcional). |
| RNF-08 | Accesibilidad: contraste suficiente, `prefers-reduced-motion`, operable con teclado en el panel. |

## Glosario
- **Núcleo**: código Rust; fuente de verdad del estado.
- **Overlay**: ventana flotante con mascota y reloj (`overlay`).
- **Panel**: ventana normal de ajustes y galería (`panel`).
- **Snapshot**: estado del timer que el núcleo envía a la UI.
- **Pack**: contenido instalable. Tipos: `pet` (mascota) y `theme` (estilo de reloj).
- **Estado semántico**: `idle`, `focus`, `alert`, `break`, `paused`; cada mascota decide qué dibuja en cada uno.
- **Catálogo**: `index.json` firmado en hosting estático.

## Riesgos abiertos
| ID | Riesgo | Mitigación | Tarea |
|---|---|---|---|
| R1 | El overlay no se ve sobre juegos en pantalla completa exclusiva. | Documentar; funciona en ventanas maximizadas y borderless. | T0.2 |
| R2 | Empaquetar MSIX para la Store con Tauri puede requerir pasos manuales; el updater y el autoarranque se comportan distinto en MSIX. | Spike temprano; variantes de build `direct` y `store`. | T0.4 |
| R3 | Avisos de SmartScreen sin firma de código con reputación. | Store (firma de Microsoft) y/o certificado OV. | T3.6 |
| R4 | Consumo de RAM de WebView2 mayor al esperado. | Panel creado bajo demanda y destruido al cerrar; medir en M1. | T1.8 |
| R5 | Parseo de fuentes `.woff2` de terceros. | Límite de tamaño; permitir solo con firma del catálogo o con aviso en importación local. | T2.1 |
| R6 | El protocolo `pack://` tiene otra forma de URL en Windows y puede romper el CSP. | Spike T0.3. | T0.3 |
