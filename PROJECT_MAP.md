# PROJECT_MAP — Estudio Med

## Qué es
PWA local-first para estudiar Medicina (UNR, área "El Ser Humano y Su Medio"): biblioteca de PDFs con chat de citas clicables, tarjetas FSRS, atlas 3D, simuladores y práctica de parcial. Todo vive en el dispositivo (IndexedDB); la IA es la clave gratuita de Gemini del estudiante.
Estado: Fases 1–4 hechas (ver PROGRESO.md). En curso: Fase 5 (docs/FUNCIONALIDADES.md §H–I); bloques 1 (Tutoría ABP), 2 (plan de estudio), 3 (resumen en voz alta) y 4 (examen oral) hechos.

## Stack
- TypeScript ~6, React 19, react-router-dom 7 (HashRouter), Vite 8 + vite-plugin-pwa, Tailwind 4.
- Datos: Dexie 4 (IndexedDB). Búsqueda: MiniSearch + embeddings `multilingual-e5-small` (@huggingface/transformers) con fusión RRF.
- PDF: pdfjs-dist 6; OCR: tesseract.js 7. 3D: three 0.186 + @react-three/fiber/drei/postprocessing.
- Repaso: ts-fsrs 5. Export Anki: sql.js + jszip. Markdown: marked + dompurify.
- Tests: Vitest 5 + jsdom + fake-indexeddb. Lint: oxlint.

## Estructura
- `src/paginas/` — una pantalla por ruta (Hoy, Biblioteca, UnidadPagina, Chat, Tarjetas, Repaso, Atlas, Simuladores, Practica, Notas, Ajustes…).
- `src/componentes/` — UI reutilizable (Hoja, Citas, VisorFuente, ConfigIA, EditorTarjeta, `voz.ts` = dictado, lectura y lector por partes (Web Speech)).
- `src/repositorio/` — ÚNICO acceso a datos: `db.ts` (esquema Dexie + migraciones), `tipos.ts`, `index.ts` (API + ajustes por defecto), respaldo .zip.
- `src/ia/` — `proveedor.ts` (interfaz), `gemini.ts`, `groq.ts`, `cliente.ts` (elige proveedor, cuenta uso, caché), `prompts/` (un prompt por archivo).
- `src/chat/preguntar.ts` — RAG: búsqueda → prompt `[F1..F10]` → verificación de citas.
- `src/citas/verificar.ts` — verifica que cada frase citada esté en el fragmento.
- `src/busqueda/` — normalización, búsqueda híbrida, cliente de embeddings.
- `src/procesamiento/` — Web Worker PDF→texto→OCR→fragmentos→embeddings; cola.
- `src/tarjetas/` — crear, FSRS, generar con IA, export Anki/CSV.
- `src/atlas/` — escenas/estructuras JSON, visor 3D, Modo Museo, recorridos.
- `src/simuladores/` — `formulas/` (puras, testeadas), `sim/*` (un simulador por archivo), `catalogo.ts`, `ejercicios.ts`.
- `src/practica/` — banco de preguntas IA, sesión, simulacro, tarjeta desde el error.
- `src/tutoria/` — tutoría ABP: `cobertura.ts` (qué temas faltan, puro) y `tutor.ts` (tutor, comparación con la guía, cierre).
- `src/plan/` — plan de estudio hasta los parciales: `planificar.ts` (puro), `usePlan.ts`, componentes del día.
- `src/resumen/` — resumen de un tema para escuchar (`resumir.ts`: RAG con citas, texto para la voz).
- `src/oral/` — examen oral: `examen.ts` (preguntas con rúbrica, repregunta y nota calculada por código).
- `src/contenido/` — paquete de contenido (UPs, disciplinas, temas, parciales). Lo específico de UNR va SOLO acá.
- `src/test/` — tests Vitest por módulo.
- `scripts/` — `iconos.mjs` (íconos PWA), `modelos/convertir.mjs` (BodyParts3D → GLB).
- `public/atlas/` — modelos GLB servidos. `docs/` — especificaciones originales.
- `material-de-estudio/`, `modelos-3d/fuente/` — material de terceros, NO se suben.

## Puntos de entrada
- `index.html` → `src/main.tsx` → `src/App.tsx` (rutas con HashRouter; páginas pesadas con `lazy` a nivel de módulo).
- Rutas: `/` Hoy · `/biblioteca` · `/up/:id` · `/fuente/:id` · `/chat[/:id]` · `/tarjetas[/generar]` · `/repaso` · `/atlas[/:escena|/recorrido/:id]` · `/simuladores[/:id]` · `/practica[/sesion|/simulacro|/banco|/mapa]` · `/tutoria[/:id]` · `/plan` · `/resumen/:temaId` · `/oral[/:id]` · `/notas[/:id]` · `/buscar` · `/ajustes` · `/estadisticas` · `/creditos` · `/mas` · `/bienvenida`.
- No hay backend: la IA se llama desde el navegador a `generativelanguage.googleapis.com`.

## Comandos
- Instalar: `npm install`
- Dev: `npm run dev` (launch.json: puerto 5173 `--strictPort`)
- Test: `npm test` (vitest run)
- Build: `npm run build` (tsc -b && vite build)
- Lint: `npm run lint` (oxlint)
- Preview build: `npm run preview` · Íconos: `npm run iconos`

## Convenciones
- Código, nombres y UI en español (rioplatense: "tocá", "pegá").
- Datos solo vía `repositorio/`; tablas nuevas → `db.ts` (nueva versión Dexie) + `TABLAS_RESPALDO` + test de respaldo.
- Cálculos médicos solo en código puro testeado; la IA nunca calcula. Cada simulador cita la guía.
- Prompts en `src/ia/prompts/<nombre>.ts`; respuestas IA en JSON (`generarJSON`), uso `'chat'` (Flash) o `'lote'` (Flash-Lite).
- Citas de la IA siempre verificadas contra fragmentos; las no verificadas se muestran en gris.
- Decisiones numeradas en DECISIONES.md; avance en PROGRESO.md. "Hecho" = tests + build verdes, probado en navegador, docs al día, commit claro.

## Cuidado con
- `material-de-estudio/` (la guía) nunca al repo; tampoco texto de la guía dentro de `src/`.
- La clave de IA vive solo en `ajustes` (IndexedDB); nunca loguearla ni mandarla a otro host.
- `lazy()` dentro de un render colgaba la navegación: declarar a nivel de módulo.
- Cambios de esquema Dexie: siempre nueva versión, nunca editar una versión existente.
- Posiciones de citas dependen de `textoPagina()` compartido por worker y visor: no cambiarlo sin re-procesar.
- 2 avisos de lint aceptados `react-hooks/set-state-in-effect` en `src/paginas/Practica.tsx`.
- En Bash, los heredocs con backticks fallan; para ediciones grandes usar scripts .cjs en el scratchpad.
- Archivos `*(1).*` / `*(2).*` son copias duplicadas de descargas (ignoradas).
