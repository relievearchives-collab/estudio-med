# Progreso

## Fase 1 — Núcleo ✅ (14/10/2026)

### Hecho
- **Bienvenida en 3 pasos:** clave de Gemini con guía paso a paso, botón *Guardar y probar*, aviso de privacidad y opción de borrarla; importar la guía; subir apuntes; fechas de parciales.
- **Árbol UP → Disciplina → Tema** precargado desde el paquete de contenido (`src/contenido/unr-ser-humano-y-su-medio/`), editable (agregar, renombrar, borrar temas). Vista por unidad y por disciplina ("toda la Fisiología del área").
- **Cada UP** muestra su situación problemática y objetivos **extraídos de la guía importada** (con "Ver en la guía, pág. N"); antes de importarla, un resumen propio.
- **Procesamiento en Web Worker** (no congela la interfaz, barra de progreso, estados en cola / procesando / listo / error con *Reintentar*, se retoma si se cierra la app): texto por página → OCR si es escaneado o foto → fragmentos de ~150–300 palabras → embeddings locales (multilingual-e5-small) → asignación sugerida de unidad, disciplina y tema.
- **Búsqueda híbrida** (MiniSearch + vectorial, fusión RRF) dentro del alcance: todo / UP / disciplina / tema / fuentes elegidas.
- **Chat con citas clicables:** 10 fragmentos numerados → JSON con frase textual → verificación en la app (tolerante a tildes, espacios, cortes de renglón y "…") → superíndices `¹ ²`; vista previa al pasar el mouse o tocar; al tocar, el PDF se abre en la página con la frase **resaltada en amarillo** (hoja desde abajo en el celular, panel lateral en la compu). Citas no verificadas en gris. Aviso "Cifra sin cita verificada". Bloque aparte **"No está en tus apuntes"**. Fuentes usadas debajo; *Guardar como nota*. Modos: Normal, Explicámelo simple, Nivel parcial, Solo puntos clave, Tabla comparativa. Dictado y lectura en voz alta. Conversaciones guardadas y buscables.
- **Visor** de PDF (zoom, navegación, capa de texto seleccionable) con **resaltador de 4 colores y comentarios**; seleccionar texto → *Preguntar · Crear nota · Resaltar*. Visor de imágenes y texto pegado.
- **Notas** en Markdown con vista previa, guardado automático, enlazadas a temas y fragmentos.
- **Búsqueda unificada** sobre fuentes, notas y conversaciones.
- **IA intercambiable** (`ProveedorIA`: Gemini + Groq), contador diario, caché local, tope opcional, mensaje claro al agotarse la cuota.
- **Exportar / importar todo** (.zip con datos, PDFs y embeddings), recordatorio semanal, borrar todo con doble confirmación.
- **Mis estadísticas** (minutos de estudio, preguntas, llamadas a la IA, funciones más usadas) exportables. **Créditos.** Modo oscuro. PWA instalable.
- `README.md`, `DEPLOY.md` (+ workflow de GitHub Pages), `PLAN.md`, `DECISIONES.md`.

### Verificado
- `npm test`: **24 tests** en verde — normalización y verificación de citas, fragmentación, texto por página, búsqueda (RRF, epónimos, guiones), **exportar/importar** con archivos y embeddings.
- `npm run build` sin errores (precaché de 3,4 MB).
- En el navegador, con la **guía real (247 páginas)**: 614 fragmentos (mediana 209 palabras), embeddings y temas asignados (~6 min en una computadora, una sola vez); situaciones y objetivos de las 6 UP extraídos; la pregunta "¿qué factores determinan la tasa de filtrado glomerular?" recupera primero la pág. 42 (contenidos de Fisiología de la UP3); al tocar la cita se abre la pág. 42 con la frase resaltada exactamente, en escritorio y en tamaño celular; una cita inventada se muestra gris; respaldo real de 12,8 MB exporta en 1,1 s e importa en 0,3 s sin pérdidas; OCR de una foto y texto pegado se procesan y se asignan al tema correcto.

