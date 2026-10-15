# PLAN — Estudio Med

Aplicación web local-first (PWA) para estudiar el área "El Ser Humano y Su Medio" (Medicina, UNR). Este documento describe la estructura del proyecto, el esquema de datos y el orden de trabajo. Las decisiones puntuales están en `DECISIONES.md`; el avance, en `PROGRESO.md`.

## 1. Lo que confirmé al leer el material

- La guía tiene 247 páginas y **todas tienen capa de texto** (no hace falta OCR para ella). El número de página del PDF coincide con el número impreso, así que las citas "pág. N" son las mismas que ve el estudiante en papel.
- Las páginas en dos columnas (p. ej. 13, 233, 241) se extraen en el orden correcto con `pdfjs-dist` (sigue el orden del flujo de contenido). Cada página repite un encabezado ("Rosario, Argentina…", "El Ser Humano y Su Medio N"): se detecta de forma genérica (líneas repetidas en muchas páginas) y se excluye de los fragmentos.
- Las páginas de "Lluvia de ideas" son líneas de puntos: se descartan.
- Diferencias con `PROGRAMA-AREA.md` (manda la guía): la UP4 tiene **Microbiología** como disciplina propia; la UP5 incluye **Semiología** (historia clínica) y **metabolismo del potasio**; la situación de la UP6 es Luis, jubilado, ascenso al Cerro Chapelco (pág. 70).
- Modelos gratuitos de Gemini verificados en la documentación oficial (14/10/2026): `gemini-3.8-flash` (Flash recomendado) y `gemini-3.5-flash-lite` (Flash-Lite recomendado). Endpoint `models/{modelo}:generateContent` con `responseMimeType: application/json` + `responseSchema`. Los nombres son configurables en Ajustes por si Google los cambia.

## 2. Estructura del proyecto

```
estudio-med/
├─ index.html, vite.config.ts, package.json
├─ public/                      íconos PWA
├─ scripts/modelos/             conversión BodyParts3D → GLB (Fase 3)
├─ modelos-3d/                  modelos fuente (no se suben)
├─ material-de-estudio/         guía y apuntes (NO se suben: .gitignore)
├─ docs/                        especificaciones originales
└─ src/
   ├─ marca.ts                  nombre, colores y logo (único archivo de marca)
   ├─ contenido/                paquetes de contenido
   │  ├─ tipos.ts               PaqueteContenido, UP, Disciplina, Tema
   │  ├─ index.ts               paquete activo
   │  └─ unr-ser-humano-y-su-medio/   estructura del área (sin texto de la guía)
   ├─ repositorio/              ÚNICO acceso a datos (hoy Dexie/IndexedDB)
   │  ├─ db.ts                  esquema Dexie y migraciones
   │  ├─ tipos.ts               entidades
   │  ├─ *.ts                   fuentes, fragmentos, temas, notas, chats, ajustes, estadísticas…
   │  └─ respaldo.ts            exportar/importar .zip
   ├─ ia/
   │  ├─ proveedor.ts           interfaz ProveedorIA (chat, generarJSON) + errores
   │  ├─ gemini.ts              implementación Gemini (gratis)
   │  ├─ groq.ts                segundo proveedor gratuito (compatible OpenAI)
   │  ├─ cliente.ts             elige proveedor, cuenta llamadas, caché
   │  └─ prompts/               un prompt por archivo
   ├─ procesamiento/
   │  ├─ worker.ts              Web Worker: PDF → texto → OCR → fragmentos → embeddings → tema
   │  ├─ textoPagina.ts         texto de una página a partir de pdfjs (compartido con el visor)
   │  ├─ fragmentar.ts          corte en fragmentos de ~150–300 palabras
   │  └─ cola.ts                cola de procesamiento (hilo principal)
   ├─ busqueda/
   │  ├─ normalizar.ts          normalización tolerante (tildes, espacios, guiones de corte)
   │  ├─ hibrida.ts             MiniSearch + vectorial, fusión RRF
   │  └─ embeddings.ts          cliente del worker de embeddings
   ├─ citas/
   │  └─ verificar.ts           verificación de citas de la IA
   ├─ componentes/              UI reutilizable (Hoja, Botón, CitaSup, VisorPDF…)
   ├─ paginas/                  Hoy, Bienvenida, Biblioteca, UP, Fuente, Chat, Notas, Buscar,
   │                            Ajustes, Estadísticas, Créditos
   ├─ atlas/                    (Fase 3) escenas, estructuras.json, creditos.json
   ├─ simuladores/              (Fase 4) un módulo por simulador + fórmulas testeadas
   └─ test/                     tests de Vitest
```

