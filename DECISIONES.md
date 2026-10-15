# Decisiones

Cosas que no estaban definidas (o que había que elegir entre opciones) y cómo se resolvieron. Regla: lo más simple que respete los principios del PROMPT.

## Generales

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| 1 | Versiones | Vite 8, React 19, TypeScript 6, Tailwind 4, Dexie 4, pdfjs-dist 6, transformers.js 4, ts-fsrs 5 (últimas estables al 14/10/2026). | Proyecto nuevo: sin deuda de migraciones. |
| 2 | Enrutado | `HashRouter` (`/#/chat`). | GitHub Pages no reescribe rutas: con hash funciona sin configuración extra. |
| 3 | `base: './'` en Vite | Rutas relativas. | El mismo build sirve en GitHub Pages (subcarpeta) y Cloudflare Pages (raíz). |
| 4 | Material con derechos | `material-de-estudio/` y `modelos-3d/fuente/` en `.gitignore`. El paquete de contenido solo tiene estructura (UP, disciplinas, temas, páginas) y **resúmenes propios** de las situaciones. El texto oficial de cada situación y sus objetivos se **extrae de la guía que importa el estudiante** (`procesamiento/seccionesGuia.ts`). | El PROMPT prohíbe incluir la guía en el repo o el sitio. |
| 5 | Archivos duplicados `(1)`, `(2)` de la descarga | No se tocaron; quedan ignorados por `.gitignore`. | Son copias idénticas (verificado con `cmp`); borrarlos es decisión de Franco. |

## Contenido del área

| # | Tema | Decisión |
|---|---|---|
| 6 | Diferencias PROGRAMA-AREA.md vs. guía | Manda la guía: UP4 suma **Microbiología** como disciplina; UP5 suma **Semiología** (historia clínica, método clínico, relación médico-paciente) y **metabolismo del potasio**; UP6: situación de Luis en el Cerro Chapelco. |
| 7 | Asignación de unidad a cada fragmento de la guía | Por rangos de páginas definidos en el paquete (UP, material de estudio de cada unidad y actividades disciplinares). La disciplina, por el título de sección detectado ("FISIOLOGIA", "ANATOMIA"…). El tema, por similitud de embeddings dentro de esa unidad/disciplina. En apuntes propios: tema más parecido entre todos. |
| 8 | Parciales | Parcial 1 = UP1–UP3, Parcial 2 = UP4–UP6 como **sugerencia** editable (la guía no lo define; el simulacro de la Fase 4 deja elegir las UP). |

## Procesamiento y búsqueda

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| 9 | Texto por página | Una única función `construirTextoPagina()` la usan el worker y el visor. Los fragmentos guardan `[inicio, fin)` en ese texto. | Así la posición del fragmento y la frase citada coinciden exactamente al resaltar en el PDF. |
| 10 | Encabezados/pies repetidos | Detección genérica: renglones (sin números) presentes en ≥30 % de las páginas se excluyen de los fragmentos. | Funciona con cualquier PDF, no solo la guía. |
| 11 | Tamaño de fragmento | Objetivo ~200 palabras (mín. 150, máx. 300), cortando en párrafos/títulos, nunca entre páginas. En la guía: 614 fragmentos, mediana 209 palabras. | Cita a página exacta + contexto suficiente. |
| 12 | Fragmentos enviados a la IA | 10 por pregunta (el PROMPT pide 8–12). | Equilibrio entre cobertura y cuota. |
| 13 | Fusión híbrida | Reciprocal Rank Fusion; la lista semántica pesa doble. Para preguntas de seguimiento cortas, la búsqueda suma la pregunta anterior. | RRF no requiere calibrar puntajes entre MiniSearch y coseno. |
| 14 | Modelo de embeddings | `Xenova/multilingual-e5-small` cuantizado **q8** (~120 MB, se baja una vez y queda en caché), en WASM dentro del worker. Con prefijos `passage:` / `query:`. | Se probó WebGPU, pero exige el modelo fp32 (~470 MB): demasiado para datos móviles. Velocidad medida en computadora: ~1,6 fragmentos/s (la guía completa ≈ 6 min, una sola vez). |
| 15 | Sin internet la primera vez | La fuente queda "Lista" con búsqueda por texto; los embeddings se completan solos al volver a abrir la app con conexión (`completarEmbeddings`). | Nada se bloquea por la IA o el modelo. |
| 16 | OCR | `tesseract.js` en español. En PDFs: solo si >30 % de las páginas no tienen texto (PDF escaneado). Fotos: siempre. Los archivos del motor e idioma se bajan del CDN de jsDelivr/tessdata la primera vez y quedan en caché (Workbox). | La guía tiene capa de texto en las 247 páginas: OCR innecesario ahí. |
| 17 | PWA y caché | Se precachea la app (~3,4 MB). El WASM de ONNX (~27 MB) **no** se precachea: se guarda al primer uso (CacheFirst). pdf.js y el visor se cargan de forma diferida. | Instalar la app no debe gastar 30 MB de datos de golpe. |