### No verificado todavía
- **Llamada real a Gemini:** no había una clave disponible al construir. El flujo se probó con la API simulada (misma forma de respuesta que `generateContent`). Primer paso al recibir la clave: Ajustes → *Guardar y probar*, y hacer la pregunta de ejemplo.
- Instalación como PWA en un celular real y rendimiento de los embeddings en un celular de gama media (se espera 2–3× más lento que en la compu).

### Cómo probarlo
```bash
npm install
npm run dev
```
Abrir http://localhost:5173 → Bienvenida → pegar la clave → importar `material-de-estudio/programa/guia-el-ser-humano-y-su-medio-unr.pdf` → esperar "Listo" → Preguntar.

### Pendiente menor
- El botón *Hacer preguntas* del chat está visible pero deshabilitado hasta la Fase 4.
- La disciplina de un fragmento que mezcla dos secciones toma el último título de la página (ej. la pág. 43 queda en Salud Mental aunque empieza con bibliografía de Fisiología).

## Fase 2 — Retención ✅ (15/10/2026)

### Hecho
- **Tarjetas** básica, cloze (cada hueco es una tarjeta) y **oclusión de imagen** (máscaras dibujadas a mano sobre una foto o sobre una página de la guía capturada desde el visor en alta resolución, 1800 px). Todas editables, suspendibles y borrables; enlazadas al fragmento, la fuente y la página de origen.
- **Generación con IA por lotes** (Flash-Lite, JSON con esquema, una idea por tarjeta, prompt en `src/ia/prompts/tarjetas.ts`) desde:
  - una **UP, disciplina, tema o fuente** ("Hacer tarjetas de la UP3": 30 tarjetas en 2 llamadas);
  - una **selección del visor** (*Crear tarjeta* en la barra de selección);
  - una **respuesta del chat** (*Hacer tarjetas*, usa solo los fragmentos citados).
  **Vista previa** para aceptar, editar o descartar cada una, con "✓ Respaldo verificado" (la frase de respaldo está textual en el fragmento) que abre la página; las que no lo tienen vienen desmarcadas.
- **Repaso FSRS** (`ts-fsrs`): Otra vez / Difícil / Bien / Fácil con el **próximo intervalo en cada botón**, teclas 1–4, espacio para revelar, *Deshacer* (Ctrl+Z), *Ver en la fuente*, *Editar*, *Suspender*. Repaso filtrado por UP o tema. Retención objetivo y nuevas por día en **Ajustes**.
- **"Hoy"**: primero la cola del día (vencidas + nuevas + en aprendizaje), **racha**, **temas flojos** (o, sin datos todavía, UP con material sin tarjetas), cuenta regresiva y el resto.
- **Exportar a Anki `.apkg`** (SQLite armado en el navegador con sql.js; mazo por UP; las oclusiones van con su imagen) y **CSV**; **importar CSV** (con o sin encabezado, `,` `;` o tab).
- Tarjetas en la **búsqueda unificada**, en el **respaldo .zip** (estado FSRS, historial e imágenes) y evento `repaso` en **Mis estadísticas**.
- Botones nuevos: *Hacer tarjetas* / *Repasar* en cada UP, *Tarjetas* por tema y por fuente (Biblioteca); *Tarjetas* en la navegación.

### Verificado
- `npm test`: **46 tests** en verde. Nuevos: scheduling (orden de intervalos, crecimiento, lapsos, efecto de la retención, preview = calificar), cola del día y tope de nuevas, racha, temas flojos, cloze, editar un cloze sin perder FSRS, responder/deshacer, generación con IA simulada (lotes, validación, verificación de la frase, chat), CSV ida y vuelta, `.apkg` abierto con sql.js, y **respaldo con estado FSRS + historial + imagen de oclusión**.
- `npm run build` sin errores.
- En el navegador, con la **guía real** importada: "Hacer tarjetas de la UP3" → 2 llamadas al modelo de lotes → 30 propuestas, 27 con respaldo verificado; descartar/desmarcar y guardar; repaso con teclado (25 nuevas por el tope, intervalos 1 min / 6 min / 10 min / 8 d) y deshacer; selección en la pág. 42 → *Crear tarjeta*; captura de la pág. 24 → oclusión con 3 máscaras → repaso con la máscara destapada; chat → *Hacer tarjetas*; búsqueda; `.apkg` real en el navegador (153 ms, mazo "UP3"); respaldo de 12,3 MB exportado e importado con tarjetas, historial e imagen idénticos. Sin errores en consola.