## 3. Esquema de datos (IndexedDB vía Dexie, detrás de `repositorio/`)

| Tabla | Clave / índices | Campos principales |
|---|---|---|
| `ajustes` | `clave` | valor (clave IA, proveedor, modelos, fechas de parciales, retención, tema visual, último backup, bienvenida completa) |
| `temas` | `id`, `upId`, `disciplinaId`, `padreId` | nombre, orden, origen (`paquete`/`usuario`), oculto |
| `contenidoGuia` | `upId` | situación problemática y objetivos extraídos de la guía importada, con página |
| `fuentes` | `id`, `estado`, `creada` | nombre, tipo (`pdf`/`imagen`/`texto`), esGuia, blob, paginas, estado (`en_cola`/`procesando`/`listo`/`error`), progreso, error, upIds |
| `paginas` | `[fuenteId+numero]` | texto completo de la página (para visor de texto, extracción y re-fragmentación) |
| `fragmentos` | `id`, `fuenteId`, `upId`, `disciplinaId`, `temaId`, `[fuenteId+pagina]` | pagina, inicio, fin (posición en el texto de la página), texto, titulo, palabras, embedding (Float32Array 384) |
| `chats` | `id`, `actualizado` | título, alcance, mensajes [{rol, texto, segmentos con citas, fragmentos usados, fecha}] |
| `notas` | `id`, `actualizada`, `*temaIds` | título, markdown, fragmentoIds, origen |
| `resaltados` | `id`, `fuenteId`, `[fuenteId+pagina]` | inicio, fin, texto, color, comentario |
| `usoIA` | `fecha` | llamadas del día, tokens |
| `cacheIA` | `hash` | respuesta, fecha |
| `eventos` | `++id`, `tipo`, `fecha` | detalle, duración (estadísticas locales) |
| `tarjetas` | `id`, `vence`, `estado`, `creada`, `unidadId`, `disciplinaId`, `temaId`, `fuenteId`, `fragmentoId`, `imagenId` | tipo (básica/cloze/oclusión), frente, dorso, cloze + clozeN, máscaras + máscara, grupoId, estado FSRS (fechas en ms), suspendida |
| `revisiones` | `++id`, `tarjetaId`, `fecha` | calificación 1–4, estado previo (para deshacer), intervalo, estabilidad, dificultad, duración |
| `imagenesTarjeta` | `id` | imagen de las tarjetas de oclusión (va como archivo `imagenes/<id>` en el respaldo) |
| (Fase 4) `preguntas`, `intentos` | | banco y resultados por UP/disciplina |

Exportar = un `.zip` con `datos.json` (todas las tablas), `fuentes/<id>.<ext>` (los PDFs e imágenes como archivo) y `embeddings.bin` (vectores Float32 concatenados). Importar restaura exactamente lo mismo, incluido el estado FSRS.

## 4. Flujo de las citas clicables

1. Worker: `pdfjs` → ítems de texto por página → `textoPagina()` (el mismo código lo usa el visor, así las posiciones coinciden) → líneas → `fragmentar()` (150–300 palabras, respeta títulos y párrafos, nunca cruza páginas) → `fragmentos` con `pagina`, `inicio`, `fin`.
2. Embeddings `multilingual-e5-small` en el worker (prefijos `passage:`/`query:`), MiniSearch para texto exacto, fusión RRF → 10 fragmentos dentro del alcance.
3. Prompt `[F1]…[F10]` → la IA devuelve JSON: segmentos `{texto, citas:[{f, frase}]}` + `fueraDeFuentes`.
4. `verificarCitas()`: el fragmento existe y la frase normalizada está dentro del fragmento normalizado → cita verificada; si no, gris "no verificada".
5. UI: superíndices `¹ ²`; hover = vista previa; toque = visor PDF en la página con la frase resaltada en amarillo (hoja inferior en celular). Debajo: fuentes usadas + *Guardar como nota · Hacer tarjetas · Hacer preguntas*.

## 5. Fases

1. **Núcleo** (este primer bloque de trabajo).
2. Retención: tarjetas + FSRS + "Hoy" + Anki/CSV.
3. Atlas 3D.
4. Simuladores y práctica de parcial.
5. Tutoría ABP y extras.
