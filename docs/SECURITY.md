# Seguridad

## Activos
Integridad de la app y de sus actualizaciones; archivos del usuario; confianza en el contenido instalado.

## Modelo de amenazas
| Amenaza | Vector | Mitigación |
|---|---|---|
| Pack malicioso | zip-slip, zip bomb, imágenes con dimensiones enormes, archivos poliglota, SVG con scripts, fuentes malformadas | `PACK_FORMAT.md` §Límites: lista blanca, firmas de bytes, límites de tamaño/ratio, rechazo total ante violación, sin SVG, instalación atómica en `tmp/` |
| Catálogo manipulado / MITM | respuesta alterada, pack sustituido | HTTPS + firma Ed25519 del índice + `sha256` por pack verificado antes de extraer |
| Actualización falsa | updater comprometido | Firma de actualizaciones de Tauri (clave privada solo en secretos de CI); firma de código del instalador |
| XSS en la webview | contenido remoto o inyección | Sin contenido remoto; CSP estricto; sin `dangerouslySetInnerHTML`/`eval`; tema por tokens validados |
| Abuso de IPC | la UI llama comandos no previstos | Comandos tipados; capabilities por ventana; validación total en Rust |
| Lectura de archivos del usuario | UI o pack piden rutas arbitrarias | La webview no tiene plugin `fs`/`shell`; `pack://` solo sirve archivos listados en un manifiesto validado |
| Cadena de suministro | dependencia o acción de CI comprometida | Lockfiles; `cargo audit`/`cargo deny` y `pnpm audit` en CI; acciones de GitHub fijadas por SHA; permisos mínimos de CI; dependencias nuevas con entrada en DECISIONS.md |
| Suplantación del instalador | binario sin firma | Store (firma de Microsoft) y/o certificado OV; publicar hashes en las releases |
| Privacidad | telemetría, rutas personales en logs | Sin telemetría; logs sin datos personales |
| Denegación de servicio local | packs o catálogo enormes | Topes de tamaño, tiempo y memoria en descarga y validación |

## Reglas para agentes
1. La webview: `connect-src 'none'`; CSP sin `unsafe-eval`; evitar `unsafe-inline` (aplicar tokens con `style.setProperty` o la prop `style` de React, que usan el CSSOM; documentar cualquier excepción).
2. No habilitar plugins `fs`, `shell`, `http` ni `opener` para la webview. Cualquier plugin nuevo requiere ADR y revisión de seguridad.
3. Los permisos de `capabilities/` son el mínimo por ventana. Cada cambio se justifica en el PR.
4. Toda ruta, tamaño, color, id o número que llegue de fuera se valida en Rust antes de usarse.
5. Solo cliente HTTP en el núcleo (rustls, timeouts, límite de tamaño, sin seguir redirecciones a hosts no permitidos).
6. Secretos (clave del updater, clave de firma del catálogo, credenciales de firma de código) solo en secretos de CI; nunca en el repo, nunca en logs.
7. Errores hacia la UI sin rutas del sistema ni trazas internas.
8. Cada agente que cree una función de parseo o validación deja pruebas con entradas hostiles en `fixtures/`.

## Checklist de revisión (el rol de seguridad la aplica a todo PR que toque capabilities, CSP, packs, catálogo, updater o dependencias)
- [ ] Diff de `capabilities/` y `tauri.conf.json` revisado
- [ ] Nuevas rutas de entrada externa y su validación
- [ ] Dependencias nuevas: licencia, mantenimiento, `cargo deny`
- [ ] Fixtures hostiles añadidos o actualizados
- [ ] Sin secretos ni rutas personales en logs, tests o fixtures

## Divulgación de vulnerabilidades
Definir un contacto (correo o GitHub Security Advisories) antes de la beta pública (T3.4) y enlazarlo desde el README.