### Pulido posterior
- Captura de página para oclusión en alta resolución (antes copiaba el canvas visible, ~580 px).
- La selección del visor une renglones y palabras cortadas por guion ("hormo- nales" → "hormonales") para preguntar, notas y tarjetas.
- Propuestas con respaldo sin verificar desmarcadas por defecto.
- Repaso: tarjeta actual como estado derivado (sin saltos ni repeticiones), botones fijos que no tapan la fila de acciones; sin warnings de lint en el código de la Fase 2. Revisado en escritorio y modo oscuro.

### No verificado todavía
- **Gemini real:** igual que en la Fase 1, sin clave: la IA se probó con `generateContent` simulado. La calidad de las tarjetas depende del modelo real; revisar la vista previa la primera vez.
- Importar el `.apkg` en Anki escritorio / AnkiDroid (se verificó la estructura del SQLite, no la importación en Anki).

### Cómo probarlo
UP3 → *Hacer tarjetas de la UP3* → *Generar* → revisar y *Guardar* → **Hoy** → *Repasar* (espacio, 1–4). En el visor: seleccioná texto → *Crear tarjeta*, o el ícono de imagen → oclusión. **Tarjetas** → *Anki (.apkg)* / *CSV* / *Importar CSV*.

## Fase 3 — Atlas 3D ✅ (15/10/2026)

### Hecho
- **Modelos reales de BodyParts3D 4.0** (CC BY 4.0), bajados del sitio oficial y convertidos con `scripts/modelos/convertir.mjs` (OBJ → un `.glb` por escena, una pieza por estructura con su código FMA, meshopt): riñones y vías urinarias superiores (27 estructuras, 0,3 MB), vejiga y uretra (13), fosa lumbar y retroperitoneo (30), periné (14) y vasos de abdomen y pelvis (35). Todas las piezas pedidas existen en BodyParts3D; cada escena pesa 0,1–0,6 MB.
- **Esquemas hechos en código** ("Esquema – no a escala"): riñón por dentro (corte coronal: cápsula, corteza, médula, pirámide, columnas, papilas, cálices menores y mayores, pelvis, seno, hilio, vasos), **nefrona** (arteriolas, glomérulo, Bowman, TCP, asa de Henle, TCD, mácula densa, aparato yuxtaglomerular, colector, vasos rectos, con **partículas del filtrado**) y plexo lumbar y autónomo (6 ramos del plexo lumbar, tronco simpático, plexos celíaco e hipogástrico superior).
- **Holograma ↔ Realista**: shader propio (Fresnel cian, semitransparente, líneas de escaneo, parpadeo, bloom) y colores anatómicos convencionales. Lo elegido brilla y lo demás se atenúa.
- **Navegar**: rotar, zoom y desplazar (mouse y gestos), doble toque centra, vistas anterior/posterior/lateral/superior/inferior.
- **Desarmar** 0–100 % animado (en 0 % vuelve exacto), **mover piezas** sueltas y *Reacomodar*, **capas** por escena, **plano de corte** coronal/sagital/transversal con deslizador, **rótulos** todos/ninguno/el elegido.
- **Ficha** de cada estructura (`src/atlas/estructuras.json`, línea Rouvière): nombre en español y latín, descripción, relaciones (por lado), irrigación, inervación; en la nefrona, qué se reabsorbe y secreta. Aviso "Texto generado, verificá con Rouvière" hasta marcarla revisada o editarla (se guarda en el dispositivo). Muestra los **fragmentos de tus apuntes** que la nombran, con cita clicable. *Preguntarle a mis apuntes* y *Crear tarjeta* (captura la vista y crea una **tarjeta de oclusión** con la máscara sobre la estructura).
- **Uréter con sus 3 estrechamientos** marcados (calculados del modelo: unión pieloureteral, cruce de los vasos ilíacos, unión ureterovesical).
- **Recorridos guiados**: *Camino de la orina* (13 pasos, de la nefrona a la uretra) y *Camino de la sangre renal* (10 pasos, de la aorta a la cava), saltando entre escenas.
- **Armar (rompecabezas)**: las piezas aparecen alrededor, la silueta marca el lugar, encajan con destello; cronómetro, errores y récord personal.
- **Modo Museo**: alfiler sobre una estructura y hay que escribir el nombre (tolera tildes, sinónimos, latín, artículos y un error de tipeo; el lado es opcional pero no puede estar mal). Tanda de 10 cronometrada, puntaje y lista de falladas. **¿Dónde está?**: se nombra y hay que tocarla.
- **FSRS por estructura**: cada respuesta actualiza su estado (las falladas vuelven antes). "Hoy" y el índice del atlas muestran las estructuras para repasar.
- Atlas en el menú, en "Hoy", en cada UP (*… en 3D*) y en cada tema de anatomía (*3D*). Créditos con la atribución por escena (`src/atlas/creditos.json`). Respaldo con el estado del atlas y las fichas editadas. Estadísticas: estructuras practicadas y rompecabezas armados.

