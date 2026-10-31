# Formato de packs y catálogo

Dos tipos de pack, un mismo mecanismo: `pet` (mascota) y `theme` (estilo de reloj). Un pack es una carpeta o un `.zip` con un manifiesto y assets. **Son datos, nunca código.** Los esquemas JSON en `schemas/` son normativos; este documento los explica.

## Estructura
```
<id>/
├─ pet.json | theme.json     # manifiesto (exactamente uno)
├─ sprites/*.webp|png        # solo pet
├─ sounds/*.ogg              # opcional, solo pet
├─ fonts/*.woff2             # opcional, solo theme
├─ preview.webp|png          # opcional local; obligatorio en catálogo
└─ LICENSE | LICENSE.txt | README.md   # opcionales, no se renderizan como HTML
```

## Campos comunes
| Campo | Regla |
|---|---|
| `schema` | entero; v1 = `1` |
| `type` | `"pet"` o `"theme"` |
| `id` | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–48 caracteres |
| `name` | 1–40 caracteres |
| `version` | semver `x.y.z` |
| `author` | 1–60 caracteres |
| `license` | identificador SPDX (p. ej. `CC-BY-4.0`) |
| `description` | opcional, ≤ 200 caracteres |

## Pet (`pet.json`)
| Campo | Regla |
|---|---|
| `frameSize` | `[w, h]`, cada uno 32–512 |
| `render` | `"smooth"` (defecto) o `"pixelated"` |
| `states` | obligatorios: `idle`, `focus`, `alert`, `break`. Opcional: `paused` (si falta, se usa `idle`) |
| `states.<n>.sheet` | archivo dentro de `sprites/` |
| `states.<n>.frames` | 1–120 |
| `states.<n>.columns` | opcional; por defecto `frames` (una fila) |
| `states.<n>.mode` | `loop`, `once` o `progress` |
| `states.<n>.fps` | 1–30; obligatorio en `loop`/`once`, prohibido en `progress` |
| `sounds.alert` | opcional, archivo `.ogg` en `sounds/` |

Geometría: el tamaño en píxeles de la hoja debe ser exactamente `columns × frameW` por `ceil(frames / columns) × frameH`. Fotograma en `progress`: `min(frames - 1, floor(avance × frames))`. En `alert/once` se mantiene el último fotograma hasta que termina la alerta.

## Theme (`theme.json`)
| Campo | Regla |
|---|---|
| `layout` | `digital`, `ring`, `bar` o `minimal` (diseños nativos de la app) |
| `tokens.text`, `accent`, `accentBreak`, `background` | `#RRGGBB` o `#RRGGBBAA` |
| `tokens.radius` | entero 0–48 |
| `font` | opcional: `{ file: "fonts/x.woff2", weight: 100–900 }` |
| `petPlacement` | `left`, `right`, `top`, `bottom`, `none` |
| `size` | `[w, h]` del overlay: w 160–480, h 100–320 |

Un tema no puede aportar CSS, HTML ni JS. Si se necesita un layout nuevo, se añade como diseño nativo en una versión de la app.

## Límites y validación (se rechaza el pack entero ante cualquier violación; no se «sanea»)
**Archivo**
- `.zip` ≤ 3 MB; descomprimido ≤ 10 MB; ≤ 64 entradas; profundidad ≤ 2.
- Extensiones permitidas: `.json` (solo el manifiesto), `.png`, `.webp`, `.ogg`, `.woff2`, `LICENSE`, `LICENSE.txt`, `README.md`. Todo lo demás (incluidos `.svg`, `.gif`, `.html`, `.js`, `.exe`, `.dll`) se rechaza.
- Los bytes iniciales deben coincidir con la extensión (firma PNG, `RIFF…WEBP`, `OggS`, `wOF2`).
- Tamaños: imagen ≤ 2 MB; hoja ≤ 4096×4096 px (leer dimensiones de la cabecera antes de decodificar); `.ogg` ≤ 200 KB; `.woff2` ≤ 300 KB; preview ≤ 256×256 y ≤ 200 KB.

**Rutas**
- Normalizar y rechazar: absolutas, `..`, `\`, letras de unidad, `:` (flujos alternativos NTFS), nombres reservados de Windows (`CON`, `NUL`, `COM1`…), entradas duplicadas ignorando mayúsculas, enlaces simbólicos.
- Límite de ratio de compresión por entrada (≤ 100:1) contra zip bombs; contar bytes realmente descomprimidos, no confiar en la cabecera.

**Semántica**
- Validar contra el JSON Schema, luego reglas cruzadas (geometría, archivos referenciados que existen, ids no reservados).
- Todo archivo referenciado debe existir; todo archivo no referenciado (salvo licencia/README/preview) se rechaza.

## Instalación (atómica)
1. Origen: archivo local o descarga del catálogo (ver abajo).
2. Extraer a `<app_data>/tmp/<uuid>/` aplicando los límites mientras se descomprime.
3. Validar. Si falla, borrar `tmp/` y devolver `pack_invalid` con el motivo.
4. Mover a `packs/<tipo>s/<id>/<version>/` (rename). Conservar las 2 últimas versiones.
5. Emitir `content://changed`. La activación es un paso aparte.

## Catálogo (`index.json` firmado)
```json
{
  "schema": 1,
  "generatedAt": "2026-11-01T12:00:00Z",
  "packs": [
    { "kind": "pet", "id": "planta-bonsai", "name": "Bonsái", "version": "1.0.0",
      "author": "…", "license": "CC-BY-4.0",
      "url": "packs/pets/planta-bonsai-1.0.0.zip", "sha256": "…hex…",
      "sizeBytes": 412000, "preview": "previews/planta-bonsai.webp",
      "minAppVersion": "1.0.0" }
  ]
}
```
- Firma detached `index.json.sig` = `{ "kid": "2026-01", "sig": "<base64 Ed25519 sobre los bytes exactos de index.json>" }`.
- La app embebe una lista de claves públicas (`kid → pubkey`) para permitir rotación: se publica la clave nueva en una versión de la app antes de empezar a firmar con ella.
- Solo HTTPS. Las `url` son relativas a la base del catálogo o de un host de la lista permitida en la config de la app; sin redirecciones a hosts no permitidos.
- Descarga: respetar `sizeBytes` y el tope global mientras se transmite; verificar `sha256` **antes** de extraer; luego pasar por el mismo validador y la misma instalación atómica.
- Caché offline: `cache/catalog.json` + `.sig`. La app solo usa una caché cuya firma verifica.

## Contenido de fábrica (reservado)
Mascotas: `gato-clasico`, `planta-bonsai` (demuestra el modo `progress`). Temas: `clasico` (layout `digital`), `anillo` (layout `ring`).

## Compatibilidad
`schema` solo sube con cambios incompatibles. La app rechaza packs con `schema` mayor al que conoce y muestra «requiere una versión más nueva». Nuevos renderizadores (p. ej. Lottie) llegarían como `schema` 2, sin romper los packs v1.