## Citas

| # | Tema | Decisión |
|---|---|---|
| 18 | Formato de respuesta | JSON con segmentos `{texto, citas:[{f, frase}]}` + `fueraDeFuentes` + `sinInformacion` (esquema en `ia/prompts/chatConCitas.ts`). |
| 19 | Normalización para verificar | Minúsculas, sin tildes (NFKD: también `²`→`2`), puntuación→espacio, espacios colapsados y unión de palabras cortadas por guion de fin de renglón. Se aceptan elisiones `...`/`…` (cada tramo, en orden). Frases de menos de 12 caracteres normalizados no cuentan como cita. |
| 20 | Cifras sin cita | Si un segmento tiene números y ninguna cita verificada, se muestra el aviso "Cifra sin cita verificada". |
| 21 | Cita no verificada al tocarla | Abre igual la página del fragmento y resalta el fragmento completo (no la frase), con la cita en gris tachada. |
| 22 | Numeración `¹ ² ³` | Por fragmento, en orden de primera aparición dentro de cada respuesta. |

## IA

| # | Tema | Decisión |
|---|---|---|
| 23 | Modelos Gemini | Verificados en ai.google.dev el 14/10/2026: chat con `gemini-3.8-flash`, lotes con `gemini-3.5-flash-lite` (ambos con nivel gratuito). Editables en Ajustes → Avanzado por si Google los cambia. |
| 24 | Segundo proveedor | **Groq** implementado (`ia/groq.ts`, API compatible con OpenAI, nivel gratuito con clave). **Ollama local**: usar el mismo `crearGroq({ base: 'http://localhost:11434/v1', clave: 'ollama', modeloChat: 'llama3.1' })` — no se expone en la UI porque requiere instalar Ollama en la PC. |
| 25 | Cuota | Contador local de llamadas por día; error 429/`RESOURCE_EXHAUSTED` → mensaje "Llegaste al límite gratis de hoy, se renueva mañana" y marca el día como agotado. Tope diario propio opcional. Caché local de respuestas idénticas (30 días). |
| 26 | Privacidad | Aviso permanente junto a la clave: solo material de estudio, nunca datos de pacientes; el nivel gratuito puede usar el contenido. |

## Datos

| # | Tema | Decisión |
|---|---|---|
| 27 | Respaldo | `.zip` con `datos.json` (todas las tablas), `fuentes/<id>` (archivos originales) y `embeddings.bin` (Float32 concatenados). Importar **reemplaza** todo (con confirmación). La caché de IA no se exporta. |
| 28 | Recordatorio semanal | Aviso en "Hoy" si hay datos y pasaron 7 días desde el último respaldo (o nunca se hizo). |
| 29 | Borrar todo | Doble confirmación: botón + escribir `BORRAR`. |
| 30 | Almacenamiento persistente | Se pide `navigator.storage.persist()` para que el navegador no borre la base por falta de espacio. |
| 31 | Estadísticas de uso | Eventos locales (`pantalla`, `chat`, `fuente`, `ia`, `estudio` cada minuto con la app visible y uso en los últimos 3 min). Exportables a JSON. |