### Verificado
- `npm test`: **55 tests** en verde. Nuevos: datos del atlas (cada pieza con ficha, ids consistentes entre escenas, nombres con lado concordado), recorridos válidos, corrección del Modo Museo (tildes, sinónimos, latín, typo, lado equivocado, "renal" no vale para la vena), tanda priorizada por FSRS y efecto de acierto/pista/error, y respaldo con estado del atlas y fichas editadas.
- `npm run build` sin errores; three.js va en un chunk aparte (solo se baja al abrir el atlas) y los `.glb` se guardan para usar sin conexión la primera vez que se abre cada escena.
- En el navegador (escritorio y celular): las 8 escenas cargan; selección con ficha y fragmentos de la guía (págs. 135, 41, 240 para el riñón); realista + capas + desarmar; Modo Museo (respuesta corregida y estado FSRS guardado); ¿Dónde está? (acierto contado); rompecabezas (pieza encajada); recorrido *Camino de la orina* con los 3 estrechamientos rotulados; *Crear tarjeta* creó una oclusión con la captura y la máscara sobre el uréter.

### No verificado todavía
- Rendimiento en un celular de gama media real (en la prueba la app bajó sola la calidad: sin bloom y resolución 1×).
- **Realidad aumentada y pirámide holográfica**: quedan para la Fase 5 (extras), como dice `docs/ATLAS-3D.md`.
- Faltan en BodyParts3D y no se modelaron: cuadrado lumbar, transverso y oblicuo interno del abdomen, dorsal ancho, isquiocavernoso, bulboesponjoso, transversos del periné, uretra femenina y órganos genitales femeninos (el modelo es masculino). Los triángulos lumbares (Petit, Grynfeltt), la fosa isquioanal y la vejiga abierta quedan como esquemas pendientes.

### Cómo probarlo
Más → **Atlas 3D** → *Riñones y vías urinarias superiores*: tocá un riñón (ficha), abrí *Herramientas* (realista, desarmar, capas, corte), probá *Armar*, *Modo Museo* y *¿Dónde está?*. Recorridos: *Camino de la orina*. Para regenerar los modelos: `modelos-3d/LEEME.md`.

## Fase 4 — Simuladores y práctica de parcial
## Fase 5 — Tutoría ABP y extras
Al final: `ESCALAR.md`.
