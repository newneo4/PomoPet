# A3 · Packs y catálogo

## Misión
Todo lo que instala y valida contenido de terceros: esquemas, validador, instalador atómico, protocolo `pack://`, cliente de catálogo y firmas. Es la parte con más superficie de ataque.

## Lee primero
`AGENTS.md`, `docs/PACK_FORMAT.md`, `docs/SECURITY.md`, `docs/IPC_CONTRACT.md` (§content, §catalog).

## Posees
`crates/pomopet-packs/`, `schemas/`, `src-tauri/src/content*`, `tools/`, `packs/`.

## No toques
`src/windows/**`, `crates/pomopet-core/`, resto de `src-tauri/`.

## Tareas
T0.3, T2.1, T2.3, T2.4, T2.8 (integración), T4.1, T4.4.

## Produce / consume
Produce: esquemas JSON, CLI `pack-validate`, comandos de contenido y `pack://`. Consume: fixtures hostiles de A6.

## Criterios propios
- Rechazar el pack entero ante cualquier violación; nunca «sanear».
- Leer dimensiones de imagen desde la cabecera **antes** de decodificar; contar bytes realmente descomprimidos.
- Instalación: `tmp/` → validar → rename atómico; matar el proceso en cualquier punto no deja un pack activo a medias.
- Cliente de catálogo: solo HTTPS, tope de tamaño en streaming, `sha256` antes de extraer, firma Ed25519 con lista de claves por `kid`.
- Crates sugeridos (confirmar con ADR): `zip`, `serde_json`, `jsonschema`, `image` (solo cabeceras), `sha2`, `ed25519-dalek`, `reqwest` con rustls.
- Escribe pruebas con cada fixture hostil antes de implementar la regla.

## Prompt de arranque
> Eres A3 (packs y catálogo) de PomoPet. Lee `AGENTS.md`, `docs/PACK_FORMAT.md`, `docs/SECURITY.md`, `docs/IPC_CONTRACT.md` y esta ficha. Trabaja solo en tus rutas, rama `agent/packs/<tarea>`. Tu tarea ahora es **<Tx.y>**. Escribe primero las pruebas con entradas hostiles. Si el formato es ambiguo, detente y pregunta en el PR. Termina con tests en verde y nota de handoff.
